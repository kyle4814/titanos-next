import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { make } from "./harness.ts";

const SRC = fileURLToPath(new URL("../src/throttle.ts", import.meta.url));
const MOD = process.env.THROTTLE_SRC ?? SRC;
const { Throttle, MemoryThrottleStore, ThrottledError, throttleKey } = (await import(MOD)) as typeof import("../src/throttle.ts");

const N = 3, WIN = 60_000, LOCK = 120_000;
function rig(max = 1000) {
  const c = { t: 1_000_000 }, logs: string[] = [];
  const store = new MemoryThrottleStore(max);
  const th = new Throttle({ maxFailures: N, windowMs: WIN, lockoutMs: LOCK, now: () => c.t, log: (l) => logs.push(l) }, store);
  return { c, th, store, logs };
}
const fail = async () => { throw new Error("bad"); };
const run = (th: any, k: string, f: () => Promise<any> = fail) => th.guard(k, f).then(() => "ok", (e: any) => (e instanceof ThrottledError ? e : "fail"));

test("boundary: N failures run, call N+1 is blocked before running", async () => {
  const { th } = rig(); let ran = 0;
  for (let i = 0; i < N; i++) assert.equal(await run(th, "k", async () => { ran++; throw new Error("x"); }), "fail");
  const r = await run(th, "k", async () => { ran++; return 1; });
  assert.ok(r instanceof ThrottledError); assert.equal(ran, N);
  // N-1 failures stay open
  const b = rig(); for (let i = 0; i < N - 1; i++) await run(b.th, "k");
  assert.equal(await run(b.th, "k", async () => 1), "ok");
});
test("Retry-After arithmetic: lockout seconds, rounded up, counts down", async () => {
  const { th, c } = rig(); for (let i = 0; i < N; i++) await run(th, "k");
  let e = await run(th, "k"); assert.equal(e.retryAfterSec, 120);
  c.t += 500; e = await run(th, "k"); assert.equal(e.retryAfterSec, 120);        // 119.5s -> ceil 120
  c.t += 1000; e = await run(th, "k"); assert.equal(e.retryAfterSec, 119);       // 118.5s -> 119
  c.t += LOCK; assert.equal(await run(th, "k", async () => 1), "ok");            // lock expired
});
test("window rollover: failures older than the window are forgotten", async () => {
  const { th, c } = rig(); for (let i = 0; i < N - 1; i++) await run(th, "k");
  c.t += WIN - 1; await run(th, "k");                                            // still same window: Nth failure locks
  assert.ok((await run(th, "k")) instanceof ThrottledError);
  const o = rig(); for (let i = 0; i < N - 1; i++) await run(o.th, "k");
  o.c.t += WIN; await run(o.th, "k"); await run(o.th, "k");                      // fresh window: 2 failures, not locked
  assert.equal(await run(o.th, "k", async () => 1), "ok");
});
test("lockout shorter than window: still blocked to window end, Retry-After from the window", async () => {
  const c = { t: 5_000_000 };
  const th = new Throttle({ maxFailures: N, windowMs: WIN, lockoutMs: 10_000, now: () => c.t });
  for (let i = 0; i < N; i++) await run(th, "k");
  c.t += 20_000;                                                                  // lock over, window (60s) not
  const e = await run(th, "k"); assert.ok(e instanceof ThrottledError); assert.equal(e.retryAfterSec, 40);
  c.t += 40_000; assert.equal(await run(th, "k", async () => 1), "ok");
});
test("per-key isolation", async () => {
  const { th } = rig(); for (let i = 0; i < N; i++) await run(th, "a");
  assert.ok((await run(th, "a")) instanceof ThrottledError);
  assert.equal(await run(th, "b", async () => 1), "ok");
});
test("success resets the key", async () => {
  const { th } = rig(); for (let i = 0; i < N - 1; i++) await run(th, "k");
  assert.equal(await run(th, "k", async () => 1), "ok");
  for (let i = 0; i < N; i++) assert.equal(await run(th, "k"), "fail");           // a full fresh N allowed
  assert.ok((await run(th, "k")) instanceof ThrottledError);
});
test("isFailure result counts as a failure", async () => {
  const { th } = rig(); for (let i = 0; i < N; i++) await th.guard("k", async () => ({ verified: false }), (r: any) => !r.verified);
  await assert.rejects(th.guard("k", async () => ({ verified: true }), (r: any) => !r.verified), ThrottledError);
});
test("memory bound: 1000-key cap evicts oldest", async () => {
  const { th, store } = rig(1000);
  for (let i = 0; i < 1500; i++) await run(th, "k" + i);
  assert.equal(store.size, 1000);
  assert.equal(store.get("k0"), undefined); assert.equal(store.get("k499"), undefined);
  assert.ok(store.get("k500")); assert.ok(store.get("k1499"));
});
test("concurrent calls cannot exceed N", async () => {
  const { th } = rig(); let ran = 0;
  const res = await Promise.all(Array.from({ length: 50 }, () => run(th, "k", async () => { ran++; await new Promise((r) => setTimeout(r, 5)); throw new Error("x"); })));
  assert.equal(ran, N); assert.equal(res.filter((r) => r instanceof ThrottledError).length, 50 - N);
});
test("keys and logs never carry the raw email or IP", async () => {
  const { th, store, logs } = rig();
  const k = await throttleKey("login", "Victim@Example.com", "203.0.113.9");
  for (let i = 0; i < N + 1; i++) await run(th, k);
  const blob = k + logs.join("\n") + JSON.stringify([...(store as any).m.keys()]);
  assert.ok(!/victim|example\.com|203\.0\.113/i.test(blob)); assert.ok(logs.length > 0);
  assert.equal(k, await throttleKey("login", " victim@example.com ", "203.0.113.9"));   // normalised
  assert.notEqual(k, await throttleKey("login", "victim@example.com", "203.0.113.10"));
});

