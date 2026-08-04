// Tarjeta KPI: un número grande, un subtítulo y opcionalmente una barra de progreso.

const GRADIENTS = {
  indigo: "from-indigo-500 to-violet-500",
  emerald: "from-emerald-500 to-teal-500",
  amber: "from-amber-500 to-orange-500",
  sky: "from-sky-500 to-blue-500",
  rose: "from-rose-500 to-pink-500",
};

export function MetricCard({
  title,
  value,
  unit = "",
  subtitle,
  progress,
  gradient = "indigo",
  icon,
}) {
  const safeProgress =
    typeof progress === "number" && !Number.isNaN(progress)
      ? Math.min(Math.max(progress, 0), 100)
      : null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-slate-900">{value}</span>
        {unit ? <span className="text-sm font-medium text-slate-400">{unit}</span> : null}
      </p>

      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}

      {safeProgress !== null ? (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${GRADIENTS[gradient] ?? GRADIENTS.indigo}`}
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}