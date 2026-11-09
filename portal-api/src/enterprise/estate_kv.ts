// C8 (f321): Workers-KV-backed estate cache + refresh limiter, so limits and cached scans survive across isolates.
// Behind a minimal KVPort (get / put with expirationTtl, no list), so tests run on an in-memory fake and a real
// KV namespace is only a binding away. Env.ESTATE_KV absent = the Memory adapters, behaviour unchanged.
// Isolation: tenant ids are VALIDATED (^[A-Za-z0-9_-]{1,64}$, so no ':' or other delimiter can ever appear in a key);
// the domain is hashed. Every stored value repeats its tenant and domain hash and is schema-checked on read:
// a corrupt or foreign-tenant value is a MISS, never served. Fail closed: a KV error never triggers a fresh unlimited scan.
// HONEST LIMIT: KV has no compare-and-swap, so the limiter is a best-effort read-modify-write; two isolates racing inside
// one KV propagation window (up to ~60 s for cross-location reads) can each admit one extra. Needs a Durable Object or D1
// for a hard cap (UNKNOWN until measured).
import type { Assessment, ScanProvider } from "./types.ts";
import { sha256Hex } from "../util.ts";
import type { EstateCache, CacheStats } from "./estate_cache.ts";
import type { RefreshLimiter } from "./estate_refresh.ts";
import { MemoryRefreshLimiter, DEFAULT_REFRESH_MAX, DEFAULT_REFRESH_WINDOW_MS } from "./estate_refresh.ts";
import { estateCache } from "./estate_cache.ts";

export interface KVPort {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

const TENANT_RX = /^[A-Za-z0-9_-]{1,64}$/;
export const validTenant = (t: unknown): t is string => typeof t === "string" && TENANT_RX.test(t);
const ttlSec = (ms: number) => Math.max(60, Math.ceil(ms / 1000));   // Workers KV rejects expirationTtl under 60 s
const domainOf = (d: string) => d.trim().toLowerCase();

const GRADES = new Set(["A", "B", "C", "D", "F"]);
const REASONS = new Set(["timeout", "resolver_failed", "scan_error", "rate_limited"]);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
function validAssessment(a: any): a is Assessment {
  if (!a || typeof a !== "object" || !isNum(a.scannedAt) || typeof a.resolverSource !== "string") return false;
  if (a.status === "UNKNOWN") return REASONS.has(a.reason);
  if (a.status !== "ASSESSED") return false;
  const c = a.counts;
  return GRADES.has(a.grade) && isNum(a.score) && isNum(a.unreadableChecks) && !!c && typeof c === "object" &&
    isNum(c.critical) && isNum(c.high) && isNum(c.medium) && isNum(c.low);
}
function parse(raw: string | null): any | null { if (raw == null) return null; try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : null; } catch { return null; } }

export interface KvEstateCacheOpts {
  kv: KVPort; inner: ScanProvider; now?: () => number;
  ttlMs?: number; unknownTtlMs?: number;
  /** How long past logical expiry an entry stays in KV so it can be served stale. Default 1 h. */
  staleGraceMs?: number;
  /** Per-isolate token bucket on FRESH scans (same as the Memory cache). */
  bucketCapacity?: number; refillEveryMs?: number;
}

