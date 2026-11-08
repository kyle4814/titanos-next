// C8 f314: the production construction point for d.ent (src/ent_context.ts), driven through the REAL Worker entry (createWorker + buildDeps).
// SYNTHETIC data only: FakeD1 (node:sqlite), memory stores behind the seams, mock payouts/IdP/scan. Nothing live, nothing deployed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FakeD1 } from "./fake_d1.ts";
import { MemoryStore } from "../src/store.ts";
import { MockMailer } from "../src/service.ts";
import { fakeResolver } from "../src/dns.ts";
import { createWorker } from "../src/index.ts";
import { buildDeps } from "../src/build_deps.ts";
import { buildEnterpriseDeps, EntBuildError, parseSealKeys } from "../src/ent_context.ts";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { isSealed } from "../src/enterprise/seal.ts";
import { Throttle } from "../src/throttle.ts";
import { ENT_ENV, INTERNAL, MockPayouts, entSeams } from "./ent_harness.ts";

const T0 = Date.UTC(2026, 10, 9);
const MEMBERS = ["store", "approvals", "idp", "payouts", "payoutLookup", "scan", "rates", "internalSecret", "sealKeys", "selfDeal", "book", "estateCache", "refreshLimiter"];

function rig(envOver: Record<string, unknown> = {}, seamsOver: Record<string, unknown> = {}) {
  const env: any = { ...ENT_ENV(), TITANOS_SITE_ORIGIN: "https://titanos.tech" }; for (const [k, v] of Object.entries(envOver)) { if (v === undefined) delete env[k]; else env[k] = v; }
  const dns = fakeResolver({}), billing = new MemoryStore(), entStore = new MemoryEntStore(), payouts = new MockPayouts(), mailer = new MockMailer();
  const log: string[] = [];
  const seams = entSeams({ store: entStore, payouts, deps: { store: billing } }, seamsOver as never);
  const worker = createWorker({
    buildDeps: (e) => buildDeps(e, { storeFactory: () => billing, mailer, dns, now: () => T0, ent: seams }),
    throttle: new Throttle({ maxFailures: 50, windowMs: 60_000, lockoutMs: 60_000, now: () => T0 }), log: (l) => log.push(l),
  });
  const req = (method: string, path: string, o: { token?: string; body?: unknown; secret?: string } = {}) =>
    worker.fetch(new Request("https://api.test" + path, { method, headers: { ...(o.body === undefined ? {} : { "content-type": "application/json" }), ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.secret ? { "x-internal-secret": o.secret } : {}) }, body: o.body === undefined ? undefined : JSON.stringify(o.body) }), env);
  async function login(email: string) {
    await req("POST", "/auth/request", { body: { email } });
    const tok = mailer.outbox.filter((m) => m.to === email).at(-1)!.text.match(/token=(ll_[0-9a-f]+)/)![1];
    return ((await (await req("POST", "/auth/verify", { body: { token: tok } })).json()) as any).session as string;
  }
  async function provision(kind: string, email: string, slug: string, extra: Record<string, unknown> = {}) {
    const session = await login(email);
    const r = await req("POST", "/internal/tenants/provision", { body: { kind, name: slug, slug, adminEmail: email, ...extra }, secret: INTERNAL });
    return { session, tenant: (await r.json()) as any, status: r.status };
  }
  return { dns, env, billing, entStore, payouts, req, login, provision, log, seams };
}

test("ctx 1: every member is present, nothing is written at construction, no default tenant exists", async () => {
  const db = new FakeD1(), es = new MemoryEntStore();
  const ent = buildEnterpriseDeps({ ...(ENT_ENV() as object), DB: db } as never, entSeams({ store: es, payouts: new MockPayouts(), deps: { store: new MemoryStore() } }));
  for (const k of MEMBERS) assert.ok((ent as any)[k] !== undefined && (ent as any)[k] !== null, `member ${k} present`);
  await new Promise((r) => setTimeout(r, 30));   // FakeD1 logs after its async tick: a fire-and-forget query would land here
  assert.equal(db.log.length, 0, "construction runs no SQL");
  assert.equal((es as any).tenants?.size ?? 0, 0, "construction creates no tenant");
});

