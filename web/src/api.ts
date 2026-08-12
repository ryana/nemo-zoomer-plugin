// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ActiveTraceGeneration,
  PluginHost,
  PluginTrace,
  SemanticHierarchyNode,
  TraceGeneration,
  TraceGenerationStatus,
} from "./types";

const ACTIVE_STATUSES = new Set<TraceGenerationStatus>(["queued", "running"]);
const GENERATION_STATUSES = new Set<TraceGenerationStatus>([
  "not_started",
  "queued",
  "running",
  "ready",
  "failed",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNullableString = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

export const isSemanticHierarchyNode = (
  value: unknown,
): value is SemanticHierarchyNode => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.kind !== "string" ||
    typeof value.title !== "string" ||
    typeof value.what !== "string" ||
    !isNullableString(value.why) ||
    !isNullableString(value.result) ||
    !Array.isArray(value.problems) ||
    !value.problems.every((problem) => typeof problem === "string") ||
    !Array.isArray(value.span_ids) ||
    !value.span_ids.every((spanId) => typeof spanId === "string") ||
    !isRecord(value.metrics) ||
    !Object.values(value.metrics).every(
      (metric) => typeof metric === "number" || typeof metric === "string",
    ) ||
    !Array.isArray(value.children)
  ) {
    return false;
  }
  return value.children.every(isSemanticHierarchyNode);
};

export const isTraceGeneration = (value: unknown): value is TraceGeneration =>
  isRecord(value) &&
  typeof value.workspace === "string" &&
  typeof value.trace_id === "string" &&
  typeof value.status === "string" &&
  GENERATION_STATUSES.has(value.status as TraceGenerationStatus) &&
  typeof value.progress === "number" &&
  value.progress >= 0 &&
  value.progress <= 100 &&
  typeof value.stage === "string" &&
  typeof value.message === "string" &&
  isNullableString(value.error) &&
  isNullableString(value.trace_name) &&
  (value.hierarchy === null || isSemanticHierarchyNode(value.hierarchy)) &&
  isNullableString(value.updated_at);

export const isActiveTraceGeneration = (
  generation: TraceGeneration | undefined,
): generation is ActiveTraceGeneration =>
  generation !== undefined && ACTIVE_STATUSES.has(generation.status);

export const tracePath = (workspaceId: string, traceId: string): string =>
  `/apis/zoomer/v1/workspaces/${encodeURIComponent(workspaceId)}/traces/${encodeURIComponent(traceId)}`;

export const questionBaseURL = (
  workspaceId: string,
  traceId: string,
  nodeId: string,
): string =>
  new URL(
    `${tracePath(workspaceId, traceId)}/nodes/${encodeURIComponent(nodeId)}/-/v1`,
    window.location.origin,
  ).toString();

const generationQueryKey = (workspaceId: string, traceId: string) =>
  ["plugin", "zoomer", "generation", workspaceId, traceId] as const;

const responseError = async (response: Response): Promise<Error> => {
  let detail = `${response.status} ${response.statusText}`.trim();
  try {
    const body = (await response.json()) as unknown;
    if (isRecord(body) && typeof body.detail === "string") detail = body.detail;
  } catch {
    // The HTTP status remains the useful failure when the body is not JSON.
  }
  return new Error(detail || "The Zoomer request failed.");
};

const requestGeneration = async (
  host: PluginHost,
  trace: PluginTrace,
  method: "GET" | "POST",
  regenerate = false,
): Promise<TraceGeneration> => {
  const path = `${tracePath(host.workspaceId, trace.id)}${method === "POST" ? "/generation" : ""}${
    regenerate ? "?regenerate=true" : ""
  }`;
  const accessToken = host.auth.getAccessToken();
  const response = await fetch(path, {
    method,
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
  });
  if (!response.ok) throw await responseError(response);
  const payload = (await response.json()) as unknown;
  if (!isTraceGeneration(payload)) {
    throw new Error("Zoomer returned an invalid generation response.");
  }
  return payload;
};

export const useTraceGeneration = (host: PluginHost, trace: PluginTrace) =>
  useQuery({
    queryKey: generationQueryKey(host.workspaceId, trace.id),
    queryFn: () => requestGeneration(host, trace, "GET"),
    refetchInterval: (query) =>
      isActiveTraceGeneration(query.state.data) ? 1_000 : false,
  });

export const useStartTraceGeneration = (
  host: PluginHost,
  trace: PluginTrace,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (regenerate: boolean) =>
      requestGeneration(host, trace, "POST", regenerate),
    onSuccess: (generation) => {
      queryClient.setQueryData(
        generationQueryKey(host.workspaceId, trace.id),
        generation,
      );
    },
  });
};
