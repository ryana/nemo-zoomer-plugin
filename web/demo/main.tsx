import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Activity,
  Boxes,
  Braces,
  ChevronDown,
  CircleUserRound,
  Clock3,
  Database,
  FileCode2,
  GitBranch,
  ListTree,
  MessageSquareText,
  Puzzle,
  Search,
  Sparkles,
} from "lucide-react";
import React, { type FC } from "react";
import ReactDOM from "react-dom/client";

import { ZoomerTraceView } from "../src/ZoomerTraceView";
import type {
  PluginHost,
  SemanticHierarchyNode,
  TraceGeneration,
} from "../src/types";
import "./styles.css";

const hierarchy: SemanticHierarchyNode = {
  id: "run-summary",
  kind: "summary",
  title: "Implement and validate a resilient retry fix",
  what: "Diagnosed a flaky integration test, corrected the retry boundary, and verified the focused and full suites.",
  why: "The service intermittently retried permanent validation failures, hiding the real error and wasting execution time.",
  result: "Validation errors now fail immediately; transient transport failures still retry. All 248 tests pass.",
  problems: [],
  span_ids: ["span-001", "span-048"],
  metrics: {
    duration_ms: 128400,
    total_tokens: 18492,
    semantic_phases: 3,
  },
  children: [
    {
      id: "phase-diagnose",
      kind: "summary",
      title: "Diagnose the flaky failure",
      what: "Compared failing logs with the retry policy and isolated an overly broad exception handler.",
      why: "The observed delay and repeated validation message pointed to retry classification rather than network instability.",
      result: "Identified `ValidationError` as the permanent failure being retried.",
      problems: ["The first log sample omitted the original exception type."],
      span_ids: ["span-004", "span-017"],
      metrics: { duration_ms: 41200, spans: 12 },
      children: [
        {
          id: "model-hypothesis",
          kind: "model",
          title: "Form a retry-classification hypothesis",
          what: "Reasoned from timing and repeated messages that the retry predicate was too permissive.",
          why: null,
          result: "Prioritized inspection of the exception boundary.",
          problems: [],
          span_ids: ["span-006"],
          metrics: { total_tokens: 2310 },
          children: [],
        },
        {
          id: "tool-logs",
          kind: "tool",
          title: "Inspect test logs and retry policy",
          what: "Read the failing trace, implementation, and related unit tests.",
          why: null,
          result: "Found a catch-all retry around validation and transport errors.",
          problems: [],
          span_ids: ["span-009", "span-014"],
          metrics: { events: 8 },
          children: [],
        },
      ],
    },
    {
      id: "phase-implement",
      kind: "summary",
      title: "Narrow the retry boundary",
      what: "Changed the predicate and added a regression test for permanent failures.",
      why: "Only transport-level failures are safe to repeat; validation failures require caller action.",
      result: "The implementation now distinguishes transient and permanent failures explicitly.",
      problems: [],
      span_ids: ["span-018", "span-031"],
      metrics: { duration_ms: 36900, spans: 9 },
      children: [
        {
          id: "tool-patch",
          kind: "tool",
          title: "Patch retry predicate and tests",
          what: "Updated the policy and added the missing validation-error assertion.",
          why: null,
          result: "A focused regression test fails before the patch and passes after it.",
          problems: [],
          span_ids: ["span-021", "span-026"],
          metrics: { events: 11 },
          children: [],
        },
      ],
    },
    {
      id: "phase-verify",
      kind: "summary",
      title: "Verify behavior and full-suite safety",
      what: "Ran targeted checks, type validation, and the complete unit suite.",
      why: "The retry path is shared, so both the regression and unrelated consumers needed coverage.",
      result: "Focused checks and all 248 unit tests passed; no type errors remained.",
      problems: ["An unrelated timeout interrupted the first full-suite run; the clean rerun passed."],
      span_ids: ["span-032", "span-048"],
      metrics: { duration_ms: 50300, spans: 15 },
      children: [
        {
          id: "tool-tests",
          kind: "tool",
          title: "Run regression and full test suites",
          what: "Executed the focused test, typecheck, then the full unit suite.",
          why: null,
          result: "248 passed in 73 seconds.",
          problems: [],
          span_ids: ["span-038", "span-047"],
          metrics: { events: 14 },
          children: [],
        },
      ],
    },
  ],
};

const query = new URLSearchParams(window.location.search);
const scene = query.get("scene") ?? "hierarchy";