test("ctx 2: routes that answered 503 for an absent dep now answer from the real source", async () => {
  const r = rig();
  const p = await r.provision("partner", "boss@msp.synth.com.au", "msp-one", { termsAccepted: true, payoutAccount: "acct_synth_1" });
  assert.equal(p.status, 201);
  // book: d.ent.book is constructed from D1 (makeBookFacts) -> 200 with a totals block, not 503 book_unavailable
  const book = await r.req("GET", "/api/partner/book", { token: p.session });
  assert.equal(book.status, 200);
  const bj: any = await book.json(); assert.ok(Array.isArray(bj.rows)); assert.equal(bj.rows.length, 0);
  // payout sweep: payoutLookup constructed -> 200, not 503 transfer_lookup_unconfigured
  const sw = await r.req("POST", "/internal/enterprise/payouts/sweep", { body: {}, secret: INTERNAL });
  assert.equal(sw.status, 200);
  // sso: sealKeys constructed -> the client secret is sealed before the store write, not 503
  const e = await r.provision("enterprise", "admin@ent.synth.com.au", "ent-one");
  const a: any = await (await r.req("POST", `/enterprise/${e.tenant.id}/assets`, { token: e.session, body: { domain: "ent.synth.com.au", label: "main" } })).json();
  r.dns.zone[a.record.name] = [a.record.value];
  assert.equal((await r.req("POST", `/enterprise/${e.tenant.id}/assets/${a.id}/verify`, { token: e.session })).status, 200);
  const put = await r.req("PUT", `/enterprise/${e.tenant.id}/sso`, { token: e.session, body: { issuer: "https://idp.mock.test", clientId: "client-1", secret: "sso_secret_synth_0123456789", allowedDomains: ["ent.synth.com.au"] } });
  assert.equal(put.status, 200);
  assert.ok(isSealed((await r.entStore.ssoOf(e.tenant.id))!.secret), "stored sealed");
  // estate: cache + limiter constructed -> view carries the f310 markers
  const est: any = await (await r.req("GET", `/enterprise/${e.tenant.id}/estate?refresh=1`, { token: e.session })).json();
  assert.equal(typeof est.stale, "boolean"); assert.equal(typeof est.refreshed, "boolean");
});

test("ctx 3: the SAME routes on a Worker without the construction point (bare ent) are the old 503s (control)", async () => {
  const r = rig();
  const p = await r.provision("partner", "boss@msp.synth.com.au", "msp-two", { termsAccepted: true, payoutAccount: "acct_synth_2" });
  const ent = buildEnterpriseDeps(r.env, r.seams);
  const bare: any = { ...ent }; delete bare.book; delete bare.payoutLookup;
  const w = createWorker({ buildDeps: (e) => ({ ...buildDeps(e, { storeFactory: () => r.billing, mailer: new MockMailer(), dns: fakeResolver({}), now: () => T0, ent: r.seams }), ent: bare }), throttle: new Throttle({ maxFailures: 50, windowMs: 60_000, lockoutMs: 60_000, now: () => T0 }) });
  const q = (m: string, path: string, o: any = {}) => w.fetch(new Request("https://api.test" + path, { method: m, headers: { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.secret ? { "x-internal-secret": o.secret } : {}), "content-type": "application/json" }, body: o.body ? JSON.stringify(o.body) : undefined }), r.env);
  assert.equal((await q("GET", "/api/partner/book", { token: p.session })).status, 503);
  assert.equal((await q("POST", "/internal/enterprise/payouts/sweep", { body: {}, secret: INTERNAL })).status, 503);
});

