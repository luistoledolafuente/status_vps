import { SQLiteStore } from './storage';

export interface HistoryPoint {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  sent_bps: number | null;
  recv_bps: number | null;
}

export class HistoryStore {
  private readonly _points: HistoryPoint[] = [];
  private lastTs = 0;
  readonly storageName: string;
  readonly snapshotSeconds: number;
  private readonly store: SQLiteStore | null;

  constructor(
    private readonly maxPoints: number = 3600,
    snapshotSeconds: number = 15,
    dbPath: string | null = null,
    private readonly retentionDays: number = 30,
  ) {
    this.snapshotSeconds = snapshotSeconds;
    this.store = dbPath ? new SQLiteStore(dbPath, retentionDays) : null;
    this.storageName = this.store?.persistenceEnabled ? 'sqlite' : 'memory';
  }

  get sqliteStore(): SQLiteStore | null {
    return this.store;
  }

  record(summary: Record<string, unknown>): void {
    const now = Date.now() / 1000;
    if (now - this.lastTs < this.snapshotSeconds) return;
    this.lastTs = now;

    const disks = (summary['disks'] as Array<{ percent: number }>) ?? [];
    const diskMax = disks.length
      ? Math.max(...disks.map((d) => d['percent'] ?? 0))
      : 0;
    const network = (summary['network'] ?? {}) as Record<string, number | null>;
    const cpu = (summary['cpu'] ?? {}) as Record<string, number>;
    const memory = (summary['memory'] ?? {}) as Record<string, number>;

    const point: HistoryPoint = {
      timestamp: new Date().toISOString(),
      cpu_percent: Math.round((cpu['percent'] ?? 0) * 10) / 10,
      memory_percent: Math.round((memory['percent'] ?? 0) * 10) / 10,
      disk_percent: Math.round(diskMax * 10) / 10,
      sent_bps: (network['sent_bps'] as number | null) ?? null,
      recv_bps: (network['recv_bps'] as number | null) ?? null,
    };
    this._points.push(point);
    if (this._points.length > this.maxPoints) {
      this._points.splice(0, this._points.length - this.maxPoints);
    }
    if (this.store) {
      this.store.recordMetric(point);
    }
  }

  points(since?: string, limit: number = 200): HistoryPoint[] {
    let items = [...this._points];
    if (items.length === 0 && this.store) {
      items = this.store.readMetrics(since, limit) as HistoryPoint[];
    }
    if (since) {
      const cutoff = new Date(since).getTime();
      if (!Number.isNaN(cutoff)) {
        items = items.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
      }
    }
    return items.slice(-limit);
  }

  recent(minutes: number = 120, limit: number = 500): HistoryPoint[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    const items = this._points.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
    return items.slice(-limit);
  }

  clear(): void {
    this._points.length = 0;
  }

  close(): void {
    if (this.store) this.store.close();
  }
}
