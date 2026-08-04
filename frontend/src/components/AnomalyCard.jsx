// Health card: anomaly score (0-100) comparing current behavior against
// the server's own baseline over the recent window. Low = as usual.

import { Chip, ProgressCircle } from "@heroui/react";
import { Card } from "./ui/Card";

const LEVELS = {
  normal: { label: "Comportamiento normal", color: "success" },
  elevated: { label: "Levemente inusual", color: "warning" },
  high: { label: "Inusual", color: "warning" },
  critical: { label: "Críticamente inusual", color: "danger" },
};

const METRIC_LABELS = {
  cpu: "CPU",
  memory: "Memoria",
  load: "Carga",
};

function circleColor(score) {
  if (score >= 80) return "danger";
  if (score >= 40) return "warning";
  return "success";
}

function valueColor(score) {
  if (score >= 80) return "text-danger";
  if (score >= 60) return "text-warning";
  if (score >= 40) return "text-warning";
  return "text-success";
}

function barColor(value) {
  if (value >= 80) return "bg-danger";
  if (value >= 40) return "bg-warning";
  return "bg-success";
}

export function AnomalyCard({ anomaly }) {
  if (!anomaly) {
    return (
      <Card title="Salud del servidor" subtitle="Detección de comportamientos anómalos">
        <p className="text-sm text-muted">Se necesitan algunas lecturas para establecer el comportamiento habitual.</p>
      </Card>
    );
  }

  const level = LEVELS[anomaly.level] ?? LEVELS.normal;
  const metricEntries = Object.entries(anomaly.metrics ?? {});
  const deviating = metricEntries.filter(([, value]) => value >= 40);

  return (
    <Card title="Salud del servidor" subtitle="Comparado contra el comportamiento habitual del servidor">
      <div className="flex items-center gap-4">
        <div className="health-score relative inline-flex shrink-0">
          <ProgressCircle
            aria-label={`Puntuación de anomalía: ${Math.round(anomaly.score)}`}
            value={anomaly.score}
            color={circleColor(anomaly.score)}
            size="lg"
          >
            <ProgressCircle.Track>
              <ProgressCircle.TrackCircle />
              <ProgressCircle.FillCircle />
            </ProgressCircle.Track>
          </ProgressCircle>
          <span
            className={`pointer-events-none absolute inset-0 flex items-center justify-center font-data text-2xl font-bold ${valueColor(anomaly.score)}`}
          >
            {Math.round(anomaly.score)}
          </span>
        </div>
        <div>
          <Chip color={level.color} variant="soft" size="sm">
            {level.label}
          </Chip>
          {deviating.length > 0 ? (
            <p className="mt-2 max-w-[26ch] text-xs leading-relaxed text-muted">
              Se desvía de lo habitual:{" "}
              <span className="font-semibold text-foreground">
                {deviating.map(([key, value]) => `${METRIC_LABELS[key] ?? key} (${Math.round(value)})`).join(", ")}
              </span>
            </p>
          ) : (
            <p className="mt-2 max-w-[26ch] text-xs leading-relaxed text-muted">
              Ninguna métrica se desvía significativamente de su línea base.
            </p>
          )}
        </div>
      </div>

      {metricEntries.length > 0 ? (
        <div className="mt-4 flex gap-3 border-t border-separator pt-3">
          {metricEntries.map(([key, value]) => (
            <div key={key} className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted">{METRIC_LABELS[key] ?? key}</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border-secondary">
                <div
                  className={`h-full rounded-full ${barColor(value)}`}
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