// Polling hook: fetches data immediately and then on a fixed interval.
// Exposes loading, error, lastUpdated and a manual refresh.

import { useCallback, useEffect, useRef, useState } from "react";

export function usePolling(fetcher, { enabled = true, intervalMs = 5000 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const runningRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err);
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    load();
    const interval = setInterval(load, intervalMs);
    return () => clearInterval(interval);
    // `fetcher` is intentionally read via fetcherRef so the interval is not
    // reset on every render (inline fetchers change identity each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, load]);

  return { data, error, loading, lastUpdated, refresh: load };
}