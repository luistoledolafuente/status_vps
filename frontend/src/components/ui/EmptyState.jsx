// EmptyState: friendly placeholder for empty data (no alerts, no results).

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-secondary px-6 py-10 text-center ring-1 ring-border">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface ring-1 ring-border">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4M12 3l7 4v10l-7 4-7-4V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}