// Página de alertas: notificaciones, activas, resueltas y umbrales.

import { AlertList } from "../components/AlertList";
import { NotificationChannelsCard } from "../components/NotificationChannelsCard";

export function AlertsPage({ data }) {
  return (
    <div className="space-y-6">
      <NotificationChannelsCard />
      <AlertList response={data.alerts.data} loading={data.alerts.loading} />
    </div>
  );
}