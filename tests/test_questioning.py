# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Tests for grounded, ephemeral Zoomer trace questions."""

import json
from collections.abc import AsyncIterator, Mapping, Sequence
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from nemo_zoomer_plugin.generation import NormalizedEvent
from nemo_zoomer_plugin.models import SemanticNode
from nemo_zoomer_plugin.questioning import PreparedQuestion, TraceEvidence
from nemo_zoomer_plugin.service import ZoomerService


def _events() -> list[NormalizedEvent]:
    return [
        NormalizedEvent(
            id="span-1-input-1",
            sequence=0,
            step_id=1,
            span_id="span-1",
            kind="user_message",
            title="User request",
            content="Build a native plugin view for this trace.",
        ),
        NormalizedEvent(
            id="span-1-message-1",
            sequence=1,
            step_id=1,
            span_id="span-1",
            kind="agent_message",
            title="Agent response",
            content="The native plugin view is ready and grounded in trace evidence.",
        ),
    ]


def _hierarchy() -> SemanticNode:
    return SemanticNode(
        id="trace-trace-1",
        kind="summary",
        title="Research agent",
        what="The agent built a trace view.",
        why="The user requested a native plugin.",
        result="The view is ready.",
        span_ids=["span-1"],
        metrics={"spans": 1, "events": 2},
        children=[
            SemanticNode(
                id="summary-build",
                kind="summary",
                title="Build the plugin",
                what="The agent implemented the plugin view.",
                why="It was the requested deliverable.",
                result="The implementation completed.",
                span_ids=["span-1"],
                children=[
                    SemanticNode(
                        id="event-span-1-input-1",
                        kind="event",
                        title="User request",
                        what="",
                        result="Build a native plugin view for this trace.",
                        span_ids=["span-1"],
                    ),
                    SemanticNode(
                        id="event-span-1-message-1",
                        kind="model",
                        title="Agent response",
                        what="",
                        result="The native plugin view is ready.",
                        span_ids=["span-1"],
                    ),
                ],
            )
        ],
    )


