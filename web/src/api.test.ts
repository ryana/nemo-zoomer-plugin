// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { isActiveTraceGeneration, isTraceGeneration, tracePath } from "./api";
import type { TraceGeneration } from "./types";

const generation: TraceGeneration = {
  workspace: "default",
  trace_id: "trace-1",
  status: "running",
  progress: 42,
  stage: "semantic_inference",
  message: "Building a semantic map.",
  error: null,
  trace_name: "Research agent",
  hierarchy: null,
  updated_at: "2026-08-12T00:00:00Z",
};

describe("Zoomer generation API", () => {
  it("validates generation payloads before placing them in the shared cache", () => {
    expect(isTraceGeneration(generation)).toBe(true);
    expect(isActiveTraceGeneration(generation)).toBe(true);
    expect(isTraceGeneration({ ...generation, progress: 101 })).toBe(false);
    expect(
      isTraceGeneration({ ...generation, hierarchy: { id: "incomplete" } }),
    ).toBe(false);
  });

  it("encodes workspace and trace identities in service URLs", () => {
    expect(tracePath("team/a", "trace 1")).toBe(
      "/apis/zoomer/v1/workspaces/team%2Fa/traces/trace%201",
    );
  });
});
