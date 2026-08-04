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

      <footer className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs text-slate-500 shadow-sm ring-1 ring-slate-200">
          <span className="font-semibold text-slate-700">System Status</span>
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
          <span className="text-teal-700">En vivo por WebSocket</span>
        </div>
      </footer>
    </div>
  );
}