// StatusDot: colored dot with an optional label.

const COLORS = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-400",
  reconnecting: "bg-amber-400",
  disconnected: "bg-rose-500",
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  failed: "bg-rose-500",
  unknown: "bg-slate-300",
};

export function StatusDot({ state, label, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLORS[state] ?? COLORS.unknown}`} />
      {label ? <span className="text-sm font-medium text-slate-600">{label}</span> : null}
    </span>
  );
}