class FakeQuestionIntakeClient:
    """Return the complete raw evidence represented by the hierarchy fixture."""

    def export_trace(
        self,
        workspace: str,
        trace_id: str,
        report_progress,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        assert workspace == "default"
        report_progress(50, "spans", "Imported one span.")
        return (
            {"id": trace_id, "name": "Research agent"},
            [
                {
                    "span_id": "span-1",
                    "trace_id": trace_id,
                    "kind": "LLM",
                    "started_at": "2026-01-01T00:00:00Z",
                    "input": json.dumps(
                        {
                            "content": {
                                "input": [
                                    {
                                        "type": "message",
                                        "role": "user",
                                        "content": "Build a native plugin view for this trace.",
                                    }
                                ]
                            }
                        }
                    ),
                    "output": json.dumps(
                        {
                            "output": [
                                {
                                    "type": "message",
                                    "content": (
                                        "The native plugin view is ready and grounded in trace evidence."
                                    ),
                                }
                            ]
                        }
                    ),
                }
            ],
        )


def fake_question_intake_client_factory(_base_url: str) -> FakeQuestionIntakeClient:
    return FakeQuestionIntakeClient()


class FakePreparedQuestion:
    """Emit deterministic chunks and server-generated citations."""

    def __init__(self, evidence: TraceEvidence, focus_node_id: str) -> None:
        self.evidence = evidence
        self.focus_node_id = focus_node_id

    async def stream(self) -> AsyncIterator[str]:
        yield "The section built "
        yield "the native plugin view."
        yield self.evidence.citation_markdown([self.focus_node_id])


class FakeQuestionAnswerer:
    """Capture the prepared context without external inference."""

    def __init__(self) -> None:
        self.focus_node_ids: list[str] = []
        self.conversations: list[Sequence[Mapping[str, str]]] = []

    async def prepare(
        self,
        evidence: TraceEvidence,
        focus_node_id: str,
        conversation: Sequence[Mapping[str, str]],
    ) -> PreparedQuestion:
        self.focus_node_ids.append(focus_node_id)
        self.conversations.append(conversation)
        return FakePreparedQuestion(evidence, focus_node_id)


def _ready_service(tmp_path: Path, answerer: FakeQuestionAnswerer) -> ZoomerService:
    service = ZoomerService(
        database_path=tmp_path / "zoomer.sqlite3",
        intake_client_factory=fake_question_intake_client_factory,
        question_answerer_factory=lambda: answerer,
    )
    service.store.initialize()
    service.store.queue("default", "trace-1", regenerate=False)
    service.store.complete(
        "default",
        "trace-1",
        trace_name="Research agent",
        hierarchy=_hierarchy(),
    )
    return service


def test_trace_evidence_supports_global_and_scoped_read_only_inspection() -> None:
    evidence = TraceEvidence(_hierarchy(), _events())

    assert "trace-trace-1 [summary] Research agent" in evidence.outline()
    assert "event-span-1-message-1 [model] Agent response" in evidence.outline()

    focus = json.loads(evidence.get_node("summary-build").content)
    assert focus["breadcrumb"] == ["Research agent", "Build the plugin"]
    assert [child["id"] for child in focus["children"]] == [
        "event-span-1-input-1",
        "event-span-1-message-1",
    ]

    search = evidence.search_trace("grounded evidence", node_id=None, max_results=5)
    matches = json.loads(search.content)
    assert [match["node_id"] for match in matches] == ["event-span-1-message-1"]
    assert search.source_ids == ("event-span-1-message-1",)

    scoped = evidence.search_trace(
        "native plugin",
        node_id="event-span-1-input-1",
        max_results=5,
    )
    assert json.loads(scoped.content)[0]["node_id"] == "event-span-1-input-1"

    event_page = json.loads(
        evidence.get_event("event-span-1-message-1", offset=4, limit=12).content
    )
    assert event_page["content"] == "native plugi"
    assert event_page["next_offset"] == 16


def test_invalid_tool_arguments_fail_inside_the_read_only_boundary() -> None:
    evidence = TraceEvidence(_hierarchy(), _events())

    result = evidence.execute_tool("get_event", '{"event_node_id":"outside-trace"}')

    assert "was not found" in json.loads(result.content)["error"]
    assert result.source_ids == ()


def test_question_endpoint_streams_openai_chunks_and_validated_sources(
    tmp_path: Path,
) -> None:
    answerer = FakeQuestionAnswerer()
    service = _ready_service(tmp_path, answerer)
    app = FastAPI()
    app.include_router(service.get_routers()[0].router)

    with TestClient(app) as client:
        response = client.post(
            "/v1/workspaces/default/traces/trace-1/nodes/summary-build/-/v1/chat/completions",
            json={
                "model": "client-value-is-ignored",
                "messages": [{"role": "user", "content": "What happened here?"}],
                "stream": True,
                "temperature": 1,
            },
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"role": "assistant"' in response.text
    assert "The section built " in response.text
    assert "the native plugin view." in response.text
    assert "#zoomer-node=summary-build" in response.text
    assert '"finish_reason": "stop"' in response.text
    assert response.text.rstrip().endswith("data: [DONE]")
    assert answerer.focus_node_ids == ["summary-build"]
    assert answerer.conversations == [
        [{"role": "user", "content": "What happened here?"}]
    ]


def test_question_endpoint_requires_ready_hierarchy_and_known_node(
    tmp_path: Path,
) -> None:
    answerer = FakeQuestionAnswerer()
    service = ZoomerService(
        database_path=tmp_path / "zoomer.sqlite3",
        intake_client_factory=fake_question_intake_client_factory,
        question_answerer_factory=lambda: answerer,
    )
    service.store.initialize()
    app = FastAPI()
    app.include_router(service.get_routers()[0].router)
    request_body = {
        "model": "zoomer-context",
        "messages": [{"role": "user", "content": "What happened?"}],
        "stream": True,
    }

    with TestClient(app) as client:
        not_ready = client.post(
            "/v1/workspaces/default/traces/trace-1/nodes/summary-build/-/v1/chat/completions",
            json=request_body,
        )
        service.store.queue("default", "trace-1", regenerate=False)
        service.store.complete(
            "default",
            "trace-1",
            trace_name="Research agent",
            hierarchy=_hierarchy(),
        )
        unknown_node = client.post(
            "/v1/workspaces/default/traces/trace-1/nodes/outside-trace/-/v1/chat/completions",
            json=request_body,
        )

    assert not_ready.status_code == 409
    assert unknown_node.status_code == 404


def test_question_endpoint_rejects_non_user_final_message(tmp_path: Path) -> None:
    answerer = FakeQuestionAnswerer()
    service = _ready_service(tmp_path, answerer)
    app = FastAPI()
    app.include_router(service.get_routers()[0].router)

    with TestClient(app) as client:
        response = client.post(
            "/v1/workspaces/default/traces/trace-1/nodes/summary-build/-/v1/chat/completions",
            json={
                "model": "zoomer-context",
                "messages": [{"role": "assistant", "content": "No user question."}],
                "stream": True,
            },
        )

    assert response.status_code == 422
    assert answerer.focus_node_ids == []
