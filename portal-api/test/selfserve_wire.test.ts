// 2026-11-10 self-serve wiring (TEST MODE): the DEFAULT createWorker() now builds the owner, market and enterprise seats over the
// same D1 binding, and DEV_OUTBOX="1" parks login mail in dev_outbox so sign-in can complete with no mail transport.
// FakeD1 = node:sqlite with every real migration. SYNTHETIC data only, nothing live, no secret read, no network call made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeD1 } from "./fake_d1.ts";
import { createWorker } from "../src/index.ts";
import { buildDeps, refusingPayouts, refusingJobPayments, noZones, mailerFor, unavailableMailer, jobPaymentsFor } from "../src/build_deps.ts";
import { D1MarketStore } from "../src/market/d1store.ts";
import { MemoryMarketStore, type Job } from "../src/market/store.ts";

const ORIGIN = "https://titanos.tech";
const env = (db: FakeD1, extra: Record<string, string> = {}) => ({ DB: db as never, TITANOS_SITE_ORIGIN: ORIGIN, STRIPE_MODE: "test", ...extra });
const call = (w: { fetch(r: Request, e: any): Promise<Response> }, e: any, path: string, o: { method?: string; token?: string; body?: unknown } = {}) =>
  w.fetch(new Request("https://api.test" + path, { method: o.method ?? "GET", headers: { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.body ? { "content-type": "application/json" } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }), e);

async function signIn(db: FakeD1, w: ReturnType<typeof createWorker>, email = "synthetic@example.invalid") {
  const e = env(db, { DEV_OUTBOX: "1" });
  const r = await call(w, e, "/auth/request", { method: "POST", body: { email } });
  assert.equal(r.status, 202);
  const row = db.db.prepare("SELECT to_addr, body FROM dev_outbox ORDER BY id DESC LIMIT 1").get() as any;
  assert.equal(row.to_addr, email);
  const tok = /#token=(ll_[0-9a-f]+)/.exec(String(row.body))?.[1];
  assert.ok(tok, "login link parked in dev_outbox");
  const v = await call(w, e, "/auth/verify", { method: "POST", body: { token: tok } });
  assert.equal(v.status, 200);
  return { e, session: ((await v.json()) as any).session as string };
}

test("default deps carry the owner, market and enterprise seats (D1), with refusing money/DNS-write providers", () => {
  const d = buildDeps(env(new FakeD1()));
  assert.ok(d.owner && d.market && d.ent);
  assert.equal(d.owner!.zones, noZones);
  assert.ok(d.market!.store instanceof D1MarketStore);
  assert.equal(d.market!.payments, refusingJobPayments);   // no test key bound
  assert.equal(d.ent!.payouts, refusingPayouts);
  assert.equal(d.ent!.sealKeys, undefined);                // no SSO_SEAL_KEYS bound: putSso answers 503, never plaintext
  assert.equal(d.ent!.internalSecret, undefined);
  assert.equal(buildDeps(env(new FakeD1()), { side: false }).ent, undefined);
});
test("refusing providers answer a typed 503, never move money", async () => {
  await assert.rejects(refusingPayouts.transfer({ partnerId: "p", accountRef: "a", amountCents: 1, idempotencyKey: "k" }), (e: any) => e.status === 503 && e.message === "payouts_unavailable");
  await assert.rejects(refusingJobPayments.transfer("acct", 1, "g", "k"), (e: any) => e.status === 503);
  assert.equal(await refusingJobPayments.accountReady("acct"), false);
  assert.equal(noZones.zoneFor("example.com"), undefined);
  assert.equal(jobPaymentsFor({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_MODE: "test" } as any), refusingJobPayments);
});
test("mailer: unavailable by default, dev outbox only with DEV_OUTBOX=1, refused in live mode", () => {
  const db = new FakeD1();
  assert.equal(mailerFor(env(db), Date.now), unavailableMailer);
  assert.notEqual(mailerFor(env(db, { DEV_OUTBOX: "1" }), Date.now), unavailableMailer);
  assert.throws(() => mailerFor(env(db, { DEV_OUTBOX: "1", STRIPE_MODE: "live" }), Date.now), (e: any) => e.reason === "live_key_refused");
});
test("without DEV_OUTBOX the login request still fails closed (503 mailer_unavailable)", async () => {
  const db = new FakeD1(), w = createWorker();
  const r = await call(w, env(db), "/auth/request", { method: "POST", body: { email: "synthetic@example.invalid" } });
  assert.equal(r.status, 503);
});
test("sign-in end to end through dev_outbox, then /me, enterprise, pro and market routes answer (no enterprise_unavailable)", async () => {
  const db = new FakeD1(), w = createWorker();
  const { e, session } = await signIn(db, w);
  assert.equal((await call(w, e, "/me", { token: session })).status, 200);
  const t = await call(w, e, "/tenants", { token: session });
  assert.equal(t.status, 200);
  assert.equal((await call(w, e, "/invites", { token: session })).status, 200);
  const p = await call(w, e, "/portal/me");
  assert.notEqual(p.status, 503);
  assert.notEqual(((await p.json()) as any).error, "enterprise_unavailable");
  assert.equal((await call(w, e, "/market/leaderboard")).status, 200);
  assert.equal((await call(w, e, "/market/jobs", { token: session })).status, 200);
  const j = await call(w, e, "/pro/join", { method: "POST", token: session, body: { acceptTerms: true } });
  assert.equal(j.status, 201);
  assert.equal((await call(w, e, "/pro/board", { token: session })).status, 200);
  const o = await call(w, e, "/pro/onboarding", { method: "POST", token: session });
  assert.equal(o.status, 503);   // Stripe Connect onboarding needs a payments provider: refused, typed
  assert.equal(((await o.json()) as any).error, "payments_unavailable");
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM pro_profiles").get()!.n, 1);   // the pro seat is durable in D1
  // the outbox keeps one day only
  db.db.prepare("UPDATE dev_outbox SET created_at = 0").run();
  await call(w, e, "/auth/request", { method: "POST", body: { email: "second@example.invalid" } });
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM dev_outbox").get()!.n, 1);
});
test("internal enterprise routes stay closed with no INTERNAL_API_SECRET bound", async () => {
  const db = new FakeD1(), w = createWorker();
  const r = await call(w, env(db), "/internal/tenants/provision", { method: "POST", body: {} });
  assert.equal(r.status, 404);
});

// D1MarketStore parity: the same writes on Memory and D1 give the same reads, in the same order.
const job = (id: string, o: Partial<Job> = {}): Job => ({ id, ownerAccountId: "own1", domainId: "dom1", domain: "a.example", check: "spf", severity: "WARN", tier: "small", priceCents: 9900, claimFeeCents: 2900, status: "open", createdAt: 1, updatedAt: 1, baseline: { at: 1, status: "WARN", detail: "" }, abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [], ...o } as Job);
test("D1MarketStore matches MemoryMarketStore on every indexed read and the CAS", async () => {
  const fake = new FakeD1(); fake.db.exec("PRAGMA foreign_keys = OFF");
  const stores = [new MemoryMarketStore(), new D1MarketStore(fake as never)];
  for (const s of stores) {
    await s.putJob(job("j1"));
    await s.putJob(job("j2", { ownerAccountId: "own2", domainId: "dom2", check: "dmarc", status: "claimed", proAccountId: "pro1", claimDeadline: 50 }));
    await s.putJob(job("j3", { domainId: "dom1", check: "dkim", status: "cancelled", abandonedBy: ["pro1"] }));
    await s.putJob(job("j1", { status: "open", updatedAt: 2 }));   // upsert keeps first-insert order
    assert.equal(await s.transition(["open"], job("j1", { status: "claimed", proAccountId: "pro2", updatedAt: 3 })), true);
    assert.equal(await s.transition(["open"], job("j1", { status: "claimed", proAccountId: "pro3", updatedAt: 4 })), false);   // lost race
    assert.equal(await s.transition([], job("j2")), false);
    await s.putPro({ accountId: "pro1", joinedAt: 1, onboarded: false, display: "P1" });
    await s.putCard({ id: "c1", kind: "dispute", jobId: "j2", reason: "r", createdAt: 1, resolved: false });
    await s.putCard({ id: "c2", kind: "payout_review", jobId: "j1", reason: "r", createdAt: 2, resolved: true, outcome: "ok" });
  }
  const ids = (js: Job[]) => js.map((j) => `${j.id}:${j.status}:${j.proAccountId ?? "-"}`);
  const [m, d] = stores;
  assert.deepEqual(ids(await d.allJobs()), ids(await m.allJobs()));
  for (const [name, a, b] of [
    ["byOwner", await m.jobsByOwner("own1"), await d.jobsByOwner("own1")], ["byPro", await m.jobsByPro("pro1"), await d.jobsByPro("pro1")],
    ["touching", await m.jobsTouchingPro("pro1"), await d.jobsTouchingPro("pro1")], ["byStatus", await m.jobsByStatus(["claimed", "cancelled"]), await d.jobsByStatus(["claimed", "cancelled"])],
    ["byDomain", await m.jobsByDomain("dom1"), await d.jobsByDomain("dom1")], ["empty", await m.jobsByStatus([]), await d.jobsByStatus([])],
  ] as const) assert.deepEqual(ids(b as Job[]), ids(a as Job[]), name);
  assert.deepEqual(ids(await d.jobsTouchingPro("pro1")), ["j2:claimed:pro1", "j3:cancelled:-"]);
  assert.equal((await d.getJob("j1"))!.proAccountId, "pro2");
  assert.deepEqual(await d.allPros(), await m.allPros());
  assert.deepEqual(await d.openCards(), await m.openCards());
  assert.deepEqual(await d.getCard("c2"), await m.getCard("c2"));
});
