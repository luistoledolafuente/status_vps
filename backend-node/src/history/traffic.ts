import { SQLiteStore } from '../history/storage';

export class TrafficTracker {
  private readonly memory: Map<string, { sent_bytes: number; recv_bytes: number }> = new Map();

  constructor(private readonly store: SQLiteStore | null = null) {}

  private monthKey(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private current(month: string): { sent_bytes: number; recv_bytes: number } {
    if (this.memory.has(month)) return this.memory.get(month)!;
    if (this.store) {
      try {
        const stored = this.store.getMonthTraffic(month);
        this.memory.set(month, stored);
        return stored;
      } catch {
        // degrade to in-memory counters
      }
    }
    const zero = { sent_bytes: 0, recv_bytes: 0 };
    this.memory.set(month, zero);
    return zero;
  }

  addDelta(sentDelta: number, recvDelta: number): { sent_bytes: number; recv_bytes: number } {
    const month = this.monthKey();
    const current = this.current(month);
    const sent = current.sent_bytes + Math.max(0, sentDelta);
    const recv = current.recv_bytes + Math.max(0, recvDelta);
    this.memory.set(month, { sent_bytes: sent, recv_bytes: recv });
    if (this.store) {
      try {
        const persisted = this.store.addTrafficDelta(month, Math.max(0, sentDelta), Math.max(0, recvDelta));
        this.memory.set(month, persisted);
        return persisted;
      } catch {
        // keep in-memory totals on DB failure
      }
    }
    return this.memory.get(month)!;
  }

  snapshot(): { month: string; sent_bytes: number; recv_bytes: number; total_bytes: number } {
    const month = this.monthKey();
    const totals = this.current(month);
    return {
      month,
      sent_bytes: totals.sent_bytes,
      recv_bytes: totals.recv_bytes,
      total_bytes: totals.sent_bytes + totals.recv_bytes,
    };
  }
}