import type { Settings } from '../config/settings';
import type { HistoryStore } from '../history/history';
import type { TrafficTracker } from '../history/traffic';
import type { CheckService } from '../checks/checks';
import { AnomalyScorer } from '../metrics/anomaly';
import * as system from '../metrics/system';
import { getServicesWithTracking } from '../services/linux-services';

interface Summary {
  hostname: string;
  platform: string;
  cpu: { percent: number; cores: number; logical_cores: number };
  memory: { total_bytes: number; used_bytes: number; available_bytes: number; percent: number };
  disks: unknown[];
  load_avg: { one_min: number; five_min: number; fifteen_min: number } | null;
  uptime_seconds: number;
  uptime_human: string;
  boot_time_iso: string;
  network: unknown;
  traffic: Record<string, unknown>;
  anomaly: Record<string, unknown>;
  checks: unknown[];
  collected_at: string;
}

export class MetricsCollector {
  private readonly errors: string[] = [];
  lastCollectionAt: string | null = null;

  constructor(
    private readonly settings: Settings,
    private readonly logger: { warn(...args: unknown[]): void },
    private readonly history: HistoryStore,
    private readonly traffic: TrafficTracker,
    private readonly checks: CheckService | null,
  ) {}

  private async safe<T>(source: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.errors.push(`${source}: ${String(err)}`);
      this.logger.warn?.('collector source failed', { error: String(err), source });
      return fallback;
    }
  }

  recentErrors(limit = 5): string[] {
    return this.errors.slice(-limit);
  }

  errorCount(): number {
    return this.errors.length;
  }

  async collectSummary(): Promise<Summary> {
    const uptime = system.getUptime();
    const network = await this.safe<Awaited<ReturnType<typeof system.getNetworkInfo>> | null>(
      'network',
      () => system.getNetworkInfo(),
      null,
    );
    if (network) {
      const sentDelta = network.delta_sent || 0;
      const recvDelta = network.delta_recv || 0;
      if (sentDelta || recvDelta) {
        this.traffic.addDelta(sentDelta, recvDelta);
      }
    }
    const networkPublic = network
      ? {
          bytes_sent: network.bytes_sent,
          bytes_recv: network.bytes_recv,
          sent_bps: network.sent_bps,
          recv_bps: network.recv_bps,
          delta_sent: network.delta_sent,
          delta_recv: network.delta_recv,
        }
      : null;

    const cpu = await this.safe('cpu', () => system.getCpuInfo(), { percent: 0, cores: 0, logical_cores: 0 });
    const memory = await this.safe('memory', () => system.getMemoryInfo(), {
      total_bytes: 0, used_bytes: 0, available_bytes: 0, percent: 0,
    });
    const loadAvg = this.safe('load_avg', async () => system.getLoadAvg() ?? null, null);
    const disks = await this.safe('disks', () => system.getDisks(), []);

    const trafficSnapshot = this.trafficSnapshot();
    const anomaly = this.anomalySnapshot(cpu, memory, await loadAvg);
    const checks = this.checks ? this.checks.snapshot() : [];

    const summary: Summary = {
      hostname: this.settings.getHostname(),
      platform: system.getPlatform(),
      cpu,
      memory,
      disks,
      load_avg: await loadAvg,
      uptime_seconds: uptime.uptime_seconds,
      uptime_human: uptime.uptime_human,
      boot_time_iso: uptime.boot_time_iso,
      network: networkPublic,
      traffic: trafficSnapshot,
      anomaly,
      checks,
      collected_at: new Date().toISOString(),
    };
    this.lastCollectionAt = summary.collected_at;
    return summary;
  }

  private trafficSnapshot(): Record<string, unknown> {
    const base: Record<string, unknown> = { ...this.traffic.snapshot() };
    const quotaGb = this.settings.trafficQuotaGb;
    if (quotaGb > 0) {
      const quotaBytes = quotaGb * 1024 ** 3;
      base['quota_bytes'] = quotaBytes;
      base['percent'] = quotaBytes > 0 ? Math.round(((base['total_bytes'] as number) / quotaBytes) * 1000) / 10 : null;
    } else {
      base['quota_bytes'] = null;
      base['percent'] = null;
    }
    return base;
  }

  private anomalySnapshot(
    cpu: { percent: number },
    memory: { percent: number },
    loadAvg: { one_min: number } | null,
  ): Record<string, unknown> {
    try {
      const points = this.history.recent(this.settings.anomalyWindowMinutes);
      return new AnomalyScorer(this.settings.anomalyWindowMinutes, this.settings.anomalyCritical).score(
        cpu.percent,
        memory.percent,
        loadAvg?.one_min ?? null,
        points,
      ) as unknown as Record<string, unknown>;
    } catch (err) {
      this.logger.warn?.('anomaly scoring failed', { error: String(err) });
      return { score: 0, level: 'normal', critical_threshold: this.settings.anomalyCritical, metrics: {} };
    }
  }

  async collectProcesses(limit: number, sortBy: string): Promise<unknown[]> {
    return this.safe('processes', () => system.getProcesses(limit, sortBy), []);
  }

  async collectServices(): Promise<unknown> {
    return this.safe('services', async () => getServicesWithTracking(this.settings.trackedServices), {
      available: false,
      manager: null,
      detail: 'El recolector de servicios falló; inténtalo de nuevo.',
      services: [],
      counts: {},
      tracked: [],
    });
  }
}