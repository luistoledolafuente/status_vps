import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { settings } from './config/settings';
import { HistoryStore } from './history/history';
import { TrafficTracker } from './history/traffic';
import { CheckService } from './checks/checks';
import { WebhookNotifier, TelegramNotifier, EmailNotifier, NotificationHub } from './notifications/notifications';
import { AlertService } from './alerts/alerts';
import { MetricsCollector } from './metrics/collector';
import { ObservabilityState } from './observability/state';
import { AuthGuard } from './auth/guard';
import { HealthController } from './controllers/health.controller';
import { AppController, AuthController } from './controllers/app.controller';
import { MetricsController } from './controllers/metrics.controller';
import { ServicesController } from './controllers/services.controller';
import { AlertsController } from './controllers/alerts.controller';
import { Pm2Controller } from './controllers/pm2.controller';
import { MetricsGateway } from './gateways/metrics.gateway';
import { ResponseTimeMiddleware } from './middleware/response-time.middleware';

const logger = {
  info: (msg: string) => console.log(`[info] ${msg}`),
  warn: (msg: string) => console.warn(`[warn] ${msg}`),
  exception: (msg: string) => console.error(msg),
};

const hostname = settings.getHostname();

const history = new HistoryStore(
  settings.historyMaxPoints,
  settings.historySnapshotSeconds,
  settings.resolveHistoryDbPath(),
  settings.historyRetentionDays,
);

const traffic = new TrafficTracker(history.sqliteStore);

const checks = new CheckService(settings);

const notifier = new NotificationHub([
  new WebhookNotifier(settings.webhookUrl, settings.webhookTimeoutSeconds, hostname, logger),
  new TelegramNotifier(settings.telegramBotToken, settings.telegramChatId, hostname, logger),
  new EmailNotifier(
    settings.smtpHost,
    settings.smtpPort,
    settings.smtpUsername,
    settings.smtpPassword,
    settings.smtpFromEmail,
    settings.smtpToEmails,
    settings.smtpUseTls,
    hostname,
    logger,
  ),
]);

const alerts = new AlertService(settings, logger, notifier);
const observability = new ObservabilityState();
const collector = new MetricsCollector(settings, { warn: logger.warn }, history, traffic, checks);

@Module({
  controllers: [
    HealthController,
    AppController,
    AuthController,
    MetricsController,
    ServicesController,
    AlertsController,
    Pm2Controller,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: MetricsCollector, useValue: collector },
    { provide: HistoryStore, useValue: history },
    { provide: TrafficTracker, useValue: traffic },
    { provide: CheckService, useValue: checks },
    { provide: NotificationHub, useValue: notifier },
    { provide: AlertService, useValue: alerts },
    { provide: ObservabilityState, useValue: observability },
    MetricsGateway,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ResponseTimeMiddleware).forRoutes('*');
  }
}