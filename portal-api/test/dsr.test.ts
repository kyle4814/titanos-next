// C2 data rights (SYNTHETIC DATA ONLY, every name below is a fixture): export has 0 cross-tenant rows and no secrets;
// erase refuses while money or a tenant is in play, keeps the tax records, and run twice equals run once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { make, T0 } from "./harness.ts";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { MemoryMarketStore, type Job } from "../src/market/store.ts";
import { exportAccount, eraseAccount, eraseBlockers, pseudonymFor, DsrError, type DsrDeps } from "../src/dsr.ts";
import { authenticate, verifyLogin, requestLogin } from "../src/service.ts";

const DAY = 86_400_000;
function job(id: string, owner: string, pro: string | undefined, status: Job["status"]): Job {
  return { id, ownerAccountId: owner, domainId: "d", domain: `${id}.example.test`, check: "SPF", severity: "WARN", tier: "small", priceCents: 1000, claimFeeCents: 100, status, createdAt: T0, updatedAt: T0, baseline: { at: T0, status: "WARN", detail: "x" }, proAccountId: pro, abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [] };
}
async function world() {
  const h = make(); const ent = new MemoryEntStore(), market = new MemoryMarketStore();
  const d: DsrDeps = { store: h.store, ent, market, now: () => h.clock.t };
  const who: Record<string, { id: string; email: string; session: string }> = {};
  for (const k of ["a", "b"]) {
    const email = `${k}-canary@fixture.test`; const l = await h.login(email); who[k] = { id: l.account.id, email, session: l.session };
    const id = l.account.id, C = `CANARY_${k.toUpperCase()}`;
    await h.store.putDomain({ id: `dom_${k}`, accountId: id, domain: `${k}-canary.fixture.test`, token: `DNSTOKEN_${C}`, verifiedAt: T0 });
    await h.store.putKey({ id: `key_${k}`, accountId: id, hash: `KEYHASH_${C}`, scopes: ["scan"], createdAt: T0 });
    await h.store.putPurchase({ id: `pur_${k}`, accountId: id, productId: "compliance_pack", domain: `${k}-canary.fixture.test`, checkoutId: `cs_${C}`, paymentIntent: `pi_${C}`, paidAt: T0 - 30 * DAY, amountCents: 599700, deliverableIssued: true, refundedCents: 0, status: "paid" });
    await h.store.putInvoice({ id: `inv_${k}`, accountId: id, purchaseId: `pur_${k}`, number: await h.store.nextInvoiceNumber(), productId: "compliance_pack", amountCents: 599700, issuedAt: T0, stripeEventId: `evt_${C}` });
    await h.store.creditApply(id, 500, "topup", `ref_${C}`, T0);
    await h.store.putReceipt({ id: `rcpt_${k}`, tool: "scan", keyId: `key_${k}`, accountId: id, at: T0, inputSha: "i", outputSha: "o", credits: 1, mode: "prepaid", sig: `SIG_${C}` });
    await h.store.putAccount({ ...(await h.store.accountById(id))!, stripeCustomerId: `cus_${C}` });
    await ent.putTenant({ id: `ten_${k}`, slug: `ten-${k}`, name: `TenantName_${C}`, kind: "partner", createdAt: T0, ssoEnforced: false, partnerAccess: false });
    await ent.putMember({ tenantId: `ten_${k}`, accountId: id, role: "admin", addedAt: T0 });
    await ent.putMember({ tenantId: `ten_${k}`, accountId: `co_admin_${k}`, role: "admin", addedAt: T0 }); // a second admin so erase is not blocked by last-admin
    await ent.addAudit({ id: `aud_${k}`, tenantId: `ten_${k}`, actor: id, action: `did_${C}`, target: "t", at: T0 });
    await ent.addAudit({ id: `aud2_${k}`, tenantId: `ten_${k}`, actor: `co_admin_${k}`, action: `OTHER_ADMIN_${C}`, target: "t", at: T0 });
    await market.putPro({ accountId: id, joinedAt: T0, connectAccountId: `acct_${C}`, onboarded: true, plan: "payg", display: `DisplayName_${C}` });
    await market.putJob(job(`job_${k}`, id, undefined, "paid"));
    await h.store.putCard({ id: `card_${k}`, accountId: id, purchaseId: `pur_${k}`, kind: "refund_outside_policy", reason: `REASON_${C}`, createdAt: T0, resolved: k === "a" }); // a's is resolved, b's is open
  }
  // a cross-account job: a owns it, b is the pro (settled), so b's export legitimately holds it but must not reveal a's id
  await market.putJob(job("job_ab", who.a.id, who.b.id, "paid"));
  return { h, d, ent, market, who };
}
const text = (x: unknown) => JSON.stringify(x);

