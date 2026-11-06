// D1 adapters under concurrency, on real SQLite with the real migrations (FakeD1 yields random ticks, so interleavings happen).
// These always run, whatever PORTAL_STORE says. Synthetic ids only.
import test from "node:test";
import assert from "node:assert/strict";
import { newDb } from "./d1_harness.ts";
import { D1Store } from "../src/d1/store.ts";
import { D1MarketStore } from "../src/market/d1store.ts";
import { D1EntStore } from "../src/enterprise/d1store.ts";
import { sha256Hex } from "../src/util.ts";

const acct = async (s: D1Store, id: string) => s.putAccount({ id, email: `${id}@example.invalid`, seat: "owner", createdAt: 1 });

test("credits: 20 concurrent debits of 30 against a balance of 100 spend exactly 90 and never go negative", async () => {
  const db = newDb(), s = new D1Store(db); await acct(s, "a1");
  assert.equal(await s.creditApply("a1", 100, "topup", "evt_1", 1), 100);
  const out = await Promise.all(Array.from({ length: 20 }, (_, i) => s.creditApply("a1", -30, "debit", `r${i}`, 2)));
  assert.equal(out.filter((x) => x !== undefined).length, 3);
  assert.equal(await s.creditBalance("a1"), 10);
});
test("credits: a replayed top-up (same reason and ref) moves nothing and reports the balance", async () => {
  const db = newDb(), s = new D1Store(db); await acct(s, "a1");
  await s.creditApply("a1", 500, "topup", "evt_dup", 1);
  assert.equal(await s.creditApply("a1", 500, "topup", "evt_dup", 2), 500);
  assert.equal((await s.creditEntries("a1")).length, 1);
});
test("webhook events and login tokens are claimed exactly once under a race", async () => {
  const db = newDb(), s = new D1Store(db);
  const claims = await Promise.all(Array.from({ length: 10 }, () => s.claimEvent("evt_x")));
  assert.equal(claims.filter(Boolean).length, 1);
  await s.putLoginToken({ hash: await sha256Hex("ll_t"), email: "a@example.invalid", expiresAt: 1000, used: false });
  const uses = await Promise.all(Array.from({ length: 10 }, async () => s.consumeLoginToken(await sha256Hex("ll_t"), 500)));
  assert.equal(uses.filter(Boolean).length, 1);
  assert.equal(await s.consumeLoginToken(await sha256Hex("ll_t"), 500), undefined);
});
test("invoice numbers are unique and sequential under concurrency", async () => {
  const db = newDb(), s = new D1Store(db);
  const nums = await Promise.all(Array.from({ length: 15 }, () => s.nextInvoiceNumber()));
  assert.equal(new Set(nums).size, 15);
  assert.deepEqual([...nums].sort(), Array.from({ length: 15 }, (_, i) => `TT-${String(i + 1).padStart(6, "0")}`));
});
test("a put can never overwrite another account's row (purchase, domain, key)", async () => {
  const db = newDb(), s = new D1Store(db); await acct(s, "a1"); await acct(s, "a2");
  await s.putPurchase({ id: "p1", accountId: "a1", productId: "x", checkoutId: "c1", amountCents: 100, deliverableIssued: false, refundedCents: 0, status: "pending" });
  await s.putPurchase({ id: "p1", accountId: "a2", productId: "x", checkoutId: "c1", amountCents: 100, deliverableIssued: false, refundedCents: 0, status: "paid" }).catch(() => {});
  assert.equal((await s.purchaseById("p1"))!.status, "pending");
});
test("market claim is a compare-and-set: 10 racing claimers, one winner", async () => {
  const db = newDb(), s = new D1Store(db), m = new D1MarketStore(db);
  for (const id of ["o1", "d1", ...Array.from({ length: 10 }, (_, i) => `pro${i}`)]) await acct(s, id);
  await s.putDomain({ id: "dom1", accountId: "o1", domain: "fixture.com.au", token: "t", verifiedAt: 1 });
  const base: any = { id: "job1", ownerAccountId: "o1", domainId: "dom1", domain: "fixture.com.au", check: "SPF", severity: "WARN", tier: "small", priceCents: 1000, claimFeeCents: 100, status: "open", createdAt: 1, updatedAt: 1, baseline: { at: 1, status: "WARN", detail: "" }, abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [] };
  await m.putJob(base);
  const wins = await Promise.all(Array.from({ length: 10 }, (_, i) => m.transition(["open"], { ...base, status: "claimed", proAccountId: `pro${i}` })));
  assert.equal(wins.filter(Boolean).length, 1);
  const j = (await m.getJob("job1"))!; assert.equal(j.status, "claimed");
  assert.equal(await m.transition([], j), false);
});
test("partner payout reserve: two racing reserves cannot both take the same balance", async () => {
  const db = newDb(), s = new D1Store(db), e = new D1EntStore(db);
  await e.putTenant({ id: "t1", slug: "partner-one", name: "P", kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false });
  assert.equal(await e.addLedger({ id: "l1", uniq: "u1", partnerId: "t1", kind: "commission", amountCents: 10_000, at: 1, availableAt: 1 }), true);
  assert.equal(await e.addLedger({ id: "l1b", uniq: "u1", partnerId: "t1", kind: "commission", amountCents: 10_000, at: 1, availableAt: 1 }), false, "uniq is idempotent");
  const mk = (n: number) => (amount: number) => ({ payout: { id: `po${n}`, partnerId: "t1", amountCents: amount, status: "pending_approval" as const, createdAt: 2 }, entry: { id: `lp${n}`, uniq: `payout:po${n}`, partnerId: "t1", kind: "payout" as const, amountCents: -amount, at: 2, availableAt: 2, payoutId: `po${n}` } });
  const r = await Promise.all([e.reservePayout("t1", 10, 1000, mk(1)), e.reservePayout("t1", 10, 1000, mk(2))]);
  assert.equal(r.filter(Boolean).length, 1);
  assert.equal((await e.payoutsOf("t1")).length, 1);
  const bal = (await e.ledgerOf("t1")).reduce((n, x) => n + x.amountCents, 0); assert.equal(bal, 0);
  void s;
});
test("SSO client secret is sealed at rest and refused without a keyring", async () => {
  const db = newDb(), e = new D1EntStore(db);
  await e.putTenant({ id: "t2", slug: "ent-two", name: "E", kind: "enterprise", createdAt: 1, ssoEnforced: false, partnerAccess: false });
  const cfg = { tenantId: "t2", issuer: "https://idp.mock.test", clientId: "c", secret: "plain_secret_fixture_0123456789", allowedDomains: ["x.com.au"], defaultRole: "viewer" as const };
  await assert.rejects(() => e.putSso(cfg), /seal_keyring_missing/);
  const { SEAL_RING } = await import("./d1_harness.ts");
  const sealed = new D1EntStore(db, SEAL_RING); await sealed.putSso(cfg);
  const raw = db.db.prepare("SELECT secret_enc FROM sso_configs").get() as any;
  assert.ok(String(raw.secret_enc).startsWith("tsl1.") && !String(raw.secret_enc).includes("plain_secret"));
  assert.equal((await sealed.ssoOf("t2"))!.secret, cfg.secret);
});
test("src/worker.ts exports ONLY a default handler (workerd rejects any other export on an entry module)", async () => {
  const m = await import("../src/worker.ts");
  assert.deepEqual(Object.keys(m), ["default"]);
  assert.equal(typeof m.default.fetch, "function"); assert.equal(typeof m.default.scheduled, "function");
  const res = await m.default.fetch(new Request("https://x.test/catalogue"), {});
  assert.equal(res.status, 503, "no DB binding: still fails closed");
});
test("worker + D1 binding: routes answer through D1-backed deps (catalogue 200, /me 401, health db ok)", async () => {
  const m = await import("../src/worker.ts");
  const env = { DB: newDb(), LOCAL_DEV: "1" } as any;
  assert.equal((await m.default.fetch(new Request("https://x.test/catalogue"), env)).status, 200);
  assert.equal((await m.default.fetch(new Request("https://x.test/me"), env)).status, 401);
  assert.equal((await (await m.default.fetch(new Request("https://x.test/health"), env)).json() as any).db, "ok");
  const noMail = { DB: newDb() } as any;   // LOCAL_DEV off: the mailer fails closed rather than pretending to send
  assert.equal((await m.default.fetch(new Request("https://x.test/auth/request", { method: "POST", body: JSON.stringify({ email: "a@example.invalid" }) }), noMail)).status, 500);
});
