import { Controller, Get } from '@nestjs/common';
import { settings } from '../config/settings';
import { AlertService } from '../alerts/alerts';
import { NotificationHub } from '../notifications/notifications';

@Controller('api/alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertService,
    private readonly notifier: NotificationHub,
  ) {}

  @Get()
  getAlerts(): Record<string, unknown> {
    return this.alerts.snapshot();
  }

  @Get('/channels')
  getChannels(): Record<string, unknown> {
    return { channels: this.notifier.status() };
  }

  @Get('/test')
  async testAlerts(): Promise<Record<string, unknown>> {
    const configured = this.notifier.status().some((c) => c.configured);
    if (!configured) {
      return { configured: false, sent: {}, message: 'No se configuró ningún canal (webhook, Telegram o correo).' };
    }
    const sent = await this.notifier.sendTest();
    return {
      configured: true,
      sent,
      message: Object.values(sent).some(Boolean)
        ? 'Notificaciones de prueba enviadas.'
        : 'La entrega falló; revisa los logs del backend.',
    };
  }
}