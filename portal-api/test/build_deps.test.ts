// f208: buildDeps(env) + the default Worker entry on a FakeD1 (node:sqlite). SYNTHETIC data only, nothing live.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FakeD1 } from "./fake_d1.ts";
import { MemoryStore } from "../src/store.ts";
import { MockBilling, StripeHttpBilling } from "../src/stripe.ts";
import { sha256Hex } from "../src/util.ts";
import worker, { createWorker } from "../src/index.ts";
import { MockMailer } from "../src/service.ts";
import { D1Store } from "../src/d1store.ts";

const SRC = fileURLToPath(new URL("../src/build_deps.ts", import.meta.url));
const MOD = process.env.BUILD_DEPS_SRC ?? SRC;
const { buildDeps, BuildDepsError, billingFor, throttleFor, noStoreFactory } = (await import(MOD)) as typeof import("../src/build_deps.ts");
const ORIGIN = "https://titanos.tech";
const factory = () => new MemoryStore();
const env = (extra: Record<string, unknown> = {}) => ({ DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, ...extra });
const get = (w: { fetch(r: Request, e: any): Promise<Response> }, path: string, e: any, token?: string, method = "GET") =>
  w.fetch(new Request("https://api.test" + path, { method, headers: token ? { authorization: `Bearer ${token}` } : {} }), e);

test("missing DB binding: typed error naming DB", () => {
  assert.throws(() => buildDeps({ TITANOS_SITE_ORIGIN: ORIGIN }, { storeFactory: factory }), (e: any) => e instanceof BuildDepsError && e.reason === "missing_binding" && e.binding === "DB");
});
test("missing TITANOS_SITE_ORIGIN: typed error naming it", () => {
  assert.throws(() => buildDeps({ DB: new FakeD1() as never }, { storeFactory: factory }), (e: any) => e.reason === "missing_binding" && e.binding === "TITANOS_SITE_ORIGIN");
});
test("explicit noStoreFactory still refuses with the named reason; the DEFAULT factory is D1Store (f216), never a Memory store", () => {
  assert.throws(() => buildDeps(env(), { storeFactory: noStoreFactory }), (e: any) => e.reason === "store_adapter_unavailable");
  assert.ok(buildDeps(env()).store instanceof D1Store);
});
test("billing: fake by default, test key gives Stripe HTTP, live key refused", () => {
  assert.ok(billingFor({}) instanceof MockBilling);
  assert.ok(billingFor({ STRIPE_SECRET_KEY: "sk_test_FAKEFAKE" }) instanceof StripeHttpBilling);
  assert.throws(() => billingFor({ STRIPE_SECRET_KEY: "sk_live_FAKEFAKE" }), (e: any) => e.reason === "live_key_refused");
  assert.throws(() => billingFor({ STRIPE_SECRET_KEY: "sk_test_FAKEFAKE", STRIPE_MODE: "live" }), (e: any) => e.reason === "live_key_refused");
});
test("buildDeps assembles Deps from a present binding", () => {
  const d = buildDeps(env({ STRIPE_WEBHOOK_SECRET: "whsec_x" }), { storeFactory: factory });
  assert.ok(d.store && d.billing instanceof MockBilling && d.dns && d.mailer);
  assert.equal(d.siteOrigin, ORIGIN); assert.equal(d.webhookSecret, "whsec_x");
});
test("throttleFor: one Throttle per DB binding, none without", () => {
  const e = env(); assert.equal(throttleFor({}), undefined);
  assert.equal(throttleFor(e), throttleFor(e));
});

