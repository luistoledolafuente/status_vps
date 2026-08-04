// Top navigation: branding, tabs and live WebSocket connection status.

import { StatusDot } from "../ui/StatusDot";

const TABS = [
  { id: "dashboard", label: "Resumen" },
  { id: "processes", label: "Procesos" },
  { id: "services", label: "Servicios" },
  { id: "alerts", label: "Alertas" },
];

function ConnectionStatus({ wsStatus, wsAttempts, lastUpdated }) {
  const labels = {
    connecting: "Conectando…",
    connected: "Conectado",
    reconnecting: `Reconectando… (intento ${wsAttempts})`,
    disconnected: "Desconectado",
  };
  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5"
      title={lastUpdated ? `Último dato: ${lastUpdated.toLocaleTimeString("es-ES")}` : undefined}
    >
      <StatusDot state={wsStatus} label={labels[wsStatus] ?? labels.disconnected} />
      <span className="font-data text-[11px] text-slate-400">
        {lastUpdated ? lastUpdated.toLocaleTimeString("es-ES") : "—"}
      </span>
    </div>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-700 ring-1 ring-teal-200">
      <span className="h-1.5 w-1.5 rounded-full bg-teal-500 status-pulse" />
      En vivo
    </span>
  );
}

export function AppHeader({ tab, onTabChange, wsStatus, wsAttempts, lastUpdated }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5h16M4 12h16M4 19h10" strokeLinecap="round" />
              <circle cx="20" cy="19" r="2" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">Monitor del Servidor</h1>
              <LiveBadge />
            </div>
            <p className="text-xs text-slate-500">Métricas en tiempo real por WebSocket</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionStatus wsStatus={wsStatus} wsAttempts={wsAttempts} lastUpdated={lastUpdated} />
        </div>
      </div>

      <nav className="mx-auto max-w-7xl px-4 sm:px-6" aria-label="Secciones">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}