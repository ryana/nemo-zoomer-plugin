# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Tests for the native NeMo Platform Zoomer plugin."""

import json
from importlib.metadata import entry_points
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from nemo_platform_plugin import interface as plugin_interface
from nemo_platform_plugin.authz_discovery import _derive_service_contribution

from nemo_zoomer_plugin.generation import (
    HierarchyPlan,
    HierarchyPlanNode,
    NormalizedEvent,
    _replace_meta_events,
    materialize_plan,
    normalize_events,
    populate_summary_metrics,
)
from nemo_zoomer_plugin.models import GenerationStatus, SemanticNode
from nemo_zoomer_plugin.service import ZoomerService
from nemo_zoomer_plugin.store import GenerationStore
from nemo_zoomer_plugin.studio import get_studio_spec


class FakeIntakeClient:
    """Complete one deterministic export without making an HTTP request."""

    def export_trace(
        self,
        workspace: str,
        trace_id: str,
        report_progress,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        assert workspace == "default"
        report_progress(25, "spans", "Imported 2 of 2 spans.")
        return (
            {
                "id": trace_id,
                "name": "Research agent",
            },
            [
                {
                    "span_id": "model",
                    "trace_id": trace_id,
                    "kind": "LLM",
                    "name": "openai.responses",
                    "input": json.dumps(
                        {
                            "content": {
                                "input": [
                                    {
                                        "type": "message",
                                        "role": "user",
                                        "content": [
                                            {
                                                "type": "input_text",
                                                "text": "What changed?",
                                            }
                                        ],
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
                                    "content": [
                                        {
                                            "type": "output_text",
                                            "text": "A native plugin view.",
                                        }
                                    ],
                                }
                            ]
                        }
                    ),
                    "total_tokens": 42,
                },
            ],
        )


class FakeHierarchyBuilder:
    """Return a model-shaped hierarchy without making an inference request."""

    def build(self, trace, spans, report_progress) -> SemanticNode:
        report_progress(80, "semantic_inference", "Found one semantic phase.")
        return SemanticNode(
            id=f"trace-{trace['id']}",
            kind="summary",
            title=str(trace["name"]),
            what="The trace answered the user's question.",
            why="The user requested an explanation.",
            result="A native plugin view.",
            span_ids=["model"],
            metrics={"spans": len(spans), "semantic_phases": 1, "total_tokens": 42},
            children=[
                SemanticNode(
                    id="summary-answer",
                    kind="summary",
                    title="Answer the question",
                    what="The agent produced the requested explanation.",
                    why="It completed the user request.",
                    result="A native plugin view.",
                    span_ids=["model"],
                    children=[
                        SemanticNode(
                            id="event-model",
                            kind="model",
                            title="Agent response",
                            what="",
                            result="A native plugin view.",
                            span_ids=["model"],
                        )
                    ],
                )
            ],
        )


def fake_intake_client_factory(_base_url: str) -> FakeIntakeClient:
    return FakeIntakeClient()


def test_studio_spec_registers_zoomer_web_bundle() -> None:
    if not hasattr(plugin_interface, "StudioSpec"):
        with pytest.raises(RuntimeError, match="post-#594"):
            get_studio_spec()
        return

    spec = get_studio_spec()

    assert spec.name == "zoomer"
    assert spec.bundle_path is not None
    assert spec.bundle_path.name == "index.js"
    assert spec.bundle_path.parts[-3:] == ("web", "dist", "index.js")
    assert spec.bundle_path.is_file()


def test_distribution_registers_service_and_studio_entry_points() -> None:
    services = {
        entry.name: entry.value for entry in entry_points(group="nemo.services")
    }
    studio = {entry.name: entry.value for entry in entry_points(group="nemo.studio")}

    assert services["zoomer"] == "nemo_zoomer_plugin.service:ZoomerService"
    assert studio["zoomer"] == "nemo_zoomer_plugin.studio:get_studio_spec"


def test_generation_state_persists_in_sqlite(tmp_path: Path) -> None:
    database_path = tmp_path / "zoomer.sqlite3"
    store = GenerationStore(database_path)
    store.initialize()
    queued, should_schedule = store.queue("default", "trace-1", regenerate=False)

    assert should_schedule is True
    assert queued.status is GenerationStatus.QUEUED

    reloaded = GenerationStore(database_path)
    reloaded.initialize()
    interrupted = reloaded.get("default", "trace-1")

    assert interrupted.status is GenerationStatus.FAILED
    assert interrupted.stage == "interrupted"


def test_generation_endpoint_returns_queued_then_persists_ready_result(
    tmp_path: Path,
) -> None:
    service = ZoomerService(
        database_path=tmp_path / "zoomer.sqlite3",
        intake_client_factory=fake_intake_client_factory,
        hierarchy_builder_factory=FakeHierarchyBuilder,
    )
    service.store.initialize()
    app = FastAPI()
    app.include_router(service.get_routers()[0].router)

    with TestClient(app) as client:
        missing = client.get("/v1/workspaces/default/traces/trace-1")
        submitted = client.post("/v1/workspaces/default/traces/trace-1/generation")
        ready = client.get("/v1/workspaces/default/traces/trace-1")

    assert missing.json()["status"] == "not_started"
    assert submitted.status_code == 202
    assert submitted.json()["status"] == "queued"
    assert ready.json()["status"] == "ready"
    assert ready.json()["progress"] == 100
    assert ready.json()["hierarchy"]["title"] == "Research agent"
    assert ready.json()["hierarchy"]["children"][0]["children"][0]["kind"] == "model"


def test_normalize_events_removes_replayed_request_context() -> None:
    spans = [
        {
            "span_id": "span-1",
            "kind": "LLM",
            "started_at": "2026-01-01T00:00:00Z",
            "input": json.dumps(
                {
                    "content": {
                        "input": [
                            {
                                "type": "message",
                                "role": "user",
                                "content": "Inspect the repo.",
                            }
                        ]
                    }
                }
            ),
            "output": json.dumps(
                {
                    "output": [
                        {
                            "type": "function_call",
                            "call_id": "call-1",
                            "name": "exec_command",
                            "arguments": '{"cmd":"git status"}',
                        }
                    ]
                }
            ),
        },
        {
            "span_id": "span-2",
            "kind": "LLM",
            "started_at": "2026-01-01T00:00:01Z",
            "input": json.dumps(
                {
                    "content": {
                        "input": [
                            {
                                "type": "message",
                                "role": "user",
                                "content": "Inspect the repo.",
                            },
                            {
                                "type": "function_call_output",
                                "call_id": "call-1",
                                "output": "working tree clean",
                            },
                        ]
                    }
                }
            ),
            "output": json.dumps(
                {
                    "output": [
                        {
                            "type": "message",
                            "content": "The working tree is clean.",
                        }
                    ]
                }
            ),
        },
    ]

    events = normalize_events(spans)

    assert [event.title for event in events] == [
        "User request",
        "Call exec_command",
        "Result from exec_command",
        "Agent response",
    ]
    assert events[2].parent_event_id == "tool-call-call-1"


def test_populate_summary_metrics_aggregates_each_collapsible_section() -> None:
    hierarchy = SemanticNode(
        id="trace-1",
        kind="summary",
        title="Trace",
        what="The complete trace.",
        span_ids=["span-1", "span-2"],
        children=[
            SemanticNode(
                id="summary-1",
                kind="summary",
                title="First phase",
                what="The first phase.",
                span_ids=["span-1"],
                children=[
                    SemanticNode(
                        id="event-one",
                        kind="tool",
                        title="First event",
                        what="",
                        span_ids=["span-1"],
                    ),
                    SemanticNode(
                        id="event-two",
                        kind="model",
                        title="Second event",
                        what="",
                        span_ids=["span-1"],
                    ),
                ],
            ),
            SemanticNode(
                id="event-three",
                kind="model",
                title="Third event",
                what="",
                span_ids=["span-2"],
            ),
        ],
    )

    populate_summary_metrics(
        hierarchy,
        [
            {"span_id": "span-1", "total_tokens": 40},
            {"span_id": "span-2", "total_tokens": 60},
        ],
    )

    assert hierarchy.metrics == {"spans": 2, "events": 3, "total_tokens": 100}
    assert hierarchy.children[0].metrics == {
        "spans": 1,
        "events": 2,
        "total_tokens": 40,
    }
    assert hierarchy.children[0].children[0].metrics == {}


def test_replace_meta_events_removes_single_segment_wrappers() -> None:
    first_segment = HierarchyPlanNode(
        title="First segment",
        what="First segment work.",
        why="The task started.",
        result="First segment result.",
        event_ids=["event-1"],
    )
    second_segment = HierarchyPlanNode(
        title="Second segment",
        what="Second segment work.",
        why="The task continued.",
        result="Second segment result.",
        event_ids=["event-2"],
    )
    meta_root = HierarchyPlanNode(
        title="Complete task",
        what="The complete task.",
        why="The user requested it.",
        result="The task completed.",
        children=[
            HierarchyPlanNode(
                title="First phase wrapper",
                what="The first phase.",
                why="The task started.",
                result="First segment result.",
                event_ids=["semantic-segment-1"],
            ),
            HierarchyPlanNode(
                title="Second phase wrapper",
                what="The second phase.",
                why="The task continued.",
                result="Second segment result.",
                event_ids=["semantic-segment-2"],
            ),
        ],
    )

    merged = _replace_meta_events(
        meta_root,
        {
            "semantic-segment-1": first_segment,
            "semantic-segment-2": second_segment,
        },
    )

    assert merged.title == "Complete task"
    assert [child.title for child in merged.children] == [
        "First phase wrapper",
        "Second phase wrapper",
    ]
    assert merged.children[0].event_ids == first_segment.event_ids
    assert merged.children[0].children == first_segment.children
    assert merged.children[1].event_ids == second_segment.event_ids
    assert merged.children[1].children == second_segment.children


def test_replace_meta_events_keeps_real_multi_segment_group() -> None:
    first_segment = HierarchyPlanNode(
        title="First segment",
        what="First segment work.",
        why="The task started.",
        result="First segment result.",
        event_ids=["event-1"],
    )
    second_segment = HierarchyPlanNode(
        title="Second segment",
        what="Second segment work.",
        why="The task continued.",
        result="Second segment result.",
        event_ids=["event-2"],
    )
    meta_group = HierarchyPlanNode(
        title="Combined phase",
        what="Two related segments.",
        why="They share one purpose.",
        result="Both segments completed.",
        event_ids=["semantic-segment-1", "semantic-segment-2"],
    )

    merged = _replace_meta_events(
        meta_group,
        {
            "semantic-segment-1": first_segment,
            "semantic-segment-2": second_segment,
        },
    )

    assert merged.title == "Combined phase"
    assert merged.event_ids == []
    assert merged.children == [first_segment, second_segment]


def test_materialize_plan_assigns_unique_preorder_summary_ids() -> None:
    events = [
        NormalizedEvent(
            id=f"event-{index}",
            sequence=index - 1,
            step_id=index,
            span_id=f"span-{index}",
            kind="agent_message",
            title=f"Event {index}",
            content=f"Result {index}",
        )
        for index in range(1, 3)
    ]
    plan = HierarchyPlan(
        root=HierarchyPlanNode(
            title="Root",
            what="The complete task.",
            why="The user requested it.",
            result="The task completed.",
            children=[
                HierarchyPlanNode(
                    title=f"Phase {index}",
                    what=f"Phase {index} work.",
                    why="It was required.",
                    result=f"Result {index}.",
                    event_ids=[f"event-{index}"],
                )
                for index in range(1, 3)
            ],
        )
    )

    hierarchy = materialize_plan(plan, events)
    summary_ids = [
        hierarchy.id,
        *(child.id for child in hierarchy.children if child.kind == "summary"),
    ]

    assert summary_ids == ["summary-1", "summary-2", "summary-3"]
    assert len(summary_ids) == len(set(summary_ids))


def test_service_routes_have_platform_authorization_rules(tmp_path: Path) -> None:
    service = ZoomerService(database_path=tmp_path / "zoomer.sqlite3")
    _, problems, _ = _derive_service_contribution(service)
    _, repeated_problems, _ = _derive_service_contribution(service)

    assert problems == []
    assert repeated_problems == []
