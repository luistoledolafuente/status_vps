// Process table: top processes by CPU or memory, with search and pagination.

import { useEffect, useMemo, useState } from "react";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Skeleton } from "./ui/Skeleton";
import { formatBytes, formatPercent } from "../utils/format";

const STATUS_LABELS = {
  running: "En ejecución",
  sleeping: "En espera",
  stopped: "Detenido",
  zombie: "Zombie",
  idle: "Inactivo",
};

const SORT_OPTIONS = [
  { value: "cpu", label: "Por CPU" },
  { value: "memory", label: "Por memoria" },
];

export function ProcessTable({ processes = [], loading, sortBy, onSortChange, searchable = true, compact = false }) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(compact ? 5 : 10);

  useEffect(() => {
    setVisible(compact ? 5 : 10);
  }, [sortBy, compact]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return processes;
    return processes.filter((p) =>
      `${p.name} ${p.username} ${p.pid}`.toLowerCase().includes(term)
    );
  }, [processes, query]);

  const sortButtons = (
    <div className="flex items-center gap-2">
      {SORT_OPTIONS.map((option) => (
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

  return (
    <Card
      title="Procesos más pesados"
      subtitle={processes.length ? `${processes.length} procesos · actualiza cada 10 s` : undefined}
      actions={sortButtons}
    >
      {searchable ? (
        <div className="mb-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar proceso o usuario…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      ) : null}

      {loading && processes.length === 0 ? (
        <Skeleton rows={compact ? 5 : 8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? `Sin coincidencias para «${query}»` : "No se pudieron leer los procesos"}
          description="Intenta con otro término de búsqueda."
        />
      ) : (
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
              {filtered.slice(0, visible).map((process) => (
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
                    <span className="font-mono text-slate-700">{formatBytes(process.memory_rss_bytes, 0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((count) => count + 5)}
          className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
        >
          Ver más procesos
        </button>
      ) : null}
    </Card>
  );
}