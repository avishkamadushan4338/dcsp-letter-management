import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev server proxies /api to the Effect backend so window.location + fetch's
// same-origin `/api` base path (see src/lib/api.ts) work identically to
// production, where the backend serves this app's build output directly.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
