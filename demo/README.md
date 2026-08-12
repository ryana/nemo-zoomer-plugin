# Zoomer demo video

This directory contains the reproducible source for a two-minute Zoomer and NeMo Platform extensibility demo. The example coding-agent trace is deterministic representative data. The hierarchy, mixed-detail, question, and progress frames render the real `ZoomerTraceView`; the question panel uses a deterministic `AssistantChat` stand-in so the capture does not depend on a model endpoint.

The final edit includes:

- nine 1920×1080 scenes
- value-led lower thirds
- macOS Samantha narration at 195 words per minute
- burned English captions and an embedded English subtitle track
- subtle motion and scene fades

## Render

The capture harness expects this repository to be checked out at `tmp/nemo-zoomer-plugin` inside a bootstrapped NeMo Platform checkout. It reuses Studio’s current design-system CSS and Playwright installation.

Start the deterministic capture harness:

```bash
cd web
pnpm exec vite --config demo/vite.config.ts
```

From another shell at the plugin root, capture the UI and generate narration:

```bash
node demo/capture.mjs
./demo/generate_narration.sh
```

Render the video with the project’s uv environment and system FFmpeg:

```bash
uv run python demo/build_video.py
```

The final artifact is written to `demo/zoomer-nemo-demo.mp4`. Generated screenshots, audio, intermediate renders, and the MP4 remain untracked.

## Narrative

The approved narration and scene sequence live in [script.md](script.md). The video first establishes the value of semantic trace exploration, demonstrates hierarchy and grounded Q&A, then shows the generic four-field `traceViews` contract and the standalone Python/React plugin package.
