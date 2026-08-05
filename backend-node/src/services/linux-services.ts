import { execFile } from 'child_process';
import * as fs from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const STATE_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  failed: 'Fallido',
  activating: 'Activando',
  deactivating: 'Desactivando',
  exited: 'Finalizado',
  reloading: 'Recargando',
  registered: 'Registrado',
};

const SVC_BINARIES: Record<string, string> = {
  nginx: 'nginx',
  ssh: 'sshd',
  cron: 'cron',
  redis: 'redis-server',
  postgres: 'postgres',
  mysql: 'mysqld',
  mongodb: 'mongod',
};

export interface ServiceInfo {
  name: string;
  description: string;
  load_state: string;
  active_state: string;
  sub_state: string;
  label: string;
}

export interface TrackedService {
  name: string;
  state: string;
  label: string;
  active_state: string | null;
  source: string | null;
  hint: string;
}

export interface ServicesResponse {
  available: boolean;
  manager: string | null;
  detail: string;
  services: ServiceInfo[];
  counts: Record<string, number>;
  tracked: TrackedService[];
}

function translate(state: string): string {
  return STATE_LABELS[state] ?? (state ? state.charAt(0).toUpperCase() + state.slice(1) : 'Desconocido');
}

async function safeRun(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(cmd, args, { timeout: 15000, encoding: 'utf-8', windowsHide: true });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    const error = err as { code?: number; stdout?: string; stderr?: string; message?: string };
    return { code: error.code ?? -1, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message ?? 'comando no disponible' };
  }
}

function parseSystemctlUnits(stdout: string): ServiceInfo[] {
  const services: ServiceInfo[] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s+/, 5);
    const unit = parts[0];
    if (!unit || !unit.endsWith('.service')) continue;
    const active = parts[2] ?? '';
    let description = (parts[4] ?? '').trim();
    if (description.endsWith('...')) {
      description = description.slice(0, -3).trim();
    }
    services.push({
      name: unit,
      description,
      load_state: parts[1] ?? '',
      active_state: active,
      sub_state: parts[3] ?? '',
      label: translate(active),
    });
  }
  return services;
}

function tally(services: ServiceInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const service of services) {
    const state = service.active_state;
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return counts;
}

function sysvServices(): ServiceInfo[] {
  const initD = '/etc/init.d';
  if (!fs.existsSync(initD)) return [];
  try {
    const names = fs.readdirSync(initD).sort();
    const services: ServiceInfo[] = [];
    for (const name of names) {
      const filePath = `${initD}/${name}`;
      if (name.startsWith('.') || name === 'README') continue;
      if (!fs.statSync(filePath).isFile()) continue;
      services.push({
        name,
        description: 'Script de inicio SysV',
        load_state: 'registered',
        active_state: 'unknown',
        sub_state: 'unknown',
        label: translate('registered'),
      });
    }
    return services;
  } catch {
    return [];
  }
}

function probeDocker(): Promise<{ state: string; label: string; source: string; hint: string }> {
  if (fs.existsSync('/var/run/docker.sock')) {
    return safeRun('docker', ['info', '--format', '{{.ServerVersion}}']).then((result) => {
      if (result.code === 0) {
        return { state: 'active', label: 'Activo', source: 'docker', hint: '' };
      }
      return { state: 'unreachable', label: 'Sin acceso', source: 'docker', hint: 'El motor de contenedores no es accesible desde este entorno.' };
    });
  }
  return safeRun('docker', ['info', '--format', '{{.ServerVersion}}']).then((result) => {
    if (result.code === 0) {
      return { state: 'active', label: 'Activo', source: 'docker', hint: '' };
    }
    if (result.code === -1) {
      return { state: 'not_found', label: 'No instalado', source: 'ninguno', hint: '' };
    }
    return { state: 'unreachable', label: 'Sin acceso', source: 'docker', hint: 'El motor de contenedores no es accesible desde este entorno.' };
  });
}

function probeByProcess(name: string): Promise<{ state: string; label: string; source: string; hint: string }> {
  const binary = SVC_BINARIES[name];
  if (!binary) {
    return Promise.resolve({ state: 'not_found', label: 'No instalado', source: 'ninguno', hint: '' });
  }
  return safeRun('pgrep', ['-x', binary]).then((result) => {
    if (result.code === 0) {
      return { state: 'active', label: 'Activo', source: 'proceso', hint: '' };
    }
    return { state: 'inactive', label: 'Inactivo', source: 'proceso', hint: '' };
  });
}

async function buildTracked(services: ServiceInfo[], names: string[]): Promise<TrackedService[]> {
  const byName: Record<string, ServiceInfo> = {};
  for (const service of services) {
    byName[service.name] = service;
  }
  const tracked: TrackedService[] = [];
  for (const name of names) {
    const service = byName[`${name}.service`];
    if (service) {
      tracked.push({
        name,
        state: service.active_state,
        label: service.label,
        active_state: service.active_state,
        source: 'systemd',
        hint: '',
      });
      continue;
    }
    if (name === 'docker') {
      const probe = await probeDocker();
      tracked.push({
        name,
        state: probe.state,
        label: probe.label,
        active_state: null,
        source: probe.source,
        hint: probe.hint,
      });
      continue;
    }
    const probe = await probeByProcess(name);
    tracked.push({
      name,
      state: probe.state,
      label: probe.label,
      active_state: null,
      source: probe.source,
      hint: '',
    });
  }
  return tracked;
}

export async function getServices(): Promise<ServicesResponse> {
  const hasSystemctl = fs.existsSync('/usr/bin/systemctl') || fs.existsSync('/bin/systemctl');
  if (hasSystemctl) {
    const result = await safeRun('systemctl', ['list-units', '--type=service', '--all', '--no-pager', '--no-legend']);
    if (result.code === 0) {
      const services = parseSystemctlUnits(result.stdout);
      if (services.length > 0) {
        return { available: true, manager: 'systemd', detail: '', services, counts: tally(services), tracked: [] };
      }
      if (process.platform === 'linux') {
        try {
          const comm = fs.readFileSync('/proc/1/comm', 'utf-8').trim();
          if (comm === 'systemd') {
            return { available: true, manager: 'systemd', detail: 'systemctl responded but listed no services.', services: [], counts: {}, tracked: [] };
          }
        } catch {
          // fall through to SysV
        }
      }
    }
  }

  const sysv = sysvServices();
  if (sysv.length > 0) {
    return {
      available: true,
      manager: 'sysv',
      detail: 'Gestor systemd no arrancado en este entorno; se listan scripts de /etc/init.d.',
      services: sysv,
      counts: tally(sysv),
      tracked: [],
    };
  }

  return {
    available: false,
    manager: null,
    detail:
      'No se descubrió un gestor de servicios accesible en este entorno (por ejemplo, WSL sin systemd arrancado). Consulta el README.',
    services: [],
    counts: {},
    tracked: [],
  };
}

export async function getServicesWithTracking(trackedNames: string[]): Promise<ServicesResponse> {
  const response = await getServices();
  response.tracked = await buildTracked(response.services, trackedNames);
  return response;
}