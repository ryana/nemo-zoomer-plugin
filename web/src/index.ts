// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  PluginNavGroup,
  PluginRootProps,
  PluginTraceViewDefinition,
} from "./types";
import { ZoomerTraceActivity, ZoomerTraceView } from "./ZoomerTraceView";

export const Root = (_props: PluginRootProps) => null;

export const navItems = (_workspaceId: string): PluginNavGroup[] => [];

export const traceViews: readonly PluginTraceViewDefinition[] = [
  {
    id: "zoomer",
    label: "Zoomer",
    description: "Explore this trace as a generated semantic hierarchy.",
    View: ZoomerTraceView,
    Activity: ZoomerTraceActivity,
  },
];
