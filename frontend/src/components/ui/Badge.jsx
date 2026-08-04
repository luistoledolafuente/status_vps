// Badge with severity-based colors (info / success / warning / critical).

const VARIANTS = {
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  critical: "bg-rose-50 text-rose-700 ring-rose-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({ variant = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${VARIANTS[variant] ?? VARIANTS.neutral}`}
    >
      {children}
    </span>
  );
}