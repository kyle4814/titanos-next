// C8 f321: KV-backed estate cache + refresh limiter. FAKE KV, FAKE CLOCK, STUB SCANNER. All data SYNTHETIC. No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { kvEstateCache, KvRefreshLimiter, estateAdapters, validTenant, type KVPort } from "../src/enterprise/estate_kv.ts";
import { MemoryRefreshLimiter } from "../src/enterprise/estate_refresh.ts";
import type { Assessment, ScanProvider } from "../src/enterprise/types.ts";

class FakeKV implements KVPort {
  m = new Map<string, { v: string; exp: number }>(); ignoreTtl = false; failGet = false; failPut = false; puts: { key: string; ttl?: number }[] = [];
  clock: { t: number };
  constructor(clock: { t: number }) { this.clock = clock; }
  async get(k: string) { if (this.failGet) throw new Error("kv down"); const e = this.m.get(k); if (!e) return null; if (this.clock.t >= e.exp) { this.m.delete(k); return null; } return e.v; }
  async put(k: string, v: string, o?: { expirationTtl?: number }) { if (this.failPut) throw new Error("kv down"); this.puts.push({ key: k, ttl: o?.expirationTtl }); this.m.set(k, { v, exp: o?.expirationTtl && !this.ignoreTtl ? this.clock.t + o.expirationTtl * 1000 : Infinity }); }
}
const assessed = (tag: string): Assessment => ({ status: "ASSESSED", grade: "B", score: 80, counts: { critical: 0, high: 1, medium: 2, low: 3 }, scannedAt: 1, resolverSource: "FAKE:" + tag, unreadableChecks: 0 });
function mk(opts: Record<string, unknown> = {}, delayMs = 0) {
  const clock = { t: 1_000_000 }; let scans = 0;
  const inner: ScanProvider = { source: "FAKE", scan: async () => [], assess: async (d) => { scans++; if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); return assessed(d); } };
  const kv = new FakeKV(clock);
  const c = kvEstateCache({ kv, inner, now: () => clock.t, ...opts });
  return { clock, kv, inner, c, scans: () => scans };
}
const fresh = (kv: KVPort, clock: { t: number }, inner: ScanProvider, opts: Record<string, unknown> = {}) => kvEstateCache({ kv, inner, now: () => clock.t, ...opts });

test("hit: second call served from KV with no scan; a second isolate sharing the KV also hits", async () => {
  const m = mk();
  const a = await m.c.assess("T1", "a.synthetic.test"); assert.equal(m.scans(), 1);
  const b = await m.c.assess("T1", "A.Synthetic.Test ");
  assert.deepEqual(b, a); assert.equal(m.scans(), 1);
  const other = fresh(m.kv, m.clock, m.inner);   // new isolate, empty memory, same KV
  assert.deepEqual(await other.assess("T1", "a.synthetic.test"), a); assert.equal(m.scans(), 1);
});

test("isolation: 1000 randomised keys, tenant A never reads tenant B, delimiter-injection ids are refused", async () => {
  const m = mk({ bucketCapacity: 100000 });
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const tenants = ["tenA", "tenB", "ten_C-1"], doms = Array.from({ length: 20 }, (_, i) => `d${i}.synthetic.test`);
  for (let i = 0; i < 1000; i++) {
    const t = tenants[Math.floor(rnd() * 3)], d = doms[Math.floor(rnd() * 20)];
    const a = await m.c.assess(t, d);
    assert.equal(a.status === "ASSESSED" && a.resolverSource, "FAKE:" + d);
  }
  // every stored value belongs to the tenant named in its key
  for (const [k, e] of m.kv.m) { const v = JSON.parse(e.v); assert.equal(k.split(":")[2], v.t); }
  // per-tenant scan count == distinct (tenant,domain) pairs touched: nothing leaked across tenants
  const pairs = new Set([...m.kv.m.keys()]).size; assert.equal(m.scans(), pairs);
  const before = m.scans();
  for (const evil of ["tenA:x", "tenA\u0000", "tenA:..", "a:b:c", "../tenB", "tenA ", "", "x".repeat(65), "tenA/../tenB", "ten\nB"]) {
    assert.equal(validTenant(evil), false);
    const a = await m.c.assess(evil, doms[0]); assert.equal(a.status, "UNKNOWN");
  }
  assert.equal(m.scans(), before);   // refused ids never scan and never touch KV
});

