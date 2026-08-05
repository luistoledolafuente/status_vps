// Pantalla de acceso: solicita credenciales y conserva la sesión JWT.
// Usa campos nativos con estilos propios (.field/.btn-primary) para que el
// formulario sea visible en ambos temas, independientemente del CSS de HeroUI.

import { useState } from "react";
import { api, ApiError } from "../api/client";
import { saveSession } from "../auth/session";

const EyeIcon = ({ closed }) =>
  closed ? (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-2.4 3.2M6.6 6.6A17 17 0 0 0 2 12s3 7 10 7a9.8 9.8 0 0 0 5.4-1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

export function LoginPage({ onAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (submitting) return;
    if (!username.trim() || !password) {
      setError("Introduce usuario y contraseña.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await api.login(username.trim(), password);
      saveSession(session);
      onAuthenticated(session);
    } catch (err) {
      console.error("login failed", err);
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-[0_10px_28px_-10px] shadow-cyan-600/60 ring-1 ring-white/20">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5h16M4 12h16M4 19h10" strokeLinecap="round" />
              <circle cx="20" cy="19" r="2" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Monitor del Servidor</h1>
            <p className="mt-0.5 text-sm text-muted">Inicia sesión para acceder a las métricas</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-2xl bg-surface p-6 shadow-surface ring-1 ring-border sm:p-8"
        >
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="block text-sm font-medium text-foreground">
              Usuario
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="admin"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-foreground">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="field pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition-colors hover:text-foreground focus-visible:outline-none"
              >
                <EyeIcon closed={showPassword} />
              </button>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm text-danger ring-1 ring-inset ring-danger/30"
            >
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          ) : null}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                </svg>
                Ingresando…
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Panel protegido · sesión segura mediante token JWT
        </p>
      </div>
    </main>
  );
}