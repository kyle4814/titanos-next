// f205: the Worker ENTRY (createWorker) constructs ONE Throttle and injects it into Deps; tests go through the entry's fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { make } from "./harness.ts";

const SRC = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const MOD = process.env.WORKER_SRC ?? SRC;
const { createWorker, THROTTLE_LIMITS } = (await import(MOD)) as typeof import("../src/index.ts");
const { Throttle } = (await import("../src/throttle.ts")) as typeof import("../src/throttle.ts");
const N = THROTTLE_LIMITS.maxFailures, LOCK = THROTTLE_LIMITS.lockoutMs;
const ENV = { TITANOS_SITE_ORIGIN: "https://titanos.tech" } as any;

function rig(extra: { throttle?: any; log?: (l: string) => void } = {}) {
  const h = make(); const logs: string[] = [];
  const w = createWorker({ buildDeps: () => h.deps, now: () => h.clock.t, log: (l) => logs.push(l), ...extra });
  const call = (method: string, path: string, o: { token?: string; body?: unknown; ip?: string | null } = {}) =>
    w.fetch(new Request("https://api.test" + path, { method, headers: { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.ip === null ? {} : { "cf-connecting-ip": o.ip ?? "203.0.113.9" }) }, body: o.body === undefined ? undefined : JSON.stringify(o.body) }), ENV);
  return { h, w, call, logs };
}
const bad = (call: any, ip?: string | null) => call("POST", "/auth/verify", { body: { token: "ll_bad" }, ip });

