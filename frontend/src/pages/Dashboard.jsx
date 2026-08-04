// Resumen: KPIs, salud del servidor, tendencias, procesos y servicios.

import { KPIGrid } from "../components/KPIGrid";
import { SystemCharts } from "../components/SystemCharts";
import { ProcessTable } from "../components/ProcessTable";
import { ServiceStatusList } from "../components/ServiceStatusList";
import { TrafficCard } from "../components/TrafficCard";
import { AnomalyCard } from "../components/AnomalyCard";
import { AvailabilityChecks } from "../components/AvailabilityChecks";

function SectionHeading({ children }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</h2>
  );
}

export function Dashboard({ data }) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading>Resumen en vivo</SectionHeading>
        <KPIGrid summary={data.summary} loading={data.loading} />
      </section>

      <section className="space-y-3">
        <SectionHeading>Salud del servidor</SectionHeading>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnomalyCard anomaly={data.summary?.anomaly} />
          <TrafficCard traffic={data.summary?.traffic} network={data.summary?.network} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading>Disponibilidad</SectionHeading>
        <AvailabilityChecks checks={data.summary?.checks ?? []} loading={data.loading} />
      </section>

      <section className="space-y-3">
        <SectionHeading>Tendencias y almacenamiento</SectionHeading>
        <SystemCharts history={data.history} summary={data.summary} />
      </section>

      <section className="space-y-3">
        <SectionHeading>Procesos y servicios</SectionHeading>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ProcessTable
            compact
            processes={data.processes.data?.processes ?? []}
            loading={data.processes.loading}
            sortBy={data.processSort}
            onSortChange={data.refreshProcesses}
          />
          <ServiceStatusList response={data.services.data} loading={data.services.loading} compact />
        </div>
      </section>
    </div>
  );
}