test("foreign-tenant value planted under tenant A's key is a miss, never served", async () => {
  const m = mk();
  await m.c.assess("tenB", "x.synthetic.test");
  const [kB, eB] = [...m.kv.m.entries()][0];
  const kA = kB.replace(":tenB:", ":tenA:");
  m.kv.m.set(kA, eB);                                  // tenB's value copied under tenA's key
  const n = m.scans();
  const a = await m.c.assess("tenA", "x.synthetic.test");
  assert.equal(m.scans(), n + 1);                      // treated as a miss and re-scanned
  assert.equal(JSON.parse(m.kv.m.get(kA)!.v).t, "tenA");
});

test("TTL: fresh until ttl, then re-scan; stale kept for the grace window and served cacheOnly; KV drops it after grace", async () => {
  const m = mk({ ttlMs: 60_000, staleGraceMs: 120_000 });
  await m.c.assess("T1", "a.synthetic.test");
  m.clock.t += 59_000; await m.c.assess("T1", "a.synthetic.test"); assert.equal(m.scans(), 1);
  m.clock.t += 2_000;                                   // 61 s: logically expired, still in KV
  const s = await m.c.forTenant("T1", { cacheOnly: true }).assess!("a.synthetic.test");
  assert.equal(s.status, "ASSESSED"); assert.equal(m.scans(), 1); assert.equal(m.c.stats().staleServed, 1);
  await m.c.assess("T1", "a.synthetic.test"); assert.equal(m.scans(), 2);
  m.clock.t += 60_000 + 120_000 + 1000;                  // past ttl + grace: KV has expired it
  const gone = await m.c.forTenant("T1", { cacheOnly: true }).assess!("a.synthetic.test");
  assert.equal(gone.status === "UNKNOWN" && gone.reason, "rate_limited");
});

test("KV put carries expirationTtl >= 60 s covering ttl + grace", async () => {
  const m = mk({ ttlMs: 15 * 60_000, staleGraceMs: 3_600_000 });
  await m.c.assess("T1", "a.synthetic.test");
  assert.equal(m.kv.puts.at(-1)!.ttl, 15 * 60 + 3600);
  const u = mk({ unknownTtlMs: 1000, staleGraceMs: 0 });
  (u.inner as any).assess = async () => { throw new Error("x"); };
  await u.c.assess("T1", "z.synthetic.test"); assert.ok(u.kv.puts.at(-1)!.ttl! >= 60);
});

test("corrupt values are misses: garbage, wrong shape, wrong version, bad grade, missing exp", async () => {
  const m = mk(); await m.c.assess("T1", "a.synthetic.test");
  const [k, e] = [...m.kv.m.entries()][0]; const good = JSON.parse(e.v);
  const bad = ["not json", "null", "[]", JSON.stringify({ ...good, v: 2 }), JSON.stringify({ ...good, d: "other" }), JSON.stringify({ ...good, exp: "soon" }),
    JSON.stringify({ ...good, a: { ...good.a, grade: "Z" } }), JSON.stringify({ ...good, a: { status: "ASSESSED" } }), JSON.stringify({ ...good, a: { ...good.a, counts: null } }),
    JSON.stringify({ ...good, a: { status: "UNKNOWN", reason: "weird", scannedAt: 1, resolverSource: "x" } })];
  for (const b of bad) {
    m.kv.m.set(k, { v: b, exp: Infinity }); const n = m.scans();
    await m.c.assess("T1", "a.synthetic.test"); assert.equal(m.scans(), n + 1, "corrupt value must be a miss: " + b.slice(0, 30));
  }
});

test("KV read error fails closed: UNKNOWN, no fresh scan; KV write error still returns the scan", async () => {
  const m = mk(); await m.c.assess("T1", "a.synthetic.test");
  m.kv.failGet = true; const n = m.scans();
  const a = await m.c.assess("T1", "b.synthetic.test"); assert.equal(a.status, "UNKNOWN"); assert.equal(m.scans(), n);
  const r = await m.c.forTenant("T1", { refresh: true }).assess!("a.synthetic.test"); assert.equal(r.status, "UNKNOWN"); assert.equal(m.scans(), n);
  const co = await m.c.forTenant("T1", { cacheOnly: true }).assess!("a.synthetic.test"); assert.equal(co.status, "UNKNOWN"); assert.equal(m.scans(), n);
  m.kv.failGet = false; m.kv.failPut = true;
  const w = await m.c.assess("T1", "c.synthetic.test"); assert.equal(w.status, "ASSESSED");
});

