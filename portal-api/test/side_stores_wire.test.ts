// f222: the owner, market and enterprise side stores are D1-backed behind the Worker (sideStoresFactory next to the f216 storeFactory).
// SYNTHETIC data only, nothing live, no secrets read (DB binding only). A restart = a second createWorker() on the SAME FakeD1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeD1 } from "./fake_d1.ts";
import { D1Store } from "../src/d1store.ts";
import { sha256Hex } from "../src/util.ts";
import { createWorker } from "../src/index.ts";
import { buildDeps, d1SideStoresFactory, memorySideStores, memorySideStoresFactory, failClosedSealer, throttleFor, type BuildOpts, type SideStoresFactory } from "../src/build_deps.ts";
import { D1OwnerStore } from "../src/owner/d1ownerstore.ts";
import { D1MarketStore } from "../src/market/d1store.ts";
import { D1EntStore } from "../src/enterprise/d1store.ts";
import { MemoryOwnerStore } from "../src/owner/engine.ts";
import { MemoryMarketStore } from "../src/market/store.ts";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MockPayments } from "../src/market/payments.ts";
import { MockIdp } from "../src/enterprise/sso.ts";
import { SyntheticScan } from "../src/enterprise/estate.ts";
import { RATE_V1 } from "../src/enterprise/share.ts";
import { healthy } from "./owner_harness.ts";
import type { Env } from "../src/env.ts";

const ORIGIN = "https://titanos.tech", DOMAIN = "synthetic-shop.com.au", INTERNAL = "internal_fixture_secret", TOKEN = "ss_5eed00000000000000000000000000ab";
const mk = (db: FakeD1): Env => ({ DB: db as never, TITANOS_SITE_ORIGIN: ORIGIN });
type W = { fetch(r: Request, e: any): Promise<Response> };
const call = (w: W, e: Env, path: string, o: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
  w.fetch(new Request("https://api.test" + path, { method: o.method ?? "GET", headers: { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.body ? { "content-type": "application/json" } : {}), ...(o.headers ?? {}) }, body: o.body ? JSON.stringify(o.body) : undefined }), e);
const jj = async (r: Response) => (await r.json()) as any;

async function seed(db: FakeD1) {   // one signed-in account with one verified domain, written straight into D1
  const s = new D1Store(db);
  await s.putAccount({ id: "acc_synth1", email: "synthetic@example.invalid", seat: "owner", createdAt: 1 });
  await s.putSession({ hash: await sha256Hex(TOKEN), accountId: "acc_synth1", expiresAt: Date.now() + 3_600_000 });
  await s.putDomain({ id: "dom_synth1", accountId: "acc_synth1", domain: DOMAIN, token: "tok_synth", verifiedAt: Date.now() });
}
// A Worker with the side seats switched on (the providers are synthetic mocks; none is a live provider). A fresh zone per Worker = a fresh isolate.
function worker(opts: { sideStoresFactory?: SideStoresFactory } = {}) {
  const zone = new MemoryZone(healthy(DOMAIN));
  zone.world.txt![DOMAIN] = ["v=spf1 include:_spf.google.com ~all"];   // one planted fault: SPF soft-fail
  const o: BuildOpts = {
    ...opts,
    side: {
      owner: { doh: () => zone.doh, zones: { zoneFor: (x) => (x === DOMAIN ? zone : undefined) } },
      market: { payments: new MockPayments(), doh: () => zone.doh, internalSecret: INTERNAL },
      ent: { idp: MockIdp, payouts: { async transfer() { return { ref: "po_1" }; } }, scan: SyntheticScan, rates: RATE_V1, internalSecret: INTERNAL },
    },
  };
  return { w: createWorker({ buildDeps: (env) => buildDeps(env, o), makeThrottle: (env) => throttleFor(env) }), zone };
}

test("the shipped side factory builds the three D1 stores from the DB binding alone", () => {
  const db = new FakeD1() as never, s = d1SideStoresFactory(db, {});
  assert.ok(s.owner instanceof D1OwnerStore && s.market instanceof D1MarketStore && s.ent instanceof D1EntStore);
  assert.equal(s.durable, true);
});
test("no DB handed to the factory: memory stores, labelled non-durable", () => {
  const s = d1SideStoresFactory(undefined, {});
  assert.ok(s.owner instanceof MemoryOwnerStore && s.market instanceof MemoryMarketStore && s.ent instanceof MemoryEntStore);
  assert.equal(s.durable, false); assert.match(s.label, /^non-durable/);
});
test("the SSO sealer fails closed with no key bound (DB binding only, no secret)", async () => {
  await assert.rejects(() => failClosedSealer.seal("x"), /sso_sealer_unavailable/);
  await assert.rejects(() => failClosedSealer.open("x"), /sso_sealer_unavailable/);
});

