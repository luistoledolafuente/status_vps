// Tarjeta KPI: número en mono, subtítulo, barra de progreso por severidad.
// Altura mínima reservada para evitar saltos de layout al cargar.

const GRADIENTS = {
  teal: "from-teal-500 to-cyan-500",
  sky: "from-sky-500 to-blue-500",
  amber: "from-amber-500 to-orange-500",
  rose: "from-rose-500 to-pink-500",
  indigo: "from-indigo-500 to-violet-500",
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
    <div className="flex h-full min-h-[136px] flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium uppercase tracking-wide text-slate-500">{title}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-data text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
        {unit ? <span className="font-data text-sm font-medium text-slate-400">{unit}</span> : null}
      </p>

      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}

      <div className="mt-auto pt-3">
        {safeProgress !== null ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${GRADIENTS[gradient] ?? GRADIENTS.teal} transition-[width] duration-300`}
              style={{ width: `${safeProgress}%` }}
            />
          </div>
        ) : (
          <div className="h-1.5 w-full rounded-full bg-slate-100" />
        )}
      </div>
    </div>
  );
}