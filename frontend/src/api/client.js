// HTTP client for the monitoring API (single layer for all REST calls).

import { config } from "../config";
import { loadSession, notifySessionExpired } from "../auth/session";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function authHeaders() {
  const token = loadSession()?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      headers: { Accept: "application/json", ...authHeaders(), ...(options.headers ?? {}) },
      ...options,
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor de monitoreo.", null);
  }
  if (!response.ok) {
    let detail = `La API respondió con estado ${response.status}.`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
      else if (body?.message) detail = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {
      // keep the generic message
    }
    if (response.status === 401 && path !== "/api/auth/token") {
      notifySessionExpired();
    }
    throw new ApiError(detail, response.status);
  }
  return response.json();
}

export const api = {
  health: () => request("/api/health"),

  summary: () => request("/api/metrics/summary"),

  processes: ({ limit = 10, sortBy = "cpu" } = {}) => {
    const query = new URLSearchParams({ limit: String(limit), sort_by: sortBy });
    return request(`/api/metrics/processes?${query}`);
  },

  history: ({ limit = 200, since } = {}) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (since) query.set("since", since);
    return request(`/api/metrics/history?${query}`);
  },

  services: () => request("/api/services"),

  alerts: () => request("/api/alerts"),

  login: (username, password) =>
    request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    }),
};
