// ErrorBanner: global error with a retry action.

export function ErrorBanner({ error, onRetry, hint }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p className="text-sm font-medium text-rose-800">Error al consultar el servidor</p>
          <p className="text-sm text-rose-700">{error?.message ?? "Comprueba que el backend esté corriendo."}</p>
          {hint ? <p className="mt-1 text-xs text-rose-600">{hint}</p> : null}
        </div>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}