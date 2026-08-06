// App root: session gate + navigation tabs + shared dashboard data + footer.

import { useEffect, useState } from "react";
import { useTheme } from "@heroui/react";
import { AppHeader } from "./components/layout/AppHeader";
import { ErrorBanner } from "./components/ui/ErrorBanner";
import { useDashboardData } from "./hooks/useDashboardData";
import { Dashboard } from "./pages/Dashboard";
import { ProcessesPage } from "./pages/ProcessesPage";
import { ServicesPage } from "./pages/ServicesPage";
import { AlertsPage } from "./pages/AlertsPage";
import { Pm2Page } from "./pages/Pm2Page";
import { LoginPage } from "./pages/LoginPage";
import { clearSession, loadSession, SESSION_EXPIRED_EVENT } from "./auth/session";

const PAGES = {
  dashboard: Dashboard,
  processes: ProcessesPage,
  services: ServicesPage,
  pm2: Pm2Page,
  alerts: AlertsPage,
};

export default function App() {
  const [session, setSession] = useState(loadSession());
  const [tab, setTab] = useState("dashboard");
  const data = useDashboardData({ tab, enabled: Boolean(session) });
  const { resolvedTheme, setTheme } = useTheme("system");

  useEffect(() => {
    const handleExpired = () => setSession(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  if (!session) {
    return <LoginPage onAuthenticated={setSession} />;
  }

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setTab("dashboard");
  };

  const Page = PAGES[tab] ?? Dashboard;

  return (
    <div className="min-h-screen">
      <AppHeader
        tab={tab}
        onTabChange={setTab}
        wsStatus={data.wsStatus}
        wsAttempts={data.wsAttempts}
        lastUpdated={data.lastUpdated}
        theme={resolvedTheme}
        onThemeChange={setTheme}
        username={session.username}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {data.error ? (
          <ErrorBanner
            error={data.error}
            onRetry={() => window.location.reload()}
            hint="Verifica que el backend esté corriendo en el puerto 8000 y recarga la página."
          />
        ) : null}

        <Page data={data} session={session} />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 text-xs text-muted shadow-surface ring-1 ring-border">
          <span className="font-semibold text-foreground">System Status</span>
          <span aria-hidden="true">·</span>
          <span>
            API v<span className="font-data">{data.health.data?.version ?? "—"}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            respuesta <span className="font-data">{data.health.data?.avg_response_ms != null ? `${data.health.data.avg_response_ms} ms` : "—"}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <span className="font-data">{data.health.data?.ws_clients ?? "—"}</span> clientes WebSocket
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-accent">En vivo por WebSocket</span>
        </div>
      </footer>
    </div>
  );
}