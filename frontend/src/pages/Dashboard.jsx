// Página principal: panel de monitoreo del servidor.

import { KPIGrid } from "../components/KPIGrid";
import { SystemCharts } from "../components/SystemCharts";
import { ProcessTable } from "../components/ProcessTable";
import { ServiceStatusList } from "../components/ServiceStatusList";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatDateTime } from "../utils/format";

function RefreshButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Actualizar ahora
    </button>
  );
}

export function Dashboard() {
  const {
    summary,
    processes,
    services,
    history,
    error,
    loading,
    lastUpdated,
    processSort,
    refresh,
    refreshProcesses,
  } = useDashboardData();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 5h16M4 12h16M4 19h10" strokeLinecap="round" />
                <circle cx="20" cy="19" r="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Monitor del Servidor</h1>
              <p className="text-xs text-slate-500">
                {summary ? `Equipo: ${summary.hostname} · ${summary.platform}` : "Conectando con el servidor…"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 md:block">
              Última actualización: {lastUpdated ? formatDateTime(lastUpdated.toISOString()) : "—"}
            </span>
            <RefreshButton onClick={refresh} disabled={loading} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium text-rose-800">Error al consultar la API</p>
                <p className="text-sm text-rose-700">
                  {error.message ?? "Comprueba que el backend esté corriendo en el puerto 8000."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        <KPIGrid summary={summary} loading={loading} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SystemCharts history={history} />
          </div>
          <div className="lg:col-span-2">
            <ProcessTable
              processes={processes}
              loading={loading}
              sortBy={processSort}
              onSortChange={refreshProcesses}
            />
          </div>
        </div>

        <ServiceStatusList response={services} loading={loading} />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
        System Status · MVP de monitoreo · FastAPI + React + psutil
      </footer>
    </div>
  );
}