// C5 hop 3 adapter: DrainQueue over a D1-shaped port. SYNC interface, ASYNC store, so the existing drainQueue stays untouched:
//   await q.load()  -> SELECT every row into a cache; drainQueue(q, ...) reads/writes the cache; await q.flush() -> one UPSERT per DIRTY row.
// A re-run dirties nothing, so it writes nothing. Never publishes, never reads a clock, no live D1 (the port is injected; tests use a fake).
import type { DrainEntry, DrainQueue, DrainStatus } from "./drain";

export interface D1PortStatement { bind(...args: unknown[]): D1PortStatement; all<T = unknown>(): Promise<{ results: T[] }>; run(): Promise<unknown> }
export interface D1Port { prepare(sql: string): D1PortStatement }

export const SELECT_SQL = "SELECT cluster_id, label, first_seen, status, attempts, failed_checks, last_error FROM generator_queue";
export const UPSERT_SQL =
  "INSERT INTO generator_queue (cluster_id, label, first_seen, status, attempts, failed_checks, last_error) VALUES (?, ?, ?, ?, ?, ?, ?) " +
  "ON CONFLICT(cluster_id) DO UPDATE SET label = excluded.label, first_seen = excluded.first_seen, status = excluded.status, " +
  "attempts = excluded.attempts, failed_checks = excluded.failed_checks, last_error = excluded.last_error";

type Row = { cluster_id: string; label: string; first_seen: string | null; status: string; attempts: number | null; failed_checks: string | null; last_error: string | null };
const STATUSES = new Set<string>(["QUEUED", "QUEUED_FOR_GENERATOR", "GRADED_PASS", "GRADED_FAIL", "FAILED"]);

export function parseChecks(raw: string | null | undefined): string[] {
  if (raw === null || raw === undefined || raw === "") return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
}
export function rowToEntry(r: Row): DrainEntry {
  if (!STATUSES.has(r.status)) throw new Error("generator_queue: unknown status " + r.status);
  return { cluster_id: r.cluster_id, label: r.label, first_seen: r.first_seen ?? null, status: r.status as DrainStatus, attempts: Number(r.attempts ?? 0), failed_checks: parseChecks(r.failed_checks), last_error: r.last_error ?? null };
}
export function entryToArgs(e: DrainEntry): unknown[] {
  return [e.cluster_id, e.label, e.first_seen ?? null, e.status, e.attempts ?? 0, JSON.stringify(e.failed_checks ?? []), e.last_error ?? null];
}

export class D1DrainQueue implements DrainQueue {
  private rows = new Map<string, DrainEntry>();
  private dirty = new Set<string>();
  writes = 0;
  private readonly db: D1Port;
  constructor(db: D1Port) { this.db = db; }
  async load(): Promise<void> {
    const { results } = await this.db.prepare(SELECT_SQL).all<Row>();
    this.rows = new Map(); this.dirty = new Set();
    for (const r of results) this.rows.set(r.cluster_id, rowToEntry(r));
  }
  list(): DrainEntry[] { return [...this.rows.values()].map((e) => ({ ...e, failed_checks: [...(e.failed_checks ?? [])] })); }
  save(e: DrainEntry): void { this.rows.set(e.cluster_id, { ...e, failed_checks: [...(e.failed_checks ?? [])] }); this.dirty.add(e.cluster_id); }
  async flush(): Promise<number> {
    let n = 0;
    for (const id of [...this.dirty]) {
      const e = this.rows.get(id);
      if (e) { await this.db.prepare(UPSERT_SQL).bind(...entryToArgs(e)).run(); n++; this.writes++; }
      this.dirty.delete(id);
    }
    return n;
  }
}
