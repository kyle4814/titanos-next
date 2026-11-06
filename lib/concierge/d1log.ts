// D1UnmatchedLog: the Worker/D1 adapter behind the UnmatchedLog interface (C5/C6, plan line 1497).
// Built and tested against a fake D1 on real SQLite. NOT wired to a real D1 binding and no migration applied: PENDING LIVE.
// One round trip per append: an upsert (dedup per day) and the oldest-first eviction go in ONE batch, so the table is
// bounded after every call even under concurrent callers. Nothing identifying the visitor is a column, so none can be stored.
import { prepare, mustDay, ROW_CAP, DAY_RE } from "./unmatched.ts";
import type { AppendResult, LogEntry, LogOpts, ReadableLog } from "./unmatched.ts";
import type { ConfigStub, Seat } from "./types.ts";

// Structural twin of the portal-api D1Like (env.ts), with batch.
export interface D1Stmt { bind(...a: unknown[]): D1Stmt; all<T = unknown>(): Promise<{ results: T[] }>; run(): Promise<unknown> }
export interface D1Db { prepare(sql: string): D1Stmt; batch(stmts: D1Stmt[]): Promise<unknown[]> }

export class D1UnmatchedLog implements ReadableLog {
  private day: () => string;
  readonly cap: number;
  private db: D1Db;
  constructor(db: D1Db, o: LogOpts = {}) {
    this.db = db;
    this.day = o.day ?? (() => { throw new Error("D1UnmatchedLog needs a day() clock"); });
    this.cap = Math.max(1, o.cap ?? ROW_CAP);
  }
  async append(stub: ConfigStub): Promise<AppendResult> {
    const p = prepare(stub);
    if (!p.ok) return { status: "rejected", reason: p.reason };
    const day = mustDay(this.day());
    await this.db.batch([
      this.db.prepare("INSERT INTO unmatched_asks (day, seat, normalised, count) VALUES (?, ?, ?, 1) ON CONFLICT (day, seat, normalised) DO UPDATE SET count = count + 1").bind(day, p.seat, p.normalised),
      this.db.prepare("DELETE FROM unmatched_asks WHERE id <= (SELECT id FROM unmatched_asks ORDER BY id DESC LIMIT 1 OFFSET ?)").bind(this.cap),
    ]);
    return { status: "stored" };
  }
  async entries(limit = ROW_CAP): Promise<LogEntry[]> {
    const n = Math.max(0, Math.min(Math.floor(limit), ROW_CAP * 4));
    const r = await this.db.prepare("SELECT day, seat, normalised, count FROM unmatched_asks ORDER BY id ASC LIMIT ?").bind(n).all<{ day: string; seat: Seat; normalised: string; count: number }>();
    return r.results.filter((x) => DAY_RE.test(x.day)).map((x) => ({ day: x.day, seat: x.seat, normalised: x.normalised, count: Number(x.count) }));
  }
}
