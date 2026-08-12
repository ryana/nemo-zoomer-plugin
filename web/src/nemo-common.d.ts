// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

declare module "@nemo/common" {
  import type { ComponentType, FC, ReactNode } from "react";

  export interface MarkdownLinkProps {
    href?: string;
    children?: ReactNode;
  }

  export interface AssistantChatProps {
    model: string;
    baseURL?: string;
    assistantName?: string;
    placeholder?: string;
    className?: string;
    emptyState?: {
      slotHeading?: string;
      slotSubheading?: string;
    };
    messageContentProps?: {
      markdownLinkComponent?: ComponentType<MarkdownLinkProps>;
    };
    onRunningChange?: (isRunning: boolean) => void;
    slotComposerStart?: ReactNode;
    enableImageAttachments?: boolean;
  }

  export const AssistantChat: FC<AssistantChatProps>;
}
