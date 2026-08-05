import { createTransport, type Transporter } from 'nodemailer';

interface AlertEvent {
  event?: string;
  severity?: string;
  title?: string;
  message?: string;
  tip?: string;
  metric?: string | null;
  value?: number | null;
  threshold?: number | null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function formatLines(event: AlertEvent, hostname: string): string {
  const severity = event.severity ?? 'info';
  const emoji = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟠' : '🔵';
  const lines = [
    `${emoji} [${event.event}] ${event.title}`,
    `🏷️  Severidad: ${severity}`,
    `🖥️  Host: ${hostname}`,
  ];
  if (event.message) lines.push(`📝 ${event.message}`);
  if (event.metric != null && event.value != null) lines.push(`📊 ${event.metric}: ${event.value}`);
  if (event.tip) lines.push(`💡 ${event.tip}`);
  lines.push(`🕒 ${nowIso()}`);
  return lines.join('\n');
}

export interface NotifierChannel {
  readonly kind: string;
  readonly enabled: boolean;
  send(event: AlertEvent): Promise<boolean>;
  sendTest(): Promise<boolean>;
  details(): string;
}

export class WebhookNotifier implements NotifierChannel {
  readonly kind = 'webhook';
  constructor(
    private readonly url: string,
    private readonly timeoutSeconds: number,
    private readonly hostname: string,
    private readonly logger: { info(msg: string): void; warn(msg: string): void },
  ) {}

  get enabled(): boolean {
    return this.url.trim().length > 0;
  }

  details(): string {
    return this.url || 'sin URL';
  }

  async send(event: AlertEvent): Promise<boolean> {
    if (!this.enabled) return false;
    const payload = {
      event: event.event,
      severity: event.severity,
      title: event.title,
      message: event.message,
      tip: event.tip,
      metric: event.metric,
      value: event.value,
      threshold: event.threshold,
      hostname: this.hostname,
      timestamp: nowIso(),
    };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutSeconds * 1000);
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      this.logger.info(`webhook sent ${event.event} -> ${response.status}`);
      return true;
    } catch (err) {
      this.logger.warn(`webhook delivery failed: ${String(err)}`);
      return false;
    }
  }

  sendTest(): Promise<boolean> {
    return this.send({
      event: 'alert_raised',
      severity: 'warning',
      title: 'Notificación de prueba',
      message: 'Si recibiste este mensaje, el webhook está configurado correctamente.',
      tip: 'Esta es una notificación de prueba del panel de monitoreo.',
    });
  }
}

export class TelegramNotifier implements NotifierChannel {
  readonly kind = 'telegram';
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
    private readonly hostname: string,
    private readonly logger: { info(msg: string): void; warn(msg: string): void },
  ) {}

  get enabled(): boolean {
    return this.botToken.trim().length > 0 && this.chatId.trim().length > 0;
  }

  details(): string {
    return this.chatId ? `chat ${this.chatId}` : 'sin chat_id';
  }

  async send(event: AlertEvent): Promise<boolean> {
    if (!this.enabled) return false;
    const text = formatLines(event, this.hostname);
    const body = JSON.stringify({
      chat_id: this.chatId,
      text,
      disable_web_page_preview: true,
    });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        const responseBody = await response.text();
        this.logger.warn(`telegram delivery failed: HTTP ${response.status} ${responseBody.slice(0, 200)}`);
        return false;
      }
      this.logger.info(`telegram sent -> ${response.status}`);
      return true;
    } catch (err) {
      this.logger.warn(`telegram delivery failed: ${String(err)}`);
      return false;
    }
  }

  sendTest(): Promise<boolean> {
    return this.send({
      event: 'alert_raised',
      severity: 'warning',
      title: 'Notificación de prueba (Telegram)',
      message: 'Si recibes esto, el bot de Telegram está configurado correctamente.',
      tip: 'Revisa que el bot tenga permiso de enviar mensajes a este chat.',
    });
  }
}

export class EmailNotifier implements NotifierChannel {
  readonly kind = 'email';
  private readonly transporter: Transporter | null;
  private readonly port: number;

  constructor(
    private readonly host: string,
    port: number,
    private readonly username: string,
    private readonly password: string,
    private readonly fromEmail: string,
    private readonly toEmails: string[],
    useTls: boolean,
    private readonly hostname: string,
    private readonly logger: { info(msg: string): void; warn(msg: string): void },
  ) {
    this.port = port;
    this.transporter = host
      ? createTransport({
          host,
          port,
          secure: port === 465,
          requireTLS: port === 587 && useTls,
          ...(username ? { auth: { user: username, pass: password } } : {}),
        })
      : null;
  }

  get enabled(): boolean {
    return Boolean(this.host && this.fromEmail && this.toEmails.length > 0);
  }

  details(): string {
    if (!this.enabled) return 'sin host/to';
    return `${this.host}:${this.port} -> ${this.toEmails.join(', ')}`;
  }

  async send(event: AlertEvent): Promise<boolean> {
    if (!this.enabled || !this.transporter) return false;
    const subject = `[${(event.severity ?? 'alerta').toUpperCase()}] ${event.title} — ${this.hostname}`;
    const text = formatLines(event, this.hostname);
    const html = `<html><body style="font-family:sans-serif">${text
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => `<p>${l}</p>`)
      .join('')}</body></html>`;
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: this.toEmails.join(', '),
        subject,
        text,
        html,
      });
      this.logger.info(`email sent to ${this.toEmails.join(', ')}`);
      return true;
    } catch (err) {
      this.logger.warn(`email delivery failed: ${String(err)}`);
      return false;
    }
  }

  sendTest(): Promise<boolean> {
    return this.send({
      event: 'alert_raised',
      severity: 'warning',
      title: 'Notificación de prueba (correo)',
      message: 'Si recibes este correo, el envío por SMTP está configurado correctamente.',
      tip: 'Revisa la bandeja de entrada (y spam).',
    });
  }
}

export class NotificationHub {
  constructor(private readonly channels: NotifierChannel[]) {}

  get enabled(): boolean {
    return this.channels.some((channel) => channel.enabled);
  }

  status(): Array<{ kind: string; configured: boolean; details: string }> {
    return this.channels.map((channel) => ({
      kind: channel.kind,
      configured: channel.enabled,
      details: channel.details(),
    }));
  }

  async send(event: AlertEvent): Promise<boolean> {
    const results = await Promise.all(
      this.channels
        .filter((channel) => channel.enabled)
        .map((channel) => channel.send(event)),
    );
    return results.some(Boolean);
  }

  async sendTest(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const channel of this.channels) {
      if (channel.enabled) {
        results[channel.kind] = await channel.sendTest();
      }
    }
    return results;
  }
}