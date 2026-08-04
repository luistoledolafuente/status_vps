// Alerts view: active + recently resolved alerts with configured thresholds.

import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Skeleton } from "./ui/Skeleton";
import { formatDateTime } from "../utils/format";

const SEVERITY_VARIANT = {
  critical: "critical",
  warning: "warning",
  info: "info",
};

function AlertRow({ alert }) {
  const resolved = alert.state === "resolved";
  return (
    <li className={`flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-secondary ${resolved ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={SEVERITY_VARIANT[alert.severity] ?? "info"}>
            {alert.severity === "critical" ? "Crítico" : alert.severity === "warning" ? "Aviso" : "Info"}
          </Badge>
          <p className="text-sm font-semibold text-foreground">{alert.title}</p>
        </div>
        <span className="font-data text-xs text-muted">
          {formatDateTime(alert.last_seen)}
          {resolved ? ` · resuelta ${formatDateTime(alert.resolved_at)}` : ""}
        </span>
      </div>
      <p className="text-sm text-muted">{alert.message}</p>
      <p className="text-xs text-muted">
        <span className="font-medium text-foreground">Sugerencia: </span>
        {alert.tip}
      </p>
    </li>
  );
}

export function AlertList({ response, loading }) {
  if (loading && !response) {
    return (
      <Card title="Alertas del sistema">
        <Skeleton rows={4} />
      </Card>
    );
  }

  const thresholds = response?.thresholds;
  const alerts = response?.alerts ?? [];
  const active = alerts.filter((alert) => alert.state === "active");
  const resolved = alerts.filter((alert) => alert.state === "resolved");

  const thresholdChips = thresholds
    ? [
        `CPU > ${thresholds.cpu_warning}%`,
        `CPU > ${thresholds.cpu_critical}%`,
        `Memoria > ${thresholds.memory_warning}%`,
        `Memoria > ${thresholds.memory_critical}%`,
        `Disco > ${thresholds.disk_warning}%`,
        `Disco > ${thresholds.disk_critical}%`,
      ].concat(
        thresholds.traffic_warning != null ? [`Tráfico > ${thresholds.traffic_warning}% de cuota`, `Tráfico > ${thresholds.traffic_critical}% de cuota`] : [],
        thresholds.anomaly_critical != null ? [`Anomalía > ${thresholds.anomaly_critical} puntos`] : []
      )
    : [];

  return (
    <Card
      title="Alertas del sistema"
      subtitle="Se generan al superar los umbrales configurados y se resuelven solas al normalizarse."
      actions={
        thresholds ? (
          <div className="flex flex-wrap gap-1.5">
            {thresholdChips.map((chip) => (
              <Badge key={chip} variant="neutral">
                {chip}
              </Badge>
            ))}
          </div>
        ) : null
      }
    >
      {active.length === 0 ? (
        <EmptyState
          title="No hay alertas activas"
          description="El sistema se encuentra dentro de los umbrales configurados. Las alertas aparecerán aquí cuando algo requiera atención."
        />
      ) : (
        <div className="mb-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Activas ({active.length})
          </p>
          <ul className="divide-y divide-separator rounded-xl bg-danger-soft ring-1 ring-danger/20">
            {active.map((alert) => (
              <AlertRow key={alert.key} alert={alert} />
            ))}
          </ul>
        </div>
      )}

      {resolved.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Resueltas recientemente ({resolved.length})
          </p>
          <ul className="divide-y divide-separator rounded-xl ring-1 ring-border-secondary">
            {resolved.map((alert) => (
              <AlertRow key={alert.key} alert={alert} />
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}