import * as fs from 'fs';
import * as path from 'path';

export interface MetricPoint {
  timestamp: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
  sent_bps: number | null;
  recv_bps: number | null;
}

type MetricRow = {
  timestamp: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
  sent_bps: number | null;
  recv_bps: number | null;
};

type TrafficRow = {
  sent_bytes: number;
  recv_bytes: number;
};

interface SqliteLike {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): void;
    all(...params: unknown[]): MetricRow[];
    get(...params: unknown[]): MetricRow | TrafficRow | undefined;
  };
}

function loadSqlite(): typeof import('node:sqlite') | null {
  try {
    return require('node:sqlite') as typeof import('node:sqlite');
  } catch {
    return null;
  }
}

export class SQLiteStore {
  private readonly db: SqliteLike | null;
  private readonly memory: MetricPoint[] = [];
  private readonly memoryTraffic = new Map<string, { sent_bytes: number; recv_bytes: number }>();

  constructor(dbPath: string, private readonly retentionDays: number = 30) {
    const sqlite = loadSqlite();
    if (!sqlite) {
      this.db = null;
      return;
    }
    try {
      const directory = path.dirname(path.resolve(dbPath));
      fs.mkdirSync(directory, { recursive: true });
      this.db = new sqlite.DatabaseSync(dbPath) as unknown as SqliteLike;
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS metrics (
          timestamp      TEXT PRIMARY KEY,
          cpu_percent    REAL,
          memory_percent REAL,
          disk_percent   REAL,
          sent_bps       REAL,
          recv_bps       REAL
        );
        CREATE TABLE IF NOT EXISTS traffic_month (
          month       TEXT PRIMARY KEY,
          sent_bytes  INTEGER NOT NULL DEFAULT 0,
          recv_bytes  INTEGER NOT NULL DEFAULT 0,
          updated_at  TEXT
        );
      `);
      this.prune();
    } catch {
      this.db = null;
    }
  }

  get persistenceEnabled(): boolean {
    return this.db !== null;
  }

  close(): void {
    // node:sqlite DatabaseSync has no explicit close in all versions; noop
  }

  recordMetric(point: MetricPoint): void {
    try {
      if (this.db) {
        this.db
          .prepare('INSERT OR REPLACE INTO metrics VALUES (?, ?, ?, ?, ?, ?)')
          .run(
            point.timestamp,
            point.cpu_percent,
            point.memory_percent,
            point.disk_percent,
            point.sent_bps,
            point.recv_bps,
          );
      } else {
        this.memory.push(point);
        if (this.memory.length > 10000) this.memory.shift();
      }
    } catch {
      // persistence is best-effort; never break collection
    }
  }

  readMetrics(since?: string, limit: number = 200): MetricPoint[] {
    try {
      if (this.db) {
        let query = 'SELECT timestamp, cpu_percent, memory_percent, disk_percent, sent_bps, recv_bps FROM metrics';
        const params: unknown[] = [];
        if (since) {
          query += ' WHERE timestamp >= ?';
          params.push(since);
        }
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        const rows = this.db.prepare(query).all(...params);
        const points = rows.map((row) => ({
          timestamp: row.timestamp,
          cpu_percent: row.cpu_percent,
          memory_percent: row.memory_percent,
          disk_percent: row.disk_percent,
          sent_bps: row.sent_bps,
          recv_bps: row.recv_bps,
        }));
        points.reverse();
        return points;
      }
      return this.memory.filter((p) => !since || p.timestamp >= since).slice(-limit);
    } catch {
      return [];
    }
  }

  prune(): void {
    try {
      if (!this.db) return;
      const cutoff = new Date(Date.now() - this.retentionDays * 86400 * 1000).toISOString();
      this.db.prepare('DELETE FROM metrics WHERE timestamp < ?').run(cutoff);
    } catch {
      // ignore
    }
  }

  getMonthTraffic(month: string): { sent_bytes: number; recv_bytes: number } {
    try {
      if (this.db) {
        const row = this.db
          .prepare('SELECT sent_bytes, recv_bytes FROM traffic_month WHERE month = ?')
          .get(month) as TrafficRow | undefined;
        if (!row) return { sent_bytes: 0, recv_bytes: 0 };
        return { sent_bytes: Number(row.sent_bytes), recv_bytes: Number(row.recv_bytes) };
      }
      return this.memoryTraffic.get(month) ?? { sent_bytes: 0, recv_bytes: 0 };
    } catch {
      return { sent_bytes: 0, recv_bytes: 0 };
    }
  }

  addTrafficDelta(month: string, sentDelta: number, recvDelta: number): { sent_bytes: number; recv_bytes: number } {
    try {
      if (this.db) {
        this.db
          .prepare(
            `INSERT INTO traffic_month (month, sent_bytes, recv_bytes, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(month) DO UPDATE SET
               sent_bytes = sent_bytes + ?,
               recv_bytes = recv_bytes + ?,
               updated_at = ?`,
          )
          .run(month, sentDelta, recvDelta, new Date().toISOString(), sentDelta, recvDelta, new Date().toISOString());
        const row = this.db
          .prepare('SELECT sent_bytes, recv_bytes FROM traffic_month WHERE month = ?')
          .get(month) as TrafficRow | undefined;
        if (!row) return { sent_bytes: sentDelta, recv_bytes: recvDelta };
        return { sent_bytes: Number(row.sent_bytes), recv_bytes: Number(row.recv_bytes) };
      }
      const current = this.memoryTraffic.get(month) ?? { sent_bytes: 0, recv_bytes: 0 };
      const next = {
        sent_bytes: current.sent_bytes + Math.max(0, sentDelta),
        recv_bytes: current.recv_bytes + Math.max(0, recvDelta),
      };
      this.memoryTraffic.set(month, next);
      return next;
    } catch {
      return this.getMonthTraffic(month);
    }
  }
}