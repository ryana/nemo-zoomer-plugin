# NeMo Zoomer Plugin

Zoomer adds a generated semantic view to NeMo Studio traces. It is a standalone
NeMo Platform plugin: the Python distribution contributes both the `zoomer`
service and a separately built Studio bundle.

The Studio view sits beside the built-in **Tree** and **List** trace modes. It
groups low-level telemetry into an explorable hierarchy, preserves generation
progress across navigation, and lets users ask grounded questions about any
node without leaving the trace.

## Compatibility

Zoomer uses the runtime web-plugin contract introduced by
[NVIDIA-NeMo/nemo-platform#594](https://github.com/NVIDIA-NeMo/nemo-platform/pull/594)
and the optional `traceViews` export proposed by
[ryana/nemo-platform#1](https://github.com/ryana/nemo-platform/pull/1).
Until the post-#594 `StudioSpec` ships in a stable `nemo-platform-plugin`
release, run Zoomer against NeMo Platform main or the PR #1 branch.

## Run from source

Set up NeMo Platform first, then build this repository's Studio bundle:

```bash
cd web
pnpm install --frozen-lockfile
pnpm build
cd ..
```

Run the platform with Zoomer installed into the command's environment:

```bash
export NMP_BASE_URL=http://localhost:8080
cd /path/to/nemo-platform
uv run --with-editable /path/to/nemo-zoomer-plugin \
  nemo services run --service-group all --port 8080
```

The plugin is discovered through standard Python entry points; it does not need
to be copied into the NeMo Platform monorepo. The built bundle lives inside the
wheel at `nemo_zoomer_plugin/web/dist/index.js`.

## Configuration

Generation accepts `NMP_ZOOMER_INFERENCE_API_KEY` or the existing
`INFERENCE_HUB_API_KEY`, `OPTIMIZER_INFERENCE_HUB_KEY`, and
`INFERENCE_HUB_KEY` aliases. Defaults:

- model: `azure/anthropic/claude-sonnet-4-6`
- endpoint: `https://inference-api.nvidia.com/v1`
- database: `$NMP_DATA_DIR/zoomer/generations.sqlite3`

Override them with `NMP_ZOOMER_INFERENCE_MODEL`,
`NMP_ZOOMER_INFERENCE_BASE_URL`, and `NMP_ZOOMER_DATABASE`.

## Development

```bash
uv sync --dev
uv run pytest
uv run ruff check

cd web
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

The stable dependency exercises the backend plus Zoomer's explicit
pre-`StudioSpec` failure. To exercise the full Studio registration before the
next plugin API release, point Python at a post-#594 NeMo Platform checkout:

```bash
PYTHONPATH=/path/to/nemo-platform/packages/nemo_platform_plugin/src uv run pytest
```

The browser bundle exports the standard `Root` and `navItems` symbols plus a
`traceViews` contribution. React, React Router, KUI, TanStack Query, and
`@nemo/common` stay external so the plugin runs inside Studio's provider tree
and uses Studio's authenticated shared cache and UI.

## License

Apache-2.0.
