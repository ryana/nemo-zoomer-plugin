# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Native NeMo Platform service for Zoomer trace generation."""

import asyncio
import json
import logging
import os
import time
import uuid
from collections.abc import AsyncIterator, Callable
from pathlib import Path
from typing import ClassVar

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from fastapi.routing import APIRoute
from nemo_platform_plugin.authz import CallerKind, get_path_rules, path_rule
from nemo_platform_plugin.service import NemoService, RouterSpec

from nemo_zoomer_plugin.generation import (
    HierarchyBuilder,
    InferenceHierarchyBuilder,
    IntakeClient,
    IntakeExporter,
    build_hierarchy,
)
from nemo_zoomer_plugin.models import GenerationStatus, TraceGeneration
from nemo_zoomer_plugin.questioning import (
    InferenceQuestionAnswerer,
    QuestionAnswererFactory,
    QuestionConfigurationError,
    QuestionCoordinator,
    QuestionEvidenceError,
    QuestionInferenceError,
    QuestionNodeNotFoundError,
    QuestionRequest,
)
from nemo_zoomer_plugin.store import GenerationStore

logger = logging.getLogger(__name__)
IntakeClientFactory = Callable[[str], IntakeExporter]
HierarchyBuilderFactory = Callable[[], HierarchyBuilder]


def _database_path() -> Path:
    configured = os.environ.get("NMP_ZOOMER_DATABASE")
    if configured:
        return Path(configured).expanduser().resolve()
    data_dir = Path(os.environ.get("NMP_DATA_DIR", Path.cwd() / "tmp"))
    return data_dir.expanduser().resolve() / "zoomer" / "generations.sqlite3"


def _intake_base_url() -> str:
    platform_base_url = os.environ.get("NMP_BASE_URL", "http://localhost:8080")
    return f"{platform_base_url.rstrip('/')}/apis/intake"


def _authorize_principals(router: APIRouter) -> APIRouter:
    """Declare platform policy for every Zoomer route."""

    for route in router.routes:
        if isinstance(route, APIRoute) and not get_path_rules(route.endpoint):
            path_rule(callers=[CallerKind.PRINCIPAL], permissions=[])(route.endpoint)
    return router


def _completion_chunk(
    *,
    completion_id: str,
    created: int,
    delta: dict[str, str],
    finish_reason: str | None = None,
) -> str:
    payload = {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": "zoomer-context",
        "choices": [
            {
                "index": 0,
                "delta": delta,
                "finish_reason": finish_reason,
            }
        ],
    }
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


