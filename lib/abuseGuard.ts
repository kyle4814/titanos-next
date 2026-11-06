// Abuse and runaway-cost guard for the free guest scan and AI Opportunity X-Ray paths.
// Enterprise vision Annex B10. PURE module: no network, no env, no wall clock (clock is injected),
// no live wiring. Storage sits behind GuardStore; InMemoryStore is the test/local adapter.
// Erasable TypeScript only so `node --experimental-strip-types` can run the tests.
//
// Rules (all fail closed):
//  1. Two token buckets per request: one per client key, one global. Both must have a token or
//     neither is spent.
//  2. A daily spend cap. Reaching it trips a latched kill switch: guest answers degrade to
//     cached or code-only, never to a model. The latch clears at the next day boundary or by
//     an explicit reset.
//  3. Guest paths carry a model-call budget of 0. Any attempt throws and is logged.
//  4. Every decision is appended to a bounded decision log.
//  5. Any store error, bad input or non-finite number denies or degrades. It never allows.

export type GuardPath = "guest_scan" | "xray_guest" | "xray_consented";
export type GuardMode = "live" | "cached" | "code_only" | "deny";

export type Clock = () => number; // epoch milliseconds

export interface BucketConfig { capacity: number; refillPerSec: number }
export interface BucketState { tokens: number; updatedAt: number }

export interface GuardConfig {
  perClient: BucketConfig;
  global: BucketConfig;
  dailySpendCapUsd: number;
  /** Max model calls per request by path. Guest paths MUST be 0. */
  modelCallBudget: Record<GuardPath, number>;
  /** Day boundary offset from UTC in minutes (Brisbane = 600). */
  dayOffsetMinutes: number;
  maxTrackedClients: number;
  maxLogEntries: number;
  /** Mode served while the kill switch is tripped. */
  degradedMode: "cached" | "code_only";
}

export const DEFAULT_CONFIG: GuardConfig = {
  perClient: { capacity: 5, refillPerSec: 5 / 600 },
  global: { capacity: 60, refillPerSec: 1 },
  dailySpendCapUsd: 5,
  modelCallBudget: { guest_scan: 0, xray_guest: 0, xray_consented: 3 },
  dayOffsetMinutes: 600,
  maxTrackedClients: 5000,
  maxLogEntries: 1000,
  degradedMode: "code_only",
};

export interface Decision {
  allow: boolean;
  mode: GuardMode;
  reason: string;
  retryAfterMs: number;
  modelCallsAllowed: number;
}

export interface DecisionLogEntry {
  at: number;
  kind: "request" | "spend" | "kill_switch" | "reset" | "budget_violation" | "store_error";
  path?: GuardPath;
  clientKey?: string;
  allow?: boolean;
  mode?: GuardMode;
  reason: string;
  detail?: Record<string, number | string | boolean>;
}

export interface GuardStore {
  getBucket(key: string): BucketState | undefined;
  setBucket(key: string, state: BucketState): void;
  deleteBucket(key: string): void;
  bucketKeys(): string[];
  getSpend(dayKey: string): number;
  setSpend(dayKey: string, usd: number): void;
  getKill(): { tripped: boolean; dayKey: string; trippedAt: number } | undefined;
  setKill(state: { tripped: boolean; dayKey: string; trippedAt: number } | undefined): void;
  appendLog(entry: DecisionLogEntry, maxEntries: number): void;
  readLog(): DecisionLogEntry[];
}

export class InMemoryStore implements GuardStore {
  private buckets = new Map<string, BucketState>();
  private spend = new Map<string, number>();
  private kill: { tripped: boolean; dayKey: string; trippedAt: number } | undefined;
  private log: DecisionLogEntry[] = [];
  getBucket(k: string) { return this.buckets.get(k); }
  setBucket(k: string, s: BucketState) { this.buckets.set(k, { ...s }); }
  deleteBucket(k: string) { this.buckets.delete(k); }
  bucketKeys() { return [...this.buckets.keys()]; }
  getSpend(d: string) { return this.spend.get(d) ?? 0; }
  setSpend(d: string, usd: number) { this.spend.clear(); this.spend.set(d, usd); } // only today is kept
  getKill() { return this.kill ? { ...this.kill } : undefined; }
  setKill(s: { tripped: boolean; dayKey: string; trippedAt: number } | undefined) { this.kill = s ? { ...s } : undefined; }
  appendLog(e: DecisionLogEntry, max: number) {
    this.log.push(e);
    if (this.log.length > max) this.log.splice(0, this.log.length - max);
  }
  readLog() { return this.log.map((e) => ({ ...e })); }
}

export class BudgetExceededError extends Error {
  path: GuardPath;
  constructor(path: GuardPath, allowed: number) {
    super(`model call refused on ${path}: budget ${allowed}`);
    this.name = "BudgetExceededError";
    this.path = path;
  }
}

