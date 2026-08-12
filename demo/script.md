# Zoomer demo — narration and storyboard

Target runtime: approximately two minutes. The deterministic coding-agent example shown in the video is representative demo data, rendered through the real Zoomer React trace view.

## 1. Bottom line

Agent traces have the evidence we need, but not the shape we need. Zoomer turns a long run into a semantic map—so the bottom line is visible first, and every claim stays connected to source events.

## 2. From telemetry to meaning

Here’s a simple coding run. The raw stream jumps among prompts, model reasoning, tool calls, logs, and retries. It is complete, but expensive to understand. Zoomer groups those events into the phases a reviewer actually asks about: diagnose, implement, and verify.

## 3. Semantic zoom inside Studio

Open Zoomer beside Studio’s existing Tree and List views. At the top, you see the outcome, duration, token cost, and major phases. Expand only the branch you need. One screen can mix summary-level context with span-level evidence.

## 4. One run, many altitudes

That semantic zoom matters: leadership gets the outcome; an engineer can drill into the failed test, inspect the retry, and see exactly what changed—without losing their place in the run.

## 5. Ask the trace

Every node is also a question context. Ask why the first attempt failed. Zoomer answers from that section, can inspect the wider trace when needed, and returns citations that jump back to the supporting node. The answer is useful, and auditable.

## 6. Built for long-running work

Hierarchy generation runs asynchronously and persists on the server. You can switch views or leave the page; progress and failure state remain truthful when you return. Regeneration is explicit and idempotent.

## 7. A small NeMo extension surface

The other half of the demo is how little NeMo had to know about Zoomer. NeMo exposes a generic trace-view slot and a shared host contract. The plugin exports an ID, label, React view, and optional activity indicator.

## 8. A genuinely standalone plugin

Everything specific—the service, generation jobs, database, UI, and Q&A—lives in its own public repository. Install the Python package, and entry-point discovery supplies both the backend service and Studio bundle. Remove it, and Tree and List behave exactly as before.

## 9. Close

That is the bottom line: Zoomer makes long agent runs faster to understand, easier to explain, and safer to trust. And NeMo gains a deeply integrated workflow without turning one feature into platform core.
