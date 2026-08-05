import { Controller, Get } from '@nestjs/common';
import { settings } from '../config/settings';
import { MetricsCollector } from '../metrics/collector';
import { HistoryStore } from '../history/history';
import { AlertService } from '../alerts/alerts';
import { CheckService } from '../checks/checks';

@Controller('api/metrics')
export class MetricsController {
  constructor(
    private readonly collector: MetricsCollector,
    private readonly history: HistoryStore,
    private readonly alerts: AlertService,
    private readonly checks: CheckService,
  ) {}

  @Get('/summary')
  async getSummary(): Promise<Record<string, unknown>> {
    const summary = await this.collector.collectSummary();
    this.history.record(summary as unknown as Record<string, unknown>);
    await this.alerts.evaluate(summary as unknown as Record<string, unknown>, null, this.checks.snapshot());
    return summary as unknown as Record<string, unknown>;
  }

  @Get('/processes')
  async getProcesses(limit = 10, sortBy = 'cpu'): Promise<Record<string, unknown>> {
    const parsedLimit = Math.max(1, Math.min(Number(limit) || 10, settings.maxProcesses));
    const sort = ['cpu', 'memory', 'name'].includes(sortBy) ? sortBy : 'cpu';
    const processes = await this.collector.collectProcesses(parsedLimit, sort);
    return {
      limit: parsedLimit,
      checked: processes.length,
      sort_by: sort,
      processes,
      collected_at: new Date().toISOString(),
    };
  }

  @Get('/history')
  async getHistory(limit: string, since?: string): Promise<Record<string, unknown>> {
    const parsedLimit = Math.max(1, Math.min(Number(limit) || 200, settings.historyMaxPoints));
    return {
      storage: this.history.storageName,
      interval_seconds: this.history.snapshotSeconds,
      points: this.history.points(since ?? undefined, parsedLimit),
    };
  }
}