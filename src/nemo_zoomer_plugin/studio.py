# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Studio web UI registration for the Zoomer plugin."""

from pathlib import Path

from nemo_platform_plugin import interface as plugin_interface


def get_studio_spec() -> object:
    """Register Zoomer's independently built Studio bundle."""

    studio_spec = getattr(plugin_interface, "StudioSpec", None)
    if studio_spec is None:
        raise RuntimeError(
            "Zoomer's Studio UI requires the post-#594 nemo-platform-plugin API. "
            "Run against NeMo Platform main or a newer stable release."
        )
    bundle_path = Path(__file__).parent / "web" / "dist" / "index.js"
    return studio_spec(name="zoomer", bundle_path=bundle_path)