class ZoomerService(NemoService):
    """Generate and persist Studio-native semantic trace hierarchies."""

    name: ClassVar[str] = "zoomer"
    dependencies: ClassVar[list[str]] = ["intake"]

    def __init__(
        self,
        *,
        database_path: Path | None = None,
        intake_client_factory: IntakeClientFactory = IntakeClient,
        hierarchy_builder_factory: HierarchyBuilderFactory = (
            InferenceHierarchyBuilder.from_environment
        ),
        question_answerer_factory: QuestionAnswererFactory = (
            InferenceQuestionAnswerer.from_environment
        ),
    ) -> None:
        self.store = GenerationStore(database_path or _database_path())
        self.intake_client_factory = intake_client_factory
        self.hierarchy_builder_factory = hierarchy_builder_factory
        self.question_coordinator = QuestionCoordinator(
            intake_base_url=_intake_base_url(),
            intake_client_factory=intake_client_factory,
            answerer_factory=question_answerer_factory,
        )

    def get_routers(self) -> list[RouterSpec]:
        router = APIRouter(prefix="/v1")

        @router.get(
            "/workspaces/{workspace}/traces/{trace_id}",
            response_model=TraceGeneration,
        )
        def get_generation(workspace: str, trace_id: str) -> TraceGeneration:
            return self.store.get(workspace, trace_id)

        @router.post(
            "/workspaces/{workspace}/traces/{trace_id}/generation",
            response_model=TraceGeneration,
            status_code=status.HTTP_202_ACCEPTED,
        )
        def generate(
            workspace: str,
            trace_id: str,
            background_tasks: BackgroundTasks,
            regenerate: bool = Query(default=False),
        ) -> TraceGeneration:
            generation, should_schedule = self.store.queue(
                workspace,
                trace_id,
                regenerate=regenerate,
            )
            if should_schedule:
                background_tasks.add_task(self._generate, workspace, trace_id)
            return generation

        @router.post(
            "/workspaces/{workspace}/traces/{trace_id}/nodes/{node_id}/-/v1/chat/completions",
            response_class=StreamingResponse,
        )
        async def ask_question(
            workspace: str,
            trace_id: str,
            node_id: str,
            body: QuestionRequest,
            request: Request,
        ) -> StreamingResponse:
            generation = self.store.get(workspace, trace_id)
            if (
                generation.status is not GenerationStatus.READY
                or generation.hierarchy is None
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Generate the Zoomer hierarchy before asking questions.",
                )
            try:
                prepared = await self.question_coordinator.prepare(
                    workspace=workspace,
                    trace_id=trace_id,
                    focus_node_id=node_id,
                    hierarchy=generation.hierarchy,
                    conversation=body.conversation(),
                )
            except QuestionNodeNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=str(exc),
                ) from exc
            except QuestionConfigurationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=str(exc),
                ) from exc
            except (QuestionEvidenceError, QuestionInferenceError) as exc:
                logger.exception(
                    "Zoomer question preparation failed for workspace=%s trace=%s node=%s",
                    workspace,
                    trace_id,
                    node_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Zoomer could not inspect the trace for this question.",
                ) from exc

            completion_id = f"chatcmpl-zoomer-{uuid.uuid4().hex}"
            created = int(time.time())

            async def event_stream() -> AsyncIterator[str]:
                try:
                    yield _completion_chunk(
                        completion_id=completion_id,
                        created=created,
                        delta={"role": "assistant"},
                    )
                    async for content in prepared.stream():
                        if await request.is_disconnected():
                            return
                        yield _completion_chunk(
                            completion_id=completion_id,
                            created=created,
                            delta={"content": content},
                        )
                    yield _completion_chunk(
                        completion_id=completion_id,
                        created=created,
                        delta={},
                        finish_reason="stop",
                    )
                    yield "data: [DONE]\n\n"
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception(
                        "Zoomer answer stream failed for workspace=%s trace=%s node=%s",
                        workspace,
                        trace_id,
                        node_id,
                    )
                    raise

            return StreamingResponse(
                event_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                },
            )

        @router.get("/health")
        def health() -> dict[str, str]:
            return {"status": "ok"}

        return [
            RouterSpec(
                _authorize_principals(router),
                tag="Zoomer",
                description="Persistent semantic hierarchy generation for Intake traces.",
            )
        ]

    async def on_startup(self) -> None:
        self.store.initialize()

    def _generate(self, workspace: str, trace_id: str) -> None:
        """Run export and hierarchy work after the initiating response returns."""

        def report_progress(progress: int, stage: str, message: str) -> None:
            self.store.update_progress(
                workspace,
                trace_id,
                progress=progress,
                stage=stage,
                message=message,
            )

        try:
            client = self.intake_client_factory(_intake_base_url())
            trace, spans = client.export_trace(workspace, trace_id, report_progress)
            trace_name = str(trace.get("name") or "Agent trace")
            self.store.update_progress(
                workspace,
                trace_id,
                progress=52,
                stage="analyzing",
                message="Converting telemetry into semantic phases.",
                trace_name=trace_name,
            )
            hierarchy = build_hierarchy(
                trace,
                spans,
                report_progress,
                builder=self.hierarchy_builder_factory(),
            )
            self.store.complete(
                workspace,
                trace_id,
                trace_name=trace_name,
                hierarchy=hierarchy,
            )
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
            logger.exception(
                "Zoomer generation failed for workspace=%s trace=%s",
                workspace,
                trace_id,
            )
            self.store.fail(workspace, trace_id, error)
