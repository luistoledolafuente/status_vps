// Tarjeta KPI: número en mono, subtítulo, barra de progreso por severidad.
// Altura mínima reservada para evitar saltos de layout al cargar.

import { ProgressBar } from "@heroui/react";

const COLORS = {
  teal: "accent",
  sky: "accent",
  amber: "warning",
  rose: "danger",
  indigo: "accent",
};

export function MetricCard({
  title,
  value,
  unit = "",
  subtitle,
  progress,
  gradient = "teal",
  icon,
}) {
  const safeProgress =
    typeof progress === "number" && !Number.isNaN(progress)
      ? Math.min(Math.max(progress, 0), 100)
      : null;

  return (
    <div className="relative flex h-full min-h-[136px] flex-col overflow-hidden rounded-2xl bg-surface p-4 shadow-surface ring-1 ring-border transition-shadow hover:shadow-overlay">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium uppercase tracking-wide text-muted">{title}</p>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary text-muted ring-1 ring-border">
            {icon}
          </span>
        ) : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-data text-3xl font-semibold tracking-tight text-foreground">{value}</span>
        {unit ? <span className="font-data text-sm font-medium text-muted">{unit}</span> : null}
      </p>

      {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}

      <div className="mt-auto pt-3">
        {safeProgress !== null ? (
          <ProgressBar
            aria-label={`${title}: ${Math.round(safeProgress)}%`}
            value={safeProgress}
            color={COLORS[gradient] ?? "accent"}
            size="sm"
          />
        ) : (
          <div className="h-1.5 w-full rounded-full bg-border-secondary" />
        )}
      </div>
    </div>
  );
}