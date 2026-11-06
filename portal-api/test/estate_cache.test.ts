// F34: estate cache + limiter. FAKE RESOLVERS AND FAKE CLOCK ONLY. All domains are SYNTHETIC (*.synthetic.test). No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estateCache } from "../src/enterprise/estate_cache.ts";
import { dnsScan } from "../src/enterprise/estate_dns.ts";
import { FIXTURES, fakeDoh, type World } from "../../lib/guestscan/fixtures.ts";
import type { DohFetch } from "../../lib/guestscan/scan.ts";

const PERFECT = FIXTURES.find((f) => f.id === "perfect")!;
const world = (dom: string): World => JSON.parse(JSON.stringify(PERFECT.world).split("good.example").join(dom));
function mk(opts: Record<string, unknown> = {}, domains: string[] = ["a.synthetic.test"]) {
  let t = 1_000_000, calls = 0, fail = false;
  const worlds = Object.fromEntries(domains.map((d) => [d, world(d)]));
  const resolver: DohFetch = async (name, type) => {
    calls++;
    if (fail) throw new Error("down");
    const dom = Object.keys(worlds).find((d) => name === d || name.endsWith("." + d));
    return dom ? fakeDoh(worlds[dom]).fetch(name, type) : { Status: 0 };
  };
  const inner = dnsScan({ resolver, resolverSource: "FAKE", now: () => t });
  const c = estateCache({ inner, now: () => t, ...opts });
  return { c, clock: { adv: (ms: number) => { t += ms; }, get t() { return t; } }, calls: () => calls, setFail: (v: boolean) => { fail = v; } };
}

test("hit: second call is served from cache with 0 resolver calls", async () => {
  const m = mk();
  const a = await m.c.assess("T1", "a.synthetic.test");
  const n = m.calls();
  assert.ok(n > 0); assert.equal(a.status, "ASSESSED");
  const b = await m.c.assess("T1", "A.Synthetic.Test");
  assert.equal(m.calls(), n); assert.deepEqual(b, a);
  assert.equal(m.c.stats().hits, 1);
});

test("expiry: after ttl a fresh scan runs", async () => {
  const m = mk({ ttlMs: 1000 });
  await m.c.assess("T1", "a.synthetic.test"); const n = m.calls();
  m.clock.adv(999); await m.c.assess("T1", "a.synthetic.test"); assert.equal(m.calls(), n);
  m.clock.adv(2); await m.c.assess("T1", "a.synthetic.test"); assert.ok(m.calls() > n);
});

test("UNKNOWN is cached for the shorter TTL", async () => {
  const m = mk({ ttlMs: 10_000, unknownTtlMs: 100 });
  m.setFail(true);
  const a = await m.c.assess("T1", "a.synthetic.test"); assert.equal(a.status, "UNKNOWN");
  const n = m.calls(); await m.c.assess("T1", "a.synthetic.test"); assert.equal(m.calls(), n);
  m.setFail(false); m.clock.adv(101);
  const b = await m.c.assess("T1", "a.synthetic.test"); assert.equal(b.status, "ASSESSED");
});

test("forced refresh bypasses a fresh entry", async () => {
  const m = mk();
  await m.c.assess("T1", "a.synthetic.test"); const n = m.calls();
  await m.c.assess("T1", "a.synthetic.test", { refresh: true });
  assert.ok(m.calls() > n);
});

test("LRU eviction: max entries respected, least recently used goes first", async () => {
  const doms = ["a", "b", "c"].map((x) => `${x}.synthetic.test`);
  const m = mk({ maxEntries: 2 }, doms);
  await m.c.assess("T1", doms[0]); await m.c.assess("T1", doms[1]);
  await m.c.assess("T1", doms[0]);
  await m.c.assess("T1", doms[2]);
  assert.equal(m.c.stats().size, 2); assert.equal(m.c.stats().evictions, 1);
  let n = m.calls(); await m.c.assess("T1", doms[0]); assert.equal(m.calls(), n);
  n = m.calls(); await m.c.assess("T1", doms[1]); assert.ok(m.calls() > n);
});