test("entry, no DB: /health 200 (db unconfigured), other routes 503 with the named reason", async () => {
  const w = createWorker({ buildDeps: (e) => buildDeps(e, { storeFactory: factory }) });
  const h = await get(w, "/health", {}); assert.equal(h.status, 200);
  const r = await get(w, "/me", { TITANOS_SITE_ORIGIN: ORIGIN }); assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "deps_unavailable", reason: "missing_binding:DB" });
  assert.equal((await get(w, "/me", {}, undefined, "OPTIONS")).status, 204);
});
test("DEFAULT export with a DB: served by D1Store (f216); without a DB: 503 named reason, /health still ok", async () => {
  const e = env();
  assert.equal((await get(worker, "/health", e)).status, 200);
  assert.equal((await get(worker, "/catalogue", e)).status, 200);
  const r = await get(worker, "/catalogue", { TITANOS_SITE_ORIGIN: ORIGIN }); assert.equal(r.status, 503);
  assert.equal(((await r.json()) as any).reason, "missing_binding:DB");
});
test("present binding: /health 200 plus one signed-in route end to end (D1 throttle wired)", async () => {
  const now = 1_800_000_000_000, logs: string[] = [], store = new MemoryStore(), e = env();
  await store.putAccount({ id: "acc_1", email: "owner@example-co.com", seat: "owner", createdAt: now });
  await store.putSession({ hash: await sha256Hex("ss_abc"), accountId: "acc_1", expiresAt: now + 3_600_000 });
  const w = createWorker({ buildDeps: (x) => buildDeps(x, { storeFactory: () => store, now: () => now, mailer: new MockMailer() }), makeThrottle: (x) => throttleFor(x, () => now, (l) => logs.push(l)), log: (l) => logs.push(l) });
  assert.equal((await get(w, "/health", e)).status, 200);
  const me = await get(w, "/me", e, "ss_abc"); assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { id: "acc_1", email: "owner@example-co.com", seat: "owner" });
  assert.equal((await get(w, "/me", e)).status, 401);
  // the D1 throttle really is the shared one: 5 bad verifies hit throttle_state, the 6th is 429
  const bad = () => w.fetch(new Request("https://api.test/auth/verify", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.7" }, body: JSON.stringify({ token: "ll_bad" }) }), e);
  for (let i = 0; i < 5; i++) assert.equal((await bad()).status, 401);
  assert.equal((await bad()).status, 429);
  const rows = (e.DB as FakeD1).db.prepare("SELECT COUNT(*) AS n FROM throttle_state").get() as { n: number };
  assert.ok(rows.n >= 1);
});
test("no secret value is logged or returned", async () => {
  const SECRETS = ["sk_test_SECRETVALUE123", "whsec_SECRETVALUE456", "internal_SECRETVALUE789"], logs: string[] = [];
  const noDb = { STRIPE_SECRET_KEY: SECRETS[0], STRIPE_WEBHOOK_SECRET: SECRETS[1], INTERNAL_API_SECRET: SECRETS[2] };
  const w = createWorker({ buildDeps: (x) => buildDeps(x, { storeFactory: factory }), log: (l) => logs.push(l) });
  const bodies = [await (await get(w, "/me", noDb)).text(), await (await get(w, "/health", noDb)).text()];
  const live = await get(createWorker({ buildDeps: (x) => buildDeps(x, { storeFactory: factory }), log: (l) => logs.push(l) }), "/me", { ...env(), ...noDb, STRIPE_SECRET_KEY: "sk_live_SECRETVALUE000" });
  bodies.push(await live.text());
  assert.equal(live.status, 503);
  const all = logs.join("\n") + bodies.join("\n");
  for (const s of [...SECRETS, "sk_live_SECRETVALUE000"]) assert.ok(!all.includes(s), "leaked " + s);
  assert.ok(logs.length >= 2);
});

// MUTATION: removing the missing-binding check must be caught by this suite (run in a child with the mutated copy).
test("mutation: dropping the DB binding check is caught", { skip: process.env.BUILD_DEPS_SRC ? "inside mutant child" : false }, () => {
  const src = readFileSync(SRC, "utf8");
  const muts: [string, string][] = [
    ['if (!db) throw new BuildDepsError("missing_binding", "DB");', ""],
    ['if (!siteOrigin) throw new BuildDepsError("missing_binding", "TITANOS_SITE_ORIGIN");', ""],
    ['throw new BuildDepsError("live_key_refused");\n  if (k.startsWith("sk_test_")', 'void 0;\n  if (k.startsWith("sk_test_")'],
  ];
  for (const [from, to] of muts) {
    assert.ok(src.includes(from), "mutation anchor missing: " + from);
    const mp = fileURLToPath(new URL("../src/build_deps_mutant.ts", import.meta.url));
    writeFileSync(mp, src.replace(from, to));
    try {
      const env2 = { ...process.env }; delete env2.NODE_TEST_CONTEXT; env2.BUILD_DEPS_SRC = mp;
      const r = spawnSync(process.execPath, ["--experimental-strip-types", "--test", fileURLToPath(import.meta.url)], { env: env2, encoding: "utf8" });
      assert.notEqual(r.status, 0, "mutant survived: " + from);
    } finally { rmSync(mp, { force: true }); }
  }
});
