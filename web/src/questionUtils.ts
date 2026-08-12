// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { SemanticHierarchyNode } from "./types";

const genericQuestions = [
  "What happened in this section?",
  "Why did the agent do this?",
  "Were there any failures or recoveries?",
];

const questionSubject = (title: string): string =>
  title.length <= 56 ? title : `${title.slice(0, 55)}…`;

export const getZoomerStarterQuestions = (
  node: SemanticHierarchyNode,
): string[] => {
  const subject = questionSubject(node.title);
  if (node.kind === "model") {
    return [
      `What did the model produce in “${subject}”?`,
      "What trace evidence led to this model response?",
      "Was this response consistent with the surrounding trace?",
    ];
  }
  if (node.kind === "tool") {
    return [
      `What tool activity happened in “${subject}”?`,
      "Which tool inputs and outputs mattered here?",
      "Did this tool call fail or require recovery?",
    ];
  }
  if (node.kind === "summary") {
    return [
      `What happened in “${subject}”?`,
      "Why was this section necessary?",
      "What failures or recoveries occurred here?",
    ];
  }
  return genericQuestions;
};

export const parseZoomerCitationNodeId = (
  href: string | null,
): string | null => {
  const prefix = "#zoomer-node=";
  if (!href?.startsWith(prefix)) return null;
  try {
    const nodeId = decodeURIComponent(href.slice(prefix.length));
    return nodeId || null;
  } catch {
    return null;
  }
};

export const zoomerNodeDomId = (nodeId: string): string =>
  `zoomer-node-${encodeURIComponent(nodeId).replaceAll("%", "_")}`;

export const getZoomerNodeAncestors = (
  parentIds: ReadonlyMap<string, string | null>,
  nodeId: string,
): string[] => {
  const ancestors: string[] = [];
  let parentId = parentIds.get(nodeId);
  while (parentId) {
    ancestors.unshift(parentId);
    parentId = parentIds.get(parentId);
  }
  return ancestors;
};
