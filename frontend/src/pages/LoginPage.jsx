// Pantalla de acceso: solicita credenciales y conserva la sesión JWT.

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { api, ApiError } from "../api/client";
import { saveSession } from "../auth/session";

export function LoginPage({ onAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // HeroUI v3 pasa el evento (o el valor crudo): normalizamos ambos.
  const fromEvent = (valueOrEvent) =>
    typeof valueOrEvent === "string" ? valueOrEvent : (valueOrEvent?.target?.value ?? "");

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await api.login(fromEvent(username).trim(), fromEvent(password));
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5h16M4 12h16M4 19h10" strokeLinecap="round" />
              <circle cx="20" cy="19" r="2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Monitor del Servidor</h1>
            <p className="text-xs text-muted">Inicia sesión para continuar</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-surface p-6 shadow-surface ring-1 ring-border"
        >
          <Input
            type="text"
            label="Usuario"
            value={fromEvent(username)}
            onChange={setUsername}
            autoComplete="username"
          />
          <Input
            type="password"
            label="Contraseña"
            value={fromEvent(password)}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" color="primary" size="md" isDisabled={submitting} className="w-full" onPress={handleSubmit}>
            {submitting ? "Ingresando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}