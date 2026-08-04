// App root: navigation tabs + shared dashboard data + footer with observability.

import { useState } from "react";
import { AppHeader } from "./components/layout/AppHeader";
import { ErrorBanner } from "./components/ui/ErrorBanner";
import { useDashboardData } from "./hooks/useDashboardData";
import { Dashboard } from "./pages/Dashboard";
import { ProcessesPage } from "./pages/ProcessesPage";
import { ServicesPage } from "./pages/ServicesPage";
import { AlertsPage } from "./pages/AlertsPage";

const PAGES = {
  dashboard: Dashboard,
  processes: ProcessesPage,
  services: ServicesPage,
  alerts: AlertsPage,
};

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const data = useDashboardData({ tab });

  const Page = PAGES[tab] ?? Dashboard;

  return (
    <div className="min-h-screen">
      <AppHeader
        tab={tab}
        onTabChange={setTab}
        wsStatus={data.wsStatus}
        wsAttempts={data.wsAttempts}
        lastUpdated={data.lastUpdated}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {data.error ? (
          <ErrorBanner
            error={data.error}
            onRetry={() => window.location.reload()}
            hint="Verifica que el backend esté corriendo en el puerto 8000 y recarga la página."
          />
        ) : null}

        <Page data={data} />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
        <p>
          System Status · API v{data.health.data?.version ?? "—"} · respuesta {data.health.data?.avg_response_ms != null ? `${data.health.data.avg_response_ms} ms` : "—"} · clientes WebSocket: {data.health.data?.ws_clients ?? "—"} · en vivo por WebSocket
        </p>
      </footer>
    </div>
  );
}