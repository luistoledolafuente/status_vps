// Página de alertas: activas, resueltas recientemente y umbrales.

import { AlertList } from "../components/AlertList";

export function AlertsPage({ data }) {
  return <AlertList response={data.alerts.data} loading={data.alerts.loading} />;
}