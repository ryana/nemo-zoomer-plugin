// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { AssistantChat, type MarkdownLinkProps } from "@nemo/common";
import {
  Badge,
  Button,
  Flex,
  SidePanel,
  Spinner,
  Stack,
  Text,
} from "@nvidia/foundations-react-core";
import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getZoomerStarterQuestions,
  parseZoomerCitationNodeId,
} from "./questionUtils";
import type { SemanticHierarchyNode } from "./types";

export interface ZoomerQuestionTarget {
  node: SemanticHierarchyNode;
  breadcrumb: string[];
}

interface ZoomerQuestionPanelProps {
  baseURL: string;
  open: boolean;
  target: ZoomerQuestionTarget;
  onClose: () => void;
  onCitation: (nodeId: string) => void;
}

const ZoomerCitationLink: FC<MarkdownLinkProps> = ({ href, children }) =>
  parseZoomerCitationNodeId(href ?? null) ? (
    <a
      href={href}
      className="cursor-pointer text-brand underline underline-offset-2"
    >
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );

export const ZoomerQuestionPanel: FC<ZoomerQuestionPanelProps> = ({
  baseURL,
  open,
  target,
  onClose,
  onCitation,
}) => {
  const [running, setRunning] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => setRunning(false), [target.node.id]);

  const handleContentClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest("a");
    const nodeId = parseZoomerCitationNodeId(
      anchor?.getAttribute("href") ?? null,
    );
    if (!nodeId) return;
    event.preventDefault();
    onCitation(nodeId);
  };

  const seedComposer = (question: string): void => {
    const textarea = contentRef.current?.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Task prompt"]',
    );
    if (!textarea) return;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, question);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  };

  const starterQuestions = getZoomerStarterQuestions(target.node);

  return (
    <SidePanel
      bordered
      closeOnClickOutside={false}
      className="w-full"
      style={{ maxWidth: 560 }}
      forceMount
      modal={false}
      open={open}
      side="right"
      slotHeading={
        <Stack gap="density-xs" className="min-w-0 pr-density-xl">
          <Text kind="label/bold/lg">Ask Zoomer</Text>
          <Text
            kind="body/regular/sm"
            className="truncate text-secondary"
            title={target.node.title}
          >
            {target.node.title}
          </Text>
        </Stack>
      }
      slotNavigation={
        <Stack gap="density-xs" className="min-w-0">
          <Badge color="green" kind="outline">
            Focused on {target.node.kind}
          </Badge>
          <Text
            kind="label/regular/sm"
            className="truncate text-secondary"
            title={target.breadcrumb.join(" / ")}
          >
            {target.breadcrumb.join(" / ")}
          </Text>
          {running ? (
            <Flex align="center" gap="density-xs">
              <Spinner
                size="small"
                aria-label="Zoomer is inspecting the trace"
              />
              <Text kind="label/regular/sm" className="text-secondary">
                Inspecting trace and answering…
              </Text>
            </Flex>
          ) : null}
        </Stack>
      }
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <div
        ref={contentRef}
        className="h-full min-h-0"
        onClickCapture={handleContentClick}
        data-testid="zoomer-question-panel-content"
      >
        <AssistantChat
          key={target.node.id}
          model="zoomer-context"
          baseURL={baseURL}
          assistantName="Zoomer"
          placeholder="Ask about this part of the trace"
          emptyState={{
            slotHeading: "Ask about this section",
            slotSubheading:
              "Zoomer will focus here and inspect the rest of the trace when the answer needs more context.",
          }}
          messageContentProps={{ markdownLinkComponent: ZoomerCitationLink }}
          onRunningChange={setRunning}
          enableImageAttachments={false}
          slotComposerStart={
            <Flex gap="density-xs" className="min-w-0 flex-wrap">
              {starterQuestions.map((question) => (
                <Button
                  key={question}
                  kind="tertiary"
                  size="small"
                  onClick={() => seedComposer(question)}
                >
                  {question}
                </Button>
              ))}
            </Flex>
          }
          className="h-full"
        />
      </div>
    </SidePanel>
  );
};
