import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config: proxy REST (/api) and WebSocket (/ws) to the FastAPI backend.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
