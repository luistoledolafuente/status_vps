// KPI grid: CPU, memory, disk, network and uptime cards with severity colors.

import { Skeleton } from "@heroui/react";
import { MetricCard } from "./MetricCard";
import { formatBitsPerSecond, formatBytes, formatPercent, formatUptime, maxDiskPercent, pickMainDisk } from "../utils/format";

const IconCpu = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
    <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" strokeLinecap="round" />
  </svg>
);

const IconMemory = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="10" rx="2" />
    <path d="M5 7v2M8 7v2M11 7v2M14 7v2M17 7v2M19 7v2M5 15h14" strokeLinecap="round" />
  </svg>
);

const IconDisk = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" />
  </svg>
);

const IconNetwork = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7h11M3 12h8M3 17h5" strokeLinecap="round" />
    <circle cx="17" cy="7" r="3" />
    <circle cx="15" cy="17" r="3" />
  </svg>
);

const IconClock = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Gradient by severity for better "cola de jerarquía de información".
function severityGradient(percent) {
  if (percent >= 90) return "rose";
  if (percent >= 80) return "amber";
  return "teal";
}

export function KPIGrid({ summary, loading }) {
  if (loading && !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" animationType="pulse" />
        ))}
      </div>
    );
  }

  const cpu = summary?.cpu;
  const memory = summary?.memory;
  const disk = pickMainDisk(summary?.disks);
  const loadAvg = summary?.load_avg;
  const network = summary?.network;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        title="Uso de CPU"
        value={cpu ? formatPercent(cpu.percent) : "—"}
        subtitle={
          cpu ? `${cpu.cores} ${cpu.cores === 1 ? "núcleo físico" : "núcleos físicos"} · ${cpu.logical_cores} lógicos` : "No disponible"
        }
        progress={cpu?.percent}
        gradient={severityGradient(cpu?.percent)}
        icon={IconCpu}
      />

      <MetricCard
        title="Memoria usada"
        value={memory ? formatBytes(memory.used_bytes) : "—"}
        unit={memory ? `de ${formatBytes(memory.total_bytes)}` : ""}
        subtitle={memory ? `Libre: ${formatBytes(memory.available_bytes)}` : "No disponible"}
        progress={memory?.percent}
        gradient={severityGradient(memory?.percent)}
        icon={IconMemory}
      />

      <MetricCard
        title="Almacenamiento"
        value={disk ? formatPercent(disk.percent, 1) : "—"}
        subtitle={
          disk
            ? `${formatBytes(disk.used_bytes)} de ${formatBytes(disk.total_bytes)} en ${disk.mountpoint}${summary?.disks?.length > 1 ? ` · ${summary.disks.length} particiones` : ""}`
            : "No disponible"
        }
        progress={disk?.percent}
        gradient={severityGradient(disk?.percent)}
        icon={IconDisk}
      />

      <MetricCard
        title="Tráfico de red"
        value={network && network.recv_bps != null ? formatBitsPerSecond(network.recv_bps) : "—"}
        subtitle={
          network
            ? `Enviado: ${network.sent_bps != null ? formatBitsPerSecond(network.sent_bps) : "—"}`
            : `${maxDiskPercent(summary) > 0 ? "Sin datos de red" : "No disponible"}`
        }
        gradient="sky"
        icon={IconNetwork}
      />

      <MetricCard
        title="Tiempo activo (uptime)"
        value={summary ? formatUptime(summary.uptime_seconds) : "—"}
        subtitle={
          loadAvg
            ? `Carga: ${loadAvg.one_min.toFixed(1)} · ${loadAvg.five_min.toFixed(1)} · ${loadAvg.fifteen_min.toFixed(1)}`
            : summary?.hostname ?? "Cargando…"
        }
        gradient="teal"
        icon={IconClock}
      />
    </div>
  );
}