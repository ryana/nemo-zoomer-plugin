// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ComponentType } from "react";

export interface PluginHost {
  workspaceId: string;
  auth: {
    accessToken: string;
    getAccessToken: () => string;
  };
  notifications: {
    notify: (
      message: string,
      type?: "success" | "error" | "info" | "warning",
    ) => void;
  };
  telemetry: {
    info: (message: string, cause?: unknown) => void;
    warn: (message: string, cause?: unknown) => void;
    error: (message: string, cause?: unknown) => void;
    event: (name: string, attributes?: Record<string, unknown>) => void;
  };
}

export interface PluginRootProps {
  host: PluginHost;
}

export interface PluginTrace {
  id: string;
  sessionId: string;
}

export interface PluginTraceViewProps {
  host: PluginHost;
  trace: PluginTrace;
}

export interface PluginTraceViewDefinition {
  id: string;
  label: string;
  description?: string;
  View: ComponentType<PluginTraceViewProps>;
  Activity?: ComponentType<PluginTraceViewProps>;
}

export interface PluginNavItem {
  id: string;
  iconName: string;
  label: string;
  href: string;
}

export interface PluginNavGroup {
  group: string;
  items: PluginNavItem[];
}

export type TraceGenerationStatus =
  | "not_started"
  | "queued"
  | "running"
  | "ready"
  | "failed";

export interface SemanticHierarchyNode {
  id: string;
  kind: string;
  title: string;
  what: string;
  why: string | null;
  result: string | null;
  problems: string[];
  span_ids: string[];
  metrics: Record<string, number | string>;
  children: SemanticHierarchyNode[];
}

export interface TraceGeneration {
  workspace: string;
  trace_id: string;
  status: TraceGenerationStatus;
  progress: number;
  stage: string;
  message: string;
  error: string | null;
  trace_name: string | null;
  hierarchy: SemanticHierarchyNode | null;
  updated_at: string | null;
}

export type ActiveTraceGeneration = TraceGeneration & {
  status: "queued" | "running";
};
