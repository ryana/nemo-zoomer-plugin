# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""API models for native Zoomer trace generation."""

from datetime import datetime
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, Field


class GenerationStatus(StrEnum):
    """Persisted lifecycle states for a generated trace hierarchy."""

    NOT_STARTED = "not_started"
    QUEUED = "queued"
    RUNNING = "running"
    READY = "ready"
    FAILED = "failed"


class SemanticNode(BaseModel):
    """One collapsible unit in Studio's native semantic hierarchy."""

    id: str
    kind: str
    title: str
    what: str
    why: str | None = None
    result: str | None = None
    problems: list[str] = Field(default_factory=list)
    span_ids: list[str] = Field(default_factory=list)
    metrics: dict[str, int | float | str] = Field(default_factory=dict)
    children: list[Self] = Field(default_factory=list)


class TraceGeneration(BaseModel):
    """Current persisted generation state and result for one Intake trace."""

    workspace: str
    trace_id: str
    status: GenerationStatus
    progress: int = Field(ge=0, le=100)
    stage: str
    message: str
    error: str | None = None
    trace_name: str | None = None
    hierarchy: SemanticNode | None = None
    updated_at: datetime | None = None
