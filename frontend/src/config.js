// Entorno del frontend: configuración derivada de variables VITE_*.

function defaultWsUrl() {
  // En desarrollo el proxy de Vite redirige /ws al backend (mismo origen).
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws/metrics`;
}

export const config = {
  apiBase: import.meta.env.VITE_API_BASE_URL ?? "",
  wsUrl: import.meta.env.VITE_WS_URL ?? defaultWsUrl(),
};