test("RESTART: owner level change, market listing and enterprise row all survive a second createWorker on the same D1", async () => {
  const db = new FakeD1(); await seed(db);
  const a = worker(), env = mk(db);
  // owner: scan then one-tap fix moves the level 4 -> 9
  const sc = await jj(await call(a.w, env, "/app/domains/dom_synth1/scan", { method: "POST", token: TOKEN }));
  assert.equal(sc.level, 4);
  const fx = await jj(await call(a.w, env, "/app/domains/dom_synth1/fix", { method: "POST", token: TOKEN, body: { check: "SPF" } }));
  assert.equal(fx.result, "proven"); assert.equal(fx.overview.level, 9);
  // market: a pro profile and an owner-hired job (the listing) land in D1
  assert.equal((await call(a.w, env, "/pro/join", { method: "POST", token: TOKEN, body: { acceptTerms: true } })).status, 201);
  a.zone.world.txt![DOMAIN] = ["v=spf1 include:_spf.google.com ~all"];   // re-plant the fault so there is something to hire
  const job = await call(a.w, env, "/market/jobs", { method: "POST", token: TOKEN, body: { domainId: "dom_synth1", check: "SPF" } });
  assert.equal(job.status, 201); const jid = (await jj(job)).job.id as string;
  // enterprise: the operator provisions a seat for the signed-in account
  const tn = await call(a.w, env, "/internal/tenants/provision", { method: "POST", headers: { "x-internal-secret": INTERNAL }, body: { kind: "enterprise", name: "Synthetic Group", slug: "synthetic-group", adminEmail: "synthetic@example.invalid" } });
  assert.equal(tn.status, 201); const tid = (await jj(tn)).id as string; assert.ok(tid);

  // the rows are in D1 itself, not in any Worker object
  assert.equal((db.db.prepare("SELECT COUNT(*) n FROM owner_state").get() as any).n, 1);
  assert.equal((db.db.prepare("SELECT COUNT(*) n FROM market_jobs").get() as any).n, 1);
  assert.equal((db.db.prepare("SELECT COUNT(*) n FROM tenants").get() as any).n, 1);

  const b = worker();   // RESTART: new Worker, new zone, same database
  const ov = await jj(await call(b.w, env, "/app/domains/dom_synth1", { token: TOKEN }));
  assert.equal(ov.level, 9, "owner level survived the restart");
  assert.equal(ov.badge.level, 9);
  const mine = await jj(await call(b.w, env, "/market/jobs", { token: TOKEN }));
  assert.equal(mine.asOwner.length, 1); assert.equal(mine.asOwner[0].id, jid);
  const ent = await jj(await call(b.w, env, `/enterprise/${tid}`, { token: TOKEN }));
  assert.equal(ent.name, "Synthetic Group"); assert.equal(ent.role, "admin");
  assert.equal((await call(b.w, env, "/internal/tenants/provision", { method: "POST", headers: { "x-internal-secret": INTERNAL }, body: { kind: "enterprise", name: "Again", slug: "synthetic-group", adminEmail: "synthetic@example.invalid" } })).status, 409, "slug_taken is read from the surviving row");
});

test("NON-DURABLE path: the explicit memory factory serves, and a second Worker sees none of it", async () => {
  const db = new FakeD1(); await seed(db);
  const env = mk(db), mem = memorySideStores();
  const a = worker({ sideStoresFactory: mem });
  assert.equal((await jj(await call(a.w, env, "/app/domains/dom_synth1/scan", { method: "POST", token: TOKEN }))).level, 4);
  assert.equal((db.db.prepare("SELECT COUNT(*) n FROM owner_state").get() as any).n, 0, "nothing reached D1");
  const same = await jj(await call(a.w, env, "/app/domains/dom_synth1", { token: TOKEN }));
  assert.equal(same.level, 4, "served from memory within the isolate");
  const b = worker({ sideStoresFactory: memorySideStores() });   // restart with fresh memory
  assert.equal((await jj(await call(b.w, env, "/app/domains/dom_synth1", { token: TOKEN }))).level, 1, "memory state is lost on restart (level back to the unscanned default)");
  assert.equal(memorySideStoresFactory(undefined, {}).durable, false);
});

test("default Worker: side seats stay 503 with no providers bound, stores or not", async () => {
  const db = new FakeD1(); await seed(db);
  const w = createWorker(), env = mk(db);
  assert.equal((await call(w, env, "/app/domains/dom_synth1/scan", { method: "POST", token: TOKEN })).status, 503);
  assert.equal((await call(w, env, "/pro/join", { method: "POST", token: TOKEN, body: { acceptTerms: true } })).status, 503);
});
