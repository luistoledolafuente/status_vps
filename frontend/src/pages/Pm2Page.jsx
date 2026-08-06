// Página PM2: proyectos gestionados con PM2 (estado, métricas, logs en vivo
// y acciones de reinicio/parada/arranque). Requiere que el backend corra
// con el mismo usuario que gestiona PM2 en el servidor.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, Modal, useOverlayState } from "@heroui/react";
import { api, ApiError } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { formatBytes, formatPercent, formatUptime, formatTime } from "../utils/format";

const STATUS_META = {
  online: { label: "Activo", chip: "success" },
  launching: { label: "Iniciando", chip: "default" },
  "one-launch-status": { label: "Iniciando", chip: "default" },
  restarting: { label: "Reiniciando", chip: "warning" },
  undoing: { label: "Deteniendo", chip: "warning" },
  stopping: { label: "Deteniendo", chip: "warning" },
  stopped: { label: "Detenido", chip: "default" },
  errored: { label: "Con error", chip: "danger" },
  lost: { label: "Perdido", chip: "danger" },
  unknown: { label: "Desconocido", chip: "default" },
};

const ACTION_VERB = {
  restart: "reiniciar",
  stop: "detener",
  start: "arrancar",
};

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function ProcessRow({ process, role, onLogs, onAction, busyKey, logsBusy }) {
  const meta = STATUS_META[process.status] ?? STATUS_META.unknown;
  const canStop = process.status === "online";
  const canStart = process.status !== "online" && process.status !== "launching";
  const canRestart = process.status !== "launching" && process.status !== "one-launch-status";
  const busy = Boolean(busyKey) || logsBusy;
  const script = process.script ?? "—";

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{process.name}</p>
          {typeof process.id === "number" ? (
            <span className="font-data text-xs text-muted">id {process.id}</span>
          ) : null}
          <Chip color={meta.chip} variant="soft" size="sm">
            {meta.label}
          </Chip>
          {process.restarts > 0 ? (
            <span className="font-data text-xs text-muted">{process.restarts} reinicios</span>
          ) : null}
        </div>

        <div className="mt-1 hidden items-center gap-2 text-xs text-muted sm:flex">
          <span className="truncate" title={script}>
            {script}
          </span>
          {process.node_version ? <span className="font-data">node {process.node_version}</span> : null}
        </div>

        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div>
            <dt className="text-muted">Uptime</dt>
            <dd className="font-data text-foreground">
              {process.status === "online" ? formatUptime(process.uptime_seconds) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">CPU</dt>
            <dd className="font-data text-foreground">{formatPercent(process.cpu, 1)}</dd>
          </div>
          <div>
            <dt className="text-muted">Memoria</dt>
            <dd className="font-data text-foreground">{formatBytes(process.memory, 0)}</dd>
          </div>
          {process.pid ? (
            <div>
              <dt className="text-muted">PID</dt>
              <dd className="font-data text-foreground">{process.pid}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {role !== "admin" ? null : (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" size="sm" isDisabled={busy} onPress={() => onLogs(process)}>
            Logs en vivo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isDisabled={!canRestart || busy}
            isLoading={busyKey === `restart-${process.id ?? process.name}`}
            onPress={() => onAction(process, "restart")}
          >
            Reiniciar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isDisabled={!canStop || busy}
            isLoading={busyKey === `stop-${process.id ?? process.name}`}
            onPress={() => onAction(process, "stop")}
          >
            Detener
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isDisabled={!canStart || busy}
            isLoading={busyKey === `start-${process.id ?? process.name}`}
            onPress={() => onAction(process, "start")}
          >
            Arrancar
          </Button>
        </div>
      )}
    </li>
  );
}

function LogsModal({ target, onClose }) {
  const id = target?.id != null ? String(target.id) : String(target?.name ?? "");
  const state = useOverlayState({
    defaultOpen: true,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });
  const [logs, setLogs] = useState({ loading: true });
  const [stick, setStick] = useState(true);
  const [refreshAt, setRefreshAt] = useState(null);
  const preRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.pm2Logs({ id, lines: 400 });
      setLogs(res);
      setRefreshAt(new Date());
    } catch (err) {
      setLogs({ available: false, detail: err instanceof ApiError ? err.message : "No se pudieron leer los logs.", lines: [] });
    }
  }, [id]);

  useEffect(() => {
    void fetchLogs();
    const timer = window.setInterval(() => void fetchLogs(), 2000);
    return () => window.clearInterval(timer);
  }, [fetchLogs]);

  useEffect(() => {
    if (stick && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [logs?.lines?.length, logs?.loading, stick]);

  const handleScroll = useCallback((event) => {
    const el = event.currentTarget;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }, []);

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Modal.Heading className="min-w-0">
                  <span className="truncate">{target?.name ?? "…"}</span>
                  {typeof target?.id === "number" ? <span className="text-muted"> · id {target.id}</span> : null}
                </Modal.Heading>
                <Chip color="success" variant="soft" size="sm" className="shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-success status-pulse" />
                  En vivo · cada 2 s
                </Chip>
              </div>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body className="p-0">
              {logs.loading && logs.lines?.length === 0 ? (
                <Skeleton rows={8} />
              ) : logs?.available && logs.lines.length > 0 ? (
                <div className="relative">
                  <pre
                    ref={preRef}
                    onScroll={handleScroll}
                    className="max-h-[16rem] min-h-[16rem] overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface-secondary p-3 text-xs leading-relaxed text-foreground ring-1 ring-border sm:max-h-[60vh]"
                  >
                    {logs.lines.join("\n")}
                  </pre>
                  {!stick ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStick(true);
                        if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
                      }}
                      className="absolute inset-x-0 bottom-1 mx-auto w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-black/10 transition hover:bg-accent/90"
                    >
                      ↓ Ir al final
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">{logs?.detail || "Sin líneas de log."}</p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <span className="font-data text-xs text-muted">
                {logs?.lines?.length != null ? `${logs.lines.length} líneas` : ""}
                {refreshAt ? ` · ${formatTime(refreshAt)}` : ""}
              </span>
              <Button variant="secondary" size="sm" onPress={() => void fetchLogs()}>
                Refrescar ahora
              </Button>
              <Button variant="primary" size="sm" onPress={onClose}>
                Cerrar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function ActionConfirmModal({ confirm, error, busy, onCancel, onConfirm }) {
  const state = useOverlayState({
    defaultOpen: true,
    onOpenChange: (open) => {
      if (!open) onCancel();
    },
  });
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Confirmar acción</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-foreground">
                ¿Seguro que quieres <strong>{ACTION_VERB[confirm?.action] ?? "manejar"}</strong> el proyecto{" "}
                <strong className="font-data">{confirm?.process?.name}</strong>?
              </p>
              <p className="mt-1 text-xs text-muted">
                La acción se ejecuta con PM2 en el servidor; la tabla se actualizará automáticamente.
              </p>
              {error ? (
                <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger ring-1 ring-danger/30">{error}</p>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" size="sm" isDisabled={Boolean(busy)} onPress={onCancel}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" isLoading={Boolean(busy)} onPress={onConfirm}>
                {ACTION_VERB[confirm?.action] && confirm ? `Sí, ${ACTION_VERB[confirm.action]}` : "Confirmar"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function Pm2Page({ session }) {
  const isAdmin = session?.role === "admin";
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tick, setTick] = useState(0);
  const [logsTarget, setLogsTarget] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmError, setConfirmError] = useState(null);

  async function load() {
    try {
      const r = await api.pm2();
      setResponse(r);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo consultar PM2.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void load();
  }, [tick]);

  const handleAction = (process, action) => {
    setConfirmError(null);
    setConfirm({ process, action });
  };

  async function applyAction(process, action) {
    setConfirm(null);
    setConfirmError(null);
    setBusy(`${action}-${process.id ?? process.name}`);
    try {
      await api.pm2Action(process.id != null ? String(process.id) : process.name, action);
      await load();
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : "La acción falló.");
    } finally {
      setBusy(null);
    }
  }

  const counts = useMemo(() => {
    const processes = response?.processes ?? [];
    const totals = { total: processes.length, online: 0, stopped: 0, errored: 0 };
    for (const process of processes) {
      if (process.status === "online") totals.online += 1;
      else if (process.status === "errored") totals.errored += 1;
      else if (process.status === "stopped") totals.stopped += 1;
    }
    return totals;
  }, [response]);

  return (
    <Card
      title="Proyectos PM2"
      subtitle={
        response?.processes?.length
          ? `${response.processes.length} proyectos · ${counts.online} activos · actualiza cada 10 s`
          : "Procesos gestionados con PM2"
      }
      actions={
        <div className="flex items-center gap-2">
          {isAdmin ? <Badge variant="info">Solo admin gestiona</Badge> : <Badge variant="neutral">Solo lectura</Badge>}
          <Button variant="secondary" size="sm" isDisabled={loading} onPress={() => setTick((t) => t + 1)}>
            <RefreshIcon />
            Actualizar
          </Button>
        </div>
      }
    >
      {error ? (
        <EmptyState
          title="No se pudo consultar PM2"
          description={`El backend no respondió: ${error}. Intenta de nuevo o revisa el estado del servicio.`}
          action={
            <Button variant="secondary" size="sm" onPress={() => setTick((t) => t + 1)}>
              Reintentar
            </Button>
          }
        />
      ) : loading && !response ? (
        <Skeleton rows={4} />
      ) : response && !response.available ? (
        <EmptyState
          title="PM2 no está disponible"
          description={response.detail}
          action={
            <Button variant="secondary" size="sm" onPress={() => setTick((t) => t + 1)}>
              Reintentar
            </Button>
          }
        />
      ) : !response?.processes?.length ? (
        <EmptyState title="Sin proyectos PM2" description="PM2 está activo pero no hay procesos registrados." />
      ) : (
        <ul className="divide-y divide-border">
          {response.processes.map((process) => (
            <ProcessRow
              key={`${process.id ?? ""}-${process.name}`}
              process={process}
              role={session?.role}
              onLogs={setLogsTarget}
              onAction={handleAction}
              busyKey={busy}
            />
          ))}
        </ul>
      )}

      {logsTarget ? <LogsModal target={logsTarget} onClose={() => setLogsTarget(null)} /> : null}

      {confirm ? (
        <ActionConfirmModal
          confirm={confirm}
          error={confirmError}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => confirm && applyAction(confirm.process, confirm.action)}
        />
      ) : null}
    </Card>
  );
}