export function kvEstateCache(o: KvEstateCacheOpts): EstateCache {
  const now = o.now ?? Date.now;
  const ttl = o.ttlMs ?? 15 * 60_000, unkTtl = o.unknownTtlMs ?? 60_000, grace = o.staleGraceMs ?? 3_600_000;
  const cap = Math.max(1, o.bucketCapacity ?? 50), refill = Math.max(1, o.refillEveryMs ?? 1000);
  const buckets = new Map<string, { tokens: number; last: number }>();
  const inflight = new Map<string, Promise<Assessment>>();
  const stats: CacheStats = { hits: 0, misses: 0, staleServed: 0, rateLimited: 0, evictions: 0, freshScans: 0, size: 0 };
  const unknown = (reason: "scan_error" | "rate_limited"): Assessment => ({ status: "UNKNOWN", reason, scannedAt: now(), resolverSource: o.inner.source });

  function take(tenant: string): boolean {
    const t = now(), b = buckets.get(tenant) ?? { tokens: cap, last: t };
    const gained = Math.floor(Math.max(0, t - b.last) / refill);
    if (gained > 0) { b.tokens = Math.min(cap, b.tokens + gained); b.last = b.tokens >= cap ? t : b.last + gained * refill; }
    buckets.set(tenant, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1; return true;
  }
  const keyOf = async (tenant: string, domain: string) => {
    const dh = (await sha256Hex(domainOf(domain))).slice(0, 32);
    return { key: `estate:v1:${tenant}:${dh}`, dh };
  };
  /** Returns the checked entry, null for a miss (absent / corrupt / foreign), or "ERR" when KV itself failed. */
  async function read(key: string, tenant: string, dh: string): Promise<{ a: Assessment; exp: number } | null | "ERR"> {
    let raw: string | null;
    try { raw = await o.kv.get(key); } catch { return "ERR"; }
    const v = parse(raw);
    if (!v || v.v !== 1 || v.t !== tenant || v.d !== dh || !isNum(v.exp) || !validAssessment(v.a)) return null;
    return { a: v.a as Assessment, exp: v.exp };
  }
  async function write(key: string, tenant: string, dh: string, a: Assessment) {
    const life = a.status === "ASSESSED" ? ttl : unkTtl;
    try { await o.kv.put(key, JSON.stringify({ v: 1, t: tenant, d: dh, a, exp: now() + life }), { expirationTtl: ttlSec(life + grace) }); } catch { /* the scan result still goes back to the caller */ }
  }

  async function assess(tenant: string, domain: string, opts: { refresh?: boolean; cacheOnly?: boolean } = {}): Promise<Assessment> {
    if (!validTenant(tenant)) { stats.rateLimited++; return unknown("scan_error"); }
    const { key, dh } = await keyOf(tenant, domain);
    const e = await read(key, tenant, dh);
    if (e === "ERR") { stats.rateLimited++; return unknown("scan_error"); }          // fail closed: no fresh scan on a KV fault
    if (opts.cacheOnly) { if (e) { if (now() >= e.exp) stats.staleServed++; else stats.hits++; return e.a; } stats.rateLimited++; return unknown("rate_limited"); }
    if (e && !opts.refresh && now() < e.exp) { stats.hits++; return e.a; }
    const pending = inflight.get(key);
    if (pending) return pending;
    if (!take(tenant)) { stats.rateLimited++; if (e) { stats.staleServed++; return e.a; } return unknown("rate_limited"); }
    stats.misses++; stats.freshScans++;
    const run = (async (): Promise<Assessment> => {
      try {
        const a = o.inner.assess ? await o.inner.assess(domain) : unknown("scan_error");
        await write(key, tenant, dh, a); return a;
      } catch { const a = unknown("scan_error"); await write(key, tenant, dh, a); return a; }
      finally { inflight.delete(key); }
    })();
    inflight.set(key, run);
    return run;
  }
  function forTenant(tenant: string, opts: { refresh?: boolean; cacheOnly?: boolean } = {}): ScanProvider {
    return { source: o.inner.source, concurrency: o.inner.concurrency, scan: (d) => o.inner.scan(d), assess: (d) => assess(tenant, d, opts) };
  }
  // A foreign or corrupt value is never served, so invalidate only has to age the entry out: overwrite with an already-expired marker.
  async function invalidate(tenant: string, domain: string): Promise<void> {
    if (!validTenant(tenant)) return;
    const { key } = await keyOf(tenant, domain);
    try { await o.kv.put(key, "null", { expirationTtl: 60 }); } catch { /* best effort */ }
  }
  return { assess, forTenant, invalidate, stats: () => ({ ...stats }) } as unknown as EstateCache;   // size is UNKNOWN on KV (no list), reported 0
}

export interface KvRefreshLimiterOpts { kv: KVPort; now?: () => number; max?: number; windowMs?: number }
/** Fixed window, N refreshes per tenant per window, shared by every isolate that shares the KV. Fails closed (deny) on KV error, corrupt or foreign value. */
export class KvRefreshLimiter implements RefreshLimiter {
  private kv: KVPort; private now: () => number; private max: number; private windowMs: number;
  constructor(o: KvRefreshLimiterOpts) { this.kv = o.kv; this.now = o.now ?? Date.now; this.max = o.max ?? DEFAULT_REFRESH_MAX; this.windowMs = o.windowMs ?? DEFAULT_REFRESH_WINDOW_MS; }
  async allow(tenantId: string): Promise<boolean> {
    if (!validTenant(tenantId)) return false;
    const key = `estate-refresh:v1:${tenantId}`, t = this.now();
    let raw: string | null;
    try { raw = await this.kv.get(key); } catch { return false; }
    let count = 0, windowStart = t;
    if (raw != null) {
      const v = parse(raw);
      if (!v || v.v !== 1 || v.t !== tenantId || !isNum(v.count) || !isNum(v.windowStart) || v.count < 0) return false;   // corrupt or foreign: deny, do not overwrite
      if (t < v.windowStart + this.windowMs) { count = v.count; windowStart = v.windowStart; }
    }
    if (count >= this.max) return false;
    try { await this.kv.put(key, JSON.stringify({ v: 1, t: tenantId, count: count + 1, windowStart }), { expirationTtl: ttlSec(windowStart + this.windowMs - t) }); } catch { return false; }
    return true;
  }
}

/** One switch: Env.ESTATE_KV present = KV adapters, absent = the Memory ones exactly as before. */
export function estateAdapters(env: { ESTATE_KV?: KVPort }, d: { inner: ScanProvider; now?: () => number }): { estateCache: EstateCache; refreshLimiter: RefreshLimiter; backend: "kv" | "memory" } {
  const now = d.now ?? Date.now;
  if (env.ESTATE_KV) return { estateCache: kvEstateCache({ kv: env.ESTATE_KV, inner: d.inner, now }), refreshLimiter: new KvRefreshLimiter({ kv: env.ESTATE_KV, now }), backend: "kv" };
  return { estateCache: estateCache({ inner: d.inner, now }), refreshLimiter: new MemoryRefreshLimiter(now), backend: "memory" };
}