test("export: A's export has 0 rows or canaries from B, and no secrets", async () => {
  const { d, who } = await world();
  const ex = await exportAccount(d, who.a.id); const s = text(ex);
  for (const bad of ["CANARY_B", who.b.id, "b-canary", "TenantName_CANARY_B", "co_admin_b"]) assert.ok(!s.includes(bad), `leaked ${bad}`);
  for (const secret of ["KEYHASH_", "DNSTOKEN_", "SIG_CANARY", "ll_", "ss_"]) assert.ok(!s.includes(secret), `secret ${secret}`);
  assert.ok(!/"hash"|"token"|"sig"/.test(s));
  assert.ok(s.includes("CANARY_A") && s.includes(who.a.email));
});
test("export: carries every record family keyed to the account", async () => {
  const { d, who } = await world();
  const ex = await exportAccount(d, who.a.id);
  assert.equal(ex.domains.length, 1); assert.equal(ex.purchases.length, 1); assert.equal(ex.invoices.length, 1);
  assert.equal(ex.apiKeys.length, 1); assert.equal(ex.credits.balance, 500); assert.equal(ex.credits.entries.length, 1);
  assert.equal(ex.reviewCards.length, 1); assert.equal(ex.reviewCards[0].id, "card_a");
  assert.equal(ex.agentReceipts.length, 1); assert.equal(ex.proProfile.display, "DisplayName_CANARY_A");
  assert.equal(ex.marketJobs.length, 2); assert.equal(ex.enterprise.memberships.length, 1);
  assert.deepEqual(ex.enterprise.auditActions.map((x: any) => x.actor), [who.a.id]); // not the co-admin's audit row
});
test("export: counterparty id inside a shared job is masked", async () => {
  const { d, who } = await world();
  const asPro = await exportAccount(d, who.b.id);
  const shared = asPro.marketJobs.find((j: any) => j.id === "job_ab");
  assert.equal(shared.ownerAccountId, "counterparty"); assert.equal(shared.proAccountId, who.b.id);
  assert.ok(!text(asPro).includes(who.a.id));
});
test("export: unknown account is not_found and the export is read-only", async () => {
  const { d, who, h } = await world();
  await assert.rejects(() => exportAccount(d, "acc_nope"), (e: any) => e instanceof DsrError && e.code === "not_found");
  const before = text([...h.store.accounts.values(), [...h.store.purchases.values()]]);
  await exportAccount(d, who.a.id); assert.equal(text([...h.store.accounts.values(), [...h.store.purchases.values()]]), before);
});

