// Availability checks: HTTP(S) and TCP probes with latency and status.

import { Chip } from "@heroui/react";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Skeleton } from "./ui/Skeleton";
import { formatDateTime } from "../utils/format";

const STATE_STYLES = {
  up: { color: "success", label: "Operativo" },
  down: { color: "danger", label: "Sin respuesta" },
  unknown: { color: "default", label: "Sin verificar" },
};

function StatePill({ state }) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.unknown;
  return (
    <Chip color={style.color} variant="soft" size="sm">
      {style.label}
    </Chip>
  );
}

export function AvailabilityChecks({ checks = [], loading }) {
  if (loading && checks.length === 0) {
    return (
      <Card title="Disponibilidad de servicios" subtitle="Comprobaciones HTTP y TCP">
        <Skeleton rows={3} />
      </Card>
    );
  }

  return (
    <Card title="Disponibilidad de servicios" subtitle="Comprobaciones HTTP y TCP de tus servicios">
      {checks.length === 0 ? (
        <EmptyState
          title="Sin comprobaciones configuradas"
          description="Define objetivos en la variable SYSSTATUS_CHECKS (ej. nginx=http://localhost, ssh=tcp://localhost:22)."
        />
      ) : (
        <ul className="divide-y divide-separator">
          {checks.map((check) => (
            <li key={check.name} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">{check.name}</span>
                  <span className="hidden truncate font-mono text-xs text-muted sm:inline">{check.target}</span>
                </div>
                {check.state === "down" ? (
                  <p className="mt-0.5 truncate text-xs text-danger">{check.error}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted">
                    {check.checked_at ? `Última comprobación: ${formatDateTime(check.checked_at)}` : "Aún no se ha comprobado"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {check.state === "up" && check.latency_ms != null ? (
                  <span className="font-data text-xs font-semibold text-muted">{check.latency_ms.toFixed(0)} ms</span>
                ) : null}
                <StatePill state={check.state} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}