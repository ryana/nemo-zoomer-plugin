import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@nemo/common": fileURLToPath(new URL("./nemoCommon.tsx", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL("../../../..", import.meta.url))],
    },
  },
});
