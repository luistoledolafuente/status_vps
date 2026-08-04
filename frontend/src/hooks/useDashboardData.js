// Central dashboard hook: combines the live source (WebSocket or polling)
// with REST data (processes, services, alerts) and the history backfill.

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { config } from "../config";
import { maxDiskPercent } from "../utils/format";
import { usePolling } from "./usePolling";
import { useWebSocket } from "./useWebSocket";

const LIVE_MAX_POINTS = 200;

function toPoint(summary, at = new Date()) {
  return {
    at,
    cpu: summary?.cpu?.percent ?? 0,
    memory: summary?.memory?.percent ?? 0,
    disk: maxDiskPercent(summary),
    sentBps: summary?.network?.sent_bps ?? 0,
    recvBps: summary?.network?.recv_bps ?? 0,
  };
}

export function useDashboardData({ mode }) {
  const [liveSummary, setLiveSummary] = useState(null);
  const [chartPoints, setChartPoints] = useState([]);
  const [backfill, setBackfill] = useState([]);
  const [wsMessageAt, setWsMessageAt] = useState(null);
  const [processSort, setProcessSort] = useState("cpu");

  const appendPoint = useCallback((summary) => {
    setChartPoints((prev) => {
      const next = [...prev, toPoint(summary)];
      return next.length > LIVE_MAX_POINTS ? next.slice(next.length - LIVE_MAX_POINTS) : next;
    });
  }, []);

  // --- Live summary -----------------------------------------------------
  const ws = useWebSocket({
    url: config.wsUrl,
    enabled: mode === "ws",
    onMessage: (message) => {
      if (message?.type === "metrics") {
        setLiveSummary(message.data);
        appendPoint(message.data);
        setWsMessageAt(new Date());
      }
    },
  });

  const summaryPoll = usePolling(() => api.summary(), {
    enabled: mode === "polling",
    intervalMs: 2000,
  });

  useEffect(() => {
    if (mode === "polling" && summaryPoll.data) {
      appendPoint(summaryPoll.data);
    }
  }, [mode, summaryPoll.data, appendPoint]);

  // --- History backfill (server-side snapshots) --------------------------
  useEffect(() => {
    let active = true;
    api
      .history({ limit: 200 })
      .then((response) => {
        if (!active) return;
        const points = (response.points ?? []).map((point) => ({
          at: new Date(point.timestamp),
          cpu: point.cpu_percent,
          memory: point.memory_percent,
          disk: point.disk_percent,
          sentBps: point.sent_bps ?? 0,
          recvBps: point.recv_bps ?? 0,
        }));
        setBackfill(points);
      })
      .catch(() => {
        if (active) setBackfill([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // --- REST datasets ------------------------------------------------------
  const fetchProcesses = useCallback(
    () => api.processes({ limit: 12, sortBy: processSort }),
    [processSort]
  );

  const processes = usePolling(fetchProcesses, { intervalMs: 10000 });
  const services = usePolling(() => api.services(), { intervalMs: 10000 });
  const alerts = usePolling(() => api.alerts(), { intervalMs: 5000 });
  const health = usePolling(() => api.health(), { intervalMs: 10000 });

  const refreshProcesses = useCallback((sortBy) => setProcessSort(sortBy), []);

  // --- Derived state --------------------------------------------------------
  const summary = mode === "ws" ? liveSummary : summaryPoll.data;
  const loading = !summary;
  const error =
    mode === "ws"
      ? ws.status === "disconnected" && !liveSummary
        ? { message: "No se pudo conectar por WebSocket. Intenta el modo Polling." }
        : null
      : summaryPoll.error;
  const lastUpdated = mode === "ws" ? wsMessageAt : summaryPoll.lastUpdated;

  const history = useMemo(() => {
    const merged = [...backfill, ...chartPoints];
    return merged.length > LIVE_MAX_POINTS ? merged.slice(merged.length - LIVE_MAX_POINTS) : merged;
  }, [backfill, chartPoints]);

  return {
    summary,
    processes,
    services,
    alerts,
    health,
    history,
    wsStatus: ws.status,
    wsAttempts: ws.attempts,
    mode,
    error,
    loading,
    lastUpdated,
    processSort,
    refreshProcesses,
  };
}