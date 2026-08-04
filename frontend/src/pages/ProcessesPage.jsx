// Página de procesos: tabla completa con búsqueda y ordenamiento.

import { ProcessTable } from "../components/ProcessTable";

export function ProcessesPage({ data }) {
  return (
    <ProcessTable
      processes={data.processes.data ?? []}
      loading={data.processes.loading}
      sortBy={data.processSort}
      onSortChange={data.refreshProcesses}
    />
  );
}