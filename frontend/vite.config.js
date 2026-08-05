import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite config: proxy REST (/api) and WebSocket (/ws) to the backend Node.
// Se usa 127.0.0.1 (IPv4) para no chocar con relays de WSL en [::1]:8000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "heroui": ["@heroui/react"],
          "charts": ["chart.js", "react-chartjs-2"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
    },
  },
});