test("refresh over the scan bucket serves stale from KV, else UNKNOWN rate_limited", async () => {
  const m = mk({ bucketCapacity: 1, refillEveryMs: 1_000_000 });
  await m.c.assess("T1", "a.synthetic.test");
  const s = await m.c.forTenant("T1", { refresh: true }).assess!("a.synthetic.test"); assert.equal(s.status, "ASSESSED"); assert.equal(m.scans(), 1);
  const u = await m.c.assess("T1", "new.synthetic.test"); assert.equal(u.status === "UNKNOWN" && u.reason, "rate_limited");
});

test("limiter: window holds across two simulated isolates sharing one KV, resets after the window, tenants independent", async () => {
  const clock = { t: 5_000_000 }, kv = new FakeKV(clock);
  const i1 = new KvRefreshLimiter({ kv, now: () => clock.t, max: 3, windowMs: 600_000 });
  const i2 = new KvRefreshLimiter({ kv, now: () => clock.t, max: 3, windowMs: 600_000 });
  const got: boolean[] = [];
  for (let i = 0; i < 6; i++) got.push(await (i % 2 ? i1 : i2).allow("tenA"));
  assert.deepEqual(got, [true, true, true, false, false, false]);
  assert.equal(await i1.allow("tenB"), true);
  clock.t += 599_000; assert.equal(await i2.allow("tenA"), false);
  clock.t += 2_000; assert.equal(await i2.allow("tenA"), true);
  assert.ok(kv.puts.every((p) => p.ttl! >= 60));
});

test("limiter fails closed: KV error, corrupt, foreign-tenant, bad ids all deny", async () => {
  const clock = { t: 1 }, kv = new FakeKV(clock), l = new KvRefreshLimiter({ kv, now: () => clock.t, max: 2, windowMs: 600_000 });
  assert.equal(await l.allow("tenA"), true);
  const k = [...kv.m.keys()][0]; const good = kv.m.get(k)!.v;
  for (const b of ["junk", "null", JSON.stringify({ v: 1, t: "tenB", count: 0, windowStart: 1 }), JSON.stringify({ v: 1, t: "tenA", count: -5, windowStart: 1 }), JSON.stringify({ v: 1, t: "tenA", count: "0", windowStart: 1 })]) {
    kv.m.set(k, { v: b, exp: Infinity }); assert.equal(await l.allow("tenA"), false, b);
  }
  kv.m.set(k, { v: good, exp: Infinity }); kv.failGet = true; assert.equal(await l.allow("tenA"), false);
  kv.failGet = false; kv.failPut = true; assert.equal(await l.allow("tenC"), false);
  kv.failPut = false;
  for (const evil of ["tenA:x", "", "a b", "x".repeat(65)]) assert.equal(await l.allow(evil), false);
  assert.ok(![...kv.m.keys()].some((x) => x.includes("a b")));
});

test("estateAdapters: ESTATE_KV absent = Memory adapters (unchanged), present = KV adapters", async () => {
  const clock = { t: 1 }; const inner: ScanProvider = { source: "FAKE", scan: async () => [], assess: async () => assessed("x") };
  const mem = estateAdapters({}, { inner, now: () => clock.t });
  assert.equal(mem.backend, "memory"); assert.ok(mem.refreshLimiter instanceof MemoryRefreshLimiter);
  const kv = new FakeKV(clock); const k = estateAdapters({ ESTATE_KV: kv }, { inner, now: () => clock.t });
  assert.equal(k.backend, "kv"); await k.estateCache.assess("T1", "a.synthetic.test"); assert.ok(kv.puts.length >= 1);
  assert.equal(await k.refreshLimiter.allow("T1"), true);
});

test("concurrent identical requests in one isolate share one scan", async () => {
  const m = mk({}, 20); await Promise.all([1, 2, 3, 4].map(() => m.c.assess("T1", "a.synthetic.test")));
  assert.equal(m.scans(), 1);
});

test("limiter window resets on its own clock even when KV TTL eviction is late (KV expiry is lazy)", async () => {
  const clock = { t: 9_000_000 }, kv = new FakeKV(clock); kv.ignoreTtl = true;
  const l = new KvRefreshLimiter({ kv, now: () => clock.t, max: 2, windowMs: 600_000 });
  assert.equal(await l.allow("tenA"), true); assert.equal(await l.allow("tenA"), true); assert.equal(await l.allow("tenA"), false);
  clock.t += 601_000; assert.equal(await l.allow("tenA"), true);
});
