# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Small persistent store for Zoomer generation state."""

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any

from nemo_zoomer_plugin.models import GenerationStatus, SemanticNode, TraceGeneration

SCHEMA = """
CREATE TABLE IF NOT EXISTS trace_generations (
    workspace TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL,
    stage TEXT NOT NULL,
    message TEXT NOT NULL,
    error TEXT,
    trace_name TEXT,
    hierarchy_json TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (workspace, trace_id)
)
"""


def _now() -> str:
    return datetime.now(UTC).isoformat()


class GenerationStore:
    """SQLite-backed state that survives navigation and platform restarts."""

    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self._write_lock = Lock()

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(SCHEMA)
            connection.execute(
                """
                UPDATE trace_generations
                SET status = ?, stage = ?, message = ?, error = ?, updated_at = ?
                WHERE status IN (?, ?)
                """,
                (
                    GenerationStatus.FAILED,
                    "interrupted",
                    "Generation was interrupted. Retry to continue.",
                    "The platform stopped before generation completed.",
                    _now(),
                    GenerationStatus.QUEUED,
                    GenerationStatus.RUNNING,
                ),
            )

    def get(self, workspace: str, trace_id: str) -> TraceGeneration:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT workspace, trace_id, status, progress, stage, message,
                       error, trace_name, hierarchy_json, updated_at
                FROM trace_generations
                WHERE workspace = ? AND trace_id = ?
                """,
                (workspace, trace_id),
            ).fetchone()
        if row is None:
            return TraceGeneration(
                workspace=workspace,
                trace_id=trace_id,
                status=GenerationStatus.NOT_STARTED,
                progress=0,
                stage="not_started",
                message="Generate a semantic hierarchy for this trace.",
            )
        return self._from_row(row)

    def queue(
        self,
        workspace: str,
        trace_id: str,
        *,
        regenerate: bool,
    ) -> tuple[TraceGeneration, bool]:
        """Queue a trace if it is not already active or cached."""

        with self._write_lock, self._connect() as connection:
            current = connection.execute(
                """
                SELECT workspace, trace_id, status, progress, stage, message,
                       error, trace_name, hierarchy_json, updated_at
                FROM trace_generations
                WHERE workspace = ? AND trace_id = ?
                """,
                (workspace, trace_id),
            ).fetchone()
            if current is not None:
                generation = self._from_row(current)
                if generation.status in {
                    GenerationStatus.QUEUED,
                    GenerationStatus.RUNNING,
                }:
                    return generation, False
                if generation.status is GenerationStatus.READY and not regenerate:
                    return generation, False

            connection.execute(
                """
                INSERT INTO trace_generations (
                    workspace, trace_id, status, progress, stage, message,
                    error, trace_name, hierarchy_json, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
                ON CONFLICT(workspace, trace_id) DO UPDATE SET
                    status = excluded.status,
                    progress = excluded.progress,
                    stage = excluded.stage,
                    message = excluded.message,
                    error = NULL,
                    trace_name = NULL,
                    hierarchy_json = NULL,
                    updated_at = excluded.updated_at
                """,
                (
                    workspace,
                    trace_id,
                    GenerationStatus.QUEUED,
                    0,
                    "queued",
                    "Waiting to inspect the trace.",
                    _now(),
                ),
            )
        return self.get(workspace, trace_id), True

    def update_progress(
        self,
        workspace: str,
        trace_id: str,
        *,
        progress: int,
        stage: str,
        message: str,
        trace_name: str | None = None,
    ) -> None:
        values: dict[str, Any] = {
            "status": GenerationStatus.RUNNING,
            "progress": max(0, min(99, progress)),
            "stage": stage,
            "message": message,
            "updated_at": _now(),
        }
        if trace_name is not None:
            values["trace_name"] = trace_name
        self._update(workspace, trace_id, values)

    def complete(
        self,
        workspace: str,
        trace_id: str,
        *,
        trace_name: str,
        hierarchy: SemanticNode,
    ) -> None:
        self._update(
            workspace,
            trace_id,
            {
                "status": GenerationStatus.READY,
                "progress": 100,
                "stage": "ready",
                "message": "Semantic hierarchy ready.",
                "error": None,
                "trace_name": trace_name,
                "hierarchy_json": hierarchy.model_dump_json(),
                "updated_at": _now(),
            },
        )

    def fail(self, workspace: str, trace_id: str, error: str) -> None:
        self._update(
            workspace,
            trace_id,
            {
                "status": GenerationStatus.FAILED,
                "stage": "failed",
                "message": "Zoomer could not generate this trace.",
                "error": error,
                "updated_at": _now(),
            },
        )

    def _update(
        self,
        workspace: str,
        trace_id: str,
        values: dict[str, Any],
    ) -> None:
        assignments = ", ".join(f"{column} = ?" for column in values)
        parameters = [*values.values(), workspace, trace_id]
        with self._write_lock, self._connect() as connection:
            cursor = connection.execute(
                f"""
                UPDATE trace_generations
                SET {assignments}
                WHERE workspace = ? AND trace_id = ?
                """,
                parameters,
            )
            if cursor.rowcount != 1:
                raise LookupError(
                    f"Generation state does not exist for {workspace}/{trace_id}"
                )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _from_row(row: sqlite3.Row) -> TraceGeneration:
        raw_hierarchy = row["hierarchy_json"]
        hierarchy = (
            SemanticNode.model_validate(json.loads(raw_hierarchy))
            if raw_hierarchy
            else None
        )
        return TraceGeneration(
            workspace=row["workspace"],
            trace_id=row["trace_id"],
            status=GenerationStatus(row["status"]),
            progress=row["progress"],
            stage=row["stage"],
            message=row["message"],
            error=row["error"],
            trace_name=row["trace_name"],
            hierarchy=hierarchy,
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )
