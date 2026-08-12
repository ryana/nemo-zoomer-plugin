# Zoomer contextual Q&A

## Status

This document defines the first implementation of contextual question answering
inside the Zoomer trace view. The work is tracked by AIRE-836 and remains part
of the existing Zoomer plugin branch.

The implementation is deliberately Zoomer-specific. It uses the optional
`traceViews` export in the general Studio web-plugin contract and the shared
`AssistantChat` primitive, while keeping the backend, panel behavior,
retrieval, and citation navigation inside this repository.

## Goal

Let a user ask grounded questions about any section of a generated Zoomer
hierarchy without leaving the trace page. The selected section is the focus of
the question, while the assistant may inspect the complete semantic hierarchy
and raw trace evidence when the answer requires broader context.

This should demonstrate both the practical value of Zoomer's semantic trace
representation and the ability of a NeMo Platform plugin to add a native,
model-backed Studio workflow.

## Product requirements

### Entry points and layout

- Every semantic node has an **Ask a question** action, including raw model,
  tool, and event leaves.
- The action is available whether the node is expanded or collapsed.
- The action opens a nonmodal panel on the right so the hierarchy remains
  visible and usable. The desktop target width is approximately 560 px. On a
  narrow viewport the panel may use the full available width.
- The panel identifies the selected node with its title, type, and breadcrumb.
- The selected node is visually identified in the hierarchy while its panel is
  open.
- The existing node header must be split into separate expand/collapse and Ask
  controls; an interactive control must not be nested inside another button.

### Conversation behavior

- The selected node is the question's primary focus, not a hard retrieval
  boundary. The assistant can navigate to parents, siblings, other branches,
  and raw events across the trace.
- Answers use the platform's configured backend inference model. The UI does
  not expose a model picker and the client cannot override the configured
  model.
- Answers stream into the panel.
- The user can stop an in-progress answer and retry the last question.
- The user can clear the current conversation and start over.
- The empty state provides three editable starter prompts adapted to the
  selected node's type and summary. Deterministic client-side templates are
  sufficient; opening the panel must not make a separate inference request just
  to generate suggestions. Generic fallbacks include:
  - What happened in this section?
  - Why did the agent do this?
  - Were there any failures or recoveries?
- Selecting a starter prompt places it in the composer so the user can edit it
  before sending.
- Answers are read-only. The assistant cannot modify the trace, hierarchy,
  session, evaluation data, or platform configuration.

### Ephemeral lifecycle

- There is one in-memory conversation for the node currently selected on the
  page.
- Closing and reopening the panel for the same node restores that conversation
  while the trace page remains mounted.
- Selecting Ask on a different node cancels an in-flight response, clears the
  prior conversation, and starts a new conversation focused on the new node.
- Reloading the page or navigating away clears the conversation.
- No messages, server-side sessions, or conversation metadata are persisted.
- Each request includes the conversation transcript needed for that response.

### Grounding and answer quality

- The assistant answers from the persisted Zoomer hierarchy and normalized raw
  trace evidence. Trace content is untrusted data, not instructions to the
  assistant.
- The prompt clearly distinguishes the selected focus node from globally
  available trace context.
- The assistant distinguishes observed facts from interpretations. If the
  available trace does not support an answer, it says so.
- The assistant does not claim access to a model's hidden reasoning or invent
  intent that is absent from the trace.
- Answers should be concise by default and expand when the question requires
  detail.

### Citations

Citations are required before AIRE-836 is complete, but follow the core chat
experience so the streaming and retrieval path can be validated first.

- Answers cite Zoomer semantic nodes and raw event leaves used as evidence.
- The backend validates cited identifiers against the current generated
  hierarchy; the model cannot create arbitrary navigation targets.
- Selecting a citation keeps the panel open, expands the cited node's
  ancestors, scrolls it into view, and applies a temporary highlight.
- Raw event citations retain their associated span identifier in metadata. A
  direct link into another Intake presentation can be added later without
  changing the first citation contract.

## Proposed user flow

1. The user generates or opens a ready Zoomer hierarchy.
2. The user selects **Ask a question** on any node.
3. Studio opens the right panel with the node context and starter prompts.
4. The user asks a question or edits a starter prompt.
5. The backend inspects a compact trace outline and uses read-only retrieval
   tools to gather relevant hierarchy nodes or raw events.
6. The final grounded answer streams into the panel.
7. The user may stop, retry, ask a follow-up, or select a citation to reveal
   its evidence in the hierarchy.

## Architecture

### Boundary

The feature remains inside the Zoomer plugin:

- The backend endpoint is owned by `nemo_zoomer_plugin`.
- The Studio bundle and panel are Zoomer components used only by the Zoomer trace view.
- Existing platform authentication, Intake export, inference configuration,
  and shared chat primitives are reused.
- The plugin exports one `traceViews` definition from its runtime-loaded web bundle.
- No SDK regeneration is needed because this plugin endpoint is consumed as a
  custom OpenAI-compatible endpoint, matching the existing plugin API pattern.

### Request endpoint

Expose an OpenAI-compatible streaming endpoint scoped to the trace and focus
node:

```text
POST /apis/zoomer/v1/workspaces/{workspace}/traces/{trace_id}/nodes/{node_id}/-/v1/chat/completions
```

The plugin router path is:

```text
/v1/workspaces/{workspace}/traces/{trace_id}/nodes/{node_id}/-/v1/chat/completions
```

Studio passes the path ending in `/-/v1` to the existing chat client, which
appends `/chat/completions`. The request uses the OpenAI chat-completion shape
and requests streaming. The browser sends user and assistant transcript
messages. System messages and unsupported roles are rejected; the backend owns
the system prompt.

The client supplies a fixed sentinel model name such as `zoomer-context`. The
backend ignores that value and always selects the Zoomer service's configured
inference model. This preserves compatibility with the shared chat client
without exposing provider selection.

### Evidence model

The persisted semantic hierarchy remains the source for summaries, node
relationships, metrics, and stable navigation identifiers. Full normalized
events are reloaded through the authorized Intake trace export because leaf
display text is intentionally truncated and is not sufficient for Q&A.

An in-memory, bounded, time-limited evidence cache may retain normalized events
and a lexical index by workspace and trace ID. It is a performance cache, not
conversation persistence. It must be safe to miss or evict at any time.

Version one uses hierarchy navigation and lexical search rather than adding an
embedding service or database. This keeps the feature plugin-local and makes
the retrieval path inspectable in a demo.

### Read-only tools

The model can request only these server-executed tools:

- `get_node(node_id)`: Return the node summary, breadcrumb, metrics, immediate
  child descriptors, and source span identifiers.
- `list_children(node_id)`: Return a compact list of immediate children for
  deliberate hierarchy navigation.
- `search_trace(query, node_id?)`: Search normalized event content either
  globally or below an optional node and return bounded matches with node and
  span identifiers.
- `get_event(event_node_id, offset, limit)`: Return a bounded page of one full
  normalized raw event so large events can be inspected without placing the
  entire event in context.

Tool arguments are schema-validated. The server confirms that each node or
event belongs to the requested trace. There are no mutation tools.

### Answer pipeline

1. Authorize the principal for the workspace and export access.
2. Require a ready generated hierarchy and validate the focus node.
3. Load or build the normalized trace evidence index.
4. Give the model a compact whole-trace outline, the focus node and breadcrumb,
   the conversation transcript, and the read-only tool definitions.
5. Run a bounded, nonstreaming retrieval/tool loop using the configured model.
6. Give the model the collected evidence and stream the final answer as
   OpenAI-compatible server-sent events.
7. Validate source identifiers gathered during retrieval and append citation
   metadata or a final Sources section through the same stream.
8. Cancel upstream inference and further tool work when the client disconnects.

Retrieval may introduce a delay before the first answer token. During that
period the panel shows an explicit inspecting-trace state rather than an empty
assistant bubble.

### Initial safety and size limits

Make limits configurable, with these initial defaults:

- At most 6 model retrieval/tool rounds per answer.
- At most 12 recent conversation messages included in a request.
- At most 12,000 characters returned by one event page.
- At most 160,000 characters of accumulated trace evidence per answer.
- At most 4,000 generated answer tokens.
- Strict length limits on individual user messages and search queries.

If a limit is reached, the assistant answers with the evidence it has and does
not silently imply that the entire trace was inspected.

### Streaming, stop, and retry

The final-answer stage emits standard OpenAI chat-completion SSE chunks so the
existing Studio chat hook can render the stream. Tool activity is not exposed
as editable messages. A small status label may show that the trace is being
inspected.

The existing client abort controller implements Stop. The backend observes the
disconnect and cancels its provider request and tool loop. Retry resubmits the
last user message with the retained in-page transcript.

### Citation navigation contract

Each rendered hierarchy node gets a stable DOM anchor derived from its Zoomer
node ID. The recursive tree moves expansion state into a small controller owned
by `TracePluginView` so a citation can expand every ancestor before scrolling.

Citation targets use validated node IDs, for example:

```text
#zoomer-node=event-123
```

The renderer intercepts these links, reveals the target, scrolls it into view,
and applies a temporary highlight. It does not navigate away or close the Q&A
panel.

## Failure behavior

- `404`: the trace generation or selected node does not exist.
- `409`: the Zoomer hierarchy is not ready for questioning.
- `422`: the request transcript, role, or tool argument is invalid.
- `503`: no configured inference backend is available.
- `502`: the configured inference backend failed; return a sanitized message.
- Client disconnect: cancel work without persisting partial conversation state.

Errors appear in the panel with Retry when retrying is meaningful. No provider
secrets, raw authorization failures, or unbounded trace content are returned to
the browser or written to application logs.

## Implementation plan

### Phase 1: Backend evidence and model capability spike

1. Confirm the configured inference endpoint and default model support the tool
   calling shape used by the Zoomer service. Fail clearly if they do not; do not
   emulate unsupported tool calls with fragile text parsing.
2. Add a Zoomer-local evidence index with node lookup, breadcrumb lookup,
   descendant membership, lexical event search, and paginated event reads.
3. Add typed request validation and a direct, grounded nonstreaming answer path
   to validate prompts, evidence limits, and configured-model selection.
4. Unit test lookup correctness, trace ownership checks, truncation, limits,
   prompt-injection framing, and failure responses.

Likely new backend modules:

```text
plugins/nemo-zoomer/src/nemo_zoomer_plugin/questioning.py
plugins/nemo-zoomer/src/nemo_zoomer_plugin/question_api.py
plugins/nemo-zoomer/tests/test_questioning.py
```

`service.py` should need only route wiring and access to existing store and
inference configuration.

### Phase 2: Bounded retrieval and streaming

1. Implement the four read-only tools and the bounded model/tool loop.
2. Add the OpenAI-compatible streaming adapter for the final response.
3. Propagate cancellation from the HTTP disconnect to inference and retrieval.
4. Add structured operational metrics for trace ID, focus node ID, latency,
   tool counts, evidence size, completion status, and errors. Do not log prompts
   or event content.
5. Test SSE shape, forced configured-model selection, cancellation, upstream
   failures, and round/evidence budgets.

### Phase 3: Zoomer sidebar

1. Add a `ZoomerQuestionPanel` beside the existing trace component, reusing the
   shared assistant chat transport and Studio `SidePanel` primitives.
2. Refactor semantic node headers into accessible expand and Ask controls.
3. Add selected-node state, panel lifecycle state, and abort/remount behavior
   for node switching.
