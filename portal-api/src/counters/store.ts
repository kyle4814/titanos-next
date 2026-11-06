// Counter store: increment, read, window. Counts live in hourly buckets so a window is a bucket sum.
// Adapters: MemoryCounterStore (tests, local) and D1CounterStore (migration 0002, NOT applied).
// No endpoint reads this yet; the /api/site-event beacon is untouched (event name only, no domain).
import type { D1Like } from "../env.ts";

export const HOUR_MS = 3_600_000;
// Event names the site beacon sends today (components/GuestScan.tsx data-analytics).
export const EVENT_SCAN = "scan-instant-run";
export const EVENT_GET_FIXED = "scan-get-fixed";
export const COUNTER_MINUTES = "scan-minutes-handed-back"; // summed plan minutes, incremented with by=minutes

export interface CounterStore {
  increment(name: string, by?: number, atMs?: number): Promise<number>; // returns the new all-time total
  read(name: string): Promise<number>;                                  // all-time total
  window(name: string, fromMs: number, toMs: number): Promise<number>;  // sum over [fromMs, toMs) at hour-bucket granularity
}

export function bucketOf(ms: number): number {
  if (!Number.isFinite(ms)) throw new RangeError("timestamp must be finite");
  return Math.floor(ms / HOUR_MS);
}
function checkBy(by: number): void {
  if (!Number.isInteger(by) || by < 1) throw new RangeError("increment must be a positive integer");
}
// A window covers every bucket that starts inside [fromMs, toMs): buckets [bucketOf(from), ceil(to/HOUR)) .
function windowBuckets(fromMs: number, toMs: number): [number, number] | null {
  if (!(toMs > fromMs)) return null;
  return [bucketOf(fromMs), Math.ceil(toMs / HOUR_MS)];
}

export class MemoryCounterStore implements CounterStore {
  private buckets = new Map<string, Map<number, number>>();
  private now: () => number;
  constructor(now: () => number = Date.now) { this.now = now; }
  // Synchronous body inside an async method: JS is single-threaded, so concurrent callers never interleave a read-modify-write.
  async increment(name: string, by = 1, atMs: number = this.now()): Promise<number> {
    checkBy(by);
    const m = this.buckets.get(name) ?? new Map<number, number>();
    this.buckets.set(name, m);
    const b = bucketOf(atMs);
    m.set(b, (m.get(b) ?? 0) + by);
    return this.sum(m, -Infinity, Infinity);
  }
  async read(name: string): Promise<number> {
    const m = this.buckets.get(name);
    return m ? this.sum(m, -Infinity, Infinity) : 0;
  }
  async window(name: string, fromMs: number, toMs: number): Promise<number> {
    const w = windowBuckets(fromMs, toMs);
    const m = this.buckets.get(name);
    if (!w || !m) return 0;
    return this.sum(m, w[0], w[1]);
  }
  private sum(m: Map<number, number>, lo: number, hi: number): number {
    let t = 0;
    for (const [b, n] of m) if (b >= lo && b < hi) t += n;
    return t;
  }
}

// D1 adapter. Table: counter_buckets (migrations/0002_counter_buckets.sql). One atomic upsert per increment.
export class D1CounterStore implements CounterStore {
  private db: D1Like;
  private now: () => number;
  constructor(db: D1Like, now: () => number = Date.now) { this.db = db; this.now = now; }
  async increment(name: string, by = 1, atMs: number = this.now()): Promise<number> {
    checkBy(by);
    await this.db.prepare(
      "INSERT INTO counter_buckets (name, bucket, n) VALUES (?, ?, ?) ON CONFLICT (name, bucket) DO UPDATE SET n = n + excluded.n",
    ).bind(name, bucketOf(atMs), by).run();
    return this.read(name);
  }
  async read(name: string): Promise<number> {
    const r = await this.db.prepare("SELECT COALESCE(SUM(n), 0) AS total FROM counter_buckets WHERE name = ?").bind(name).first<{ total: number }>();
    return r?.total ?? 0;
  }
  async window(name: string, fromMs: number, toMs: number): Promise<number> {
    const w = windowBuckets(fromMs, toMs);
    if (!w) return 0;
    const r = await this.db.prepare(
      "SELECT COALESCE(SUM(n), 0) AS total FROM counter_buckets WHERE name = ? AND bucket >= ? AND bucket < ?",
    ).bind(name, w[0], w[1]).first<{ total: number }>();
    return r?.total ?? 0;
  }
}
