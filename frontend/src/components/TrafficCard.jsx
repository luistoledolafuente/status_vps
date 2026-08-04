// Monthly traffic card: transfer used this month vs. the plan quota,
// with current up/down rates underneath.

import { Card } from "./ui/Card";
import { formatBitsPerSecond, formatBytes } from "../utils/format";

function monthLabel(month) {
  if (!month) return "";
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return month;
  return new Date(year, monthIndex - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function quotaGradient(percent) {
  if (percent >= 95) return "bg-rose-500";
  if (percent >= 80) return "bg-amber-500";
  return "bg-teal-500";
}

export function TrafficCard({ traffic, network }) {
  if (!traffic) {
    return (
      <Card title="Tráfico mensual" subtitle="Transferencia del mes en curso">
        <p className="text-sm text-slate-500">Recopilando datos de tráfico…</p>
      </Card>
    );
  }

  const quotaBytes = traffic.quota_bytes;
  const percent = traffic.percent;
  const hasQuota = quotaBytes != null && percent != null;

  return (
    <Card
      title="Tráfico mensual"
      subtitle={`Transferencia del mes · ${monthLabel(traffic.month)}`}
      actions={
        hasQuota ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            Cuota: {formatBytes(quotaBytes, 0)}
          </span>
        ) : null
      }
    >
      <div className="flex items-baseline gap-1.5">
        <span className="font-data text-3xl font-semibold tracking-tight text-slate-900">
          {formatBytes(traffic.total_bytes, 2)}
        </span>
        {hasQuota ? (
          <span className="font-data text-sm font-medium text-slate-400">
            de {formatBytes(quotaBytes, 0)}
          </span>
        ) : null}
      </div>

      {hasQuota ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{formatBytes(traffic.sent_bytes, 1)} enviados · {formatBytes(traffic.recv_bytes, 1)} recibidos</span>
            <span className="font-data font-semibold text-slate-700">{percent.toFixed(1)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${quotaGradient(percent)} transition-[width] duration-500`}
              style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          {formatBytes(traffic.sent_bytes, 1)} enviados · {formatBytes(traffic.recv_bytes, 1)} recibidos
        </p>
      )}

      <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          <span className="text-slate-400">Descarga actual: </span>
          <span className="font-data font-semibold text-sky-600">
            {network?.recv_bps != null ? formatBitsPerSecond(network.recv_bps) : "—"}
          </span>
        </span>
        <span>
          <span className="text-slate-400">Subida actual: </span>
          <span className="font-data font-semibold text-violet-600">
            {network?.sent_bps != null ? formatBitsPerSecond(network.sent_bps) : "—"}
          </span>
        </span>
      </div>
    </Card>
  );
}
