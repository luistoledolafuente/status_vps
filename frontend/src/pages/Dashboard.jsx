// Resumen: KPIs, gráficas de tendencia, procesos y servicios principales.

import { KPIGrid } from "../components/KPIGrid";
import { SystemCharts } from "../components/SystemCharts";
import { ProcessTable } from "../components/ProcessTable";
import { ServiceStatusList } from "../components/ServiceStatusList";

export function Dashboard({ data }) {
  return (
    <div className="space-y-6">
      <KPIGrid summary={data.summary} loading={data.loading} />
      <SystemCharts history={data.history} summary={data.summary} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProcessTable
          compact
          processes={data.processes.data ?? []}
          loading={data.processes.loading}
          sortBy={data.processSort}
          onSortChange={data.refreshProcesses}
        />
        <ServiceStatusList response={data.services.data} loading={data.services.loading} compact />
      </div>
    </div>
  );
}