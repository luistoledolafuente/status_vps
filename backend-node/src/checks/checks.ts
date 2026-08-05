import * as net from 'net';
import type { Settings } from '../config/settings';

const FAILURES_TO_DOWN = 2;
const PROBE_TIMEOUT_MS = 5000;

export interface CheckResult {
  name: string;
  target: string;
  state: 'up' | 'down' | 'unknown';
  latency_ms: number | null;
  checked_at: string | null;
  error: string | null;
}

export class CheckService {
  private readonly checks: Array<{ name: string; target: string }>;
  private readonly interval: number;
  private readonly failures: Record<string, number> = {};
  private readonly results: Record<string, CheckResult> = {};
  private lastRun = 0;

  constructor(private readonly settings: Settings) {
    this.checks = settings.checks;
    this.interval = settings.checksIntervalSeconds;
    for (const { name, target } of this.checks) {
      this.results[name] = {
        name,
        target,
        state: 'unknown',
        latency_ms: null,
        checked_at: null,
        error: null,
      };
    }
  }

  private probeHttp(url: string): Promise<{ latency_ms: number } | { error: string }> {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      const started = Date.now();
      fetch(url, { signal: controller.signal, redirect: 'follow' })
        .then((response) => {
          clearTimeout(timer);
          const status = response.status;
          if (status < 200 || status >= 400) {
            resolve({ error: `HTTP ${status}` });
            return;
          }
          resolve({ latency_ms: Date.now() - started });
        })
        .catch((err) => {
          clearTimeout(timer);
          resolve({ error: err instanceof Error ? err.message : String(err) });
        });
    });
  }

  private probeTcp(target: string): Promise<{ latency_ms: number } | { error: string }> {
    return new Promise((resolve) => {
      const [host, port] = target.split(':');
      if (!host || !port) {
        resolve({ error: 'destino TCP inválido (usa tcp://host:puerto)' });
        return;
      }
      const started = Date.now();
      const socket = net.connect({
        host,
        port: Number(port),
        timeout: PROBE_TIMEOUT_MS,
      });
      socket.on('connect', () => {
        socket.destroy();
        resolve({ latency_ms: Date.now() - started });
      });
      socket.on('error', (err) => {
        socket.destroy();
        resolve({ error: err.message });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ error: 'timeout' });
      });
    });
  }

  private async probe(name: string, target: string): Promise<{ name: string; latency_ms: number | null; error: string | null }> {
    try {
      if (target.startsWith('http://') || target.startsWith('https://')) {
        const result = await this.probeHttp(target);
        if ('error' in result) {
          return { name, latency_ms: null, error: result.error };
        }
        return { name, latency_ms: result.latency_ms, error: null };
      }
      if (target.startsWith('tcp://')) {
        const result = await this.probeTcp(target.replace(/^tcp:\/\//, ''));
        if ('error' in result) {
          return { name, latency_ms: null, error: result.error };
        }
        return { name, latency_ms: result.latency_ms, error: null };
      }
      return { name, latency_ms: null, error: 'esquema no soportado (usa http://, https:// o tcp://)' };
    } catch (err) {
      return { name, latency_ms: null, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async runIfDue(): Promise<void> {
    if (this.checks.length === 0) return;
    const now = Date.now() / 1000;
    if (now - this.lastRun < this.interval) return;
    await this.runOnce();
  }

  async runOnce(): Promise<void> {
    this.lastRun = Date.now() / 1000;
    const results = await Promise.all(
      this.checks.map(({ name, target }) => this.probe(name, target)),
    );
    for (const probe of results) {
      const result = this.results[probe.name];
      if (!result) continue;
      if (probe.error === null) {
        this.failures[probe.name] = 0;
        result.state = 'up';
        result.latency_ms = probe.latency_ms;
        result.checked_at = new Date().toISOString();
        result.error = null;
      } else {
        this.failures[probe.name] = (this.failures[probe.name] ?? 0) + 1;
        const down = this.failures[probe.name] >= FAILURES_TO_DOWN;
        result.state = down ? 'down' : result.state;
        result.latency_ms = null;
        result.checked_at = new Date().toISOString();
        result.error = probe.error;
      }
    }
  }

  snapshot(): CheckResult[] {
    return Object.values(this.results);
  }

  enabled(): boolean {
    return this.checks.length > 0;
  }
}