// Integración con PM2: lista de procesos, logs y acciones (reiniciar,
// parar, arrancar) invocando el CLI de pm2. El backend debe correr con el
// mismo usuario que gestiona los procesos (en producción, el usuario del VPS).

import { execFile } from 'child_process';
import * as fs from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const CACHE_MS = 5000;
const ACTIONS = new Set(['restart', 'stop', 'start', 'reload']);

let cache: { at: number; data: Pm2Response } | null = null;
let inflight: Promise<Pm2Response> | null = null;

export type Pm2Action = 'restart' | 'stop' | 'start' | 'reload';

export interface Pm2Process {
  id: number | null;
  name: string;
  namespace: string | null;
  status: string;
  restarts: number;
  unstable_restarts: number;
  uptime_seconds: number | null;
  cpu: number;
  memory: number;
  pid: number | null;
  exec_mode: string;
  script: string | null;
  cwd: string | null;
  node_version: string | null;
  created_at: number | null;
  out_log_path: string | null;
  err_log_path: string | null;
}

export interface Pm2Response {
  available: boolean;
  manager: string | null;
  detail: string;
  processes: Pm2Process[];
}

export interface Pm2LogsResponse {
  available: boolean;
  detail: string;
  lines: string[];
}

async function safeRun(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(cmd, args, { timeout: 15000, encoding: 'utf-8', windowsHide: true });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    const error = err as { code?: string | number; stdout?: string; stderr?: string; message?: string };
    if (error.code === 'ENOENT') return { code: -1, stdout: '', stderr: 'pm2 no está instalado' };
    return { code: typeof error.code === 'number' ? error.code : -1, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message ?? 'comando no disponible' };
  }
}

function normalize(item: Record<string, unknown>): Pm2Process | null {
  if (!item || typeof item !== 'object') return null;
  const env = (item.pm2_env ?? {}) as Record<string, unknown>;
  const monit = (item.monit ?? {}) as Record<string, unknown>;
  const start = typeof env.pm_uptime === 'number' ? env.pm_uptime : null;
  return {
    id: typeof item.pm_id === 'number' ? item.pm_id : null,
    name: String(item.name ?? env.name ?? 'desconocido'),
    namespace: typeof env.namespace === 'string' ? env.namespace : null,
    status: String(env.status ?? 'unknown'),
    restarts: typeof env.restart_time === 'number' ? env.restart_time : 0,
    unstable_restarts: typeof env.unstable_restarts === 'number' ? env.unstable_restarts : 0,
    uptime_seconds: start ? Math.max(0, Math.floor((Date.now() - start) / 1000)) : null,
    cpu: typeof monit.cpu === 'number' ? monit.cpu : 0,
    memory: typeof monit.memory === 'number' ? monit.memory : 0,
    pid: typeof item.pid === 'number' ? item.pid : null,
    exec_mode: typeof env.exec_mode === 'string' ? env.exec_mode : 'fork',
    script: typeof env.pm_exec_path === 'string' ? env.pm_exec_path : null,
    cwd: typeof env.pm_cwd === 'string' ? env.pm_cwd : null,
    node_version: typeof env.node_version === 'string' ? env.node_version : null,
    created_at: typeof env.created_at === 'number' ? env.created_at : null,
    out_log_path: typeof env.pm_out_log_path === 'string' && env.pm_out_log_path ? env.pm_out_log_path : null,
    err_log_path: typeof env.pm_err_log_path === 'string' && env.pm_err_log_path ? env.pm_err_log_path : null,
  };
}

async function fetchProcesses(): Promise<Pm2Response> {
  const result = await safeRun('pm2', ['jlist']);
  if (result.code === -1) {
    return { available: false, manager: null, detail: 'PM2 no está instalado en este servidor.', processes: [] };
  }
  if (result.code !== 0) {
    return { available: false, manager: null, detail: result.stderr.trim() || 'El daemon de PM2 no responde.', processes: [] };
  }
  let raw: unknown[] = [];
  try {
    raw = JSON.parse(result.stdout) as unknown[];
  } catch {
    return { available: false, manager: null, detail: 'PM2 devolvió datos que no se pudieron interpretar.', processes: [] };
  }
  const processes = raw
    .map((item) => normalize(item as Record<string, unknown>))
    .filter((process): process is Pm2Process => process !== null)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  return { available: true, manager: 'pm2', detail: '', processes };
}

export function getPm2Processes(): Promise<Pm2Response> {
  if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.data);
  if (!inflight) {
    inflight = fetchProcesses()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidatePm2Cache(): void {
  cache = null;
}

async function readTail(file: string, count: number): Promise<string[]> {
  const result = await safeRun('tail', ['-n', String(count), file]);
  if (result.code === 0 && result.stdout.trim()) {
    return result.stdout.split('\n');
  }
  try {
    const stat = fs.statSync(file);
    if (stat.size > 50 * 1024 * 1024) return [];
    const text = fs.readFileSync(file, 'utf-8');
    return text.split('\n').filter((line) => line.trim() !== '');
  } catch {
    return [];
  }
}

export async function getPm2Logs(target: string | number, lines = 200): Promise<Pm2LogsResponse> {
  const count = Math.min(Math.max(1, Math.floor(lines)), 2000);
  const list = await getPm2Processes();
  if (!list.available) {
    return { available: false, detail: list.detail, lines: [] };
  }
  const wanted = String(target);
  const process = list.processes.find((item) => String(item.id) === wanted || item.name === wanted);
  if (!process) {
    return { available: false, detail: `No existe el proceso PM2 «${wanted}».`, lines: [] };
  }
  const files = [process.out_log_path, process.err_log_path].filter((file): file is string => Boolean(file));
  if (files.length === 0) {
    return { available: false, detail: 'El proyecto no tiene archivos de log configurados.', lines: [] };
  }
  const chunks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    chunks.push(...(await readTail(file, count)));
  }
  return { available: true, detail: '', lines: chunks.slice(-count) };
}

export function isPm2Action(action: string): action is Pm2Action {
  return ACTIONS.has(action);
}

export async function runPm2Action(target: string | number, action: Pm2Action): Promise<{ ok: boolean; detail: string }> {
  const result = await safeRun('pm2', [action, String(target)]);
  if (result.code !== 0) {
    return { ok: false, detail: result.stderr.trim() || `PM2 no pudo ejecutar «${action}».` };
  }
  invalidatePm2Cache();
  return { ok: true, detail: result.stdout.trim() || `PM2 ejecutó «${action}» correctamente.` };
}
