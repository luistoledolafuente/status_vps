import 'dotenv/config';
import * as path from 'path';
import * as os from 'os';

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function number(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export interface CheckEntry {
  name: string;
  target: string;
}

function parseChecks(value: string | undefined): CheckEntry[] {
  const entries: CheckEntry[] = [];
  for (const raw of list(value)) {
    const [name, target] = raw.split('=', 2);
    if (!name || !target) continue;
    if (/^(https?|tcp):\/\//.test(target)) {
      entries.push({ name: name.trim(), target: target.trim() });
    }
  }
  return entries;
}

export class Settings {
  readonly appName: string = 'System Status API';
  readonly appVersion: string = '2.0.0';
  readonly environment: string;
  readonly port: number;
  readonly apiPrefix: string = '/api';

  readonly corsOrigins: string[];

  readonly authEnabled: boolean;
  readonly adminUsername: string;
  readonly adminPassword: string;
  readonly viewerUsername: string;
  readonly viewerPassword: string;
  readonly jwtSecret: string;
  readonly jwtAlgorithm: string;
  readonly tokenExpireMinutes: number;

  readonly wsIntervalSeconds: number;
  readonly historySnapshotSeconds: number;
  readonly historyMaxPoints: number;
  readonly maxProcesses: number;
  readonly historyDbPath: string;
  readonly historyRetentionDays: number;

  readonly alertCpuWarning: number;
  readonly alertCpuCritical: number;
  readonly alertMemoryWarning: number;
  readonly alertMemoryCritical: number;
  readonly alertDiskWarning: number;
  readonly alertDiskCritical: number;
  readonly alertSustainSeconds: number;

  readonly webhookUrl: string;
  readonly webhookTimeoutSeconds: number;

  readonly telegramBotToken: string;
  readonly telegramChatId: string;

  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpUsername: string;
  readonly smtpPassword: string;
  readonly smtpFromEmail: string;
  readonly smtpToEmails: string[];
  readonly smtpUseTls: boolean;

  readonly trafficQuotaGb: number;
  readonly trafficWarningPercent: number;
  readonly trafficCriticalPercent: number;

  readonly checks: CheckEntry[];
  readonly checksIntervalSeconds: number;

  readonly anomalyCritical: number;
  readonly anomalyWindowMinutes: number;

  readonly trackedServices: string[];

  readonly rateLimitEnabled: boolean;
  readonly rateLimitPerMinute: number;

  readonly logLevel: string;

  constructor() {
    const env = process.env;
    this.environment = env.SYSSTATUS_ENV ?? 'development';
    this.port = number(env.SYSSTATUS_PORT, 8000);
    this.corsOrigins =
      list(env.SYSSTATUS_CORS_ORIGINS).length > 0
        ? list(env.SYSSTATUS_CORS_ORIGINS)
        : ['http://localhost:5173', 'http://127.0.0.1:5173'];

    this.authEnabled = bool(env.SYSSTATUS_AUTH_ENABLED, false);
    this.adminUsername = env.SYSSTATUS_ADMIN_USERNAME ?? 'admin';
    this.adminPassword = env.SYSSTATUS_ADMIN_PASSWORD ?? 'admin123';
    this.viewerUsername = env.SYSSTATUS_VIEWER_USERNAME ?? 'viewer';
    this.viewerPassword = env.SYSSTATUS_VIEWER_PASSWORD ?? 'viewer123';
    this.jwtSecret = env.SYSSTATUS_JWT_SECRET ?? 'cambia-este-secreto-en-produccion';
    this.jwtAlgorithm = env.SYSSTATUS_JWT_ALGORITHM ?? 'HS256';
    this.tokenExpireMinutes = number(env.SYSSTATUS_TOKEN_EXPIRE_MINUTES, 60);

    this.wsIntervalSeconds = number(env.SYSSTATUS_WS_INTERVAL_SECONDS, 2);
    this.historySnapshotSeconds = number(env.SYSSTATUS_HISTORY_SNAPSHOT_SECONDS, 15);
    this.historyMaxPoints = number(env.SYSSTATUS_HISTORY_MAX_POINTS, 3600);
    this.maxProcesses = number(env.SYSSTATUS_MAX_PROCESSES, 25);
    this.historyDbPath = env.SYSSTATUS_HISTORY_DB_PATH ?? 'data/history.db';
    this.historyRetentionDays = number(env.SYSSTATUS_HISTORY_RETENTION_DAYS, 30);

    this.alertCpuWarning = number(env.SYSSTATUS_ALERT_CPU_WARNING, 80);
    this.alertCpuCritical = number(env.SYSSTATUS_ALERT_CPU_CRITICAL, 90);
    this.alertMemoryWarning = number(env.SYSSTATUS_ALERT_MEMORY_WARNING, 80);
    this.alertMemoryCritical = number(env.SYSSTATUS_ALERT_MEMORY_CRITICAL, 90);
    this.alertDiskWarning = number(env.SYSSTATUS_ALERT_DISK_WARNING, 80);
    this.alertDiskCritical = number(env.SYSSTATUS_ALERT_DISK_CRITICAL, 90);
    this.alertSustainSeconds = number(env.SYSSTATUS_ALERT_SUSTAIN_SECONDS, 30);

    this.webhookUrl = env.SYSSTATUS_WEBHOOK_URL ?? '';
    this.webhookTimeoutSeconds = number(env.SYSSTATUS_WEBHOOK_TIMEOUT_SECONDS, 10);

    this.telegramBotToken = env.SYSSTATUS_TELEGRAM_BOT_TOKEN ?? '';
    this.telegramChatId = env.SYSSTATUS_TELEGRAM_CHAT_ID ?? '';

    this.smtpHost = env.SYSSTATUS_SMTP_HOST ?? '';
    this.smtpPort = number(env.SYSSTATUS_SMTP_PORT, 587);
    this.smtpUsername = env.SYSSTATUS_SMTP_USERNAME ?? '';
    this.smtpPassword = env.SYSSTATUS_SMTP_PASSWORD ?? '';
    this.smtpFromEmail = env.SYSSTATUS_SMTP_FROM_EMAIL ?? '';
    this.smtpToEmails = list(env.SYSSTATUS_SMTP_TO_EMAILS);
    this.smtpUseTls = bool(env.SYSSTATUS_SMTP_USE_TLS, true);

    this.trafficQuotaGb = number(env.SYSSTATUS_TRAFFIC_QUOTA_GB, 0);
    this.trafficWarningPercent = number(env.SYSSTATUS_TRAFFIC_WARNING_PERCENT, 80);
    this.trafficCriticalPercent = number(env.SYSSTATUS_TRAFFIC_CRITICAL_PERCENT, 95);

    this.checks = parseChecks(env.SYSSTATUS_CHECKS);
    this.checksIntervalSeconds = number(env.SYSSTATUS_CHECKS_INTERVAL_SECONDS, 30);

    this.anomalyCritical = number(env.SYSSTATUS_ANOMALY_CRITICAL, 80);
    this.anomalyWindowMinutes = number(env.SYSSTATUS_ANOMALY_WINDOW_MINUTES, 120);

    this.trackedServices = list(env.SYSSTATUS_TRACKED_SERVICES);
    if (this.trackedServices.length === 0) {
      this.trackedServices = ['nginx', 'postgresql', 'redis', 'ssh', 'cron'];
    }

    this.rateLimitEnabled = bool(env.SYSSTATUS_RATE_LIMIT_ENABLED, false);
    this.rateLimitPerMinute = number(env.SYSSTATUS_RATE_LIMIT_PER_MINUTE, 120);

    this.logLevel = (env.SYSSTATUS_LOG_LEVEL ?? 'info').toLowerCase();
  }

  resolveHistoryDbPath(): string {
    if (path.isAbsolute(this.historyDbPath)) return this.historyDbPath;
    return path.resolve(process.cwd(), this.historyDbPath);
  }

  getHostname(): string {
    try {
      return os.hostname();
    } catch {
      return 'unknown';
    }
  }
}

export const settings = new Settings();