4. Add the selected-node header, inspecting state, streaming answer, Stop,
   Retry, Clear, and node-aware editable starter prompts.
5. Test Ask availability at every node type, keyboard behavior, open/close
   retention, node-switch clearing, streaming, stop, retry, and error states.

Likely new frontend files:

```text
web/packages/studio/src/components/IntakeDetail/ZoomerQuestionPanel.tsx
web/packages/studio/src/components/IntakeDetail/ZoomerQuestionPanel.test.tsx
```

`TracePluginView.tsx` should contain only the integration and tree-state changes
that cannot live in the new component.

### Phase 4: Citations and hierarchy reveal

1. Capture retrieved source IDs and validate them before rendering citations.
2. Render source links in streamed answers.
3. Add controlled ancestor expansion, stable node anchors, scroll-to-node, and
   transient highlight behavior.
4. Test valid and invalid citation IDs, raw event citations, hidden descendant
   reveal, and repeated navigation while the panel remains open.

### Phase 5: Real-trace hardening and demo validation

1. Exercise the feature on the imported 34-span production trace used for the
   Zoomer demo, including root, intermediate, and raw-event questions.
2. Verify a focused question can retrieve supporting evidence elsewhere in the
   trace.
3. Verify unsupported questions get an explicit insufficient-evidence answer.
4. Verify large events are paginated and evidence budgets are enforced.
5. Verify Stop cancels work, Retry succeeds, node switching clears, close/open
   retains, and page reload clears.
6. Run focused backend tests, Studio tests, lint, type checking, and production
   builds; restart the local platform and complete a browser smoke test.

## Acceptance criteria

- Every Zoomer node, including raw event leaves, exposes an accessible Ask
  action in expanded and collapsed states.
- The right panel keeps the hierarchy visible, identifies the focus node, and
  offers three node-aware starter prompts that can be edited before sending.
- The configured backend model answers with streamed, trace-grounded responses;
  there is no model picker or client model override.
- The selected node is the focus while the assistant can use bounded read-only
  tools to inspect the entire hierarchy and raw trace.
- Stop, Retry, Clear, close/reopen retention, node-switch clearing, and reload
  clearing behave as specified.
- The feature performs no trace or platform mutations and persists no chat
  history.
- Answers distinguish evidence from inference and explicitly report when the
  trace does not support an answer.
- Citations reveal, scroll to, and highlight validated Zoomer node or event
  targets without closing the panel.
- Focused backend and Studio tests, lint, type checks, builds, service restart,
  and the real-trace browser smoke test pass.
- The implementation remains Zoomer-specific and does not change the global
  Studio trace-view plugin contract.

## Risks and mitigations

- **Configured model lacks reliable tool calling:** validate this first and
  fail explicitly. Do not commit to a text-parsing substitute without a new
  product decision.
- **Long delay before first token:** show retrieval status, bound tool rounds,
  cache the normalized evidence index, and measure retrieval latency.
- **Prompt injection in trace content:** label all trace evidence as untrusted
  data, keep tool execution server-side, and expose only fixed read-only tools.
- **Large traces exhaust context or memory:** send a compact outline, page raw
  events, cap accumulated evidence, and use a bounded TTL cache.
- **Incorrect citations undermine trust:** cite only server-observed retrieval
  sources and validate every target against the hierarchy.
- **Citation reveal destabilizes tree state:** centralize only the expansion
  state needed for navigation and preserve the current recursive node rendering
  structure.

## Out of scope

- Persistent or shareable conversations.
- A model picker or per-chat inference configuration.
- Write actions, remediation, trace annotations, or regenerated summaries.
- A generic Q&A capability in the platform plugin contract.
- Embedding infrastructure or semantic-vector indexing.
- Cross-trace questions.
- Direct navigation into other Intake presentations beyond metadata retained
  for a later follow-up.
