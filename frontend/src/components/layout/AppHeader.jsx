// Top navigation: branding, tabs and live WebSocket connection status.

import { Button, Chip, Tabs } from "@heroui/react";
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
      className="inline-flex items-center gap-2 rounded-xl bg-surface-secondary px-3 py-1.5 ring-1 ring-border"
      title={lastUpdated ? `Último dato: ${lastUpdated.toLocaleTimeString("es-ES")}` : undefined}
    >
      <StatusDot state={wsStatus} label={labels[wsStatus] ?? labels.disconnected} />
      <span className="font-data text-[11px] text-muted">
        {lastUpdated ? lastUpdated.toLocaleTimeString("es-ES") : "—"}
      </span>
    </div>
  );
}

function LiveBadge() {
  return (
    <Chip color="success" variant="soft" size="sm">
      <span className="h-1.5 w-1.5 rounded-full bg-success status-pulse" />
      En vivo
    </Chip>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ThemeToggle({ theme, onThemeChange }) {
  const isDark = theme === "dark";
  const label = isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  return (
    <Button
      isIconOnly
      variant="secondary"
      size="sm"
      aria-label={label}
      title={label}
      onPress={() => onThemeChange(isDark ? "light" : "dark")}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}

function UserMenu({ username, onLogout }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted sm:inline">
        <span className="font-data text-foreground">{username}</span>
      </span>
      <Button variant="secondary" size="sm" onPress={onLogout} title="Cerrar sesión">
        Salir
      </Button>
    </div>
  );
}

export function AppHeader({ tab, onTabChange, wsStatus, wsAttempts, lastUpdated, theme, onThemeChange, username, onLogout }) {
  return (
    <header className="sticky top-0 z-10 relative border-b border-border bg-surface/85 backdrop-blur after:pointer-events-none after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:bg-gradient-to-r after:from-transparent after:via-accent/40 after:to-transparent">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-[0_6px_16px_-6px] shadow-cyan-600/50 ring-1 ring-white/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5h16M4 12h16M4 19h10" strokeLinecap="round" />
              <circle cx="20" cy="19" r="2" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">Monitor del Servidor</h1>
              <LiveBadge />
            </div>
            <p className="text-xs text-muted">Métricas en tiempo real por WebSocket</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionStatus wsStatus={wsStatus} wsAttempts={wsAttempts} lastUpdated={lastUpdated} />
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
          {onLogout ? <UserMenu username={username} onLogout={onLogout} /> : null}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Tabs
            aria-label="Secciones"
            variant="secondary"
            selectedKey={tab}
            onSelectionChange={(key) => onTabChange(String(key))}
          >
            <Tabs.List>
              {TABS.map((item) => (
                <Tabs.Tab key={item.id} id={item.id}>
                  {item.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </div>
      </div>
    </header>
  );
}