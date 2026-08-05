import type { Settings } from '../config/settings';
import { NotificationHub } from '../notifications/notifications';

interface Alert {
  id: string;
  key: string;
  severity: string;
  title: string;
  message: string;
  tip: string;
  state: 'active' | 'resolved';
  metric: string | null;
  value: number | null;
  threshold: number | null;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
}

interface ThresholdState {
  since: number;
  severity: string;
}

export class AlertService {
  private readonly active: Record<string, Alert> = {};
  private readonly recent: Alert[] = [];
  private readonly pending: Record<string, ThresholdState> = {};
  private seq = 0;

  constructor(
    private readonly settings: Settings,
    private readonly logger: { warn(...args: unknown[]): void; info(...args: unknown[]): void; exception(...args: unknown[]): void },
    private readonly notifier?: { enabled: boolean; send(event: unknown): Promise<boolean> | boolean },
  ) {}

  thresholds(): Record<string, number> {
    const s = this.settings;
    return {
      cpu_warning: s.alertCpuWarning,
      cpu_critical: s.alertCpuCritical,
      memory_warning: s.alertMemoryWarning,
      memory_critical: s.alertMemoryCritical,
      disk_warning: s.alertDiskWarning,
      disk_critical: s.alertDiskCritical,
      traffic_warning: s.trafficWarningPercent,
      traffic_critical: s.trafficCriticalPercent,
      anomaly_critical: s.anomalyCritical,
    };
  }

  async notify(alert: Alert): Promise<void> {
    if (!this.notifier || !this.notifier.enabled) return;
    try {
      await this.notifier.send({
        event: alert.state === 'active' ? 'alert_raised' : 'alert_resolved',
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        tip: alert.tip,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
      });
    } catch {
      this.logger.exception?.('notification failed');
    }
  }

  upsert(
    key: string,
    severity: string,
    title: string,
    message: string,
    tip: string,
    metric: string | null,
    value: number | null,
    threshold: number | null,
  ): void {
    const now = new Date().toISOString();
    const alert = this.active[key];
    if (alert) {
      alert.last_seen = now;
      if (severity === 'critical' && alert.severity !== 'critical') {
        alert.severity = severity;
        alert.message = message;
        alert.value = value;
        alert.threshold = threshold;
        void this.notify(alert);
      }
      return;
    }
    this.seq += 1;
    const next: Alert = {
      id: `al-${this.seq}`,
      key,
      severity,
      title,
      message,
      tip,
      state: 'active',
      metric,
      value,
      threshold,
      first_seen: now,
      last_seen: now,
      resolved_at: null,
    };
    this.active[key] = next;
    this.logger.warn?.('alert raised', { event: key, severity });
    void this.notify(next);
  }

  private resolve(key: string): void {
    const alert = this.active[key];
    if (!alert) return;
    delete this.active[key];
    alert.state = 'resolved';
    alert.resolved_at = new Date().toISOString();
    this.recent.unshift(alert);
    if (this.recent.length > AlertService.MAX_RESOLVED) {
      this.recent.length = AlertService.MAX_RESOLVED;
    }
    this.logger.info?.('alert resolved', { event: key });
    void this.notify(alert);
  }

  checkThreshold(
    key: string,
    label: string,
    value: number,
    warning: number,
    critical: number,
    tip: string,
    sustain = true,
  ): void {
    const metric = key.split('_')[0];
    if (value >= warning) {
      const severity = value >= critical ? 'critical' : 'warning';
      const pending = this.pending[key];
      if (!pending) {
        this.pending[key] = { since: Date.now() / 1000, severity };
      } else if (severity === 'critical' && pending.severity !== 'critical') {
        this.pending[key] = { since: Date.now() / 1000, severity: 'critical' };
      } else {
        pending.severity = severity;
      }
      const sustainedSeconds = Date.now() / 1000 - this.pending[key].since;
      const sustained = !sustain || sustainedSeconds >= this.settings.alertSustainSeconds;
      if (sustained && !this.active[key]) {
        const isCritical = severity === 'critical';
        this.upsert(
          key,
          severity,
          `${label} ${isCritical ? 'crítico' : 'alto'}`,
          isCritical
            ? `El uso de ${label.toLowerCase()} alcanzó ${Math.round(value)}% (umbral crítico ${Math.round(critical)}%).`
            : `El uso de ${label.toLowerCase()} está en ${Math.round(value)}% (umbral de aviso ${Math.round(warning)}%).`,
          tip,
          metric,
          value,
          isCritical ? critical : warning,
        );
      }
      return;
    }
    delete this.pending[key];
    this.resolve(key);
  }

