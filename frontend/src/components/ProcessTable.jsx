// Tabla de los procesos más pesados (mayor uso de CPU o memoria).

import { useEffect, useState } from "react";
import { formatBytes, formatPercent } from "../utils/format";

const STATUS_LABELS = {
  running: "En ejecución",
  sleeping: "En espera",
  stopped: "Detenido",
  zombie: "Zombie",
  idle: "Inactivo",
};

export function ProcessTable({ processes, loading, sortBy, onSortChange }) {
  const [visible, setVisible] = useState(5);
  useEffect(() => setVisible(5), [sortBy]);

  const sortOptions = [
    { value: "cpu", label: "Por CPU" },
    { value: "memory", label: "Por memoria" },
  ];

  const renderSortButtons = () => (
    <div className="flex items-center gap-2">
      {sortOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSortChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            sortBy === option.value
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (loading && processes.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex justify-between">{renderPill()}</div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-8 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!loading && processes.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex justify-between">{renderPill()}</div>
        <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
          No se pudieron leer los procesos de este sistema.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Procesos más pesados</h2>
        {renderPill()}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-2 font-medium">Proceso</th>
              <th className="pb-2 pr-2 font-medium">PID</th>
              <th className="hidden pb-2 pr-2 font-medium sm:table-cell">Estado</th>
              <th className="pb-2 pr-2 text-right font-medium">CPU</th>
              <th className="pb-2 text-right font-medium">Memoria</th>
            </tr>
          </thead>
          <tbody>
            {processes.slice(0, visible).map((process) => (
              <tr key={process.pid} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-2">
                  <p className="font-medium text-slate-800">{process.name}</p>
                  <p className="text-xs text-slate-400">{process.username}</p>
                </td>
                <td className="py-2.5 pr-2 font-mono text-slate-600">{process.pid}</td>
                <td className="hidden py-2.5 pr-2 sm:table-cell">
                  <span className="text-xs text-slate-500">
                    {STATUS_LABELS[process.status] ?? process.status}
                  </span>
                </td>
                <td className="py-2.5 pr-2 text-right">
                  <span className={`font-mono ${process.cpu_percent > 50 ? "text-rose-600" : "text-slate-700"}`}>
                    {formatPercent(process.cpu_percent, 1)}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <span className="font-mono text-slate-700">
                    {formatBytes(process.memory_rss_bytes, 0)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {processes.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((count) => count + 5)}
          className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
        >
          Ver más procesos
        </button>
      ) : null}
    </div>
  );
}