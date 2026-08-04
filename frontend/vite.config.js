import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración base de Vite.
// El proxy evita problemas de CORS en desarrollo: /api -> backend FastAPI.
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
    },
  },
});
