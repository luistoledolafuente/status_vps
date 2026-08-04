// Monthly traffic card: transfer used this month vs. the plan quota,
// with current up/down rates underneath.

import { Chip, ProgressBar } from "@heroui/react";
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

function quotaColor(percent) {
  if (percent >= 95) return "danger";
  if (percent >= 80) return "warning";
  return "accent";
}

export function TrafficCard({ traffic, network }) {
  if (!traffic) {
    return (
      <Card title="Tráfico mensual" subtitle="Transferencia del mes en curso">
        <p className="text-sm text-muted">Recopilando datos de tráfico…</p>
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
          <Chip variant="soft" size="sm">
            Cuota: {formatBytes(quotaBytes, 0)}
          </Chip>
        ) : null
      }
    >
      <div className="flex items-baseline gap-1.5">
        <span className="font-data text-3xl font-semibold tracking-tight text-foreground">
          {formatBytes(traffic.total_bytes, 2)}
        </span>
        {hasQuota ? (
          <span className="font-data text-sm font-medium text-muted">
            de {formatBytes(quotaBytes, 0)}
          </span>
        ) : null}
      </div>

      {hasQuota ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{formatBytes(traffic.sent_bytes, 1)} enviados · {formatBytes(traffic.recv_bytes, 1)} recibidos</span>
            <span className="font-data font-semibold text-foreground">{percent.toFixed(1)}%</span>
          </div>
          <ProgressBar
            className="mt-1.5"
            aria-label={`Uso de cuota de tráfico: ${percent.toFixed(1)}%`}
            value={percent}
            color={quotaColor(percent)}
            size="sm"
          />
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">
          {formatBytes(traffic.sent_bytes, 1)} enviados · {formatBytes(traffic.recv_bytes, 1)} recibidos
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-separator pt-3 text-xs text-muted">
        <span>
          <span className="text-muted">Descarga actual: </span>
          <span className="font-data font-semibold text-sky-600">
            {network?.recv_bps != null ? formatBitsPerSecond(network.recv_bps) : "—"}
          </span>
        </span>
        <span>
          <span className="text-muted">Subida actual: </span>
          <span className="font-data font-semibold text-violet-600">
            {network?.sent_bps != null ? formatBitsPerSecond(network.sent_bps) : "—"}
          </span>
        </span>
      </div>
    </Card>
  );
}