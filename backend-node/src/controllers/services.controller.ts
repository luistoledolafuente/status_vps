import { Controller, Get } from '@nestjs/common';
import { settings } from '../config/settings';
import { AlertService } from '../alerts/alerts';
import { MetricsCollector } from '../metrics/collector';

@Controller('api/services')
export class ServicesController {
  constructor(
    private readonly collector: MetricsCollector,
    private readonly alerts: AlertService,
  ) {}

  @Get()
  async listServices(): Promise<Record<string, unknown>> {
    const response = (await this.collector.collectServices()) as Record<string, unknown> & {
      tracked?: Array<{ name: string; state: string }>;
    };
    await this.alerts.evaluate(null, { tracked: response.tracked ?? [] }, null);
    return response;
  }
}