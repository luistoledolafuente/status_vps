// Cliente HTTP de la API.
// En desarrollo usa el proxy de Vite (misma URL relativa).
// Para apuntar a otra API, definir VITE_API_BASE_URL (p. ej. https://host:8000).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor de monitoreo.", null);
  }
  if (!response.ok) {
    throw new ApiError(`La API respondió con estado ${response.status}.`, response.status);
  }
  return response.json();
}

export const api = {
  health: () => request("/api/health"),

  summary: () => request("/api/metrics/summary"),

  processes: ({ limit = 10, sortBy = "cpu" } = {}) => {
    const query = new URLSearchParams({
      limit: String(limit),
      sort_by: sortBy,
    });
    return request(`/api/metrics/processes?${query}`);
  },

  services: () => request("/api/services"),
};
