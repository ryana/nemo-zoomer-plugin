// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  getZoomerNodeAncestors,
  getZoomerStarterQuestions,
  parseZoomerCitationNodeId,
  zoomerNodeDomId,
} from "./questionUtils";
import type { SemanticHierarchyNode } from "./types";

const node: SemanticHierarchyNode = {
  id: "model-1",
  kind: "model",
  title: "Generate the final answer",
  what: "The model answered.",
  why: null,
  result: null,
  problems: [],
  span_ids: ["span-1"],
  metrics: {},
  children: [],
};

describe("Zoomer question helpers", () => {
  it("creates node-specific starter questions", () => {
    expect(getZoomerStarterQuestions(node)[0]).toContain(
      "Generate the final answer",
    );
  });

  it("accepts only Zoomer citation links", () => {
    expect(parseZoomerCitationNodeId("#zoomer-node=summary%2F1")).toBe(
      "summary/1",
    );
    expect(parseZoomerCitationNodeId("https://example.com")).toBeNull();
    expect(parseZoomerCitationNodeId("#zoomer-node=%E0%A4%A")).toBeNull();
  });

  it("builds stable anchors and ordered ancestors", () => {
    expect(zoomerNodeDomId("summary/1")).toBe("zoomer-node-summary_2F1");
    expect(
      getZoomerNodeAncestors(
        new Map([
          ["root", null],
          ["phase", "root"],
          ["event", "phase"],
        ]),
        "event",
      ),
    ).toEqual(["root", "phase"]);
  });
});
