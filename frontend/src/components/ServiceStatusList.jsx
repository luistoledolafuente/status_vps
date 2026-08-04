// Service status: tracked services plus full list with search and state
// filters. Tracked services are always shown — resolved via systemd, daemon
// socket/CLI or process lookup — with the detection source and an actionable
// hint when a service is present but unreachable.

import { useMemo, useState } from "react";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Skeleton } from "./ui/Skeleton";
import { StatusDot } from "./ui/StatusDot";

const STATE_DOT = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  failed: "bg-rose-500",
  activating: "bg-amber-500",
  deactivating: "bg-amber-500",
  reloading: "bg-amber-500",
  unreachable: "bg-amber-500",
  not_found: "bg-slate-300",
  unknown: "bg-slate-300",
};

function StatusPill({ state, label }) {
  const dot = STATE_DOT[state] ?? STATE_DOT.unknown;
  const pill =
    state === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : state === "failed"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
        : state === "unreachable"
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : state === "not_found"
            ? "bg-slate-100 text-slate-500 ring-slate-200"
            : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${pill}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

const SOURCE_LABELS = {
  systemd: "systemd",
  sysv: "init.d",
  docker: "socket/CLI",
  proceso: "proceso",
  ninguno: "sin fuente",
};

function TrackedChip({ service }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
      <span className="font-mono font-medium text-slate-700">{service.name}</span>
      <StatusPill state={service.state} label={service.label} />
      {service.source ? (
        <span className="hidden text-[11px] text-slate-400 sm:inline" title="Fuente de detección">
          {SOURCE_LABELS[service.source] ?? service.source}
        </span>
      ) : null}
    </span>
  );
}

function CountBadge({ label, count, variant }) {
  return (
    <Badge variant={variant}>
      <span className="font-semibold">{count}</span> {label}
    </Badge>
  );
}

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "failed", label: "Fallidos" },
  { value: "not_found", label: "No instalados" },
];

export function ServiceStatusList({ response, loading, compact = false }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const counts = response?.counts ?? {};
  const tracked = response?.tracked ?? [];

  const filtered = useMemo(() => {
    const services = response?.services ?? [];
    const term = query.trim().toLowerCase();
    return services.filter((service) => {
      if (filter !== "all" && service.active_state !== filter) return false;
      if (!term) return true;
      return `${service.name} ${service.description}`.toLowerCase().includes(term);
    });
  }, [response, query, filter]);

  const unreachableHints = tracked
    .filter((service) => service.hint)
    .map((service) => ({ name: service.name, hint: service.hint }));

  if (loading && !response) {
    return (
      <Card title="Servicios del sistema">
        <Skeleton rows={compact ? 4 : 6} />
      </Card>
    );
  }

  return (
    <Card
      title="Servicios del sistema"
      subtitle={
        response?.available
          ? `Gestor: ${response.manager ?? "no disponible"}`
          : "Listado completo no disponible en este entorno; seguimiento de servicios clave activo."
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <CountBadge label="activos" count={counts.active ?? 0} variant="success" />
          <CountBadge label="inactivos" count={counts.inactive ?? 0} variant="neutral" />
          <CountBadge label="fallidos" count={counts.failed ?? 0} variant="critical" />
        </div>
      }
    >
      {!response?.available ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M12 11v5" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              El listado completo de servicios no está disponible en este entorno.
            </p>
            {response?.detail ? <p className="mt-1 text-sm text-amber-700">{response.detail}</p> : null}
          </div>
        </div>
      ) : null}

      {tracked.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Servicios en seguimiento
          </p>
          <div className="flex flex-wrap gap-2">
            {tracked.map((service) => (
              <TrackedChip key={service.name} service={service} />
            ))}
          </div>
          {unreachableHints.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {unreachableHints.map(({ name, hint }) => (
                <li key={name} className="flex items-start gap-2 text-xs text-slate-500">
                  <StatusDot state="unreachable" className="mt-0.5" />
                  <span>
                    <span className="font-semibold text-slate-600">{name}:</span> {hint}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {response?.available ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    filter === option.value ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar servicio…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={query ? `Sin coincidencias para «${query}»` : "No se encontraron servicios con este filtro"}
            />
          ) : (
            <ul className={`divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-100 ${compact ? "max-h-64" : "max-h-[480px]"}`}>
              {filtered.map((service) => (
                <li key={service.name} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-slate-800">{service.name}</p>
                    {service.description ? (
                      <p className="truncate text-xs text-slate-400">{service.description}</p>
                    ) : null}
                  </div>
                  <StatusPill state={service.active_state} label={service.label} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Card>
  );
}