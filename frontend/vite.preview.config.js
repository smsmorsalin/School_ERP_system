import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Temporary local preview config: proxy the API to the compose stack on :8080.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: false },
      "/media": { target: "http://127.0.0.1:8080", changeOrigin: false },
    },
  },
});
