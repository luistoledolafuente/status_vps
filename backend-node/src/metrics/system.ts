import * as os from 'os';
import si = require('systeminformation');

const SKIPPED_FSTYPES = new Set(['9p', 'drvfs', 'fuse.sshfs', 'iso9660', 'squashfs']);

export interface NetState {
  bytesSent: number;
  bytesRecv: number;
  now: number;
}

export function getPlatform(): string {
  return `${os.platform()} ${os.release()} ${os.arch()}`;
}

export async function getCpuInfo(): Promise<{ percent: number; cores: number; logical_cores: number }> {
  let percent = 0;
  try {
    const load = await si.currentLoad();
    percent = Math.round(load.currentLoad * 10) / 10;
  } catch {
    percent = 0;
  }
  let cores = 0;
  let logical = 0;
  try {
    const cpu = await si.cpu();
    cores = cpu.physicalCores ?? 0;
    logical = cpu.cores ?? 0;
  } catch {
    cores = 0;
    logical = 0;
  }
  return { percent, cores, logical_cores: logical };
}

export async function getMemoryInfo(): Promise<{
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  percent: number;
}> {
  try {
    const mem = await si.mem();
    const total = mem.total;
    const available = mem.available;
    const used = total - available;
    const percent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
    return {
      total_bytes: total,
      used_bytes: used,
      available_bytes: available,
      percent,
    };
  } catch {
    return { total_bytes: 0, used_bytes: 0, available_bytes: 0, percent: 0 };
  }
}

export async function getDisks(): Promise<
  Array<{
    partition: string;
    mountpoint: string;
    fstype: string;
    is_root: boolean;
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    percent: number;
  }>
> {
  const disks: Array<{
    partition: string;
    mountpoint: string;
    fstype: string;
    is_root: boolean;
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    percent: number;
  }> = [];
  try {
    const sizes = await si.fsSize();
    for (const fs of sizes) {
      if (SKIPPED_FSTYPES.has(fs.type)) continue;
      const mountpoint = fs.mount;
      if (!mountpoint) continue;
      const total = fs.size;
      const free = fs.available;
      const used = fs.used;
      const percent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
      disks.push({
        partition: fs.fs ?? 'desconocido',
        mountpoint,
        fstype: fs.type || 'desconocido',
        is_root: mountpoint === '/',
        total_bytes: total,
        used_bytes: used,
        free_bytes: free,
        percent,
      });
    }
  } catch {
    // leave empty; fallback below
  }
  if (disks.length === 0) {
    try {
      const info = await si.fsSize('/');
      if (info.length > 0) {
        const fs = info[0];
        disks.push({
          partition: '/',
          mountpoint: '/',
          fstype: 'local',
          is_root: true,
          total_bytes: fs.size,
          used_bytes: fs.used,
          free_bytes: fs.available,
          percent: fs.size > 0 ? Math.round((fs.used / fs.size) * 1000) / 10 : 0,
        });
      }
    } catch {
      // no fallback available
    }
  }
  disks.sort((a, b) => {
    if (a.is_root !== b.is_root) return a.is_root ? -1 : 1;
    return b.total_bytes - a.total_bytes;
  });
  return disks;
}

export function getLoadAvg(): { one_min: number; five_min: number; fifteen_min: number } | null {
  if (process.platform === 'win32') return null;
  try {
    const [one, five, fifteen] = os.loadavg();
    return { one_min: one, five_min: five, fifteen_min: fifteen };
  } catch {
    return null;
  }
}

export function humanizeUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const rem = seconds % 86400;
  const hours = Math.floor(rem / 3600);
  const rem2 = rem % 3600;
  const minutes = Math.floor(rem2 / 60);
  const secs = rem2 % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  if (parts.length === 0) parts.push(`${secs} segundos`);
  return parts.join(', ');
}

export function getUptime(): { uptime_seconds: number; uptime_human: string; boot_time_iso: string } {
  const seconds = Math.max(0, Math.floor(os.uptime()));
  const boot = new Date(Date.now() - seconds * 1000);
  return {
    uptime_seconds: seconds,
    uptime_human: humanizeUptime(seconds),
    boot_time_iso: boot.toISOString(),
  };
}

let _prevNet: NetState | null = null;

export async function getNetworkInfo(): Promise<{
  bytes_sent: number;
  bytes_recv: number;
  sent_bps: number | null;
  recv_bps: number | null;
  delta_sent: number;
  delta_recv: number;
  state: NetState;
} | null> {
  try {
    const stats = await si.networkStats();
    let bytesSent = 0;
    let bytesRecv = 0;
    for (const stat of stats) {
      bytesSent += stat.tx_bytes ?? 0;
      bytesRecv += stat.rx_bytes ?? 0;
    }
    const now = Date.now() / 1000;
    let sentBps: number | null = null;
    let recvBps: number | null = null;
    let deltaSent = 0;
    let deltaRecv = 0;
    if (_prevNet) {
      const elapsed = now - _prevNet.now;
      if (elapsed > 0) {
        deltaRecv = Math.max(0, bytesRecv - _prevNet.bytesRecv);
        deltaSent = Math.max(0, bytesSent - _prevNet.bytesSent);
        sentBps = Math.round((deltaSent / elapsed) * 10) / 10;
        recvBps = Math.round((deltaRecv / elapsed) * 10) / 10;
      }
    }
    const state: NetState = { bytesSent, bytesRecv, now };
    _prevNet = state;
    return {
      bytes_sent: bytesSent,
      bytes_recv: bytesRecv,
      sent_bps: sentBps,
      recv_bps: recvBps,
      delta_sent: deltaSent,
      delta_recv: deltaRecv,
      state,
    };
  } catch {
    return null;
  }
}

export interface ProcessInfo {
  pid: number;
  name: string;
  username: string;
  cpu_percent: number;
  memory_percent: number;
  memory_rss_bytes: number;
  status: string;
}

export async function getProcesses(limit: number, sortBy: string): Promise<ProcessInfo[]> {
  const processes: ProcessInfo[] = [];
  try {
    const data = await si.processes();
    for (const proc of data.list) {
      processes.push({
        pid: proc.pid,
        name: proc.name || '?',
        username: proc.user || '?',
        cpu_percent: Math.round((proc.cpu ?? 0) * 10) / 10,
        memory_percent: Math.round((proc.mem ?? 0) * 10) / 10,
        memory_rss_bytes: proc.memRss ?? 0,
        status: proc.state ?? 'running',
      });
    }
  } catch {
    return [];
  }
  if (sortBy === 'name') {
    processes.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const key = sortBy === 'cpu' ? 'cpu_percent' : 'memory_percent';
    processes.sort((a, b) => b[key] - a[key]);
  }
  return processes.slice(0, limit);
}
