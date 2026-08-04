// Trend charts: CPU/RAM evolution, disk usage per partition and network rate.
// Data comes from the merged history (backend snapshots + live points).

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { formatBitsPerSecond, formatBytes, formatTime } from "../utils/format";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

function cssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function makeBaseOptions() {
  const tick = cssVar("--muted", "#94a3b8");
  const grid = cssVar("--border", "#e2e8f0");
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    color: tick,
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, color: tick } },
    },
    grid: { color: grid },
  };
}

function TrendChart({ history }) {
  const hasData = history.length >= 2;
  const base = makeBaseOptions();
  const data = {
    labels: history.map((point) => formatTime(point.at)),
    datasets: [
      {
        label: "CPU",
        data: history.map((point) => point.cpu),
        borderColor: "#0d9488",
        backgroundColor: "rgba(13, 148, 136, 0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: "Memoria",
        data: history.map((point) => point.memory),
        borderColor: "#0284c7",
        backgroundColor: "rgba(2, 132, 199, 0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: "Disco",
        data: history.map((point) => point.disk),
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.10)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  };
  const options = {
    ...base,
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
      y: { beginAtZero: true, max: 100, title: { display: true, text: "% de uso" }, grid: { color: base.grid.color } },
    },
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` },
      },
    },
  };
  return hasData ? (
    <div className="h-64">
      <Line data={data} options={options} />
    </div>
  ) : (
    <EmptyState title="Recopilando datos…" description="Las gráficas aparecerán cuando haya al menos dos lecturas." />
  );
}

function DiskChart({ disks }) {
  const items = disks ?? [];
  const base = makeBaseOptions();
  const data = {
    labels: items.map((disk) => (disk.is_root ? `${disk.mountpoint} (raíz)` : disk.mountpoint)),
    datasets: [
      {
        label: "Uso",
        data: items.map((disk) => disk.percent),
        backgroundColor: items.map((disk) => (disk.percent >= 90 ? "#f43f5e" : disk.percent >= 80 ? "#f59e0b" : "#14b8a6")),
        borderRadius: 6,
      },
    ],
  };
  const options = {
    ...base,
    indexAxis: "y",
    scales: {
      x: { beginAtZero: true, max: 100, title: { display: true, text: "% usado" }, grid: { color: base.grid.color } },
      y: { grid: { display: false } },
    },
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const disk = items[ctx.dataIndex];
            return `${ctx.parsed.x.toFixed(1)}% · ${formatBytes(disk.used_bytes)} de ${formatBytes(disk.total_bytes)}${disk.fstype ? ` · ${disk.fstype}` : ""}`;
          },
        },
      },
    },
  };
  return items.length === 0 ? (
    <EmptyState title="Sin datos de particiones" description="No se pudieron leer las particiones del disco." />
  ) : (
    <div className="h-64">
      <Bar data={data} options={options} />
    </div>
  );
}

function NetworkChart({ history }) {
  const hasData = history.some((point) => point.sentBps > 0 || point.recvBps > 0);
  const base = makeBaseOptions();
  const data = {
    labels: history.map((point) => formatTime(point.at)),
    datasets: [
      {
        label: "Descarga",
        data: history.map((point) => point.recvBps),
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14, 165, 233, 0.10)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: "Subida",
        data: history.map((point) => point.sentBps),
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139, 92, 246, 0.10)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  };
  const options = {
    ...base,
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
      y: { beginAtZero: true, title: { display: true, text: "Velocidad" }, grid: { color: base.grid.color } },
    },
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatBitsPerSecond(ctx.parsed.y)}` },
      },
    },
  };
  return !hasData ? (
    <EmptyState title="Sin tráfico de red" description="Se mostrarán las tasas de descarga y subida cuando haya movimiento." />
  ) : (
    <div className="h-56">
      <Line data={data} options={options} />
    </div>
  );
}

export function SystemCharts({ history, summary }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2" title="Evolución de recursos" subtitle="CPU, memoria y disco (% de uso)">
        <TrendChart history={history} />
      </Card>
      <Card title="Almacenamiento por partición" subtitle="Solo dispositivos locales · uso de cada partición">
        <DiskChart disks={summary?.disks} />
      </Card>
      <Card className="lg:col-span-3" title="Tráfico de red" subtitle="Velocidad de descarga y subida">
        <NetworkChart history={history} />
      </Card>
    </div>
  );
}