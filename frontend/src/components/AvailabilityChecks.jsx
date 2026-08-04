// Availability checks: HTTP(S) and TCP probes with latency and status.

import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { formatDateTime } from "../utils/format";

const STATE_STYLES = {
  up: { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Operativo" },
  down: { dot: "bg-rose-500", pill: "bg-rose-50 text-rose-700 ring-rose-200", label: "Sin respuesta" },
  unknown: { dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 ring-slate-200", label: "Sin verificar" },
};

function StatePill({ state }) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${style.pill}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

export function AvailabilityChecks({ checks = [], loading }) {
  if (loading && checks.length === 0) {
    return (
      <Card title="Disponibilidad de servicios" subtitle="Comprobaciones HTTP y TCP">
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-200 ring-1 ring-slate-200" />
          ))}
        </div>
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
        <ul className="divide-y divide-slate-100">
          {checks.map((check) => (
            <li key={check.name} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-slate-800">{check.name}</span>
                  <span className="hidden truncate font-mono text-xs text-slate-400 sm:inline">{check.target}</span>
                </div>
                {check.state === "down" ? (
                  <p className="mt-0.5 truncate text-xs text-rose-600">{check.error}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {check.checked_at ? `Última comprobación: ${formatDateTime(check.checked_at)}` : "Aún no se ha comprobado"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {check.state === "up" && check.latency_ms != null ? (
                  <span className="font-data text-xs font-semibold text-slate-600">{check.latency_ms.toFixed(0)} ms</span>
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
