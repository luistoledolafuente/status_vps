// Sesión del panel: token JWT persistido en localStorage.

const SESSION_KEY = "sysstatus.session";
export const SESSION_EXPIRED_EVENT = "sysstatus:session-expired";

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function notifySessionExpired() {
  clearSession();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}
