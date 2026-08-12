// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Badge,
  Button,
  Flex,
  ProgressBar,
  Spinner,
  Stack,
  Text,
} from "@nvidia/foundations-react-core";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  MessageCircleQuestion,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isActiveTraceGeneration,
  questionBaseURL,
  useStartTraceGeneration,
  useTraceGeneration,
} from "./api";
import { getZoomerNodeAncestors, zoomerNodeDomId } from "./questionUtils";
import type { PluginTraceViewProps, SemanticHierarchyNode } from "./types";
import {
  type ZoomerQuestionTarget,
  ZoomerQuestionPanel,
} from "./ZoomerQuestionPanel";

interface SemanticNodeCardProps {
  node: SemanticHierarchyNode;
  depth: number;
  breadcrumb: string[];
  expandedNodeIds: ReadonlySet<string>;
  highlightedNodeId: string | null;
  selectedNodeId: string | null;
  onAsk: (target: ZoomerQuestionTarget) => void;
  onToggle: (nodeId: string) => void;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The Zoomer request failed.";

const kindColor = (kind: string): "blue" | "gray" | "green" | "purple" =>
  kind === "summary"
    ? "green"
    : kind === "model"
      ? "purple"
      : kind === "tool"
        ? "blue"
        : "gray";

const metricLabel = (name: string, value: number | string): string => {
  if (name === "duration_ms" && typeof value === "number")
    return `${value.toLocaleString()} ms`;
  if (name === "total_tokens")
    return `${Number(value).toLocaleString()} tokens`;
  if (name === "spans")
    return `${Number(value).toLocaleString()} span${Number(value) === 1 ? "" : "s"}`;
  if (name === "events")
    return `${Number(value).toLocaleString()} event${Number(value) === 1 ? "" : "s"}`;
  if (name === "semantic_phases")
    return `${Number(value).toLocaleString()} phase${Number(value) === 1 ? "" : "s"}`;
  return `${name.replaceAll("_", " ")} · ${value}`;
};

const initialExpandedNodeIds = (root: SemanticHierarchyNode): Set<string> => {
  const expanded = new Set<string>();
  const visit = (node: SemanticHierarchyNode, depth: number): void => {
    if (depth < 2) expanded.add(node.id);
    node.children.forEach((child) => visit(child, depth + 1));
  };
  visit(root, 0);
  return expanded;
};

const nodeParentIds = (
  root: SemanticHierarchyNode,
): Map<string, string | null> => {
  const parents = new Map<string, string | null>();
  const visit = (
    node: SemanticHierarchyNode,
    parentId: string | null,
  ): void => {
    parents.set(node.id, parentId);
    node.children.forEach((child) => visit(child, node.id));
  };
  visit(root, null);
  return parents;
};

const ErrorPanel: FC<{ header?: string; message: string }> = ({
  header = "Zoomer failed",
  message,
}) => (
  <Stack
    align="center"
    justify="center"
    gap="density-md"
    className="rounded-lg bg-surface-raised px-density-2xl text-center"
    style={{ minHeight: 240 }}
  >
    <TriangleAlert size={32} className="text-feedback-danger" aria-hidden />
    <Text kind="title/sm">{header}</Text>
    <Text kind="body/regular/sm" className="text-feedback-danger">
      {message}
    </Text>
  </Stack>
);

const SemanticNodeCard: FC<SemanticNodeCardProps> = ({
  node,
  depth,
  breadcrumb,
  expandedNodeIds,
  highlightedNodeId,
  selectedNodeId,
  onAsk,
  onToggle,
}) => {
  const open = expandedNodeIds.has(node.id);
  const hasDetails = Boolean(
    node.why ||
    node.result ||
    node.problems.length > 0 ||
    node.children.length > 0,
  );
  const selected = selectedNodeId === node.id;
  const highlighted = highlightedNodeId === node.id;
  const baseClassName =
    depth === 0
      ? "min-w-0 overflow-hidden rounded-lg bg-surface-raised"
      : "min-w-0 overflow-hidden rounded-md border border-base bg-surface-raised";
  const emphasisClassName = highlighted
    ? "ring-2 ring-brand ring-offset-2 ring-offset-surface-base"
    : selected
      ? "ring-1 ring-brand"
      : "";

  return (
    <section
      id={zoomerNodeDomId(node.id)}
      className={`${baseClassName} ${emphasisClassName} transition-shadow`}
      data-zoomer-node-id={node.id}
      aria-label={`Zoomer node ${node.title}`}
    >
      <Flex
        align="start"
        justify="between"
        gap="density-md"
        className="min-w-0 px-density-lg py-density-md"
      >
        <button
          type="button"
          className={
            hasDetails
              ? "min-w-0 flex-1 cursor-pointer text-left"
              : "min-w-0 flex-1 text-left"
          }
          aria-expanded={hasDetails ? open : undefined}
          aria-label={
            hasDetails
              ? `${open ? "Collapse" : "Expand"} ${node.title}`
              : node.title
          }
          onClick={() => hasDetails && onToggle(node.id)}
        >
          <Flex
            align="start"
            justify="between"
            gap="density-lg"
            className="min-w-0"
          >
            <Flex align="start" gap="density-sm" className="min-w-0 flex-1">
              <span className="mt-density-xxs shrink-0 text-secondary">
                {hasDetails ? (
                  open ? (
                    <ChevronDown size={16} aria-hidden />
                  ) : (
                    <ChevronRight size={16} aria-hidden />
                  )
                ) : (
                  <CheckCircle2 size={16} aria-hidden />
                )}
              </span>
              <Stack gap="density-xs" className="min-w-0">
                <Flex
                  align="center"
                  gap="density-sm"
                  className="min-w-0 flex-wrap"
                >
                  <Badge color={kindColor(node.kind)} kind="outline">
                    {node.kind}
                  </Badge>
                  <Text kind={depth === 0 ? "title/sm" : "body/semibold/md"}>
                    {node.title}
                  </Text>
                </Flex>
                <Text
                  kind="body/regular/sm"
                  className="break-words text-secondary"
                >
                  {node.what}
                </Text>
              </Stack>
            </Flex>
            {Object.keys(node.metrics).length > 0 ? (
              <Flex
                align="center"
                justify="end"
                gap="density-xs"
                className="shrink-0 flex-wrap"
              >
                {Object.entries(node.metrics).map(([name, value]) => (
                  <Badge key={name} color="gray" kind="solid">
                    {metricLabel(name, value)}
                  </Badge>
                ))}
              </Flex>
            ) : null}
          </Flex>
        </button>
        <Button
          kind="tertiary"
          size="small"
          className="shrink-0"
          aria-label={`Ask Zoomer about ${node.title}`}
          onClick={() => onAsk({ node, breadcrumb })}
        >
          <MessageCircleQuestion size={14} aria-hidden /> Ask
        </Button>
      </Flex>

      {open && hasDetails ? (
        <Stack
          gap="density-lg"
          className="border-t border-base px-density-xl py-density-lg"
        >
          {node.why ? (
            <Flex align="start" gap="density-lg" className="min-w-0">
              <Text
                kind="label/regular/sm"
                className="shrink-0 text-secondary"
                style={{ width: "5rem" }}
              >
                Why
              </Text>
              <Text kind="body/regular/sm" className="min-w-0 break-words">
                {node.why}
              </Text>
            </Flex>
          ) : null}
          {node.result ? (
            <Flex align="start" gap="density-lg" className="min-w-0">
              <Text
                kind="label/regular/sm"
                className="shrink-0 text-secondary"
                style={{ width: "5rem" }}
              >
                Result
              </Text>
              <Text
                kind="body/regular/sm"
                className="min-w-0 whitespace-pre-wrap break-words border-l-2 border-brand pl-density-md"
              >
                {node.result}
              </Text>
            </Flex>
          ) : null}
          {node.problems.length > 0 ? (
            <Flex align="start" gap="density-lg" className="min-w-0">
              <Text
                kind="label/regular/sm"
                className="shrink-0 text-secondary"
                style={{ width: "8rem" }}
              >
                Setbacks & uncertainty
              </Text>
              <ul className="min-w-0 list-disc space-y-density-xs pl-density-lg">
                {node.problems.map((problem) => (
                  <li key={problem} className="text-feedback-warning">
                    <Text kind="body/regular/sm" className="break-words">
                      {problem}
                    </Text>
                  </li>
                ))}
              </ul>
            </Flex>
          ) : null}
          {node.children.length > 0 ? (
            <Stack
              gap="density-sm"
              className="border-l border-base pl-density-lg"
            >
              {node.children.map((child) => (
                <SemanticNodeCard
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  breadcrumb={[...breadcrumb, child.title]}
                  expandedNodeIds={expandedNodeIds}
                  highlightedNodeId={highlightedNodeId}
                  selectedNodeId={selectedNodeId}
                  onAsk={onAsk}
                  onToggle={onToggle}
                />
              ))}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </section>
  );
};

const ZoomerHierarchy: FC<
  PluginTraceViewProps & { hierarchy: SemanticHierarchyNode }
> = ({ hierarchy, host, trace }) => {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() =>
    initialExpandedNodeIds(hierarchy),
  );
  const [questionTarget, setQuestionTarget] =
    useState<ZoomerQuestionTarget | null>(null);
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );
  const parentIds = useMemo(() => nodeParentIds(hierarchy), [hierarchy]);
  const highlightTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current !== null)
        window.clearTimeout(highlightTimeoutRef.current);
    },
    [],
  );

