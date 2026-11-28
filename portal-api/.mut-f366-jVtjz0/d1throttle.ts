// D1ThrottleStore (F206): the shared-state adapter for the Throttle in throttle.ts. The Memory adapter is per-isolate and evicts the
// oldest key at its cap, which can drop a live lockout; this one keeps state in D1 so every isolate sees the same count and lock.
// NOT applied to any live D1 (GATE5). Rules this file keeps:
//  - The window count and the lockout are advanced by ONE statement (INSERT ... ON CONFLICT DO UPDATE ... WHERE ... RETURNING).
//    No read-then-write across awaits: 50 interleaved hits on one key admit exactly N.
//  - The refuse path reads the row only to compute Retry-After; that read never decides admission.
//  - Rows are bounded by an expiry sweep (expires_at = last write + max(window, lockout)); a swept row was already semantically absent.
//  - Every value is bound; the key is already scope + sha256 prefix (throttleKey), so no raw email or IP is ever stored.
import type { D1Like } from "./env.ts";
import type { AtomicThrottleStore, ThrottleConfig } from "./throttle.ts";

type Cfg = Pick<ThrottleConfig, "maxFailures" | "windowMs" | "lockoutMs">;

// ?1 key, ?2 now, ?3 maxFailures, ?4 windowMs, ?5 lockoutMs, ?6 horizon = max(windowMs, lockoutMs).
// "fresh" = lock over AND window over, exactly Throttle.fresh() in throttle.ts. In an UPSERT every right-hand side and the WHERE see the OLD row.
const FRESH = "(locked_until <= ?2 AND ?2 >= window_start + ?4)";
export const RESERVE_SQL = `INSERT INTO throttle_state (key, fail_count, window_start, locked_until, expires_at)
VALUES (?1, 1, ?2, CASE WHEN ?3 <= 1 THEN ?2 + ?5 ELSE 0 END, ?2 + ?6)
ON CONFLICT(key) DO UPDATE SET
  fail_count = CASE WHEN ${FRESH} THEN 1 ELSE fail_count + 1 END,
  window_start = CASE WHEN ${FRESH} THEN ?2 ELSE window_start END,
  locked_until = CASE WHEN ${FRESH} THEN (CASE WHEN ?3 <= 1 THEN ?2 + ?5 ELSE 0 END)
                      WHEN fail_count + 1 >= ?3 THEN ?2 + ?5 ELSE locked_until END,
  expires_at = ?2 + ?6
WHERE locked_until <= ?2 AND (?2 >= window_start + ?4 OR fail_count < ?3)
RETURNING fail_count`;
export const SWEEP_SQL = "DELETE FROM throttle_state WHERE key IN (SELECT key FROM throttle_state WHERE expires_at <= ?1 LIMIT ?2)";

export class D1ThrottleStore implements AtomicThrottleStore {
  private lastSweep = Number.NEGATIVE_INFINITY;
  private db: D1Like; private opts: { sweepEveryMs?: number; sweepBatch?: number };
  constructor(db: D1Like, opts: { sweepEveryMs?: number; sweepBatch?: number } = {}) { this.db = db; this.opts = opts; }
  private get every() { return this.opts.sweepEveryMs ?? 60_000; }
  private get batch() { return this.opts.sweepBatch ?? 500; }

  async reserve(key: string, cfg: Cfg, now: number): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
    if (now - this.lastSweep >= this.every) { this.lastSweep = now; await this.sweep(now, 1); }   // opportunistic: one bounded batch, never loops on the hot path
    const horizon = Math.max(cfg.windowMs, cfg.lockoutMs);
    const row = await this.db.prepare(RESERVE_SQL).bind(key, now, cfg.maxFailures, cfg.windowMs, cfg.lockoutMs, horizon).first<{ fail_count: number }>();
    if (row) return { allowed: true };
    // Refused: no write happened. Read the row only to report Retry-After (advisory; same arithmetic as the Memory adapter).
    const s = await this.db.prepare("SELECT window_start, locked_until FROM throttle_state WHERE key = ?1").bind(key).first<{ window_start: number; locked_until: number }>();
    if (!s) return { allowed: false, retryAfterSec: 1 };
    if (Number(s.locked_until) > now) return { allowed: false, retryAfterSec: Math.ceil((Number(s.locked_until) - now) / 1000) };
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((Number(s.window_start) + cfg.windowMs - now) / 1000)) };
  }
  async delete(key: string): Promise<void> { await this.db.prepare("DELETE FROM throttle_state WHERE key = ?1").bind(key).run(); }
  // Delete expired rows in batches of `batch` (at most maxBatches batches). Returns rows deleted.
  async sweep(now: number, maxBatches = Infinity): Promise<number> {
    let total = 0;
    for (let i = 0; i < maxBatches; i++) {
      const r = (await this.db.prepare(SWEEP_SQL).bind(now, this.batch).run()) as { meta?: { changes?: number } };
      const n = Number(r?.meta?.changes ?? 0); total += n;
      if (n < this.batch) break;
    }
    return total;
  }
  async count(): Promise<number> { return Number((await this.db.prepare("SELECT COUNT(*) AS c FROM throttle_state").first<{ c: number }>())?.c ?? 0); }
  async allKeys(): Promise<string[]> { return (await this.db.prepare("SELECT key FROM throttle_state").all<{ key: string }>()).results.map((r) => r.key); }
  async stateOf(key: string) { return this.db.prepare("SELECT fail_count, window_start, locked_until, expires_at FROM throttle_state WHERE key = ?1").bind(key).first<{ fail_count: number; window_start: number; locked_until: number; expires_at: number }>(); }
}
