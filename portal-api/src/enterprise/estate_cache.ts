// F34: TTL cache + per-tenant token-bucket limiter around a ScanProvider's assess() (the dnsScan result).
// Each fresh scan is about 17 DoH queries per domain, so a repeat estate view must not re-query.
// Pure logic: the clock is injected, no I/O of its own. Cache is keyed by tenant+domain (tenant A never reads B).
// Over the rate limit we return the cached value (even if stale) or UNKNOWN reason rate_limited. Never throws.
import type { Assessment, ScanProvider } from "./types.ts";

export interface EstateCacheOpts {
  inner: ScanProvider;
  now?: () => number;
  /** TTL for ASSESSED results. Default 15 min. */
  ttlMs?: number;
  /** Shorter TTL for UNKNOWN results (a failed read should be retried sooner). Default 60 s. */
  unknownTtlMs?: number;
  /** Max entries across all tenants, LRU eviction. Default 5000. */
  maxEntries?: number;
  /** Token bucket per tenant on FRESH scans: burst size. Default 50. */
  bucketCapacity?: number;
  /** One token returns every refillEveryMs. Default 1000. */
  refillEveryMs?: number;
}
export interface CacheStats { hits: number; misses: number; staleServed: number; rateLimited: number; evictions: number; freshScans: number; size: number }

interface Entry { a: Assessment; expires: number }
interface Bucket { tokens: number; last: number }

export function estateCache(o: EstateCacheOpts) {
  const now = o.now ?? Date.now;
  const ttl = o.ttlMs ?? 15 * 60_000, unkTtl = o.unknownTtlMs ?? 60_000, max = Math.max(1, o.maxEntries ?? 5000);
  const cap = Math.max(1, o.bucketCapacity ?? 50), refill = Math.max(1, o.refillEveryMs ?? 1000);
  const store = new Map<string, Entry>();                 // insertion order = LRU order (oldest first)
  const buckets = new Map<string, Bucket>();
  const inflight = new Map<string, Promise<Assessment>>();
  const stats: CacheStats = { hits: 0, misses: 0, staleServed: 0, rateLimited: 0, evictions: 0, freshScans: 0, size: 0 };
  const keyOf = (tenant: string, domain: string) => `${tenant}\u0000${domain.trim().toLowerCase()}`;

  function take(tenant: string): boolean {
    const t = now();
    const b = buckets.get(tenant) ?? { tokens: cap, last: t };
    const gained = Math.floor(Math.max(0, t - b.last) / refill);
    if (gained > 0) { b.tokens = Math.min(cap, b.tokens + gained); b.last = b.tokens >= cap ? t : b.last + gained * refill; }
    buckets.set(tenant, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1; return true;
  }
  function put(k: string, a: Assessment) {
    store.delete(k);
    store.set(k, { a, expires: now() + (a.status === "ASSESSED" ? ttl : unkTtl) });
    while (store.size > max) { store.delete(store.keys().next().value as string); stats.evictions++; }
  }
  const limited = (): Assessment => ({ status: "UNKNOWN", reason: "rate_limited", scannedAt: now(), resolverSource: o.inner.source });

  async function assess(tenant: string, domain: string, opts: { refresh?: boolean } = {}): Promise<Assessment> {
    const k = keyOf(tenant, domain), e = store.get(k);
    if (e && !opts.refresh && now() < e.expires) { store.delete(k); store.set(k, e); stats.hits++; return e.a; }
    const pending = inflight.get(k);
    if (pending) return pending;                          // concurrent identical request shares one scan
    if (!take(tenant)) {
      stats.rateLimited++;
      if (e) { stats.staleServed++; return e.a; }
      return limited();
    }
    stats.misses++; stats.freshScans++;
    const run = (async (): Promise<Assessment> => {
      try {
        const a = o.inner.assess ? await o.inner.assess(domain) : ({ status: "UNKNOWN", reason: "scan_error", scannedAt: now(), resolverSource: o.inner.source } as Assessment);
        put(k, a); return a;
      } catch {
        const a: Assessment = { status: "UNKNOWN", reason: "scan_error", scannedAt: now(), resolverSource: o.inner.source };
        put(k, a); return a;
      } finally { inflight.delete(k); }
    })();
    inflight.set(k, run);
    return run;
  }
  /** A ScanProvider scoped to one tenant, ready to drop into estate() later. */
  function forTenant(tenant: string, opts: { refresh?: boolean } = {}): ScanProvider {
    return { source: o.inner.source, concurrency: o.inner.concurrency, scan: (d) => o.inner.scan(d), assess: (d) => assess(tenant, d, opts) };
  }
  return { assess, forTenant, invalidate(tenant: string, domain: string) { store.delete(keyOf(tenant, domain)); }, stats: () => ({ ...stats, size: store.size }) };
}
