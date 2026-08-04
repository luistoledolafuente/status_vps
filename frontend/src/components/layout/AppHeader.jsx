// Top navigation: branding, tabs, live-mode selector and WS/polling status.

import { StatusDot } from "../ui/StatusDot";

const TABS = [
  { id: "dashboard", label: "Resumen" },
  { id: "processes", label: "Procesos" },
  { id: "services", label: "Servicios" },
  { id: "alerts", label: "Alertas" },
];

function ModeSelector({ mode, onChange }) {
  const options = [
    { value: "ws", label: "En vivo (WebSocket)", hint: "Actualización cada 2 s." },
    { value: "polling", label: "Polling", hint: "Consulta cada 2 s." },
  ];
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Modo de actualización">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.hint}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === option.value
              ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ConnectionStatus({ mode, wsStatus, wsAttempts, lastUpdated }) {
  if (mode === "polling") {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5">
        <StatusDot state="connected" label="Polling activo" />
      </div>
    );
  }

  const labels = {
    connecting: "Conectando…",
    connected: "Conectado",
    reconnecting: `Reconectando… (intento ${wsAttempts})`,
    disconnected: "Desconectado",
  };
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5">
      <StatusDot state={wsStatus} label={labels[wsStatus] ?? labels.disconnected} />
    </div>
  );
}

export function AppHeader({ tab, onTabChange, mode, onModeChange, wsStatus, wsAttempts, lastUpdated }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5h16M4 12h16M4 19h10" strokeLinecap="round" />
              <circle cx="20" cy="19" r="2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Monitor del Servidor</h1>
            <p className="text-xs text-slate-500">{lastUpdated ? `Último dato: ${lastUpdated.toLocaleTimeString("es-ES")}` : "En espera de datos…"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionStatus mode={mode} wsStatus={wsStatus} wsAttempts={wsAttempts} lastUpdated={lastUpdated} />
          <ModeSelector mode={mode} onChange={onModeChange} />
        </div>
      </div>

      <nav className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "border-indigo-600 text-indigo-700"
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