// ---- route wiring (login verify, DNS-TXT verify, checkout start) ----
test("routes: login verify, DNS verify, checkout-start return 429 + Retry-After after N failures; success resets", async () => {
  const h = make(); const th = new Throttle({ maxFailures: N, windowMs: WIN, lockoutMs: LOCK, now: () => h.clock.t }); h.deps.throttle = th;
  const ipH = { "cf-connecting-ip": "198.51.100.7" };
  // login: bad tokens from one IP
  for (let i = 0; i < N; i++) assert.equal((await h.req("POST", "/auth/verify", { body: { token: "ll_bad" }, headers: ipH })).status, 401);
  const blocked = await h.req("POST", "/auth/verify", { body: { token: "ll_bad" }, headers: ipH });
  assert.equal(blocked.status, 429); assert.equal(blocked.headers.get("retry-after"), "120");
  assert.equal((await h.req("POST", "/auth/verify", { body: { token: "ll_bad" }, headers: { "cf-connecting-ip": "198.51.100.8" } })).status, 401);   // other IP isolated
  // a real login from a fresh IP still works and resets
  const { session } = await h.login("owner@example-co.com");
  const dom = await h.j(await h.req("POST", "/domains", { token: session, body: { domain: "example-co.com" } }));
  const th2 = { token: session, headers: ipH };
  for (let i = 0; i < N; i++) assert.equal((await h.req("POST", `/domains/${dom.id}/verify`, th2)).status, 422);
  const dv = await h.req("POST", `/domains/${dom.id}/verify`, th2);
  assert.equal(dv.status, 429); assert.ok(Number(dv.headers.get("retry-after")) > 0);
  // checkout-start: unknown product fails
  for (let i = 0; i < N; i++) assert.ok((await h.req("POST", "/checkout", { token: session, headers: ipH, body: { product: "nope" } })).status >= 400);
  assert.equal((await h.req("POST", "/checkout", { token: session, headers: ipH, body: { product: "nope" } })).status, 429);
  // lock expires, DNS published: success then resets
  h.clock.t += LOCK + 1000; h.dns.zone[dom.record.name] = [dom.record.value];
  assert.equal((await h.req("POST", `/domains/${dom.id}/verify`, th2)).status, 200);
});
test("routes: no throttle injected means behaviour is unchanged", async () => {
  const h = make();
  for (let i = 0; i < N + 3; i++) assert.equal((await h.req("POST", "/auth/verify", { body: { token: "ll_bad" } })).status, 401);
});

// ---- mutation test: an off-by-one in the counter must fail this suite ----
if (!process.env.THROTTLE_SRC) test("mutation: off-by-one in the counter is caught", () => {
  const src = readFileSync(SRC, "utf8");
  const mutants: [string, string][] = [
    ["s.count >= this.cfg.maxFailures) return { allowed: false", "s.count > this.cfg.maxFailures) return { allowed: false"],
    ["s.count += 1;", "s.count += 2;"],
    ["if (s.count >= this.cfg.maxFailures) s.lockedUntil", "if (s.count > this.cfg.maxFailures) s.lockedUntil"],
  ];
  for (const [from, to] of mutants) {
    assert.ok(src.includes(from), "mutation anchor missing: " + from);
    const f = fileURLToPath(new URL("../src/_mut_throttle.ts", import.meta.url));
    writeFileSync(f, src.replace(from, to));
    try {
      const r = spawnSync(process.execPath, ["--test", "--experimental-strip-types", "--test-name-pattern=^(boundary|Retry-After|lockout shorter|concurrent|success resets|window rollover)", fileURLToPath(import.meta.url)], { env: { ...process.env, NODE_TEST_CONTEXT: undefined, THROTTLE_SRC: f }, encoding: "utf8" });
      assert.notEqual(r.status, 0, "mutant survived: " + to);
    } finally { rmSync(f, { force: true }); }
  }
});
