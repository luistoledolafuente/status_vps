// Página de servicios: seguimiento y listado completo con filtros.

import { ServiceStatusList } from "../components/ServiceStatusList";

export function ServicesPage({ data }) {
  return <ServiceStatusList response={data.services.data} loading={data.services.loading} />;
}