test("login verify: N failures 401, N+1th is 429 with Retry-After, other IP isolated", async () => {
  const { call } = rig();
  for (let i = 0; i < N; i++) assert.equal((await bad(call)).status, 401);
  const r = await bad(call); assert.equal(r.status, 429); assert.equal(r.headers.get("retry-after"), String(LOCK / 1000));
  assert.equal((await bad(call, "203.0.113.10")).status, 401);
});
test("DNS-TXT verify: N+1th is 429 with Retry-After; success after lockout resets", async () => {
  const { h, call } = rig(); const { session } = await h.login("owner@example-co.com");
  const dom = await h.j(await h.req("POST", "/domains", { token: session, body: { domain: "example-co.com" } }));
  for (let i = 0; i < N; i++) assert.equal((await call("POST", `/domains/${dom.id}/verify`, { token: session })).status, 422);
  const r = await call("POST", `/domains/${dom.id}/verify`, { token: session });
  assert.equal(r.status, 429); assert.ok(Number(r.headers.get("retry-after")) > 0);
  h.clock.t += LOCK + 1; h.dns.zone[dom.record.name] = [dom.record.value];
  assert.equal((await call("POST", `/domains/${dom.id}/verify`, { token: session })).status, 200);
  for (let i = 0; i < N - 1; i++) assert.equal((await call("POST", `/domains/${dom.id}/verify`, { token: session })).status, 200);   // reset: budget is fresh
});
test("checkout start: N+1th is 429 with Retry-After", async () => {
  const { h, call } = rig(); const { session } = await h.login("buyer@example-co.com");
  for (let i = 0; i < N; i++) assert.ok((await call("POST", "/checkout", { token: session, body: { product: "nope" } })).status >= 400);
  const r = await call("POST", "/checkout", { token: session, body: { product: "nope" } });
  assert.equal(r.status, 429); assert.ok(Number(r.headers.get("retry-after")) > 0);
});
test("success resets the counter on login verify", async () => {
  const { h, call } = rig();
  for (let i = 0; i < N - 1; i++) await bad(call);
  await h.req("POST", "/auth/request", { body: { email: "ok@example-co.com" } });
  const tok = h.mailer.outbox.at(-1)!.text.match(/token=(ll_[0-9a-f]+)/)![1];
  assert.equal((await call("POST", "/auth/verify", { body: { token: tok } })).status, 200);
  for (let i = 0; i < N; i++) assert.equal((await bad(call)).status, 401);   // full budget again
});
test("missing CF-Connecting-IP: keyed safely into one shared bucket; X-Forwarded-For is ignored", async () => {
  const { call, w } = rig();
  for (let i = 0; i < N; i++) assert.equal((await bad(call, null)).status, 401);
  assert.equal((await bad(call, null)).status, 429);                                   // header-less cannot dodge by omission
  // spoofed X-Forwarded-For does not buy a fresh bucket
  const sp = await w.fetch(new Request("https://api.test/auth/verify", { method: "POST", headers: { "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify({ token: "ll_bad" }) }), ENV);
  assert.equal(sp.status, 429);
  // a real CF IP is a separate bucket; whitespace-only header counts as missing
  assert.equal((await bad(call, "203.0.113.50")).status, 401);
  const ws = await w.fetch(new Request("https://api.test/auth/verify", { method: "POST", headers: { "cf-connecting-ip": "   " }, body: JSON.stringify({ token: "ll_bad" }) }), ENV);
  assert.equal(ws.status, 429);
});
test("raw email and IP never appear in logs", async () => {
  const { h, call, logs } = rig(); const ip = "198.51.100.77", email = "secret.person@example-co.com";
  const { session } = await h.login(email);
  for (let i = 0; i < N + 1; i++) { await bad(call, ip); await call("POST", "/checkout", { token: session, body: { product: "nope" }, ip }); }
  assert.ok(logs.length > 0, "throttle must have logged");
  const all = logs.join("\n"); assert.ok(!all.includes(ip) && !all.includes(email) && !all.includes("secret.person"), all);
});
test("fail closed: a throttle store fault is 503, never an allow-through", async () => {
  const boom = { get() { throw new Error("store down"); }, set() { throw new Error("store down"); }, delete() { throw new Error("store down"); } };
  const h = make();
  const th = new Throttle({ maxFailures: N, windowMs: 1000, lockoutMs: 1000, now: () => h.clock.t }, boom as any);
  const { call, h: hh } = rig({ throttle: th });
  let ran = 0; const orig = hh.deps.store.consumeLoginToken.bind(hh.deps.store); hh.deps.store.consumeLoginToken = async (...a: any[]) => { ran++; return (orig as any)(...a); };
  const r = await bad(call); assert.equal(r.status, 503); assert.equal((await r.json() as any).error, "throttle_unavailable"); assert.equal(ran, 0, "guarded work must not run");
});
test("entry builds ONE throttle shared across requests; no deps still 503", async () => {
  const { call } = rig(); for (let i = 0; i < N; i++) await bad(call);
  assert.equal((await bad(call)).status, 429);          // state persisted across separate fetch calls
  const bare = createWorker();
  assert.equal((await bare.fetch(new Request("https://api.test/auth/verify", { method: "POST", body: "{}" }), ENV)).status, 503);
  assert.equal((await bare.fetch(new Request("https://api.test/health"), ENV)).status, 200);
});

// ---- mutation: wiring removed from any ONE route (or the entry injection) must fail this suite ----
if (!process.env.WORKER_SRC) test("mutation: unwiring any one route or the entry injection is caught", () => {
  const src = readFileSync(SRC, "utf8");
  const off = "((_d: any, _r: any, _s: any, _w: any, f: any) => f())";
  const mutants: [string, string][] = [
    ['await throttled(d, req, "login", ', `await ${off}(d, req, "login", `],
    ['await throttled(d, req, "dnsverify", ', `await ${off}(d, req, "dnsverify", `],
    ['await throttled(d, req, "checkout", ', `await ${off}(d, req, "checkout", `],
    ["{ ...base, throttle }", "base"],
    ['v ? v.slice(0, 64) : "noip"', 'v ? v.slice(0, 64) : String(Math.random())'],
    ['throw new HttpError(503, "throttle_unavailable")', "return fn()"],
  ];
  const f = fileURLToPath(new URL("../src/_mut_index.ts", import.meta.url));
  for (const [from, to] of mutants) {
    assert.ok(src.includes(from), "mutation anchor missing: " + from);
    writeFileSync(f, src.replace(from, to));
    try {
      const r = spawnSync(process.execPath, ["--test", "--experimental-strip-types", fileURLToPath(import.meta.url)], { env: { ...process.env, NODE_TEST_CONTEXT: undefined, WORKER_SRC: f }, encoding: "utf8" });
      assert.notEqual(r.status, 0, "mutant SURVIVED: " + from);
    } finally { rmSync(f, { force: true }); }
  }
});
