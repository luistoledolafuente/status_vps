import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { settings } from '../config/settings';
import { decodeToken } from '../auth/security';
import { MetricsCollector } from '../metrics/collector';
import { HistoryStore } from '../history/history';
import { AlertService } from '../alerts/alerts';
import { CheckService } from '../checks/checks';
import { ObservabilityState } from '../observability/state';

function parseQuery(url: string | undefined): URLSearchParams {
  if (!url) return new URLSearchParams();
  const index = url.indexOf('?');
  return new URLSearchParams(index >= 0 ? url.slice(index + 1) : '');
}

interface WsClient {
  id: string;
  socket: WebSocket;
}

@WebSocketGateway({ path: '/ws/metrics', cors: { origin: '*' } })
export class MetricsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MetricsGateway');
  private timer: NodeJS.Timeout | null = null;
  private seq = 0;
  private readonly clients = new Map<string, WsClient>();

  constructor(
    private readonly collector: MetricsCollector,
    private readonly history: HistoryStore,
    private readonly alerts: AlertService,
    private readonly checks: CheckService,
    private readonly state: ObservabilityState,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), settings.wsIntervalSeconds * 1000);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    try {
      await this.checks.runIfDue();
      const summary = await this.collector.collectSummary();
      this.history.record(summary as unknown as Record<string, unknown>);
      await this.alerts.evaluate(summary as unknown as Record<string, unknown>, null, this.checks.snapshot());
      this.state.lastBroadcastAt = summary.collected_at;
      this.state.lastCollectedAt = summary.collected_at;
      if (this.clients.size > 0) {
        const payload = JSON.stringify({ type: 'metrics', data: summary });
        for (const client of this.clients.values()) {
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(payload);
          }
        }
      }
    } catch (err) {
      this.logger.error(`broadcast loop error: ${String(err)}`);
    }
  }

  handleConnection(client: WebSocket, request: Request): void {
    const token = parseQuery(request.url).get('token');
    if (settings.authEnabled) {
      try {
        if (!token) throw new Error('token requerido');
        decodeToken(token, settings);
      } catch {
        client.close(4401, 'Autenticación requerida');
        return;
      }
    }
    this.seq += 1;
    const id = `client-${this.seq}`;
    this.clients.set(id, { id, socket: client });
    this.state.setWsClients(this.clients.size);
    this.logger.log(`websocket client connected id=${id} count=${this.clients.size}`);
  }

  handleDisconnect(client: WebSocket): void {
    for (const [id, entry] of this.clients) {
      if (entry.socket === client) {
        this.clients.delete(id);
        break;
      }
    }
    this.state.setWsClients(this.clients.size);
    this.logger.log(`websocket client disconnected count=${this.clients.size}`);
  }
}