/** Pure token bucket maths. Returns the refilled state at `now`. A clock that goes backwards adds nothing. */
export function refill(state: BucketState, cfg: BucketConfig, now: number): BucketState {
  const dt = Math.max(0, now - state.updatedAt);
  const tokens = Math.min(cfg.capacity, state.tokens + (dt / 1000) * cfg.refillPerSec);
  return { tokens, updatedAt: Math.max(now, state.updatedAt) };
}

function validBucket(b: BucketConfig) {
  return Number.isFinite(b.capacity) && b.capacity >= 1 && Number.isFinite(b.refillPerSec) && b.refillPerSec > 0;
}

export function validateConfig(c: GuardConfig): string[] {
  const errs: string[] = [];
  if (!validBucket(c.perClient)) errs.push("perClient bucket invalid");
  if (!validBucket(c.global)) errs.push("global bucket invalid");
  if (!Number.isFinite(c.dailySpendCapUsd) || c.dailySpendCapUsd <= 0) errs.push("dailySpendCapUsd invalid");
  if (c.modelCallBudget.guest_scan !== 0) errs.push("guest_scan model budget must be 0");
  if (c.modelCallBudget.xray_guest !== 0) errs.push("xray_guest model budget must be 0");
  const b = c.modelCallBudget.xray_consented;
  if (!Number.isInteger(b) || b < 0) errs.push("xray_consented budget invalid");
  if (!Number.isInteger(c.maxTrackedClients) || c.maxTrackedClients < 1) errs.push("maxTrackedClients invalid");
  if (!Number.isInteger(c.maxLogEntries) || c.maxLogEntries < 1) errs.push("maxLogEntries invalid");
  if (!Number.isFinite(c.dayOffsetMinutes)) errs.push("dayOffsetMinutes invalid");
  return errs;
}

const GLOBAL_KEY = "__global__";
const CLIENT_PREFIX = "c:";
const PATHS: GuardPath[] = ["guest_scan", "xray_guest", "xray_consented"];

export class AbuseGuard {
  readonly cfg: GuardConfig;
  private store: GuardStore;
  private clock: Clock;

  constructor(store: GuardStore, clock: Clock, cfg: GuardConfig = DEFAULT_CONFIG) {
    const errs = validateConfig(cfg);
    if (errs.length) throw new Error(`abuseGuard config: ${errs.join("; ")}`);
    this.cfg = cfg;
    this.store = store;
    this.clock = clock;
  }

  /** Day key at the configured offset, e.g. "2026-11-06". */
  dayKey(now: number): string {
    return new Date(now + this.cfg.dayOffsetMinutes * 60000).toISOString().slice(0, 10);
  }

  private log(e: DecisionLogEntry) {
    try { this.store.appendLog(e, this.cfg.maxLogEntries); } catch { /* the log must never block a decision */ }
  }

  private deny(now: number, path: GuardPath | undefined, clientKey: string | undefined, reason: string, retryAfterMs = 0, kind: DecisionLogEntry["kind"] = "request"): Decision {
    const d: Decision = { allow: false, mode: "deny", reason, retryAfterMs, modelCallsAllowed: 0 };
    this.log({ at: now, kind, path, clientKey, allow: false, mode: "deny", reason });
    return d;
  }

  /** Is the kill switch tripped right now? Clears itself at the day boundary. Throws on store error. */
  private killTripped(now: number): boolean {
    const k = this.store.getKill();
    if (!k || !k.tripped) return false;
    if (k.dayKey !== this.dayKey(now)) {
      this.store.setKill(undefined);
      this.log({ at: now, kind: "reset", reason: "kill switch cleared at day rollover", detail: { previousDay: k.dayKey } });
      return false;
    }
    return true;
  }

  /** Decide one request. Never throws: any internal failure becomes a deny. */
  check(path: GuardPath, clientKey: string): Decision {
    const now = this.clock();
    try {
      if (!Number.isFinite(now)) return this.deny(0, path, undefined, "clock_invalid");
      if (!PATHS.includes(path)) return this.deny(now, undefined, undefined, "unknown_path");
      if (typeof clientKey !== "string" || clientKey.length === 0 || clientKey.length > 128) {
        return this.deny(now, path, undefined, "client_key_invalid");
      }

      const budget = this.cfg.modelCallBudget[path];
      const killed = this.killTripped(now);
      const ck = CLIENT_PREFIX + clientKey;

      const cl = refill(this.store.getBucket(ck) ?? { tokens: this.cfg.perClient.capacity, updatedAt: now }, this.cfg.perClient, now);
      const gl = refill(this.store.getBucket(GLOBAL_KEY) ?? { tokens: this.cfg.global.capacity, updatedAt: now }, this.cfg.global, now);

      if (cl.tokens < 1) {
        this.store.setBucket(ck, cl);
        const wait = Math.ceil(((1 - cl.tokens) / this.cfg.perClient.refillPerSec) * 1000);
        return this.deny(now, path, clientKey, "rate_limited_client", wait);
      }
      if (gl.tokens < 1) {
        this.store.setBucket(GLOBAL_KEY, gl);
        const wait = Math.ceil(((1 - gl.tokens) / this.cfg.global.refillPerSec) * 1000);
        return this.deny(now, path, clientKey, "rate_limited_global", wait);
      }
      if (!this.store.getBucket(ck) && !this.makeRoom(now)) {
        return this.deny(now, path, clientKey, "tracker_full");
      }
      this.store.setBucket(ck, { tokens: cl.tokens - 1, updatedAt: cl.updatedAt });
      this.store.setBucket(GLOBAL_KEY, { tokens: gl.tokens - 1, updatedAt: gl.updatedAt });

      const mode: GuardMode = killed ? this.cfg.degradedMode : "live";
      const allowedCalls = killed ? 0 : budget;
      const reason = killed ? "kill_switch_degraded" : "ok";
      this.log({ at: now, kind: "request", path, clientKey, allow: true, mode, reason, detail: { modelCallsAllowed: allowedCalls } });
      return { allow: true, mode, reason, retryAfterMs: 0, modelCallsAllowed: allowedCalls };
    } catch {
      this.log({ at: Number.isFinite(now) ? now : 0, kind: "store_error", path, reason: "store_error_fail_closed" });
      return { allow: false, mode: "deny", reason: "store_error", retryAfterMs: 0, modelCallsAllowed: 0 };
    }
  }