test("erase: personal fields go, tax records stay under a stable pseudonym", async () => {
  const { d, who, h, ent, market } = await world();
  const pre = await h.store.invoicesFor(who.a.id);
  const r = await eraseAccount(d, who.a.id);
  assert.equal(r.pseudonym, await pseudonymFor(who.a.id));
  const acct = (await h.store.accountById(who.a.id))!;
  assert.equal(acct.email, `${r.pseudonym}@deleted.invalid`); assert.equal(acct.stripeCustomerId, undefined); assert.ok(acct.deletedAt);
  assert.deepEqual(await h.store.invoicesFor(who.a.id), pre);                       // invoice rows untouched
  assert.equal((await h.store.purchasesFor(who.a.id)).length, 1);
  assert.equal(await h.store.creditBalance(who.a.id), 500);
  assert.equal((await h.store.domainsFor(who.a.id)).length, 0);
  assert.ok((await h.store.keysFor(who.a.id)).every((k) => k.revokedAt));
  assert.equal((await ent.membershipsFor(who.a.id)).length, 0);
  const pro = (await market.getPro(who.a.id))!; assert.equal(pro.display, r.pseudonym); assert.equal(pro.connectAccountId, undefined);
  assert.ok(!text(await exportAccount(d, who.a.id)).includes(who.a.email));
  // B untouched
  assert.equal((await h.store.accountById(who.b.id))!.email, who.b.email); assert.equal((await h.store.domainsFor(who.b.id)).length, 1);
});
test("erase: twice equals once (state and result)", async () => {
  const { d, who, h, ent, market } = await world();
  const snap = async () => text([[...h.store.accounts.values()], [...h.store.invoices.values()], [...h.store.keys.values()], [...h.store.sessions.values()], [...h.store.domains.values()], h.store.ledger, [...ent.members], [...market.pros.values()], [...h.store.loginTokens.values()]]);
  const r1 = await eraseAccount(d, who.a.id), s1 = await snap();
  h.clock.t += 5 * DAY; // time passes: erasedAt and pseudonym must not drift
  const r2 = await eraseAccount(d, who.a.id);
  assert.deepEqual(r2, r1); assert.equal(await snap(), s1);
});
test("erase: a finished erase never starts refusing (late purchase or job on the erased id)", async () => {
  const { d, who, h, market } = await world();
  const r1 = await eraseAccount(d, who.a.id);
  await h.store.putPurchase({ id: "late", accountId: who.a.id, productId: "compliance_pack", checkoutId: "cs_late", paymentIntent: "pi_late", paidAt: T0, amountCents: 1, deliverableIssued: false, refundedCents: 0, status: "paid" });
  await market.putJob(job("job_late", who.a.id, undefined, "open"));
  assert.deepEqual(await eraseAccount(d, who.a.id), r1);
});
test("erase: only the erased address's login links are purged; B's outstanding link and B's open card are untouched", async () => {
  const { d, who, h } = await world();
  await requestLogin(h.deps, who.b.email);
  const linkB = h.mailer.outbox.filter((m) => m.to === who.b.email).at(-1)!.text.match(/token=(ll_[0-9a-f]+)/)![1];
  await eraseAccount(d, who.a.id);                                                    // B's open card must not have blocked A either
  const out = await verifyLogin(h.deps, linkB); assert.equal(out.account.id, who.b.id);
});
test("erase: finishes a half-done erase (crash after sessions, before the account row)", async () => {
  const { d, who, h } = await world();
  await h.store.deleteSessionsFor(who.a.id);                                         // the first step ran, then the process died
  const r = await eraseAccount(d, who.a.id); assert.equal((await h.store.accountById(who.a.id))!.email, `${r.pseudonym}@deleted.invalid`);
});
test("erase: post-erase login fails closed (session, API key, outstanding login link)", async () => {
  const { d, who, h } = await world();
  await requestLogin(h.deps, who.a.email);                                           // an unused login link is outstanding
  const link = h.mailer.outbox.filter((m) => m.to === who.a.email).at(-1)!.text.match(/token=(ll_[0-9a-f]+)/)![1];
  await authenticate(h.deps, `Bearer ${who.a.session}`);                              // works before
  await eraseAccount(d, who.a.id);
  await assert.rejects(() => authenticate(h.deps, `Bearer ${who.a.session}`), (e: any) => e.status === 401);
  await assert.rejects(() => verifyLogin(h.deps, link), (e: any) => e.status === 401); // the old link is dead
  assert.ok((await h.store.keysFor(who.a.id)).every((k) => k.revokedAt));
  // signing in again later makes a NEW empty account; it never reaches the erased one
  const again = await h.login(who.a.email);
  assert.notEqual(again.account.id, who.a.id); assert.equal((await exportAccount(d, again.account.id)).purchases.length, 0);
});
test("erase: held or in-flight partner payout blocks, and nothing changes", async () => {
  for (const status of ["pending_approval", "sending", "failed", "held", "approved_retry", "mystery_new_status"]) {
    const { d, who, h, ent } = await world();
    await ent.putPayout({ id: "po1", partnerId: "ten_a", amountCents: 1000, status: status as any, createdAt: T0 });
    await assert.rejects(() => eraseAccount(d, who.a.id), (e: any) => e instanceof DsrError && e.blockers.includes("payout_held"), status);
    assert.equal((await h.store.accountById(who.a.id))!.email, who.a.email); assert.equal((await h.store.domainsFor(who.a.id)).length, 1);
    await authenticate(h.deps, `Bearer ${who.a.session}`); // still logged in
  }
  const { d, who, ent } = await world();
  await ent.putPayout({ id: "po2", partnerId: "ten_a", amountCents: 1000, status: "paid", createdAt: T0 });
  await eraseAccount(d, who.a.id); // settled payouts do not block
});
test("erase: an order still refundable in policy blocks; outside policy or refunded does not", async () => {
  const { d, who, h } = await world();
  const p = (await h.store.purchaseById("pur_a"))!;
  await h.store.putPurchase({ ...p, deliverableIssued: false, paidAt: T0 - 3 * DAY });
  assert.deepEqual(await eraseBlockers(d, who.a.id), ["order_refundable_in_policy"]);
  await assert.rejects(() => eraseAccount(d, who.a.id), (e: any) => e.blockers[0] === "order_refundable_in_policy");
  await h.store.putPurchase({ ...p, deliverableIssued: false, paidAt: T0 - 3 * DAY, refundedCents: p.amountCents, status: "refunded" });
  assert.deepEqual(await eraseBlockers(d, who.a.id), []);
});
test("erase: other blockers (subscription, open review card, live market job, sole admin)", async () => {
  const { d, who, h, ent, market } = await world();
  await h.store.putSubscription({ id: "sub1", accountId: who.a.id, purchaseId: "pur_a", productId: "monitor_monthly", startedAt: T0 });
  await h.store.putCard({ id: "card1", accountId: who.a.id, purchaseId: "pur_a", kind: "refund_outside_policy", reason: "x", createdAt: T0, resolved: false });
  await market.putJob(job("job_live", who.a.id, undefined, "open"));
  await ent.removeMember("ten_a", "co_admin_a");
  assert.deepEqual(await eraseBlockers(d, who.a.id), ["active_subscription", "last_admin_of_tenant", "market_job_active", "refund_review_open"]);
});
test("erase: unknown account is not_found", async () => { const { d } = await world(); await assert.rejects(() => eraseAccount(d, "acc_nope"), (e: any) => e.code === "not_found"); });
test("works with only the base Store (no ent, no market)", async () => {
  const { h, who } = await world(); const d: DsrDeps = { store: h.store, now: () => h.clock.t };
  assert.equal((await exportAccount(d, who.a.id)).enterprise, undefined); await eraseAccount(d, who.a.id);
});