const MISSING: [string, Record<string, unknown>, Record<string, unknown>, string, string][] = [
  ["DB", { DB: undefined }, {}, "missing_binding", "DB"],
  ["INTERNAL_API_SECRET", { INTERNAL_API_SECRET: undefined }, {}, "missing_binding", "INTERNAL_API_SECRET"],
  ["ENT_SEAL_KEYS", { ENT_SEAL_KEYS: undefined }, {}, "missing_binding", "ENT_SEAL_KEYS"],
  ["ENT_SEAL_KEYS not JSON", { ENT_SEAL_KEYS: "{nope" }, {}, "bad_binding", "ENT_SEAL_KEYS"],
  ["ENT_SEAL_KEYS current key absent", { ENT_SEAL_KEYS: JSON.stringify({ current: "k9", keys: { k1: "x" } }) }, {}, "bad_binding", "ENT_SEAL_KEYS"],
  ["store seam", {}, { storeFactory: undefined }, "adapter_unavailable", "store"],
  ["approvals seam", {}, { approvals: undefined }, "adapter_unavailable", "approvals"],
  ["payouts seam", {}, { payouts: undefined }, "adapter_unavailable", "payouts"],
  ["payoutLookup seam", {}, { payoutLookup: undefined }, "adapter_unavailable", "payoutLookup"],
  ["idp seam", {}, { idp: undefined, fetchJwks: undefined }, "adapter_unavailable", "idp"],
  ["accounts seam", {}, { accounts: undefined }, "adapter_unavailable", "accounts"],
];
for (const [name, envO, seamO, reason, binding] of MISSING) {
  test(`ctx 4: ${name} missing -> typed EntBuildError(${reason}:${binding}), never a partial object`, () => {
    const r = rig(envO, seamO);
    assert.throws(() => buildEnterpriseDeps(r.env, r.seams), (e: any) => e instanceof EntBuildError && e.reason === reason && e.binding === binding && e.message === `${reason}:${binding}`);
  });
  test(`ctx 5: ${name} missing -> enterprise routes 503 naming it; the rest of the portal still serves; no throw`, async () => {
    const r = rig(envO, seamO);
    if (name === "DB") return;   // no DB at all: the whole portal refuses (build_deps typed error); covered by build_deps.test.ts
    const res = await r.req("GET", "/enterprise/ten_x");
    assert.equal(res.status, 503);
    const j: any = await res.json(); assert.equal(j.error, "enterprise_unavailable"); assert.equal(j.reason, `${reason}:${binding}`);
    assert.equal((await r.req("GET", "/api/partner/book")).status, 503);
    assert.equal((await r.req("POST", "/auth/request", { body: { email: "a@synth.com.au" } })).status < 500, true, "non-enterprise route unaffected");
    assert.equal((await r.req("GET", "/health")).status, 200);
  });
}
test("ctx 5b: a non-typed error from a seam is NOT swallowed into a 503 reason (surfaces as the entry's 500)", async () => {
  const r = rig({}, { storeFactory: () => { throw new Error("boom_untyped"); } });
  assert.equal((await r.req("GET", "/enterprise/ten_x")).status, 500);
});
test("ctx 6: the error text carries a binding NAME, never a secret value", () => {
  const r = rig({ ENT_SEAL_KEYS: "{secret_value_SHOULD_NOT_LEAK" });
  try { buildEnterpriseDeps(r.env, r.seams); assert.fail("must throw"); } catch (e: any) { assert.ok(!String(e.message).includes("SHOULD_NOT_LEAK")); assert.equal(e.binding, "ENT_SEAL_KEYS"); }
  assert.throws(() => parseSealKeys("[]"), EntBuildError);
});
test("ctx 7: cache and limiter are shared per DB binding (one isolate), never across DBs", () => {
  const a = rig(), b = rig();
  const e1 = buildEnterpriseDeps(a.env, a.seams), e2 = buildEnterpriseDeps(a.env, a.seams), e3 = buildEnterpriseDeps(b.env, b.seams);
  assert.equal(e1.estateCache, e2.estateCache); assert.equal(e1.refreshLimiter, e2.refreshLimiter);
  assert.notEqual(e1.estateCache, e3.estateCache); assert.notEqual(e1.refreshLimiter, e3.refreshLimiter);
});
test("ctx 8: the f64 isolation matrix re-run on the CONSTRUCTED ent: 0 cross-tenant reads", () => {
  const f = fileURLToPath(new URL("./tenant_isolation.test.ts", import.meta.url));
  const r = spawnSync("node", ["--test", "--experimental-strip-types", f], { cwd: fileURLToPath(new URL("..", import.meta.url)), env: { ...process.env, NODE_TEST_CONTEXT: undefined, ENT_CTX: "1" }, encoding: "utf8", timeout: 600000 });
  assert.equal(r.status, 0, r.stdout.slice(-1500) + r.stderr.slice(-500));
  const m = r.stdout.match(/C8 isolation: (\d+) probes, (\d+) cross-tenant reads/);
  assert.ok(m, "matrix summary line present"); assert.ok(Number(m![1]) > 4000, `probes ${m![1]}`); assert.equal(m![2], "0");
});
