// Lista del estado de los servicios del sistema, con búsqueda y contadores.

import { useMemo, useState } from "react";

const STATE_DOT = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  failed: "bg-rose-500",
  activating: "bg-amber-500",
  deactivating: "bg-amber-500",
  reloading: "bg-amber-500",
  unknown: "bg-slate-300",
};

function CountBadge({ label, count, dot }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {count} {label}
    </span>
  );
}

function StatusPill({ service }) {
  const dot = STATE_DOT[service.active_state] ?? STATE_DOT.unknown;
  const pill =
    service.active_state === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : service.active_state === "failed"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${pill}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {service.label}
    </span>
  );
}

export function ServiceStatusList({ response, loading }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const services = response?.services ?? [];
    const term = query.trim().toLowerCase();
    if (!term) return services;
    return services.filter((service) =>
      `${service.name} ${service.description}`.toLowerCase().includes(term)
    );
  }, [response, query]);

  if (loading && !response) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-9 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!loading && response && !response.available) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Servicios del sistema</h2>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <span className="mt-0.5 text-lg">ℹ️</span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              El estado de los servicios no está disponible en este entorno.
            </p>
            <p className="mt-1 text-sm text-amber-700">{response.detail}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && response && response.services.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Servicios del sistema</h2>
        <div className="mt-4 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
          No se encontraron servicios en este sistema.
        </div>
      </div>
    );
  }

  const counts = response?.counts ?? {};

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Servicios del sistema</h2>
          <p className="text-xs text-slate-400">
            Gestor: {response?.manager ?? "no disponible"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CountBadge label="activos" count={counts.active ?? 0} dot="bg-emerald-500" />
          <CountBadge label="inactivos" count={counts.inactive ?? 0} dot="bg-slate-400" />
          <CountBadge label="fallidos" count={counts.failed ?? 0} dot="bg-rose-500" />
        </div>
      </div>

      <div className="mb-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar servicio…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
          Sin coincidencias para «{query}».
        </div>
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-100">
          {filtered.map((service) => (
            <li key={service.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{service.name}</p>
                {service.description ? (
                  <p className="truncate text-xs text-slate-400">{service.description}</p>
                ) : null}
              </div>
              <StatusPill service={service} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}