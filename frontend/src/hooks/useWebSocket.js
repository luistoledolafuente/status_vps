// WebSocket hook: connection lifecycle, live messages and auto-reconnect
// with exponential backoff. Exposes the connection status for the UI:
// connecting / connected / reconnecting / disconnected.

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DELAY = 1000;
const MAX_DELAY = 10000;

export function useWebSocket({ url, enabled = true, onMessage, reconnectBaseMs = DEFAULT_DELAY, maxDelayMs = MAX_DELAY }) {
  const [status, setStatus] = useState(enabled ? "connecting" : "disconnected");
  const [attempts, setAttempts] = useState(0);

  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const enabledRef = useRef(enabled);
  const onMessageRef = useRef(onMessage);
  const attemptsRef = useRef(0);

  enabledRef.current = enabled;
  onMessageRef.current = onMessage;

  const scheduleReconnect = useCallback(() => {
    if (!enabledRef.current || timerRef.current) return;
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    setStatus("reconnecting");
    const delay = Math.min(reconnectBaseMs * 2 ** (attemptsRef.current - 1), maxDelayMs);
    timerRef.current = setTimeout(() => connect(), delay);
  }, [reconnectBaseMs, maxDelayMs]);

  const connect = useCallback(() => {
    if (!enabledRef.current) return;
    let socket;
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      attemptsRef.current = 0;
      setAttempts(0);
      setStatus("connected");
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessageRef.current?.(message);
      } catch {
        // ignore malformed frame
      }
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (!enabledRef.current) {
        setStatus("disconnected");
        return;
      }
      scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close(); // triggers onclose -> reconnect
    };
  }, [url, scheduleReconnect]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      setStatus("disconnected");
      return undefined;
    }
    connect();
    return () => {
      enabledRef.current = false;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, url, connect]);

  const disconnect = useCallback(() => {
    enabledRef.current = false;
    setStatus("disconnected");
    clearTimeout(timerRef.current);
    timerRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  return { status, attempts, connect, disconnect };
}