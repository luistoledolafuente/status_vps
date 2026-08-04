// Skeleton: pulsing placeholder block (loading states).

export function Skeleton({ className = "", rows = 1 }) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-8 rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}