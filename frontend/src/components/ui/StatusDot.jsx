// StatusDot: colored dot with an optional label. "connected"/"active"
// states pulse subtly; 'unreachable' is amber (present but not reachable).

const COLORS = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-400",
  reconnecting: "bg-amber-400",
  disconnected: "bg-rose-500",
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  failed: "bg-rose-500",
  unreachable: "bg-amber-500",
  not_found: "bg-slate-300",
  unknown: "bg-slate-300",
};

const PULSE = new Set(["connected", "active"]);

export function StatusDot({ state, label, className = "" }) {
  const color = COLORS[state] ?? COLORS.unknown;
  const pulse = PULSE.has(state) ? "status-pulse" : "";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color} ${pulse}`} />
      {label ? <span className="text-sm font-medium text-slate-600">{label}</span> : null}
    </span>
  );
}