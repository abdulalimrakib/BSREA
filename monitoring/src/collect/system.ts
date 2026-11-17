import fs from "node:fs";
import os from "node:os";
import { config } from "../config.ts";
import { db } from "../db.ts";
import { hourOf, minuteOf, nowSec } from "../time.ts";

/*--Server health once a minute: CPU, load, memory, swap, disk and network. Read from /proc (Linux).--*/

export const readMemory = () => {
  try {
    const info: Record<string, number> = {};
    for (const line of fs.readFileSync("/proc/meminfo", "utf8").split("\n")) {
      const [name, value] = line.split(":");
      if (value) info[name] = Number.parseInt(value, 10) * 1024;
    }
    return { total: info.MemTotal, available: info.MemAvailable, swapTotal: info.SwapTotal, swapUsed: info.SwapTotal - info.SwapFree };
  } catch {
    return { total: os.totalmem(), available: os.freemem(), swapTotal: 0, swapUsed: 0 };
  }
};

/*--Disk use as "df" shows it: space reserved for the system (about 5%) is left out of the total,
  so "100% used" is the point where the apps can no longer write--*/
export const readDisk = (folder = config.DISK_PATH) => {
  const s = fs.statfsSync(folder);
  const used = (s.blocks - s.bfree) * s.bsize;
  const free = s.bavail * s.bsize;
  return { total: used + free, free, used };
};

/*--CPU busy % since the previous call (/proc/stat counters)--*/
let lastCpu: { idle: number; total: number } | undefined;
const readCpu = () => {
  try {
    const [, ...fields] = fs.readFileSync("/proc/stat", "utf8").split("\n")[0].trim().split(/\s+/);
    const values = fields.map(Number);
    const idle = values[3] + (values[4] || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const previous = lastCpu;
    lastCpu = { idle, total };
    if (!previous || total === previous.total) return null;
    return Math.max(0, Math.min(100, 100 * (1 - (idle - previous.idle) / (total - previous.total))));
  } catch {
    return null;
  }
};

/*--Bytes received and sent since the previous call, all network cards except loopback--*/
let lastNet: { rx: number; tx: number } | undefined;
const readNet = () => {
  try {
    let rx = 0;
    let tx = 0;
    for (const line of fs.readFileSync("/proc/net/dev", "utf8").split("\n").slice(2)) {
      const [name, data] = line.split(":");
      if (!data || name.trim() === "lo") continue;
      const v = data.trim().split(/\s+/).map(Number);
      rx += v[0];
      tx += v[8];
    }
    const previous = lastNet;
    lastNet = { rx, tx };
    if (!previous || rx < previous.rx || tx < previous.tx) return { rx: 0, tx: 0 };
    return { rx: rx - previous.rx, tx: tx - previous.tx };
  } catch {
    return { rx: 0, tx: 0 };
  }
};

export type Sample = {
  cpu: number; load: number; cpus: number; memTotal: number; memUsed: number; swapTotal: number; swapUsed: number;
  diskTotal: number; diskUsed: number; rx: number; tx: number;
};

export const takeSample = (): Sample | null => {
  const cpu = readCpu();
  const net = readNet();
  if (cpu === null) return null; // the first call only primes the counters
  const memory = readMemory();
  const disk = readDisk();
  return {
    cpu, load: os.loadavg()[0], cpus: os.availableParallelism(), memTotal: memory.total, memUsed: memory.total - memory.available,
    swapTotal: memory.swapTotal, swapUsed: memory.swapUsed, diskTotal: disk.total, diskUsed: disk.total - disk.free, rx: net.rx, tx: net.tx,
  };
};

/*--Save one sample: a minute row, and added to the hour's row--*/
export const saveSample = (s: Sample, at = nowSec()) => {
  const upsert = (table: string, ts: number) =>
    db.prepare(`
      INSERT INTO ${table} (ts, n, cpu_sum, cpu_max, load_sum, load_max, cpus, mem_total, mem_used_sum, mem_used_max, swap_total, swap_used_max, disk_total, disk_used, net_rx, net_tx)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (ts) DO UPDATE SET n = n + 1, cpu_sum = cpu_sum + excluded.cpu_sum, cpu_max = MAX(cpu_max, excluded.cpu_max),
        load_sum = load_sum + excluded.load_sum, load_max = MAX(load_max, excluded.load_max), cpus = excluded.cpus,
        mem_total = excluded.mem_total, mem_used_sum = mem_used_sum + excluded.mem_used_sum, mem_used_max = MAX(mem_used_max, excluded.mem_used_max),
        swap_total = excluded.swap_total, swap_used_max = MAX(swap_used_max, excluded.swap_used_max),
        disk_total = excluded.disk_total, disk_used = excluded.disk_used, net_rx = net_rx + excluded.net_rx, net_tx = net_tx + excluded.net_tx
    `).run(ts, s.cpu, s.cpu, s.load, s.load, s.cpus, s.memTotal, s.memUsed, s.memUsed, s.swapTotal, s.swapUsed, s.diskTotal, s.diskUsed, s.rx, s.tx);
  const minute = minuteOf(at);
  // A minute is sampled once; if it was already saved, keep the first
  if (db.prepare(`SELECT 1 FROM system_min WHERE ts = ?`).get(minute)) return;
  upsert("system_min", minute);
  upsert("system_hour", hourOf(at));
};
