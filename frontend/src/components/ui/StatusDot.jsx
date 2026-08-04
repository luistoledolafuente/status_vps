// StatusDot: colored dot with an optional label. "connected"/"active"
// states pulse subtly; 'unreachable' is amber (present but not reachable).

const COLORS = {
  connected: "bg-success",
  connecting: "bg-warning",
  reconnecting: "bg-warning",
  disconnected: "bg-danger",
  active: "bg-success",
  inactive: "bg-muted",
  failed: "bg-danger",
  unreachable: "bg-warning",
  not_found: "bg-border-secondary",
  unknown: "bg-border-secondary",
};

const PULSE = new Set(["connected", "active"]);

export function StatusDot({ state, label, className = "" }) {
  const color = COLORS[state] ?? COLORS.unknown;
  const pulse = PULSE.has(state) ? "status-pulse" : "";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color} ${pulse}`} />
      {label ? <span className="text-sm font-medium text-muted">{label}</span> : null}
    </span>
  );
}