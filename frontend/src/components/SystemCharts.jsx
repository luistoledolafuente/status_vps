// Gráfica de evolución de CPU, memoria y disco (últimas lecturas en memoria).
// MVP: los datos provienen del historial corto del cliente; en el futuro
// vendrán del historial persistido del backend.

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatTime } from "../utils/format";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export function SystemCharts({ history }) {
  const hasData = history.length >= 2;

  const data = {
    labels: history.map((point) => formatTime(point.at)),
    datasets: [
      {
        label: "CPU",
        data: history.map((point) => point.cpu),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99, 102, 241, 0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: "Memoria",
        data: history.map((point) => point.memory),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.12)",
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
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, maxRotation: 0 },
      },
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: "% de uso" },
      },
    },
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`,
        },
      },
    },
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Evolución de recursos</h2>
        <span className="text-xs text-slate-400">Últimos minutos · se actualiza sola</span>
      </div>

      {!hasData ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-xl bg-slate-50 text-center">
          <p className="text-sm font-medium text-slate-600">Recopilando datos…</p>
          <p className="mt-1 text-xs text-slate-400">
            La gráfica aparecerá en unos segundos, cuando haya al menos dos lecturas.
          </p>
        </div>
      ) : (
        <div className="chart-box">
          <Line data={data} options={options} />
        </div>
      )}
    </div>
  );
}