  async evaluate(
    summary: Record<string, unknown> | null,
    services: { tracked: Array<{ name: string; state: string }> } | null,
    checks: Array<{ name: string; state: string; target: string; error?: string | null }> | null,
  ): Promise<unknown[]> {
    if (summary) {
      const cpu = (summary['cpu'] ?? {}) as Record<string, unknown>;
      const memory = (summary['memory'] ?? {}) as Record<string, unknown>;
      const disks = (summary['disks'] ?? []) as Array<{ percent?: number; mountpoint?: string }>;
      const disk = disks.length
        ? disks.reduce((max, d) => ((d.percent ?? 0) > (max.percent ?? 0) ? d : max), disks[0])
        : null;
      const diskPercent = disk?.percent ?? 0;

      this.checkThreshold(
        'cpu_high', 'CPU', Number(cpu['percent'] ?? 0),
        this.settings.alertCpuWarning, this.settings.alertCpuCritical,
        'Revisa la vista de Procesos para identificar qué proceso consume más CPU.',
      );
      this.checkThreshold(
        'memory_high', 'Memoria', Number(memory['percent'] ?? 0),
        this.settings.alertMemoryWarning, this.settings.alertMemoryCritical,
        'Considera liberar memoria o detener aplicaciones pesadas.',
      );
      const mountpoint = disk?.mountpoint ?? '/';
      this.checkThreshold(
        'disk_full', 'Disco', diskPercent,
        this.settings.alertDiskWarning, this.settings.alertDiskCritical,
        `Libera espacio en la partición ${mountpoint} (archivos temporales, logs, paquetes sin usar).`,
      );

      const trafficResult = (summary['traffic'] ?? null) as { percent?: number | null } | null;
      if (trafficResult?.percent != null) {
        this.checkThreshold(
          'traffic_quota', 'Tráfico mensual', trafficResult.percent,
          this.settings.trafficWarningPercent, this.settings.trafficCriticalPercent,
          'Consulta el uso por servicio o revisa backups y transferencias programadas.',
        );
      }

      const anomaly = (summary['anomaly'] ?? null) as { score?: number } | null;
      if (anomaly) {
        this.checkThreshold(
          'anomaly_behavior', 'Comportamiento del sistema', Number(anomaly.score ?? 0),
          this.settings.anomalyCritical, this.settings.anomalyCritical,
          'Revisa los procesos y el tráfico reciente: algo se desvía del comportamiento habitual.',
        );
      }
    }

    if (services) {
      for (const item of services.tracked) {
        const key = `service_down_${item.name}`;
        if (item.state === 'failed') {
          this.upsert(
            key, 'critical', `Servicio ${item.name} caído`,
            `El servicio ${item.name} está en estado fallido y no responde.`,
            `Revisa los logs con: journalctl -u ${item.name}.service`,
            'service', null, null,
          );
        } else {
          this.resolve(key);
        }
      }
    }

    if (checks) {
      for (const check of checks) {
        const key = `check_down_${check.name}`;
        if (check.state === 'down') {
          this.upsert(
            key, 'critical', `Verificación ${check.name} sin respuesta`,
            `El objetivo ${check.target} no responde (${check.error ?? 'error de conexión'}).`,
            'Comprueba el proceso, el puerto y el firewall del objetivo.',
            'check', null, null,
          );
        } else {
          this.resolve(key);
        }
      }
    }
    return Object.values(this.active);
  }

  static readonly MAX_RESOLVED = 20;

  snapshot(): Record<string, unknown> {
    const active = Object.values(this.active).sort((a, b) => {
      return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
    });
    return {
      active_count: active.length,
      thresholds: this.thresholds(),
      alerts: [...active, ...this.recent],
    };
  }
}