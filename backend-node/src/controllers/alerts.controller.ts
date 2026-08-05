import { Controller, Get, Query } from '@nestjs/common';
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
  async testAlerts(@Query('channel') channel?: string): Promise<Record<string, unknown>> {
    const channels = this.notifier.status();
    const target = channel ? (channels.find((c) => c.kind === channel) ?? null) : null;

    if (channel) {
      if (!target) {
        return { configured: false, sent: {}, message: `Canal desconocido: ${channel}.` };
      }
      if (!target.configured) {
        return {
          configured: false,
          sent: { [channel]: false },
          message: `El canal ${channel} no está configurado. Revisa las variables SYSSTATUS_* del backend.`,
        };
      }
    } else {
      const configured = channels.some((c) => c.configured);
      if (!configured) {
        return { configured: false, sent: {}, message: 'No se configuró ningún canal (webhook, Telegram o correo).' };
      }
    }

    const sent = await (channel ? this.notifier.sendTestOne(channel) : this.notifier.sendTest());
    return {
      configured: true,
      sent,
      message: Object.values(sent).some(Boolean)
        ? 'Notificación de prueba enviada.'
        : 'La entrega falló; revisa los logs del backend.',
    };
  }
}