const readyGeneration: TraceGeneration = {
  workspace: "default",
  trace_id: "retry-fix-2026-08-12",
  status: "ready",
  progress: 100,
  stage: "complete",
  message: "Semantic hierarchy ready",
  error: null,
  trace_name: "retry-fix-coding-agent",
  hierarchy,
  updated_at: "2026-08-12T15:30:00Z",
};

const runningGeneration: TraceGeneration = {
  ...readyGeneration,
  status: "running",
  progress: 68,
  stage: "building_hierarchy",
  message: "Grouping 48 spans into semantic phases…",
  hierarchy: null,
};

const generation = scene === "progress" ? runningGeneration : readyGeneration;

window.fetch = async () =>
  new Response(JSON.stringify(generation), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const host: PluginHost = {
  workspaceId: "default",
  auth: { accessToken: "", getAccessToken: () => "" },
  notifications: { notify: () => undefined },
  telemetry: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    event: () => undefined,
  },
};

const Sidebar: FC = () => (
  <aside className="studio-sidebar">
    <div className="studio-mark"><span>N</span></div>
    <nav aria-label="Studio navigation">
      <button type="button"><Boxes /><span>Build</span></button>
      <button type="button" className="active"><Activity /><span>Observe</span></button>
      <button type="button"><Database /><span>Data</span></button>
    </nav>
    <div className="sidebar-bottom"><CircleUserRound /></div>
  </aside>
);

const Chrome: FC<{ children: React.ReactNode; active?: "tree" | "list" | "zoomer" }> = ({
  children,
  active = "zoomer",
}) => (
  <div className="studio-frame">
    <Sidebar />
    <main className="studio-main">
      <header className="studio-topbar">
        <div className="product-name">NeMo <strong>Studio</strong></div>
        <div className="workspace-switcher">default <ChevronDown /></div>
      </header>
      <div className="trace-heading">
        <div>
          <div className="eyebrow">TRACE · RETRY-FIX-2026-08-12</div>
          <h1>Implement resilient retries</h1>
        </div>
        <div className="trace-meta"><Clock3 /> 2m 08s <span>18,492 tokens</span></div>
      </div>
      <div className="trace-tabs" aria-label="Trace views">
        <button type="button" className={active === "tree" ? "active" : ""}><GitBranch /> Tree</button>
        <button type="button" className={active === "list" ? "active" : ""}><ListTree /> List</button>
        <button type="button" className={active === "zoomer" ? "active zoomer" : ""}><Sparkles /> Zoomer <span className="plugin-pill">PLUGIN</span></button>
      </div>
      <div className="trace-content">{children}</div>
    </main>
  </div>
);

const RawVsMeaning: FC = () => {
  const events = [
    ["00:04", "MODEL", "Inspecting the failure and retry timing…"],
    ["00:13", "TOOL", "read integration/test_retry.py"],
    ["00:21", "TOOL", "rg 'except Exception' src/"],
    ["00:35", "MODEL", "The predicate retries validation failures."],
    ["00:49", "TOOL", "apply_patch retry_policy.py"],
    ["01:08", "TOOL", "pytest test_retry.py -q"],
    ["01:42", "TOOL", "pytest -q → timeout"],
    ["02:08", "TOOL", "pytest -q → 248 passed"],
  ];
  return (
    <div className="concept-scene">
      <div className="concept-title">
        <span className="kicker">ONE AGENT RUN</span>
        <h1>Same evidence. Better altitude.</h1>
        <p>Zoomer turns event-by-event telemetry into a semantic map without severing the path back to source.</p>
      </div>
      <div className="compare-grid">
        <section className="raw-panel">
          <div className="panel-label"><Braces /> RAW TRACE <span>48 SPANS</span></div>
          {events.map(([time, kind, text]) => (
            <div className="raw-event" key={time}><time>{time}</time><b>{kind}</b><span>{text}</span></div>
          ))}
        </section>
        <div className="transform-arrow">→</div>
        <section className="meaning-panel">
          <div className="panel-label"><Sparkles /> SEMANTIC MAP <span>3 PHASES</span></div>
          <div className="outcome-card"><b>Outcome</b><strong>Retry fix verified</strong><span>248 tests pass</span></div>
          <div className="phase-row"><span>01</span><div><b>Diagnose</b><small>Find the broad exception boundary</small></div></div>
          <div className="phase-row"><span>02</span><div><b>Implement</b><small>Narrow retry policy + add regression</small></div></div>
          <div className="phase-row"><span>03</span><div><b>Verify</b><small>Focused checks + full suite</small></div></div>
        </section>
      </div>
    </div>
  );
};

