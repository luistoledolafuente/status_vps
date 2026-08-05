import { Controller, Get } from '@nestjs/common';
import { settings } from '../config/settings';
import { ObservabilityState } from '../observability/state';

@Controller('api/health')
export class HealthController {
  constructor(private readonly state: ObservabilityState) {}

  @Get()
  getHealth(): Record<string, unknown> {
    return {
      status: 'ok',
      service: settings.appName,
      version: settings.appVersion,
      environment: settings.environment,
      auth_enabled: settings.authEnabled,
      server_time: this.state.lastCollectedAt,
      last_collection_at: this.state.lastCollectedAt,
      ws_clients: this.state.wsClients(),
      last_broadcast_at: this.state.lastBroadcastAt,
      avg_response_ms: this.state.averageResponseMs(),
      collector_error_count: this.state.collectorErrorCount(),
      collector_recent_errors: this.state.collectorRecentErrors(),
      api_uptime_seconds: this.state.uptimeSeconds(),
    };
  }
}