// Tarjeta de canales de notificación: estado de correo/Telegram/webhook y
// envío de mensajes de prueba. La configuración vive en el .env del backend
// (variables SYSSTATUS_SMTP_* y SYSSTATUS_TELEGRAM_*).

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { api, ApiError } from "../api/client";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

const CHANNELS_META = {
  email: {
    label: "Correo (SMTP)",
    description: "Se envía un correo por cada alerta activada o resuelta.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
telegram: {
    label: "Telegram",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M21 4L3 11l6 2 2 6 3-4 6 3 1-14z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 13l4-3 4 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  webhook: {
    label: "Webhook",
    description: "POST JSON a una URL al dispararse una alerta.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M10 13l4-2 1 3-4 3-1-4z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11l3-2a4 4 0 1 1 2 5l-2 1M10 13l-3 2a4 4 0 1 1-2 5l2 1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

function ChannelRow({ kind, meta, configured, details, testing, result, onTest }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted ring-1 ring-border">
          {meta.icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{meta.label}</p>
            <Badge variant={configured ? "success" : "neutral"}>
              {configured ? "Configurado" : "Sin configurar"}
            </Badge>
            {result != null ? (
              <Badge variant={result ? "success" : "critical"}>
                {result ? "Enviado" : "Falló"}
              </Badge>
            ) : null}
          </div>
          {configured ? (
            <p className="mt-0.5 font-data truncate text-xs text-muted" title={details}>
              {details}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted">Añade las variables de entorno del backend y reinícialo.</p>
          )}
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        isDisabled={!configured}
        isLoading={testing}
        onPress={() => onTest(kind)}
        className="shrink-0"
      >
        Enviar prueba
      </Button>
    </li>
  );
}

export function NotificationChannelsCard() {
  const [channels, setChannels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState({});
  const [results, setResults] = useState({});
  const [notice, setNotice] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.alertChannels();
      setChannels(response.channels ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron consultar los canales.");
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const runTest = async (channel) => {
    setTesting((prev) => ({ ...prev, [channel]: true }));
    setNotice(null);
    try {
      const response = await api.testNotification(channel);
      setResults((prev) => ({ ...prev, [channel]: response.sent?.[channel] ?? false }));
    } catch (err) {
      setResults((prev) => ({ ...prev, [channel]: false }));
      setNotice(err instanceof ApiError ? err.message : "La prueba falló.");
    } finally {
      setTesting((prev) => ({ ...prev, [channel]: false }));
    }
  };

  const runAll = async () => {
    setNotice(null);
    try {
      const response = await api.testAllNotifications();
      setResults(response.sent ?? {});
      if (response.message) setNotice(response.message);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "La prueba falló.");
    }
  };

  const hasConfigured = channels?.some((c) => c.configured) ?? false;

  return (
    <Card
      title="Canales de notificación"
      subtitle="Las alertas se envían por los canales configurados. Usa «Enviar prueba» para verificarlos."
      actions={
        <Button variant="secondary" size="sm" isDisabled={!hasConfigured || Object.values(testing).some(Boolean)} onPress={runAll}>
          Probar todos
        </Button>
      }
    >
      {loading ? (
        <Skeleton rows={3} />
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm text-danger ring-1 ring-inset ring-danger/30">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onPress={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-separator rounded-xl ring-1 ring-border-secondary">
          {channels.map((channel) => {
            const meta = CHANNELS_META[channel.kind] ?? { label: channel.kind, icon: null };
            return (
              <ChannelRow
                key={channel.kind}
                kind={channel.kind}
                meta={meta}
                configured={channel.configured}
                details={channel.details}
                testing={Boolean(testing[channel.kind])}
                result={results[channel.kind]}
                onTest={(kind) => void runTest(kind)}
              />
            );
          })}
        </ul>
      )}

      {notice ? (
        <p role="status" className="mx-4 mt-3 text-xs text-muted">
          {notice}
        </p>
      ) : null}
    </Card>
  );
}