test("tenant isolation: tenant A never reads B's entry", async () => {
  const m = mk();
  await m.c.assess("A", "a.synthetic.test"); const n = m.calls();
  await m.c.assess("B", "a.synthetic.test");
  assert.ok(m.calls() > n, "B must scan for itself");
  const n2 = m.calls(); await m.c.assess("A", "a.synthetic.test"); await m.c.assess("B", "a.synthetic.test");
  assert.equal(m.calls(), n2);
  m.c.invalidate("A", "a.synthetic.test"); await m.c.assess("B", "a.synthetic.test"); assert.equal(m.calls(), n2);
});

test("rate limit: over limit with no cache gives UNKNOWN rate_limited, never throws; refill restores", async () => {
  const doms = ["a", "b", "c"].map((x) => `${x}.synthetic.test`);
  const m = mk({ bucketCapacity: 2, refillEveryMs: 1000 }, doms);
  await m.c.assess("T1", doms[0]); await m.c.assess("T1", doms[1]);
  const n = m.calls();
  const r = await m.c.assess("T1", doms[2]);
  assert.deepEqual([r.status, (r as { reason?: string }).reason], ["UNKNOWN", "rate_limited"]);
  assert.equal(m.calls(), n);
  const other = await m.c.assess("T2", doms[2]); assert.equal(other.status, "ASSESSED");
  m.clock.adv(1000);
  assert.equal((await m.c.assess("T1", doms[2])).status, "ASSESSED");
  assert.equal(m.c.stats().rateLimited, 1);
});

test("rate limit: stale cached value is returned instead of UNKNOWN, including on forced refresh", async () => {
  const m = mk({ bucketCapacity: 1, refillEveryMs: 60_000, ttlMs: 10 });
  const a = await m.c.assess("T1", "a.synthetic.test");
  m.clock.adv(50);
  const n = m.calls();
  assert.deepEqual(await m.c.assess("T1", "a.synthetic.test"), a);
  assert.deepEqual(await m.c.assess("T1", "a.synthetic.test", { refresh: true }), a);
  assert.equal(m.calls(), n); assert.equal(m.c.stats().staleServed, 2);
});

test("rate-limited result is not cached (next call after refill scans)", async () => {
  const m = mk({ bucketCapacity: 1, refillEveryMs: 500 }, ["a.synthetic.test", "b.synthetic.test"]);
  await m.c.assess("T1", "a.synthetic.test");
  assert.equal((await m.c.assess("T1", "b.synthetic.test") as { reason?: string }).reason, "rate_limited");
  m.clock.adv(500);
  assert.equal((await m.c.assess("T1", "b.synthetic.test")).status, "ASSESSED");
});

test("resolver throwing inside inner never escapes", async () => {
  const inner = { source: "X", scan: async () => [], assess: async () => { throw new Error("boom"); } };
  const c = estateCache({ inner: inner as never, now: () => 1 });
  const r = await c.assess("T", "x.synthetic.test"); assert.equal(r.status, "UNKNOWN");
});

test("concurrent identical requests share one scan", async () => {
  const m = mk();
  const [x, y] = await Promise.all([m.c.assess("T1", "a.synthetic.test"), m.c.assess("T1", "a.synthetic.test")]);
  assert.deepEqual(x, y); assert.equal(m.c.stats().freshScans, 1);
});

test("100-domain estate viewed twice: second view makes 0 resolver calls", async () => {
  const doms = Array.from({ length: 100 }, (_, i) => `d${i}.synthetic.test`);
  const m = mk({ bucketCapacity: 100 }, doms);
  const view = async () => { const p = m.c.forTenant("BIG"); return Promise.all(doms.map((d) => p.assess!(d))); };
  const first = await view();
  const n1 = m.calls();
  assert.ok(n1 >= 100 * 10, `expected roughly 17 queries per domain, got ${n1}`);
  const second = await view();
  assert.equal(m.calls(), n1, "second view must make 0 resolver calls");
  assert.deepEqual(second, first);
  assert.equal(m.c.stats().freshScans, 100); assert.equal(m.c.stats().hits, 100);
});
