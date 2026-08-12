// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const STUDIO_SHARED_DEPS = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "react-router",
  "@nvidia/foundations-react-core",
  "@tanstack/react-query",
  "@nemo/common",
];

const rejectDeepSharedImports = (): Plugin => ({
  name: "reject-deep-shared-imports",
  enforce: "pre",
  resolveId(id: string, importer: string | undefined) {
    if (id.startsWith("@nemo/common/")) {
      throw new Error(
        `Deep import "${id}"${importer ? ` from ${importer}` : ""}. ` +
          'Only the bare "@nemo/common" specifier is shared by Studio.',
      );
    }
    return null;
  },
});

const LICENSE_BANNER =
  "// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.\n" +
  "// SPDX-License-Identifier: Apache-2.0";

export default defineConfig({
  plugins: [react(), rejectDeepSharedImports()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "../src/nemo_zoomer_plugin/web/dist",
    emptyOutDir: true,
    rolldownOptions: {
      external: STUDIO_SHARED_DEPS,
      output: { banner: LICENSE_BANNER },
    },
  },
});
