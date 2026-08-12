# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Intake export and semantic hierarchy generation."""

import json
import os
from collections import Counter
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
from pydantic import BaseModel, Field, ValidationError, model_validator

from nemo_zoomer_plugin.models import SemanticNode

ProgressCallback = Callable[[int, str, str], None]


class IntakeExporter(Protocol):
    """Trace-export boundary used by the generation service."""

    def export_trace(
        self,
        workspace: str,
        trace_id: str,
        report_progress: ProgressCallback,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]: ...


class IntakeExportError(RuntimeError):
    """Raised when Intake cannot provide a complete trace export."""


class IntakeClient:
    """Read one complete trace from the local NeMo Intake service."""

    def __init__(self, base_url: str, *, timeout_seconds: float = 60) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def export_trace(
        self,
        workspace: str,
        trace_id: str,
        report_progress: ProgressCallback,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        workspace_url = f"{self.base_url}/v2/workspaces/{workspace}"
        with httpx.Client(timeout=self.timeout_seconds, trust_env=False) as client:
            report_progress(8, "trace", "Reading trace metadata from Intake.")
            trace = self._get_object(
                client,
                f"{workspace_url}/traces/{trace_id}",
                params={"mode": "detailed"},
                resource="trace",
            )
            if str(trace.get("id") or "") != trace_id:
                raise IntakeExportError(
                    "Intake returned metadata for a different trace."
                )

            spans: list[dict[str, Any]] = []
            page = 1
            total_pages = 1
            expected_total: int | None = None
            while page <= total_pages:
                payload = self._get_object(
                    client,
                    f"{workspace_url}/spans",
                    params={
                        "filter[trace_id]": trace_id,
                        "mode": "detailed",
                        "page": page,
                        "page_size": 250,
                        "sort": "started_at",
                    },
                    resource="span list",
                )
                items, pagination = self._page(payload)
                try:
                    page_total = int(pagination["total_results"])
                    page_count = int(pagination["total_pages"])
                except (KeyError, TypeError, ValueError) as exc:
                    raise IntakeExportError(
                        "Intake span pagination metadata is invalid."
                    ) from exc
                if expected_total is None:
                    expected_total = page_total
                    total_pages = max(1, page_count)
                elif expected_total != page_total or total_pages != page_count:
                    raise IntakeExportError(
                        "Intake span pagination changed during generation."
                    )
                if any(str(item.get("trace_id") or "") != trace_id for item in items):
                    raise IntakeExportError(
                        "Intake returned spans from a different trace."
                    )
                spans.extend(items)
                progress = 12 + round(38 * page / total_pages)
                report_progress(
                    progress,
                    "spans",
                    f"Imported {len(spans):,} of {page_total:,} spans.",
                )
                page += 1

        if expected_total is None or len(spans) != expected_total:
            raise IntakeExportError(
                f"Incomplete Intake export: received {len(spans)} of {expected_total} spans."
            )
        if not spans:
            raise IntakeExportError("The Intake trace does not contain any spans.")
        return trace, spans

    @staticmethod
    def _get_object(
        client: httpx.Client,
        url: str,
        *,
        params: dict[str, str | int],
        resource: str,
    ) -> dict[str, Any]:
        try:
            response = client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500]
            raise IntakeExportError(
                f"Intake returned HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise IntakeExportError(f"Could not read Intake {resource}: {exc}") from exc
        if not isinstance(payload, dict):
            raise IntakeExportError(f"Intake {resource} response is not an object.")
        return payload

    @staticmethod
    def _page(
        payload: Mapping[str, Any],
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        data = payload.get("data")
        pagination = payload.get("pagination")
        if not isinstance(data, list) or not all(
            isinstance(item, dict) for item in data
        ):
            raise IntakeExportError(
                "Intake span list does not contain an object data list."
            )
        if not isinstance(pagination, dict):
            raise IntakeExportError("Intake span list has no pagination metadata.")
        return data, pagination


class SemanticGenerationError(RuntimeError):
    """Raised when a model cannot produce a valid semantic hierarchy."""


@dataclass(frozen=True)
class NormalizedEvent:
    """One chronological unit sent to semantic hierarchy inference."""

    id: str
    sequence: int
    step_id: int
    span_id: str
    kind: str
    title: str
    content: str
    parent_event_id: str | None = None
    tool_name: str | None = None


class HierarchyPlanNode(BaseModel):
    """Recursive model response before raw events are materialized."""

    title: str = Field(min_length=1, max_length=120)
    what: str = Field(min_length=1)
    why: str = Field(min_length=1)
    result: str = Field(min_length=1)
    problems: list[str] = Field(default_factory=list)
    event_ids: list[str] = Field(default_factory=list)
    children: list["HierarchyPlanNode"] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_content(self) -> "HierarchyPlanNode":
        if not self.event_ids and not self.children:
            raise ValueError("hierarchy nodes must contain event_ids or children")
        return self


class HierarchyPlan(BaseModel):
    """Top-level structured response from hierarchy inference."""

    root: HierarchyPlanNode


class HierarchyBuilder(Protocol):
    """Semantic generation boundary used by the service and tests."""

    def build(
        self,
        trace: Mapping[str, Any],
        spans: list[dict[str, Any]],
        report_progress: ProgressCallback,
    ) -> SemanticNode: ...


def _json_value(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _text(value: Any) -> str:
    value = _json_value(value)
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        rendered = [_text(item) for item in value]
        return "\n".join(item for item in rendered if item)
    if isinstance(value, Mapping):
        for key in ("text", "output_text", "input_text", "content", "output"):
            if key in value and (rendered := _text(value[key])):
                return rendered
        return json.dumps(value, ensure_ascii=False, indent=2, default=str)
    return str(value)


def _request_content(span: Mapping[str, Any]) -> Mapping[str, Any]:
    envelope = _mapping(_json_value(span.get("input")))
    content = envelope.get("content")
    if isinstance(content, Mapping):
        return content
    if isinstance(envelope.get("messages"), list):
        return envelope
    return {}


def _request_items(span: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    request = _request_content(span)
    items = request.get("input")
    if items is None:
        items = request.get("messages")
    if items is None:
        return []
    if not isinstance(items, list) or not all(
        isinstance(item, Mapping) for item in items
    ):
        raise SemanticGenerationError(
            f"Intake LLM span {span.get('span_id')!r} contains invalid request items."
        )
    return [item for item in items if isinstance(item, Mapping)]


def _response_payload(span: Mapping[str, Any]) -> Mapping[str, Any]:
    output = _json_value(span.get("output"))
    if isinstance(output, Mapping):
        return output
    raise SemanticGenerationError(
        f"Intake LLM span {span.get('span_id')!r} contains an unsupported response."
    )


def _response_items(span: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    response = _response_payload(span)
    output = response.get("output")
    if not isinstance(output, list) or not all(
        isinstance(item, Mapping) for item in output
    ):
        raise SemanticGenerationError(
            f"Intake LLM span {span.get('span_id')!r} contains invalid response items."
        )
    return [item for item in output if isinstance(item, Mapping)]


def _reasoning_text(item: Mapping[str, Any]) -> str:
    return _text(item.get("summary")) or _text(item.get("content"))


def _reasoning_tokens(span: Mapping[str, Any]) -> int | None:
    usage = _mapping(_response_payload(span).get("usage"))
    details = _mapping(usage.get("output_tokens_details"))
    value = details.get("reasoning_tokens")
    return int(value) if isinstance(value, int | float) else None


def normalize_events(spans: list[dict[str, Any]]) -> list[NormalizedEvent]:
    """Turn repeated LLM request snapshots into one exact chronological event stream."""

    llm_spans = sorted(
        (span for span in spans if str(span.get("kind") or "").upper() == "LLM"),
        key=lambda span: str(span.get("started_at") or ""),
    )
    if not llm_spans:
        raise SemanticGenerationError(
            "The Intake trace does not contain any LLM spans."
        )

    events: list[NormalizedEvent] = []
    emitted_tool_calls: set[str] = set()
    emitted_tool_results: set[str] = set()
    tool_names: dict[str, str] = {}

    def add_event(
        *,
        event_id: str,
        step_id: int,
        span_id: str,
        kind: str,
        title: str,
        content: str,
        parent_event_id: str | None = None,
        tool_name: str | None = None,
    ) -> None:
        events.append(
            NormalizedEvent(
                id=event_id,
                sequence=len(events),
                step_id=step_id,
                span_id=span_id,
                kind=kind,
                title=title,
                content=content,
                parent_event_id=parent_event_id,
                tool_name=tool_name,
            )
        )

    first_span = llm_spans[0]
    first_span_id = str(first_span.get("span_id") or "llm-1")
    instructions = _text(_request_content(first_span).get("instructions"))
    if instructions:
        add_event(
            event_id=f"{first_span_id}-instructions",
            step_id=1,
            span_id=first_span_id,
            kind="system_message",
            title="Agent instructions",
            content=instructions,
        )
    for index, item in enumerate(_request_items(first_span), start=1):
        item_type = str(item.get("type") or "")
        role = str(item.get("role") or "user")
        if item_type != "message" and ("type" in item or "role" not in item):
            continue
        if role not in {"system", "developer", "user"}:
            continue
        content = _text(item.get("content"))
        if not content:
            continue
        add_event(
            event_id=f"{first_span_id}-input-{index}",
            step_id=1,
            span_id=first_span_id,
            kind="user_message" if role == "user" else "system_message",
            title="User request" if role == "user" else f"{role.title()} instructions",
            content=content,
        )

    for step_id, span in enumerate(llm_spans, start=1):
        span_id = str(span.get("span_id") or f"llm-{step_id}")
        for item in _request_items(span):
            item_type = str(item.get("type") or "")
            role = str(item.get("role") or "")
            if item_type != "function_call_output" and role != "tool":
                continue
            call_id = str(item.get("call_id") or item.get("tool_call_id") or "")
            if not call_id or call_id in emitted_tool_results:
                continue
            emitted_tool_results.add(call_id)
            tool_name = str(item.get("name") or tool_names.get(call_id) or "tool")
            add_event(
                event_id=f"tool-result-{call_id}",
                step_id=step_id,
                span_id=span_id,
                kind="tool_result",
                title=f"Result from {tool_name}",
                content=_text(
                    item.get("output")
                    if item_type == "function_call_output"
                    else item.get("content")
                ),
                parent_event_id=(
                    f"tool-call-{call_id}" if call_id in emitted_tool_calls else None
                ),
                tool_name=tool_name,
            )

        reasoning_tokens = _reasoning_tokens(span)
        for item_index, item in enumerate(_response_items(span), start=1):
            item_type = str(item.get("type") or "")
            if item_type == "reasoning":
                content = _reasoning_text(item)
                if not content and not reasoning_tokens:
                    continue
                add_event(
                    event_id=f"{span_id}-reasoning-{item_index}",
                    step_id=step_id,
                    span_id=span_id,
                    kind="reasoning",
                    title="Visible reasoning" if content else "Reasoning usage",
                    content=content
                    or (
                        f"The model used {reasoning_tokens} reasoning tokens. "
                        "Reasoning content was not exported by Intake."
                    ),
                )
            elif item_type == "message":
                content = _text(item.get("content"))
                if content:
                    add_event(
                        event_id=f"{span_id}-message-{item_index}",
                        step_id=step_id,
                        span_id=span_id,
                        kind="agent_message",
                        title="Agent response",
                        content=content,
                    )
            elif item_type == "function_call":
                call_id = str(
                    item.get("call_id") or item.get("id") or f"{span_id}-{item_index}"
                )
                if call_id in emitted_tool_calls:
                    continue
                emitted_tool_calls.add(call_id)
                tool_name = str(item.get("name") or "tool")
                tool_names[call_id] = tool_name
                add_event(
                    event_id=f"tool-call-{call_id}",
                    step_id=step_id,
                    span_id=span_id,
                    kind="tool_call",
                    title=f"Call {tool_name}",
                    content=_text(item.get("arguments")),
                    tool_name=tool_name,
                )
    return events


SYSTEM_PROMPT = """You are the semantic hierarchy engine for Zoomer, an agent trace viewer.

Build a truthful tree that lets a reader zoom between a complete agent run and its raw events.
Group by meaning and intent, not by equal-sized chunks. Different branches may have different
depths. Preserve failed attempts, recoveries, and parallel tool work. Never claim access to hidden
reasoning: only summarize reasoning explicitly present in an event.

Return one JSON object matching this recursive shape exactly:
{
  "root": {
    "title": "short activity label",
    "what": "what happened",
    "why": "why the agent did it, grounded in visible evidence",
    "result": "the outcome",
    "problems": ["material setback or uncertainty, or empty if none"],
    "event_ids": ["direct raw event IDs, if any"],
    "children": ["more nodes with this exact shape"]
  }
}

Every supplied event ID must occur exactly once in event_ids somewhere in the tree. Do not invent
IDs. A node must contain event_ids, children, or both. Keep children and direct events in source
chronology. Every node and all of its descendants must cover one contiguous range of the supplied
event sequence. The root counts as level 1. Use no more than the requested number of summary
levels.

Use problems only for material failures, uncertainty, or setbacks that affected the user-visible
outcome. A supplied trace segment ending while work is still in progress is normal continuation,
not a problem. Do not expose executor session IDs or other internal bookkeeping unless they
materially explain the outcome. If a setback was resolved within the supplied events, say what
failed and how the agent recovered rather than presenting it as unresolved.

Output JSON only, with no code fence or commentary."""


def _walk_plan(
    node: HierarchyPlanNode,
    depth: int = 1,
) -> Iterable[tuple[HierarchyPlanNode, int]]:
    yield node, depth
    for child in node.children:
        yield from _walk_plan(child, depth + 1)


def _plan_event_ids(node: HierarchyPlanNode) -> Iterable[str]:
    yield from node.event_ids
    for child in node.children:
        yield from _plan_event_ids(child)


def validate_plan(
    plan: HierarchyPlan,
    events: list[NormalizedEvent],
    max_depth: int,
) -> None:
    """Reject invented, omitted, duplicated, over-deep, or non-contiguous groups."""

    expected = {event.id for event in events}
    position = {event.id: event.sequence for event in events}
    referenced: list[str] = []
    deepest = 0
    for node, depth in _walk_plan(plan.root):
        deepest = max(deepest, depth)
        node_ids = list(_plan_event_ids(node))
        referenced.extend(node.event_ids)
        if node_ids:
            positions = sorted(
                position[event_id] for event_id in node_ids if event_id in position
            )
            if len(positions) == len(node_ids) and positions[-1] - positions[
                0
            ] + 1 != len(positions):
                raise SemanticGenerationError(
                    f"Hierarchy node {node.title!r} combines non-contiguous events."
                )

    unknown = set(referenced) - expected
    if unknown:
        raise SemanticGenerationError(
            f"Hierarchy references unknown events: {sorted(unknown)}"
        )
    duplicates = sorted(
        event_id for event_id, count in Counter(referenced).items() if count > 1
    )
    if duplicates:
        raise SemanticGenerationError(f"Hierarchy duplicates events: {duplicates}")
    missing = expected - set(referenced)
    if missing:
        raise SemanticGenerationError(f"Hierarchy omits events: {sorted(missing)}")
    if deepest > max_depth:
        raise SemanticGenerationError(
            f"Hierarchy has {deepest} summary levels; maximum is {max_depth}."
        )


def _event_catalog(events: list[NormalizedEvent]) -> list[dict[str, Any]]:
    catalog: list[dict[str, Any]] = []
    for event in events:
        content = event.content
        if len(content) > 6_000:
            content = f"{content[:6_000]}\n[content truncated for hierarchy generation]"
        catalog.append(
            {
                "id": event.id,
                "sequence": event.sequence,
                "step_id": event.step_id,
                "kind": event.kind,
                "title": event.title,
                "content": content,
                "tool_name": event.tool_name,
                "parent_event_id": event.parent_event_id,
            }
        )
    return catalog


def _replace_meta_events(
    node: HierarchyPlanNode,
    replacements: Mapping[str, HierarchyPlanNode],
) -> HierarchyPlanNode:
    children = [_replace_meta_events(child, replacements) for child in node.children]
    event_ids: list[str] = []
    replacement_children: list[HierarchyPlanNode] = []
    for event_id in node.event_ids:
        replacement = replacements.get(event_id)
        if replacement is None:
            event_ids.append(event_id)
        else:
            replacement_children.append(replacement)

    if not children and not event_ids and len(replacement_children) == 1:
        replacement = replacement_children[0]
        return node.model_copy(
            update={
                "event_ids": replacement.event_ids,
                "children": replacement.children,
            }
        )

    children.extend(replacement_children)
    return node.model_copy(update={"event_ids": event_ids, "children": children})


def _semantic_kind(event: NormalizedEvent) -> str:
    if event.kind in {"agent_message", "reasoning"}:
        return "model"
    if event.kind in {"tool_call", "tool_result"}:
        return "tool"
    return "event"


def _truncate_display(value: str, limit: int = 4_000) -> str:
    stripped = value.strip()
    return stripped if len(stripped) <= limit else f"{stripped[: limit - 1]}…"


def materialize_plan(
    plan: HierarchyPlan, events: list[NormalizedEvent]
) -> SemanticNode:
    """Attach model summaries to compact raw event leaves for Studio rendering."""

    event_map = {event.id: event for event in events}
    position = {event.id: event.sequence for event in events}
    summary_index = 0

    def event_node(event_id: str) -> SemanticNode:
        event = event_map[event_id]
        return SemanticNode(
            id=f"event-{event.id}",
            kind=_semantic_kind(event),
            title=event.title,
            what="",
            result=_truncate_display(event.content),
            span_ids=[event.span_id],
        )

    def summary_node(node: HierarchyPlanNode) -> SemanticNode:
        nonlocal summary_index
        summary_index += 1
        node_index = summary_index
        children = [summary_node(child) for child in node.children]
        children.extend(event_node(event_id) for event_id in node.event_ids)
        children.sort(
            key=lambda child: min(
                position[event_id]
                for event_id in _semantic_node_event_ids(child, event_map)
            )
        )
        span_ids = list(
            dict.fromkeys(span_id for child in children for span_id in child.span_ids)
        )
        return SemanticNode(
            id=f"summary-{node_index}",
            kind="summary",
            title=node.title,
            what=node.what,
            why=node.why,
            result=node.result,
            problems=node.problems,
            span_ids=span_ids,
            children=children,
        )

    return summary_node(plan.root)


def _semantic_node_event_ids(
    node: SemanticNode,
    event_map: Mapping[str, NormalizedEvent],
) -> list[str]:
    if node.id.startswith("event-"):
        event_id = node.id.removeprefix("event-")
        return [event_id] if event_id in event_map else []
    return [
        event_id
        for child in node.children
        for event_id in _semantic_node_event_ids(child, event_map)
    ]


def populate_summary_metrics(
    hierarchy: SemanticNode,
    spans: list[dict[str, Any]],
) -> None:
    """Add exact descendant coverage totals to every collapsible summary."""

    span_by_id = {
        str(span.get("span_id")): span
        for span in spans
        if span.get("span_id") is not None
    }

    def visit(node: SemanticNode) -> int:
        event_count = (
            1
            if node.id.startswith("event-")
            else sum(visit(child) for child in node.children)
        )
        if node.kind != "summary":
            return event_count

        metrics: dict[str, int | float | str] = {
            "spans": len(node.span_ids),
            "events": event_count,
        }
        total_tokens = sum(
            int(span_by_id[span_id].get("total_tokens") or 0)
            for span_id in node.span_ids
            if span_id in span_by_id
            and isinstance(span_by_id[span_id].get("total_tokens"), int | float)
        )
        if total_tokens:
            metrics["total_tokens"] = total_tokens
        node.metrics = metrics
        return event_count

    visit(hierarchy)


class InferenceHierarchyBuilder:
    """Generate and validate Zoomer's semantic tree with NVIDIA Inference Hub."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://inference-api.nvidia.com/v1",
        model: str = "azure/anthropic/claude-sonnet-4-6",
        timeout_seconds: float = 180,
        max_output_tokens: int = 16_000,
        max_depth: int = 5,
        chunk_target_chars: int = 100_000,
        max_input_chars: int = 500_000,
    ) -> None:
        if not api_key:
            raise ValueError("An Inference Hub API key is required.")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_output_tokens = max_output_tokens
        self.max_depth = max_depth
        self.chunk_target_chars = chunk_target_chars
        self.max_input_chars = max_input_chars

    @classmethod
    def from_environment(cls) -> "InferenceHierarchyBuilder":
        api_key = (
            os.environ.get("NMP_ZOOMER_INFERENCE_API_KEY")
            or os.environ.get("INFERENCE_HUB_API_KEY")
            or os.environ.get("OPTIMIZER_INFERENCE_HUB_KEY")
            or os.environ.get("INFERENCE_HUB_KEY")
        )
        if not api_key:
            raise SemanticGenerationError(
                "Inference Hub API key is missing; set NMP_ZOOMER_INFERENCE_API_KEY, "
                "INFERENCE_HUB_API_KEY, OPTIMIZER_INFERENCE_HUB_KEY, or INFERENCE_HUB_KEY."
            )
        return cls(
            api_key=api_key,
            base_url=os.environ.get(
                "NMP_ZOOMER_INFERENCE_BASE_URL",
                "https://inference-api.nvidia.com/v1",
            ),
            model=os.environ.get(
                "NMP_ZOOMER_INFERENCE_MODEL",
                "azure/anthropic/claude-sonnet-4-6",
            ),
        )

    def build(
        self,
        trace: Mapping[str, Any],
        spans: list[dict[str, Any]],
        report_progress: ProgressCallback,
    ) -> SemanticNode:
        report_progress(56, "normalizing", "Extracting chronological agent events.")
        events = normalize_events(spans)
        trace_name = str(trace.get("name") or "Agent trace")

        if self._fits_request(events):
            report_progress(
                64,
                "semantic_inference",
                f"Finding semantic phases across {len(events):,} agent events.",
            )
            plan = self._build_plan(events, trace_name, max_depth=self.max_depth)
        else:
            chunks = self._chunk_events(events)
            local_depth = max(1, self.max_depth - 2)
            replacements: dict[str, HierarchyPlanNode] = {}
            meta_events: list[NormalizedEvent] = []
            for index, chunk in enumerate(chunks, start=1):
                progress = 58 + round(28 * (index - 1) / len(chunks))
                report_progress(
                    progress,
                    "semantic_inference",
                    f"Summarizing semantic segment {index:,} of {len(chunks):,}.",
                )
                chunk_id = f"semantic-segment-{index}"
                local_plan = self._build_plan(
                    chunk,
                    f"{trace_name} — segment {index} of {len(chunks)}",
                    max_depth=local_depth,
                )
                replacements[chunk_id] = local_plan.root
                meta_events.append(
                    NormalizedEvent(
                        id=chunk_id,
                        sequence=index - 1,
                        step_id=index,
                        span_id=chunk[0].span_id,
                        kind="summary",
                        title=local_plan.root.title,
                        content=(
                            f"What: {local_plan.root.what}\n"
                            f"Why: {local_plan.root.why}\n"
                            f"Result: {local_plan.root.result}\n"
                            f"Setbacks: {'; '.join(local_plan.root.problems) or 'None recorded.'}"
                        ),
                    )
                )
            report_progress(
                88,
                "semantic_inference",
                f"Combining {len(chunks):,} semantic segments.",
            )
            meta_plan = self._build_plan(
                meta_events,
                trace_name,
                max_depth=self.max_depth - local_depth,
            )
            plan = HierarchyPlan(
                root=_replace_meta_events(meta_plan.root, replacements)
            )
            validate_plan(plan, events, self.max_depth)

        report_progress(96, "finalizing", "Validating exact event coverage.")
        hierarchy = materialize_plan(plan, events)
        populate_summary_metrics(hierarchy, spans)
        total_tokens = sum(
            int(span.get("total_tokens") or 0)
            for span in spans
            if isinstance(span.get("total_tokens"), int | float)
        )
        hierarchy.id = f"trace-{trace.get('id') or 'unknown'}"
        hierarchy.metrics = {
            "spans": len(spans),
            "semantic_phases": len(hierarchy.children),
            "events": len(events),
        }
        if total_tokens:
            hierarchy.metrics["total_tokens"] = total_tokens
        return hierarchy

    def _fits_request(
        self,
        events: list[NormalizedEvent],
        *,
        char_limit: int | None = None,
    ) -> bool:
        return len(events) <= 500 and len(self._serialized_catalog(events)) <= (
            char_limit or min(self.chunk_target_chars, self.max_input_chars)
        )

    @staticmethod
    def _serialized_catalog(events: list[NormalizedEvent]) -> str:
        return json.dumps(_event_catalog(events), ensure_ascii=False)

    def _chunk_events(
        self, events: list[NormalizedEvent]
    ) -> list[list[NormalizedEvent]]:
        chunks: list[list[NormalizedEvent]] = []
        current: list[NormalizedEvent] = []
        for event in events:
            candidate = [*current, event]
            if current and not self._fits_request(candidate):
                current_ids = {candidate_event.id for candidate_event in current}
                if event.parent_event_id and event.parent_event_id in current_ids:
                    current.append(event)
                    if len(self._serialized_catalog(current)) > self.max_input_chars:
                        raise SemanticGenerationError(
                            f"Linked event pair ending at {event.id!r} exceeds the hierarchy request budget."
                        )
                    chunks.append(current)
                    current = []
                else:
                    chunks.append(current)
                    current = [event]
            else:
                current = candidate
            if len(self._serialized_catalog(current)) > self.max_input_chars:
                raise SemanticGenerationError(
                    f"Event {event.id!r} exceeds the hierarchy request budget."
                )
        if current:
            chunks.append(current)
        return chunks

    def _build_plan(
        self,
        events: list[NormalizedEvent],
        trace_name: str,
        *,
        max_depth: int,
    ) -> HierarchyPlan:
        request_text = (
            f"Trace name: {trace_name}\n"
            f"Maximum summary levels: {max_depth}\n"
            "Every hierarchy node must cover one contiguous range in the ordered event sequence.\n"
            "Create the semantic hierarchy for these ordered events:\n"
            f"{self._serialized_catalog(events)}"
        )
        validation_feedback: str | None = None
        prior_response: str | None = None
        for attempt in range(3):
            user_content = request_text
            if validation_feedback:
                user_content += (
                    "\n\nYour prior response was invalid:\n"
                    f"{prior_response}\n\n"
                    "Correct that hierarchy without changing the input events. "
                    f"Validation error: {validation_feedback}"
                )
            response_text = self._complete(user_content)
            try:
                plan = HierarchyPlan.model_validate(self._parse_json(response_text))
                validate_plan(plan, events, max_depth)
                return plan
            except (
                json.JSONDecodeError,
                ValidationError,
                SemanticGenerationError,
            ) as exc:
                prior_response = response_text
                validation_feedback = str(exc)
                if attempt == 2:
                    raise SemanticGenerationError(
                        f"Inference Hub returned invalid hierarchies three times: {exc}"
                    ) from exc
        raise AssertionError("unreachable")

    def _complete(self, user_content: str) -> str:
        with httpx.Client(timeout=self.timeout_seconds, trust_env=False) as client:
            response = client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0.1,
                    "max_tokens": self.max_output_tokens,
                },
            )
            response.raise_for_status()
        payload = response.json()
        try:
            choice = payload["choices"][0]
            content = choice["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise SemanticGenerationError(
                "Inference Hub response did not contain message content."
            ) from exc
        if choice.get("finish_reason") not in (None, "stop"):
            raise SemanticGenerationError(
                f"Inference Hub stopped before completing the hierarchy: {choice.get('finish_reason')}"
            )
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )
        raise SemanticGenerationError(
            "Inference Hub returned unsupported message content."
        )

    @staticmethod
    def _parse_json(content: str) -> dict[str, Any]:
        stripped = content.strip()
        if stripped.startswith("```"):
            lines = stripped.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            stripped = "\n".join(lines)
        return json.loads(stripped)


def build_hierarchy(
    trace: Mapping[str, Any],
    spans: list[dict[str, Any]],
    report_progress: ProgressCallback,
    *,
    builder: HierarchyBuilder | None = None,
) -> SemanticNode:
    """Generate a validated model-backed hierarchy with no heuristic fallback."""

    semantic_builder = builder or InferenceHierarchyBuilder.from_environment()
    return semantic_builder.build(trace, spans, report_progress)
