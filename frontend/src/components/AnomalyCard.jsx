// Health card: anomaly score (0-100) comparing current behavior against
// the server's own baseline over the recent window. Low = as usual.

import { Card } from "./ui/Card";

const LEVELS = {
  normal: { label: "Comportamiento normal", color: "text-teal-700", ring: "ring-teal-200", bg: "bg-teal-50" },
  elevated: { label: "Levemente inusual", color: "text-amber-700", ring: "ring-amber-200", bg: "bg-amber-50" },
  high: { label: "Inusual", color: "text-orange-700", ring: "ring-orange-200", bg: "bg-orange-50" },
  critical: { label: "Críticamente inusual", color: "text-rose-700", ring: "ring-rose-200", bg: "bg-rose-50" },
};

const METRIC_LABELS = {
  cpu: "CPU",
  memory: "Memoria",
  load: "Carga",
};

function scoreColor(score) {
  if (score >= 80) return "text-rose-600";
  if (score >= 60) return "text-orange-600";
  if (score >= 40) return "text-amber-600";
  return "text-teal-600";
}

export function AnomalyCard({ anomaly }) {
  if (!anomaly) {
    return (
      <Card title="Salud del servidor" subtitle="Detección de comportamientos anómalos">
        <p className="text-sm text-slate-500">Se necesitan algunas lecturas para establecer el comportamiento habitual.</p>
      </Card>
    );
  }

  const level = LEVELS[anomaly.level] ?? LEVELS.normal;
  const metricEntries = Object.entries(anomaly.metrics ?? {});
  const deviating = metricEntries.filter(([, value]) => value >= 40);

  return (
    <Card title="Salud del servidor" subtitle="Comparado contra el comportamiento habitual del servidor">
      <div className="flex items-center gap-4">
        <span className={`font-data text-5xl font-bold tracking-tight ${scoreColor(anomaly.score)}`}>
          {Math.round(anomaly.score)}
        </span>
        <div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${level.bg} ${level.color} ${level.ring}`}>
            {level.label}
          </span>
          {deviating.length > 0 ? (
            <p className="mt-2 max-w-[26ch] text-xs leading-relaxed text-slate-500">
              Se desvía de lo habitual:{" "}
              <span className="font-semibold text-slate-700">
                {deviating.map(([key, value]) => `${METRIC_LABELS[key] ?? key} (${Math.round(value)})`).join(", ")}
              </span>
            </p>
          ) : (
            <p className="mt-2 max-w-[26ch] text-xs leading-relaxed text-slate-500">
              Ninguna métrica se desvía significativamente de su línea base.
            </p>
          )}
        </div>
      </div>

      {metricEntries.length > 0 ? (
        <div className="mt-4 flex gap-3 border-t border-slate-100 pt-3">
          {metricEntries.map(([key, value]) => (
            <div key={key} className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{METRIC_LABELS[key] ?? key}</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${value >= 80 ? "bg-rose-500" : value >= 40 ? "bg-amber-500" : "bg-teal-500"}`}
                  style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