  /** Evict client buckets that have refilled to full (identical to a new client). False if still full. */
  private makeRoom(now: number): boolean {
    const keys = this.store.bucketKeys().filter((k) => k.startsWith(CLIENT_PREFIX));
    if (keys.length < this.cfg.maxTrackedClients) return true;
    for (const k of keys) {
      const b = this.store.getBucket(k);
      if (b && refill(b, this.cfg.perClient, now).tokens >= this.cfg.perClient.capacity) this.store.deleteBucket(k);
    }
    return this.store.bucketKeys().filter((k) => k.startsWith(CLIENT_PREFIX)).length < this.cfg.maxTrackedClients;
  }

  /** Record real spend (USD). Reaching the daily cap trips the kill switch. Bad numbers trip it too. */
  recordSpend(usd: number): { totalUsd: number; tripped: boolean } {
    const now = this.clock();
    try {
      const day = this.dayKey(now);
      this.killTripped(now); // applies rollover first
      if (!Number.isFinite(usd) || usd < 0) {
        this.trip(now, day, "invalid spend figure");
        return { totalUsd: this.store.getSpend(day), tripped: true };
      }
      const total = this.store.getSpend(day) + usd;
      this.store.setSpend(day, total);
      this.log({ at: now, kind: "spend", reason: "spend recorded", detail: { usd, totalUsd: total, capUsd: this.cfg.dailySpendCapUsd } });
      if (total >= this.cfg.dailySpendCapUsd) {
        this.trip(now, day, "daily cap reached");
        return { totalUsd: total, tripped: true };
      }
      return { totalUsd: total, tripped: this.killTripped(now) };
    } catch {
      this.log({ at: now, kind: "store_error", reason: "spend_store_error_fail_closed" });
      return { totalUsd: NaN, tripped: true };
    }
  }

  private trip(now: number, day: string, why: string) {
    this.store.setKill({ tripped: true, dayKey: day, trippedAt: now });
    this.log({ at: now, kind: "kill_switch", reason: why, detail: { dayKey: day } });
  }

  /** Manual operator trip. */
  tripKillSwitch(why = "manual") {
    const now = this.clock();
    this.trip(now, this.dayKey(now), why);
  }

  /** Manual operator reset. */
  resetKillSwitch() {
    const now = this.clock();
    this.store.setKill(undefined);
    this.log({ at: now, kind: "reset", reason: "manual reset" });
  }

  /** Fails closed: a store error reads as tripped. */
  isKillSwitchTripped(): boolean {
    try { return this.killTripped(this.clock()); } catch { return true; }
  }

  /** A per-request model-call budget. Guest paths get 0 and every attempt throws. */
  budgetFor(path: GuardPath, decision: Decision): RequestBudget {
    const cap = decision.allow ? Math.min(decision.modelCallsAllowed, this.cfg.modelCallBudget[path]) : 0;
    return new RequestBudget(path, cap, (e) => this.log({ ...e, at: this.clock() }));
  }

  decisionLog(): DecisionLogEntry[] { return this.store.readLog(); }
}

export class RequestBudget {
  readonly path: GuardPath;
  readonly allowed: number;
  private used = 0;
  private sink: (e: Omit<DecisionLogEntry, "at">) => void;
  constructor(path: GuardPath, allowed: number, sink: (e: Omit<DecisionLogEntry, "at">) => void) {
    this.path = path;
    this.allowed = allowed;
    this.sink = sink;
  }
  get modelCallsUsed() { return this.used; }
  /** Call BEFORE every model call. Throws when the budget is spent or is 0 (guest paths). */
  assertModelCall(): void {
    if (this.used >= this.allowed) {
      this.sink({ kind: "budget_violation", path: this.path, allow: false, reason: "model call attempted over budget", detail: { allowed: this.allowed, used: this.used } });
      throw new BudgetExceededError(this.path, this.allowed);
    }
    this.used += 1;
  }
}
