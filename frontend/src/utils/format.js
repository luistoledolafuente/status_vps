// Utilidades de formato para mostrar datos legibles a cualquier usuario.

export function formatBytes(bytes, decimals = 1) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : decimals)} ${units[index]}`;
}

export function formatPercent(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function formatUptime(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);
  return parts.length > 0 ? parts.join(", ") : `${total} segundos`;
}

export function formatDateTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function formatTime(date) {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
