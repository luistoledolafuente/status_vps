import { Injectable } from '@nestjs/common';

@Injectable()
export class ObservabilityState {
  private readonly responseTimes: number[] = [];
  private readonly errors: string[] = [];
  private readonly startedAt: number = Date.now() / 1000;
  lastCollectedAt: string | null = null;
  lastBroadcastAt: string | null = null;
  private wsClientsCount = 0;

  recordResponseTime(ms: number): void {
    this.responseTimes.push(ms);
    if (this.responseTimes.length > 50) this.responseTimes.shift();
  }

  setWsClients(count: number): void {
    this.wsClientsCount = count;
  }

  addCollectorError(message: string): void {
    this.errors.push(message);
    if (this.errors.length > 20) this.errors.shift();
  }

  wsClients(): number {
    return this.wsClientsCount;
  }

  averageResponseMs(): number | null {
    if (this.responseTimes.length === 0) return null;
    const sum = this.responseTimes.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / this.responseTimes.length) * 10) / 10;
  }

  collectorErrorCount(): number {
    return this.errors.length;
  }

  collectorRecentErrors(limit = 5): string[] {
    return this.errors.slice(-limit);
  }

  uptimeSeconds(): number {
    return Math.max(0, Math.floor(Date.now() / 1000 - this.startedAt));
  }
}