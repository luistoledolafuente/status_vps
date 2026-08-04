// Hook central del dashboard: obtiene métricas, procesos y servicios,
// mantiene un historial corto para la gráfica y refresca automáticamente.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

const REFRESH_MS = 3000;
const HISTORY_SIZE = 20; // puntos que se conservan para la gráfica (MVP simple).

function averageDiskUsage(summary) {
  if (!summary?.disks?.length) return 0;
  const total = summary.disks.reduce((acc, disk) => Math.max(acc, disk.percent), 0);
  return Math.round(total * 10) / 10;
}

export function useDashboardData() {
  const [summary, setSummary] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [services, setServices] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processSort, setProcessSort] = useState("cpu");

  const isPolling = useRef(false);

  const fetchSummary = useCallback(async () => {
    const result = await api.summary();
    setSummary(result);
    setLastUpdated(new Date());
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          at: new Date(),
          cpu: result.cpu?.percent ?? 0,
          memory: result.memory?.percent ?? 0,
          disk: averageDiskUsage(result),
        },
      ];
      return next.length > HISTORY_SIZE ? next.slice(next.length - HISTORY_SIZE) : next;
    });
    return result;
  }, []);

  const fetchProcesses = useCallback(async (sortBy) => {
    const result = await api.processes({ limit: 10, sortBy });
    setProcesses(result.processes ?? []);
  }, []);

  const fetchServices = useCallback(async () => {
    const result = await api.services();
    setServices(result);
  }, []);

  const loadEverything = useCallback(async () => {
    // Promesas tolerantes: si una fuente falla, las demás se muestran igual.
    const results = await Promise.allSettled([
      fetchSummary(),
      fetchProcesses(processSort),
      fetchServices(),
    ]);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      setError(failures[0].reason);
    } else {
      setError(null);
    }
  }, [fetchSummary, fetchProcesses, fetchServices, processSort]);

  const refreshProcesses = useCallback(
    async (sortBy) => {
      setProcessSort(sortBy);
      try {
        await fetchProcesses(sortBy);
      } catch (err) {
        setError(err);
      }
    },
    [fetchProcesses]
  );

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        await loadEverything();
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    boot();

    const interval = setInterval(async () => {
      if (isPolling.current) return; // evita solapamiento de peticiones lentas.
      isPolling.current = true;
      try {
        await loadEverything();
      } catch (err) {
        if (active) setError(err);
      } finally {
        isPolling.current = false;
      }
    }, REFRESH_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loadEverything]);

  return {
    summary,
    processes,
    services,
    history,
    error,
    loading,
    lastUpdated,
    processSort,
    refresh: loadEverything,
    refreshProcesses,
  };
}