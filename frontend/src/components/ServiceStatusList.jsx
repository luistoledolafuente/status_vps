// Service status: tracked services (nginx, docker, ...) plus full list with
// search and state filters. Shows a controlled message when unavailable.

import { useMemo, useState } from "react";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Skeleton } from "./ui/Skeleton";

const STATE_DOT = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  failed: "bg-rose-500",
  activating: "bg-amber-500",
  deactivating: "bg-amber-500",
  reloading: "bg-amber-500",
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

  if (loading && !response) {
    return (
      <Card title="Servicios del sistema">
        <Skeleton rows={compact ? 4 : 6} />
      </Card>
    );
  }

  if (response && !response.available) {
    return (
      <Card title="Servicios del sistema">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <span className="mt-0.5 text-lg">i</span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              El estado de los servicios no está disponible en este entorno.
            </p>
            <p className="mt-1 text-sm text-amber-700">{response.detail}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Servicios del sistema"
      subtitle={`Gestor: ${response?.manager ?? "no disponible"}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <CountBadge label="activos" count={counts.active ?? 0} variant="success" />
          <CountBadge label="inactivos" count={counts.inactive ?? 0} variant="neutral" />
          <CountBadge label="fallidos" count={counts.failed ?? 0} variant="critical" />
        </div>
      }
    >
      {tracked.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Servicios en seguimiento
          </p>
          <div className="flex flex-wrap gap-2">
            {tracked.map((service) => (
              <span
                key={service.name}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200"
              >
                <span className="font-mono text-slate-700">{service.name}</span>
                <StatusPill state={service.state} label={service.label} />
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === option.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
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
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={query ? `Sin coincidencias para «${query}»` : "No se encontraron servicios con este filtro"}
        />
      ) : (
        <ul className={`divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-100 ${compact ? "max-h-64" : "max-h-[480px]"}`}>
          {filtered.map((service) => (
            <li key={service.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{service.name}</p>
                {service.description ? (
                  <p className="truncate text-xs text-slate-400">{service.description}</p>
                ) : null}
              </div>
              <StatusPill state={service.active_state} label={service.label} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}