  const toggleNode = useCallback((nodeId: string): void => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const askNode = useCallback((target: ZoomerQuestionTarget): void => {
    setQuestionTarget(target);
    setQuestionPanelOpen(true);
  }, []);

  const revealCitation = useCallback(
    (nodeId: string): void => {
      if (!parentIds.has(nodeId)) return;
      setExpandedNodeIds(
        (current) =>
          new Set([...current, ...getZoomerNodeAncestors(parentIds, nodeId)]),
      );
      setHighlightedNodeId(nodeId);
      setQuestionPanelOpen(true);
      window.setTimeout(() => {
        document
          .getElementById(zoomerNodeDomId(nodeId))
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      if (highlightTimeoutRef.current !== null)
        window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedNodeId((current) =>
          current === nodeId ? null : current,
        );
      }, 2_500);
    },
    [parentIds],
  );

  return (
    <>
      <SemanticNodeCard
        node={hierarchy}
        depth={0}
        breadcrumb={[hierarchy.title]}
        expandedNodeIds={expandedNodeIds}
        highlightedNodeId={highlightedNodeId}
        selectedNodeId={questionTarget?.node.id ?? null}
        onAsk={askNode}
        onToggle={toggleNode}
      />
      {questionTarget ? (
        <ZoomerQuestionPanel
          baseURL={questionBaseURL(
            host.workspaceId,
            trace.id,
            questionTarget.node.id,
          )}
          open={questionPanelOpen}
          target={questionTarget}
          onClose={() => setQuestionPanelOpen(false)}
          onCitation={revealCitation}
        />
      ) : null}
    </>
  );
};

export const ZoomerTraceActivity: FC<PluginTraceViewProps> = ({
  host,
  trace,
}) => {
  const { data: generation } = useTraceGeneration(host, trace);
  if (!isActiveTraceGeneration(generation)) return null;

  return (
    <Stack
      gap="density-xs"
      className="rounded-md bg-surface-raised px-density-md py-density-sm"
      style={{ minWidth: "15rem" }}
    >
      <Flex align="center" justify="between" gap="density-md">
        <Flex align="center" gap="density-xs">
          <Spinner size="small" aria-label="Zoomer generation running" />
          <Text kind="label/semibold/sm">Zoomer</Text>
        </Flex>
        <Text kind="label/regular/sm" className="tabular-nums text-secondary">
          {generation.progress}%
        </Text>
      </Flex>
      <ProgressBar
        kind="determinate"
        size="small"
        value={generation.progress}
        aria-label="Zoomer generation progress"
      />
    </Stack>
  );
};

export const ZoomerTraceView: FC<PluginTraceViewProps> = ({ host, trace }) => {
  const {
    data: generation,
    error,
    isLoading,
  } = useTraceGeneration(host, trace);
  const startGeneration = useStartTraceGeneration(host, trace);

  if (isLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 320 }}>
        <Spinner size="large" description="Loading Zoomer…" />
      </Flex>
    );
  }
  if (error || !generation)
    return <ErrorPanel message={getErrorMessage(error)} />;

  if (generation.status === "not_started") {
    return (
      <Stack
        align="center"
        justify="center"
        gap="density-lg"
        className="rounded-lg bg-surface-raised text-center"
        style={{ minHeight: 360 }}
      >
        <Sparkles className="size-12 text-brand" aria-hidden />
        <Stack align="center" gap="density-xs">
          <Text kind="title/md">Generate Zoomer</Text>
          <Text kind="body/regular/sm" className="text-secondary">
            Explore this trace as a generated semantic hierarchy.
          </Text>
        </Stack>
        <Button
          kind="primary"
          color="brand"
          onClick={() => startGeneration.mutate(false)}
          disabled={startGeneration.isPending}
        >
          <GitBranch size={16} aria-hidden /> Generate semantic map
        </Button>
        {startGeneration.error ? (
          <Text kind="body/regular/sm" className="text-feedback-danger">
            {getErrorMessage(startGeneration.error)}
          </Text>
        ) : null}
      </Stack>
    );
  }

  if (isActiveTraceGeneration(generation)) {
    return (
      <Stack
        align="center"
        justify="center"
        gap="density-xl"
        className="rounded-lg bg-surface-raised px-density-2xl"
        style={{ minHeight: 360 }}
      >
        <Spinner size="large" description={generation.message} />
        <Stack
          gap="density-sm"
          className="w-full"
          style={{ maxWidth: "36rem" }}
        >
          <Flex align="center" justify="between" gap="density-md">
            <Text kind="body/semibold/sm">
              {generation.stage.replaceAll("_", " ")}
            </Text>
            <Text
              kind="body/regular/sm"
              className="tabular-nums text-secondary"
            >
              {generation.progress}%
            </Text>
          </Flex>
          <ProgressBar
            kind="determinate"
            value={generation.progress}
            aria-label="Zoomer generation progress"
          />
        </Stack>
        <Text kind="body/regular/sm" className="text-secondary">
          You can switch views or leave this page. Generation will continue in
          the background.
        </Text>
      </Stack>
    );
  }

  if (generation.status === "failed") {
    return (
      <Stack
        align="center"
        justify="center"
        gap="density-lg"
        className="rounded-lg bg-surface-raised px-density-2xl"
        style={{ minHeight: 360 }}
      >
        <ErrorPanel
          header="Zoomer generation failed"
          message={generation.error ?? generation.message}
        />
        <Button
          kind="primary"
          color="brand"
          onClick={() => startGeneration.mutate(false)}
          disabled={startGeneration.isPending}
        >
          <RotateCcw size={16} aria-hidden /> Retry generation
        </Button>
      </Stack>
    );
  }

  if (!generation.hierarchy)
    return (
      <ErrorPanel message="Zoomer completed without a semantic hierarchy." />
    );

  return (
    <Stack gap="density-lg" className="min-w-0">
      <Flex
        align="center"
        justify="between"
        gap="density-lg"
        className="min-w-0"
      >
        <Stack gap="density-xs" className="min-w-0">
          <Flex align="center" gap="density-sm">
            <Sparkles size={18} className="text-brand" aria-hidden />
            <Text kind="title/sm">Semantic map</Text>
            <Badge color="green" kind="solid">
              Ready
            </Badge>
          </Flex>
          <Text kind="body/regular/sm" className="text-secondary">
            Traverse the run from outcome to the telemetry that supports it.
          </Text>
        </Stack>
        <Button
          kind="tertiary"
          size="small"
          onClick={() => startGeneration.mutate(true)}
          disabled={startGeneration.isPending}
        >
          <RotateCcw size={14} aria-hidden /> Regenerate
        </Button>
      </Flex>
      <ZoomerHierarchy
        hierarchy={generation.hierarchy}
        host={host}
        trace={trace}
      />
    </Stack>
  );
};
