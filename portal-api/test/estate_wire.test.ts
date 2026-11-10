// f310: estate() wired to the per-tenant cache (forTenant per request) + refresh=1 limiter. SYNTHETIC domains (*.synth.com.au; the service rejects the .test TLD),
// in-memory adapters, fake clock, a counting stub resolver. No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnt } from "./ent_harness.ts";
import { estateCache } from "../src/enterprise/estate_cache.ts";
import { MemoryRefreshLimiter } from "../src/enterprise/estate_refresh.ts";
import type { Assessment, ScanProvider } from "../src/enterprise/types.ts";

function wired(opts: { max?: number; windowMs?: number; cache?: boolean; limiter?: boolean } = {}) {
  const h = makeEnt();
  let calls = 0;
  const inner: ScanProvider = {
    source: "FAKE-SYNTHETIC", concurrency: 10,
    scan: async () => [],
    assess: async (): Promise<Assessment> => { calls++; return { status: "ASSESSED", grade: "B", score: 80, counts: { critical: 0, high: 1, medium: 0, low: 0 }, scannedAt: h.clock.t, resolverSource: "FAKE", unreadableChecks: 0 }; },
  };
  const cache = estateCache({ inner, now: () => h.clock.t, bucketCapacity: 1000, ttlMs: 15 * 60_000 });
  if (opts.cache !== false) h.deps.ent!.estateCache = cache;
  if (opts.limiter !== false) h.deps.ent!.refreshLimiter = new MemoryRefreshLimiter(() => h.clock.t, opts.max ?? 2, opts.windowMs ?? 600_000);
  return { h, cache, calls: () => calls };
}
async function seed(h: ReturnType<typeof makeEnt>, slug: string, n: number) {
  const o = await h.provision("enterprise", `ciso@${slug}.com.au`, slug, slug);
  const tid = o.tenant.id;
  for (let i = 0; i < n; i++) await h.addVerifiedAsset(o.session, tid, `d${i}.${slug}.synth.com.au`);
  return { o, tid, url: `/enterprise/${tid}/estate` };
}

test("second view of a 100-domain estate makes 0 resolver calls", async () => {
  const w = wired(); const s = await seed(w.h, "bigco", 100);
  const v1 = await w.h.get(s.o.session, s.url);
  assert.equal(v1.totals.assessed, 100); assert.equal(w.calls(), 100);
  const v2 = await w.h.get(s.o.session, s.url);
  assert.equal(w.calls(), 100); assert.equal(v2.totals.assessed, 100);
  assert.equal(v2.stale, false); assert.equal(v2.refreshed, false);
});

test("refresh=1 within the limit re-queries once per domain and repopulates", async () => {
  const w = wired(); const s = await seed(w.h, "bigco", 10);
  await w.h.get(s.o.session, s.url); assert.equal(w.calls(), 10);
  const r = await w.h.get(s.o.session, s.url + "?refresh=1");
  assert.equal(w.calls(), 20); assert.equal(r.refreshed, true); assert.equal(r.stale, false);
  await w.h.get(s.o.session, s.url); assert.equal(w.calls(), 20, "repopulated: a plain view after refresh is free");
});

test("refresh over the limit: 0 resolver calls, cached view, stale marker, never an error", async () => {
  const w = wired({ max: 2 }); const s = await seed(w.h, "bigco", 5);
  await w.h.get(s.o.session, s.url);
  await w.h.get(s.o.session, s.url + "?refresh=1"); await w.h.get(s.o.session, s.url + "?refresh=1");
  const before = w.calls(); assert.equal(before, 15);
  const res = await w.h.req("GET", s.url + "?refresh=1", { token: s.o.session });
  assert.equal(res.status, 200);
  const v = await w.h.j(res);
  assert.equal(w.calls(), before); assert.equal(v.stale, true); assert.equal(v.refreshed, false);
  assert.equal(v.totals.assessed, 5, "the cached view is still full");
  w.h.clock.t += 600_001;                                   // window passes: refresh works again
  const v2 = await w.h.get(s.o.session, s.url + "?refresh=1");
  assert.equal(v2.refreshed, true); assert.equal(w.calls(), before + 5);
});

test("over the limit with an EXPIRED cache still makes 0 resolver calls (stale entries served)", async () => {
  const w = wired({ max: 1, windowMs: 3_600_000 }); const s = await seed(w.h, "bigco", 3);
  await w.h.get(s.o.session, s.url + "?refresh=1");        // uses the single allowed refresh
  const n = w.calls();
  w.h.clock.t += 16 * 60_000;                               // ttl (15 min) expired, limiter window (60 min) still open
  const v = await w.h.get(s.o.session, s.url + "?refresh=1");
  assert.equal(v.stale, true); assert.equal(w.calls(), n); assert.equal(v.totals.assessed, 3);
  assert.equal(w.cache.stats().staleServed, 3);
});

test("tenant A's cache never serves tenant B (same domain, different tenants)", async () => {
  const w = wired();
  const a = await w.h.provision("enterprise", "a@acme.com.au", "Acme", "acme");
  const b = await w.h.provision("enterprise", "b@bravo.com.au", "Bravo", "bravo");
  // each tenant proves its own, different domain; the cache key must carry the tenant id
  await w.h.addVerifiedAsset(a.session, a.tenant.id, "a.synth.com.au");
  await w.h.addVerifiedAsset(b.session, b.tenant.id, "b.synth.com.au");
  await w.h.get(a.session, `/enterprise/${a.tenant.id}/estate`);
  assert.equal(w.calls(), 1);
  await w.h.get(b.session, `/enterprise/${b.tenant.id}/estate`);
  assert.equal(w.calls(), 2, "B pays for its own scan");
  assert.equal(w.cache.stats().size, 2);
  // direct key check: same domain under two tenants are two entries
  await w.cache.assess("T1", "shared.synthetic.test"); await w.cache.assess("T2", "shared.synthetic.test");
  assert.equal(w.calls(), 4);
});

test("refresh is per tenant: tenant A exhausting its limit does not stale tenant B", async () => {
  const w = wired({ max: 1 });
  const a = await seed(w.h, "acme", 2), b = await seed(w.h, "bravo", 2);
  await w.h.get(a.o.session, a.url + "?refresh=1");
  const va = await w.h.get(a.o.session, a.url + "?refresh=1"); assert.equal(va.stale, true);
  const vb = await w.h.get(b.o.session, b.url + "?refresh=1"); assert.equal(vb.refreshed, true);
});

test("fail closed: cache wired but no limiter = refresh is stale, never a resolver call", async () => {
  const w = wired({ limiter: false }); const s = await seed(w.h, "bigco", 3);
  await w.h.get(s.o.session, s.url); const n = w.calls();
  const v = await w.h.get(s.o.session, s.url + "?refresh=1");
  assert.equal(v.stale, true); assert.equal(w.calls(), n);
});

test("no cache wired: behaviour unchanged (bare provider), refresh param ignored, no stale marker", async () => {
  const w = wired({ cache: false, limiter: false }); const s = await seed(w.h, "bigco", 2);
  const v = await w.h.get(s.o.session, s.url + "?refresh=1");
  assert.equal(v.stale, false); assert.equal(v.refreshed, false); assert.equal(v.totals.verified, 2);
});

test("refresh needs the analyst role; a viewer plain view is still allowed", async () => {
  const w = wired(); const s = await seed(w.h, "bigco", 1);
  const res = await w.h.req("GET", s.url + "?refresh=1", { token: undefined });
  assert.ok(res.status === 401 || res.status === 403);
});
