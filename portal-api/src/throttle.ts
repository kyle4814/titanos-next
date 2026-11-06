// Fixed-window failure throttle plus lockout, behind an interface. Injectable clock, Memory adapter, no I/O.
// N failures per key inside windowMs lock the key for lockoutMs: call N+1 is refused (429 + Retry-After) before it runs.
// An attempt is RESERVED before the guarded work runs (so concurrent callers cannot exceed N) and the key is reset
// when the work succeeds. Keys are built by throttleKey(): scope + sha256 of the raw parts, so a raw email or IP
// never reaches a map key, a log line or an error message.
import { sha256Hex } from "./util.ts";

export interface ThrottleState { count: number; windowStart: number; lockedUntil: number }
export interface ThrottleStore {
  get(key: string): ThrottleState | undefined;
  set(key: string, s: ThrottleState): void;
  delete(key: string): void;
}
export interface ThrottleConfig { maxFailures: number; windowMs: number; lockoutMs: number; now: () => number; log?: (line: string) => void }

export class MemoryThrottleStore implements ThrottleStore {
  readonly max: number;
  private m: Map<string, ThrottleState> = new Map();
  constructor(max = 1000) { this.max = max; }
  get size() { return this.m.size; }
  get(k: string) { return this.m.get(k); }
  set(k: string, s: ThrottleState) {
    this.m.delete(k); this.m.set(k, s);                       // re-insert so Map order = oldest-updated first
    while (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string);   // evict oldest
  }
  delete(k: string) { this.m.delete(k); }
}

export class ThrottledError extends Error {
  status: number; code: string; retryAfterSec: number;
  constructor(retryAfterSec: number) { super("too_many_attempts"); this.status = 429; this.code = "too_many_attempts"; this.retryAfterSec = retryAfterSec; }
}

export async function throttleKey(scope: string, ...parts: string[]): Promise<string> {
  return `${scope}:${(await sha256Hex(parts.map((p) => p.trim().toLowerCase()).join("\u0000"))).slice(0, 32)}`;
}

export class Throttle {
  private cfg: ThrottleConfig; readonly store: ThrottleStore;
  constructor(cfg: ThrottleConfig, store: ThrottleStore = new MemoryThrottleStore()) {
    this.cfg = cfg; this.store = store;
    if (!(cfg.maxFailures >= 1)) throw new Error("maxFailures must be >= 1");
  }
  private fresh(s: ThrottleState | undefined, now: number): ThrottleState {
    if (!s || (s.lockedUntil <= now && now >= s.windowStart + this.cfg.windowMs)) return { count: 0, windowStart: now, lockedUntil: 0 };
    return s;
  }
  // Synchronous on purpose: no await between the read and the write, so interleaved callers cannot both slip under N.
  reserve(key: string): { allowed: true } | { allowed: false; retryAfterSec: number } {
    const now = this.cfg.now();
    const s = this.fresh(this.store.get(key), now);
    if (s.lockedUntil > now) return { allowed: false, retryAfterSec: Math.ceil((s.lockedUntil - now) / 1000) };
    if (s.count >= this.cfg.maxFailures) return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((s.windowStart + this.cfg.windowMs - now) / 1000)) };
    s.count += 1;
    if (s.count >= this.cfg.maxFailures) s.lockedUntil = now + this.cfg.lockoutMs;
    this.store.set(key, s);
    return { allowed: true };
  }
  reset(key: string) { this.store.delete(key); }
  note(line: string) { this.cfg.log?.(line); }   // log sink for callers that use reserve()/reset() directly; callers pass hashed keys only
  // Run fn under the throttle. A thrown error or isFailure(result) keeps the reserved failure; anything else resets the key.
  async guard<T>(key: string, fn: () => Promise<T>, isFailure: (r: T) => boolean = () => false): Promise<T> {
    const r = this.reserve(key);
    if (!r.allowed) { this.cfg.log?.(`throttle block key=${key} retry_after=${r.retryAfterSec}`); throw new ThrottledError(r.retryAfterSec); }
    let out: T;
    try { out = await fn(); } catch (e) { this.cfg.log?.(`throttle fail key=${key}`); throw e; }
    if (isFailure(out)) { this.cfg.log?.(`throttle fail key=${key}`); return out; }
    this.reset(key);
    return out;
  }
}
