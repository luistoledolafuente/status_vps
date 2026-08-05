// Central dashboard hook: live data arrives exclusively over WebSocket;
// the secondary datasets (processes, services, alerts, health) are fetched
// on demand via REST (on mount, on tab change, on sort change) — never on a
// fixed interval, so there is no polling anywhere.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { config, wsUrlWithToken } from "../config";
import { loadSession } from "../auth/session";
import { maxDiskPercent } from "../utils/format";
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

// On-demand REST fetch: runs when refresh() is called, never on an interval.
function useOnDemand(fetcher) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, []);

  return { data, error, loading, refresh };
}

export function useDashboardData({ tab, enabled = true } = {}) {
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

  // --- Live summary: WebSocket only ---------------------------------------
  const token = loadSession()?.access_token ?? null;
  const ws = useWebSocket({
    url: wsUrlWithToken(config.wsUrl, token),
    enabled: enabled && Boolean(token),
    onMessage: (message) => {
      if (message?.type === "metrics") {
        setLiveSummary(message.data);
        appendPoint(message.data);
        setWsMessageAt(new Date());
      }
    },
  });

  // --- History backfill (server-side snapshots) ----------------------------
  useEffect(() => {
    if (!enabled) return undefined;
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

  // --- REST datasets (on demand, no polling) --------------------------------
  const fetchProcesses = useCallback(
    () => api.processes({ limit: 12, sortBy: processSort }),
    [processSort]
  );
  const processes = useOnDemand(fetchProcesses);
  const services = useOnDemand(() => api.services());
  const alerts = useOnDemand(() => api.alerts());
  const health = useOnDemand(() => api.health());

  // Load everything on mount and refresh when the active tab changes.
  useEffect(() => {
    if (!enabled) return;
    processes.refresh();
    services.refresh();
    alerts.refresh();
    health.refresh();
  }, [tab, enabled, processes.refresh, services.refresh, alerts.refresh, health.refresh]);

  // Reload the process list when the sort order changes.
  useEffect(() => {
    if (!enabled) return;
    processes.refresh();
  }, [enabled, processSort, processes.refresh]);

  const refreshProcesses = useCallback((sortBy) => setProcessSort(sortBy), []);

  // --- Derived state --------------------------------------------------------
  const summary = liveSummary;
  const loading = !summary;
  const error =
    ws.status === "disconnected" && !liveSummary
      ? { message: "No se pudo conectar con el servidor por WebSocket." }
      : null;
  const lastUpdated = wsMessageAt;

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
    error,
    loading,
    lastUpdated,
    processSort,
    refreshProcesses,
  };
}