const Intro: FC = () => (
  <div className="title-scene">
    <div className="orb orb-one" />
    <div className="orb orb-two" />
    <div className="title-lockup">
      <div className="title-icon"><Sparkles /></div>
      <div className="kicker">NEMO PLATFORM · STANDALONE PLUGIN</div>
      <h1>Zoomer</h1>
      <p>See the outcome first.<br />Keep every claim connected to evidence.</p>
      <div className="title-tags"><span>SEMANTIC TRACE EXPLORATION</span><span>GROUNDED Q&amp;A</span></div>
    </div>
  </div>
);

const Extension: FC = () => (
  <div className="extension-scene">
    <div className="extension-copy">
      <div className="kicker">THE PLATFORM CONTRACT</div>
      <h1>Four fields unlock a native trace experience.</h1>
      <p>NeMo owns the secure host and rendering slot. The plugin owns the product.</p>
      <div className="contract-pills"><span>id</span><span>label</span><span>View</span><span>Activity?</span></div>
    </div>
    <div className="architecture">
      <section className="architecture-card nemo-card">
        <div className="architecture-icon"><Boxes /></div>
        <small>NEMO STUDIO</small>
        <strong>Generic plugin host</strong>
        <ul><li>trace view slot</li><li>auth + notifications</li><li>shared UI primitives</li></ul>
      </section>
      <div className="architecture-link"><Puzzle /><span>runtime discovery</span></div>
      <section className="architecture-card zoomer-card">
        <div className="architecture-icon"><Sparkles /></div>
        <small>STANDALONE REPOSITORY</small>
        <strong>nemo-zoomer-plugin</strong>
        <ul><li>service + persistence</li><li>semantic hierarchy</li><li>React UI + grounded Q&amp;A</li></ul>
      </section>
    </div>
  </div>
);

const CodeScene: FC = () => (
  <div className="code-scene">
    <div className="repo-card">
      <div className="repo-head"><FileCode2 /><div><b>ryana / nemo-zoomer-plugin</b><span>Public · Apache-2.0</span></div><div className="repo-status">● CI PASSING</div></div>
      <div className="repo-tree"><span>src/nemo_zoomer_plugin/</span><b>service.py</b><b>studio.py</b><b>web/dist/index.js</b></div>
    </div>
    <div className="code-window">
      <div className="code-title"><span /><span /><span /><b>web/src/index.ts</b></div>
      <pre><code><i>export const</i> traceViews = [&#123;{`\n`}  <em>id</em>: <q>"zoomer"</q>,{`\n`}  <em>label</em>: <q>"Zoomer"</q>,{`\n`}  <em>View</em>: ZoomerTraceView,{`\n`}  <em>Activity</em>: ZoomerTraceActivity,{`\n`}&#125;];</code></pre>
      <div className="entry-points"><span><b>nemo.services</b> → ZoomerService</span><span><b>nemo.studio</b> → StudioSpec</span></div>
    </div>
  </div>
);

const Closing: FC = () => (
  <div className="closing-scene">
    <Sparkles className="closing-spark" />
    <div className="kicker">THE BOTTOM LINE</div>
    <h1>Understand the run.<br /><span>Trust the evidence.</span></h1>
    <div className="closing-grid"><div><strong>FASTER</strong><span>Outcome before telemetry</span></div><div><strong>CLEARER</strong><span>One run, many altitudes</span></div><div><strong>EXTENSIBLE</strong><span>Deep UX, standalone plugin</span></div></div>
    <p>Zoomer for NeMo Platform</p>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const Demo: FC = () => {
  if (scene === "intro") return <Intro />;
  if (scene === "compare") return <RawVsMeaning />;
  if (scene === "extension") return <Extension />;
  if (scene === "code") return <CodeScene />;
  if (scene === "closing") return <Closing />;
  return (
    <QueryClientProvider client={queryClient}>
      <Chrome>
        <ZoomerTraceView host={host} trace={{ id: readyGeneration.trace_id, sessionId: "session-retry-fix" }} />
      </Chrome>
    </QueryClientProvider>
  );
};

ReactDOM.createRoot(document.getElementById("app")!).render(<Demo />);
