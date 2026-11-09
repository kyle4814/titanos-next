// ONE contract suite over MemoryEntStore and D1EntStore (FakeD1 = real SQLite + the real migrations 0001..0005, foreign keys ON,
// async with random yields so concurrent callers genuinely interleave). Every assertion runs on both adapters.
// Also: the cross-tenant leak test (tenant A can never read or mutate tenant B through any method) and SQL-shape checks.
// All data is SYNTHETIC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryEntStore, type EntStore } from "../src/enterprise/store.ts";
import { D1EntStore, D1ApprovalStore } from "../src/enterprise/d1store.ts";
import { MemoryApprovalStore, type ApprovalStore, type ApprovalRecord } from "../src/enterprise/payout_decision.ts";
import { sealSecret, openSecret, newSealKey, type SealKeyring } from "../src/enterprise/seal.ts";
import type { LedgerEntry, Payout, Tenant } from "../src/enterprise/types.ts";
import { FakeD1 } from "./fake_d1.ts";

const KR: SealKeyring = { current: "k1", keys: { k1: newSealKey() } };   // synthetic, test only
const sealed = (tid: string, plain: string) => sealSecret(KR, plain, `sso:${tid}`);
const NOW = 1_800_000_000_000, DAY = 86_400_000, HOLD = 30 * DAY;
interface Rig { name: string; store: EntStore; approvals: ApprovalStore; account(id: string): void; rawStates(tenantId: string): number; rawSsoCol(tenantId: string): string | undefined; fake?: FakeD1 }
async function memory(): Promise<Rig> {
  const store = new MemoryEntStore();
  return { name: "memory", store, approvals: new MemoryApprovalStore(), account() {}, rawStates: (t) => [...store.states.values()].filter((s) => s.tenantId === t).length, rawSsoCol: (t) => store.sso.get(t)?.secret };
}
async function d1(): Promise<Rig> {
  const fake = new FakeD1();   // foreign keys ON
  const store = new D1EntStore(fake);
  return {
    name: "d1", store, approvals: new D1ApprovalStore(fake), fake,
    account: (id) => { fake.db.prepare("INSERT OR IGNORE INTO accounts (id, email) VALUES (?, ?)").run(id, `${id}@example.test`); },
    rawStates: (t) => Number((fake.db.prepare("SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ?").get(t) as any).n),
    rawSsoCol: (t) => (fake.db.prepare("SELECT secret_enc FROM sso_configs WHERE tenant_id = ?").get(t) as any)?.secret_enc,
  };
}
const ADAPTERS: [string, () => Promise<Rig>][] = [["memory", memory], ["d1", d1]];

const tenant = (id: string, kind: Tenant["kind"], over: Partial<Tenant> = {}): Tenant => ({ id, slug: id, name: `Name ${id}`, kind, createdAt: NOW, ssoEnforced: false, partnerAccess: false, ...(kind === "partner" ? { refCode: `ref-${id}` } : {}), ...over });
let seq = 0;
const uid = (p: string) => `${p}_${++seq}`;
const led = (partnerId: string, amountCents: number, over: Partial<LedgerEntry> = {}): LedgerEntry => { const id = uid("led"); return { id, uniq: `u:${id}`, partnerId, kind: amountCents < 0 ? "payout" : "commission", amountCents, at: NOW, availableAt: NOW, ...over }; };
const maker = (partnerId: string, status: Payout["status"] = "sending") => (amount: number) => { const id = uid("pay"); return { payout: { id, partnerId, amountCents: amount, status, createdAt: NOW } as Payout, entry: led(partnerId, -amount, { uniq: `payout:${id}`, payoutId: id, kind: "payout" }) }; };
async function seedPartner(r: Rig, id: string) { await r.store.putTenant(tenant(id, "partner", { termsAcceptedAt: NOW, payoutAccount: `acct_${id}` })); }

for (const [name, mk] of ADAPTERS) {
  const t = (title: string, fn: (r: Rig) => Promise<void>) => test(`[${name}] ${title}`, async () => fn(await mk()));

  t("tenants round trip every field; slug and ref code lookups; children hide deleted; setEnforcement", async (r) => {
    const s = r.store;
    const p = tenant("p1", "partner", { termsAcceptedAt: NOW, payoutAccount: "acct_x" });
    const c = tenant("c1", "client", { parentId: "p1", brand: { name: "Brand", colour: "#112233", tagline: "Tag" }, brandPublic: true, partnerAccess: true });
    const d = tenant("c2", "client", { parentId: "p1", deletedAt: NOW + 5 });
    for (const x of [p, c, d]) await s.putTenant(x);
    assert.deepEqual(await s.tenantById("p1"), p);
    assert.deepEqual(await s.tenantById("c1"), c);
    assert.deepEqual(await s.tenantBySlug("c2"), d);
    assert.equal(await s.tenantById("nope"), undefined);
    assert.deepEqual((await s.childrenOf("p1")).map((x) => x.id), ["c1"]);
    assert.equal((await s.partnerByRefCode("ref-p1"))?.id, "p1");
    assert.equal(await s.partnerByRefCode("ref-c1"), undefined);
    await s.putTenant({ ...p, deletedAt: NOW + 9 });
    assert.equal(await s.partnerByRefCode("ref-p1"), undefined, "deleted partner invisible by ref code");
    await s.setEnforcement("c1", true);
    assert.equal((await s.tenantById("c1"))!.ssoEnforced, true);
    assert.equal((await s.tenantById("p1"))!.ssoEnforced, false);
  });

  t("members: upsert keeps join order, scoped reads, removeMember, removeAccount spans only that account", async (r) => {
    const s = r.store;
    for (const a of ["a1", "a2", "a3"]) r.account(a);
    await s.putTenant(tenant("e1", "enterprise")); await s.putTenant(tenant("e2", "enterprise"));
    await s.putMember({ tenantId: "e1", accountId: "a1", role: "admin", addedAt: 1 });
    await s.putMember({ tenantId: "e1", accountId: "a2", role: "viewer", addedAt: 2 });
    await s.putMember({ tenantId: "e2", accountId: "a1", role: "viewer", addedAt: 3 });
    await s.putMember({ tenantId: "e1", accountId: "a1", role: "analyst", addedAt: 1 });
    assert.deepEqual((await s.membersOf("e1")).map((m) => `${m.accountId}:${m.role}`), ["a1:analyst", "a2:viewer"]);
    assert.equal((await s.memberOf("e2", "a2")), undefined);
    assert.deepEqual((await s.membershipsFor("a1")).map((m) => m.tenantId).sort(), ["e1", "e2"]);
    await s.removeMember("e1", "a2");
    assert.equal(await s.memberOf("e1", "a2"), undefined);
    await s.putReferral({ accountId: "a1", partnerId: "e1", claimedAt: NOW });
    await s.putInvite({ id: "i1", tenantId: "e1", email: "x@example.test", role: "viewer", invitedBy: "a1", createdAt: NOW, expiresAt: NOW + 1 });
    await s.putInvite({ id: "i2", tenantId: "e1", email: "y@example.test", role: "viewer", invitedBy: "a3", createdAt: NOW, expiresAt: NOW + 1 });
    await s.removeAccount("a1");
    assert.deepEqual(await s.membershipsFor("a1"), []);
    assert.equal(await s.referralOf("a1"), undefined);
    assert.deepEqual((await s.invitesOf("e1")).map((i) => i.id), ["i2"], "only the erased account's invites go");
  });

  t("invites: expiry window, by-email, tenant-scoped lookup and delete", async (r) => {
    const s = r.store; r.account("a1");
    await s.putTenant(tenant("e1", "enterprise")); await s.putTenant(tenant("e2", "enterprise"));
    const i = { id: "i1", tenantId: "e1", email: "u@example.test", role: "analyst" as const, invitedBy: "a1", createdAt: NOW, expiresAt: NOW + 100 };
    await s.putInvite(i);
    assert.deepEqual(await s.inviteById("i1"), i);
    assert.deepEqual(await s.inviteById("i1", "e1"), i);
    assert.equal(await s.inviteById("i1", "e2"), undefined);
    assert.equal((await s.invitesForEmail("u@example.test", NOW)).length, 1);
    assert.equal((await s.invitesForEmail("u@example.test", NOW + 100)).length, 0, "expiry is exclusive");
    await s.deleteInvite("i1", "e2"); assert.ok(await s.inviteById("i1"), "wrong tenant cannot delete");
    await s.deleteInvitesBy("a1", "e2"); assert.ok(await s.inviteById("i1"));
    await s.deleteInvite("i1", "e1"); assert.equal(await s.inviteById("i1"), undefined);
  });

  t("assets: tenant-scoped, one verified owner per domain, verifiedAt 0/undefined = unverified", async (r) => {
    const s = r.store;
    await s.putTenant(tenant("e1", "enterprise")); await s.putTenant(tenant("e2", "enterprise"));
    const a = { id: "as1", tenantId: "e1", domain: "one.example.test", label: "One", group: "g", token: "tok1" };
    await s.putAsset(a);
    assert.deepEqual(await s.assetOf("e1", "as1"), a);
    assert.equal(await s.assetOf("e2", "as1"), undefined);
    assert.equal(await s.verifiedAssetOwner("one.example.test"), undefined);
    await s.putAsset({ ...a, verifiedAt: NOW });
    assert.equal((await s.verifiedAssetOwner("one.example.test"))?.tenantId, "e1");
    await s.putAsset({ ...a, verifiedAt: undefined });
    assert.equal(await s.verifiedAssetOwner("one.example.test"), undefined);
    await s.putAsset({ id: "as2", tenantId: "e2", domain: "one.example.test", label: "Two", group: "g", token: "tok2", verifiedAt: NOW });
    assert.equal((await s.verifiedAssetOwner("one.example.test"))?.tenantId, "e2");
    await s.deleteAsset("e1", "as2"); assert.ok(await s.assetOf("e2", "as2"));
    await s.deleteAsset("e2", "as2"); assert.equal(await s.assetOf("e2", "as2"), undefined);
  });

  t("sso: config round trip; secret never stored in the clear (D1); state is single use and expires; 20 parallel consumes give 1 winner", async (r) => {
    const s = r.store; await s.putTenant(tenant("e1", "enterprise"));
    const cfg = { tenantId: "e1", issuer: "https://idp.example.test", clientId: "cid", secret: await sealed("e1", "SYNTHETIC_SECRET_0123456789"), allowedDomains: ["a.example.test", "b.example.test"], defaultRole: "viewer" as const, lastSuccessAt: NOW };
    await s.putSso(cfg);
    assert.deepEqual(await s.ssoOf("e1"), cfg);
    assert.ok(r.rawSsoCol("e1")!.startsWith("tsl1.") && !r.rawSsoCol("e1")!.includes("SYNTHETIC_SECRET"), "ciphertext only, on both adapters");
    assert.equal(await openSecret(KR, (await s.ssoOf("e1"))!.secret, "sso:e1"), "SYNTHETIC_SECRET_0123456789");
    await assert.rejects(() => s.putSso({ ...cfg, secret: "PLAINTEXT_SYNTHETIC_SECRET" }), /sso_secret_not_sealed/, "plaintext refused");
    assert.equal(r.rawSsoCol("e1")!.includes("PLAINTEXT"), false);
    const st = (hash: string, over = {}) => ({ hash, tenantId: "e1", clientKey: "k1", nonceHash: "n", expiresAt: NOW + 1000, used: false, ...over });
    await s.putSsoState(st("h1")); await s.putSsoState(st("h2", { expiresAt: NOW - 1 })); await s.putSsoState(st("h3", { clientKey: "k2" }));
    assert.equal(await s.consumeSsoState("h2", NOW), undefined, "expired");
    const results = await Promise.all(Array.from({ length: 20 }, () => s.consumeSsoState("h1", NOW)));
    assert.equal(results.filter(Boolean).length, 1, "single use under 20 parallel callbacks");
    assert.equal(await s.consumeSsoState("h1", NOW), undefined);
    assert.equal(await s.openSsoStates("e1", NOW), 1, "h1 used and h2 expired are purged; h3 remains");
    assert.equal(await s.openSsoStates("e1", NOW, "k2"), 1);
    assert.equal(await s.openSsoStates("e1", NOW, "k1"), 0);
    await s.markSsoSession("sh", "e1"); await s.markSsoSession("sh", "e1");
    assert.equal(await s.isSsoSession("sh", "e1"), true);
    assert.equal(await s.isSsoSession("sh", "e2"), false);
  });

  t("audit: newest first, limited, per tenant", async (r) => {
    const s = r.store; await s.putTenant(tenant("e1", "enterprise")); await s.putTenant(tenant("e2", "enterprise"));
    for (let i = 0; i < 5; i++) await s.addAudit({ id: `au${i}`, tenantId: "e1", actor: "a", action: "x", target: `t${i}`, at: NOW + i });
    await s.addAudit({ id: "auX", tenantId: "e2", actor: "a", action: "x", target: "other", at: NOW });
    assert.deepEqual((await s.auditOf("e1", 3)).map((x) => x.target), ["t4", "t3", "t2"]);
    assert.equal((await s.auditOf("e2", 10)).length, 1);
  });

  t("ledger: idempotent on (partner, uniq) under 20 parallel adds; same uniq for another partner is fine; referral claimed once", async (r) => {
    const s = r.store; await seedPartner(r, "p1"); await seedPartner(r, "p2"); r.account("a1");
    const e = led("p1", 500, { uniq: "commission:inv1", invoiceId: "inv1", sourceKey: "tenant:c1", sourceLabel: "C1", rateBps: 3000, rateVersion: "v1" });
    const won = await Promise.all(Array.from({ length: 20 }, (_, i) => s.addLedger({ ...e, id: `led_dup_${i}` })));
    assert.equal(won.filter(Boolean).length, 1);
    assert.equal(await s.addLedger(led("p2", 700, { uniq: "commission:inv1", invoiceId: "inv1" })), true);
    assert.equal((await s.ledgerOf("p1")).length, 1);
    assert.equal((await s.ledgerForInvoice("inv1")).length, 2, "clawback walks every partner's rows for an invoice");
    const x = (await s.ledgerOf("p1"))[0];
    assert.equal(x.rateBps, 3000); assert.equal(x.payoutId, undefined);
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => s.putReferral({ accountId: "a1", partnerId: i % 2 ? "p1" : "p2", claimedAt: NOW })));
    assert.equal(rs.filter(Boolean).length, 1);
  });

  t("reservePayout: the 30-day hold is honoured to the millisecond; minimum honoured; mismatched rows refused", async (r) => {
    const s = r.store; await seedPartner(r, "p1");
    await s.addLedger(led("p1", 10_000, { at: NOW, availableAt: NOW + HOLD }));
    assert.equal(await s.reservePayout("p1", NOW, 1000, maker("p1")), undefined, "inside the hold");
    assert.equal(await s.reservePayout("p1", NOW + HOLD - 1, 1000, maker("p1")), undefined, "1 ms short of the hold");
    assert.equal(await s.reservePayout("p1", NOW + HOLD, 20_000, maker("p1")), undefined, "below the minimum");
    await assert.rejects(() => s.reservePayout("p1", NOW + HOLD, 1000, (a) => { const m = maker("p1")(a); return { ...m, payout: { ...m.payout, partnerId: "p2" } }; }), /reserve_mismatch/);
    await assert.rejects(() => s.reservePayout("p1", NOW + HOLD, 1000, (a) => { const m = maker("p1")(a); return { ...m, payout: { ...m.payout, amountCents: a - 1 } }; }), /reserve_mismatch/);
    await assert.rejects(() => s.reservePayout("p1", NOW + HOLD, 1000, (a) => { const m = maker("p1")(a); return { ...m, entry: { ...m.entry, held: true } }; }), /reserve_mismatch/, "a held debit would hide the spend from the balance");
    const p = await s.reservePayout("p1", NOW + HOLD, 1000, maker("p1"));
    assert.equal(p?.amountCents, 10_000);
    assert.equal(await s.reservePayout("p1", NOW + HOLD, 1000, maker("p1")), undefined, "balance spent");
    const rows = await s.ledgerOf("p1");
    assert.equal(rows.reduce((n, x) => n + x.amountCents, 0), 0, "payout debit netted the credit");
    assert.equal((await s.payoutById(p!.id))?.status, "sending");
    assert.equal((await s.payoutsOf("p1")).length, 1);
  });

  t("reservePayout: 30 PARALLEL calls on one balance give exactly ONE winner, and two partners never block or leak into each other", async (r) => {
    const s = r.store; await seedPartner(r, "p1"); await seedPartner(r, "p2");
    await s.addLedger(led("p1", 40_000)); await s.addLedger(led("p2", 25_000));
    const calls = [...Array.from({ length: 30 }, () => s.reservePayout("p1", NOW, 1000, maker("p1"))), ...Array.from({ length: 30 }, () => s.reservePayout("p2", NOW, 1000, maker("p2")))];
    const out = await Promise.all(calls);
    const w1 = out.slice(0, 30).filter(Boolean), w2 = out.slice(30).filter(Boolean);
    assert.equal(w1.length, 1, "p1: exactly one reservation"); assert.equal(w2.length, 1, "p2: exactly one reservation");
    assert.equal(w1[0]!.amountCents, 40_000); assert.equal(w2[0]!.amountCents, 25_000);
    assert.equal((await s.payoutsOf("p1")).length, 1); assert.equal((await s.payoutsOf("p2")).length, 1);
    for (const p of ["p1", "p2"]) assert.equal((await s.ledgerOf(p)).reduce((n, x) => n + x.amountCents, 0), 0);
  });

  t("reservePayout: reservations racing new credits never overdraw and never lose money (conservation)", async (r) => {
    const s = r.store; await seedPartner(r, "p1");
    await s.addLedger(led("p1", 5000));
    const credits = Array.from({ length: 12 }, (_, i) => s.addLedger(led("p1", 700 + i, { uniq: `c${i}` })));
    const reserves = Array.from({ length: 30 }, () => s.reservePayout("p1", NOW, 1000, maker("p1")));
    const [, res] = [await Promise.all(credits), await Promise.all(reserves)];
    const paid = res.filter(Boolean) as Payout[];
    const credited = 5000 + Array.from({ length: 12 }, (_, i) => 700 + i).reduce((a, b) => a + b, 0);
    const rows = await s.ledgerOf("p1");
    const net = rows.reduce((n, x) => n + x.amountCents, 0);
    assert.ok(net >= 0, "ledger never negative");
    assert.equal(paid.reduce((n, p) => n + p.amountCents, 0) + net, credited, "paid + remaining = credited");
    const payoutEntries = rows.filter((x) => x.kind === "payout");
    assert.equal(payoutEntries.length, paid.length, "every payout has exactly one ledger debit");
    for (const p of paid) assert.ok(payoutEntries.some((x) => x.payoutId === p.id && x.amountCents === -p.amountCents));
  });

  t("transitionPayout: compare-and-set; 30 parallel approve/reject give exactly one winner; partner-scoped", async (r) => {
    const s = r.store; await seedPartner(r, "p1"); await seedPartner(r, "p2");
    await s.addLedger(led("p1", 9000));
    const p = (await s.reservePayout("p1", NOW, 1000, maker("p1", "pending_approval")))!;
    assert.equal(await s.transitionPayout(p.id, "sending", "paid"), undefined, "wrong from-state");
    assert.equal(await s.transitionPayout(p.id, "pending_approval", "sending", undefined, "p2"), undefined, "wrong partner");
    const outs = await Promise.all(Array.from({ length: 30 }, (_, i) => s.transitionPayout(p.id, "pending_approval", i % 2 ? "sending" : "rejected")));
    assert.equal(outs.filter(Boolean).length, 1);
    const final = (await s.payoutById(p.id))!.status;
    assert.equal(final, outs.find(Boolean)!.status);
    assert.equal(await s.payoutById(p.id, "p2"), undefined);
    await s.putPayout({ ...(await s.payoutById(p.id))!, status: "paid", providerRef: "po_1" });
    assert.deepEqual({ s: (await s.payoutById(p.id))!.status, r: (await s.payoutById(p.id))!.providerRef }, { s: "paid", r: "po_1" });
  });

  t("failures: kept in order for the operator", async (r) => {
    await r.store.noteFailure("a", "one", NOW); await r.store.noteFailure("b", "two", NOW + 1);
    assert.deepEqual((await r.store.failures()).map((f) => f.where), ["a", "b"]);
  });

  t("held ledger rows sit out of the balance; updateLedger flips the hold; payout lifecycle fields round trip; payoutsByStatus is partner-scoped", async (r) => {
    const s = r.store; await seedPartner(r, "p1"); await seedPartner(r, "p2");
    const held = led("p1", 6000, { held: true, holdReasons: ["self_dealing_suspect", "same_email"] });
    await s.addLedger(held); await s.addLedger(led("p1", 1500));
    assert.deepEqual((await s.ledgerOf("p1")).find((x) => x.id === held.id)!.holdReasons, ["self_dealing_suspect", "same_email"]);
    assert.equal((await s.ledgerOf("p1")).find((x) => x.id !== held.id)!.held, undefined, "unheld rows carry no held flag");
    const p = await s.reservePayout("p1", NOW, 1000, maker("p1", "pending_approval"));
    assert.equal(p?.amountCents, 1500, "the held 6000c is not payable");
    assert.equal(await s.updateLedger("nope", { held: false }), undefined);
    const rel = await s.updateLedger(held.id, { held: false, holdReasons: undefined });
    assert.ok(!rel?.held); assert.equal(rel?.holdReasons, undefined);
    assert.equal((await s.reservePayout("p1", NOW, 1000, maker("p1")))?.amountCents, 6000, "released rows become payable");
    await s.putPayout({ ...p!, status: "approved_retry", sendingAt: NOW + 5, attempts: 2, heldAt: NOW + 9, reason: "r" });
    const back = (await s.payoutById(p!.id))!;
    assert.deepEqual({ st: back.status, sa: back.sendingAt, at: back.attempts, ha: back.heldAt }, { st: "approved_retry", sa: NOW + 5, at: 2, ha: NOW + 9 });
    assert.deepEqual((await s.payoutsByStatus("approved_retry")).map((x) => x.id), [p!.id]);
    assert.deepEqual((await s.payoutsByStatus("approved_retry", "p1")).map((x) => x.id), [p!.id]);
    assert.deepEqual(await s.payoutsByStatus("approved_retry", "p2"), []);
    assert.deepEqual(await s.payoutsByStatus("held"), []);
  });

  t("referralsOfPartner returns only that partner's referrals", async (r) => {
    const s = r.store; await seedPartner(r, "p1"); await seedPartner(r, "p2"); for (const a of ["a1", "a2", "a3"]) r.account(a);
    await s.putReferral({ accountId: "a1", partnerId: "p1", claimedAt: NOW }); await s.putReferral({ accountId: "a2", partnerId: "p2", claimedAt: NOW }); await s.putReferral({ accountId: "a3", partnerId: "p1", claimedAt: NOW + 1 });
    assert.deepEqual((await s.referralsOfPartner("p1")).map((x) => x.accountId), ["a1", "a3"]);
    assert.deepEqual((await s.referralsOfPartner("p2")).map((x) => x.accountId), ["a2"]);
    assert.deepEqual(await s.referralsOfPartner("p3"), []);
  });

  t("approvals: first writer wins under 30 parallel decides; the opposite decision cannot overwrite; scoped reads", async (r) => {
    const s = r.store; await seedPartner(r, "p1"); await seedPartner(r, "p2"); await s.addLedger(led("p1", 9000));
    const p = (await s.reservePayout("p1", NOW, 1000, maker("p1", "pending_approval")))!;
    const rec = (decision: "approve" | "deny", i: number): ApprovalRecord => ({ payoutId: p.id, decision, cardId: `card_${i}`, decidedAt: NOW + i, expiresAt: NOW + DAY, reason: "ok" });
    assert.equal(await r.approvals.get(p.id, "p1"), undefined);
    const outs = await Promise.all(Array.from({ length: 30 }, (_, i) => r.approvals.decide(rec(i % 2 ? "approve" : "deny", i), "p1")));
    assert.equal(outs.filter((o) => o.created).length, 1, "exactly one writer");
    const won = outs.find((o) => o.created)!.record;
    assert.ok(outs.every((o) => o.record.cardId === won.cardId && o.record.decision === won.decision), "every caller sees the winner's record");
    assert.deepEqual(await r.approvals.get(p.id, "p1"), won);
    assert.deepEqual(await r.approvals.get(p.id), won, "operator path (unscoped)");
    assert.equal(await r.approvals.get(p.id, "p2"), undefined, "another partner cannot read it");
    await assert.rejects(() => r.approvals.decide(rec("approve", 99), "p2"), /approval_payout_unknown/, "another partner cannot decide it");
    assert.deepEqual(await r.approvals.get(p.id, "p1"), won, "unchanged");
  });

  t("approvals, operator path (no partner given): first writer wins; the record belongs to the PAYOUT's partner, never the caller's", async (r) => {
    const s = r.store; await seedPartner(r, "p1"); await seedPartner(r, "p2"); await s.addLedger(led("p2", 9000));
    const p = (await s.reservePayout("p2", NOW, 1000, maker("p2", "pending_approval")))!;
    const rec = (decision: "approve" | "deny", i: number): ApprovalRecord => ({ payoutId: p.id, decision, cardId: `card_${i}`, decidedAt: NOW + i, expiresAt: NOW + DAY });
    const outs = await Promise.all(Array.from({ length: 30 }, (_, i) => r.approvals.decide(rec(i % 2 ? "approve" : "deny", i))));
    assert.equal(outs.filter((o) => o.created).length, 1, "exactly one writer");
    if (r.name === "d1") {
      assert.equal((r.fake!.db.prepare("SELECT partner_id FROM ent_payout_approvals WHERE payout_id = ?").get(p.id) as any).partner_id, "p2", "partner copied from the payout row");
      assert.equal(await r.approvals.get(p.id, "p1"), undefined);
    }
    assert.ok(await r.approvals.get(p.id, "p2"), "visible to the payout's own partner");
    if (r.name === "d1") await assert.rejects(() => r.approvals.decide({ payoutId: "pay_missing", decision: "approve", cardId: "c", decidedAt: NOW, expiresAt: NOW }), /approval_payout_unknown/, "no such payout: fail closed, no invented record");
  });

  // ---------------- cross-tenant leak test ----------------
  t("LEAK: tenant A can never read or mutate tenant B through ANY method (B's snapshot is byte-identical after every attack)", async (r) => {
    const s = r.store;
    for (const a of ["acA", "acB", "acBi"]) r.account(a);
    await s.putTenant(tenant("A", "enterprise")); await s.putTenant(tenant("B", "enterprise", { brand: { name: "CANARY_B", colour: "#000000", tagline: "CANARY_TAG" } }));
    await seedPartner(r, "PA"); await seedPartner(r, "PB");
    await s.putMember({ tenantId: "A", accountId: "acA", role: "admin", addedAt: 1 });
    await s.putMember({ tenantId: "B", accountId: "acB", role: "admin", addedAt: 1 });
    await s.putInvite({ id: "inv-B", tenantId: "B", email: "canary-b@example.test", role: "viewer", invitedBy: "acBi", createdAt: NOW, expiresAt: NOW + DAY });
    await s.putAsset({ id: "as-B", tenantId: "B", domain: "canary-b.example.test", label: "CANARY_ASSET_B", group: "g", token: "tokB", verifiedAt: NOW });
    await s.putSso({ tenantId: "B", issuer: "https://idp-b.example.test", clientId: "cidB", secret: await sealed("B", "CANARY_SSO_SECRET_B"), allowedDomains: ["canary-b.example.test"], defaultRole: "viewer" });
    await s.putSsoState({ hash: "st-B-dead", tenantId: "B", clientKey: "kB", nonceHash: "n", expiresAt: NOW - 5, used: false });
    await s.putSsoState({ hash: "st-B-live", tenantId: "B", clientKey: "kB", nonceHash: "n", expiresAt: NOW + DAY, used: false });
    await s.markSsoSession("sess-B", "B");
    await s.addAudit({ id: "au-B", tenantId: "B", actor: "acB", action: "x", target: "CANARY_AUDIT_B", at: NOW });
    await s.addLedger(led("PB", 9000, { uniq: "commission:invB" })); await s.addLedger(led("PA", 100, { uniq: "commission:invA" }));
    const pb = (await s.reservePayout("PB", NOW, 1000, maker("PB", "pending_approval")))!;
    await s.addLedger(led("PB", 4000, { uniq: "commission:invB2" }));
    r.account("acRef"); await s.putReferral({ accountId: "acRef", partnerId: "PB", claimedAt: NOW });
    await r.approvals.decide({ payoutId: pb.id, decision: "approve", cardId: "card_B", decidedAt: NOW, expiresAt: NOW + DAY, reason: "CANARY_APPROVAL_B" }, "PB");

    const snap = async () => JSON.stringify({
      t: await s.tenantById("B"), m: await s.membersOf("B"), mm: await s.membershipsFor("acB"), i: await s.invitesOf("B"), a: await s.assetsOf("B"), sso: await s.ssoOf("B"),
      states: r.rawStates("B"), sess: await s.isSsoSession("sess-B", "B"), au: await s.auditOf("B", 99), l: await s.ledgerOf("PB"), p: await s.payoutsOf("PB"), ref: await s.referralOf("acRef"), appr: await r.approvals.get(pb.id, "PB"), refs: await s.referralsOfPartner("PB"), pbs: await s.payoutsByStatus("pending_approval", "PB"),
    });
    const before = await snap();

    // READS as A with B's ids: nothing comes back
    assert.equal(await s.memberOf("A", "acB"), undefined);
    assert.ok((await s.membersOf("A")).every((m) => m.tenantId === "A" && m.accountId === "acA"));
    assert.equal(await s.inviteById("inv-B", "A"), undefined);
    assert.ok((await s.invitesOf("A")).length === 0);
    assert.equal(await s.assetOf("A", "as-B"), undefined);
    assert.deepEqual(await s.assetsOf("A"), []);
    assert.equal(await s.ssoOf("A"), undefined);
    assert.equal(await s.isSsoSession("sess-B", "A"), false);
    assert.deepEqual(await s.auditOf("A", 99), []);
    assert.deepEqual(await s.ledgerOf("PA").then((x) => x.map((e) => e.partnerId)), ["PA"]);
    assert.equal(await s.payoutById(pb.id, "PA"), undefined);
    assert.deepEqual(await s.payoutsOf("PA"), []);
    assert.deepEqual(await s.childrenOf("A"), []);
    assert.equal(await s.openSsoStates("A", NOW), 0);
    assert.equal(await s.openSsoStates("A", NOW, "kB"), 0);
    assert.equal(await r.approvals.get(pb.id, "PA"), undefined);
    assert.deepEqual(await s.referralsOfPartner("PA"), []);
    assert.deepEqual(await s.payoutsByStatus("pending_approval", "PA"), []);

    // MUTATIONS as A aimed at B's ids: all no-ops
    await s.removeMember("A", "acB");
    await s.deleteInvite("inv-B", "A");
    await s.deleteInvitesBy("acBi", "A");
    await s.putInvite({ id: "inv-B", tenantId: "A", email: "EVIL@example.test", role: "admin", invitedBy: "acA", createdAt: NOW, expiresAt: NOW + DAY });
    await s.deleteAsset("A", "as-B");
    await s.putAsset({ id: "as-B", tenantId: "A", domain: "evil.example.test", label: "EVIL", group: "g", token: "evil", verifiedAt: NOW });
    await s.putSsoState({ hash: "st-B-live", tenantId: "A", clientKey: "evil", nonceHash: "evil", expiresAt: NOW + 5, used: true });
    await s.markSsoSession("sess-B", "A");   // A marks its own pairing; B's pairing must be untouched
    assert.equal(await s.transitionPayout(pb.id, "pending_approval", "paid", undefined, "PA"), undefined);
    await s.putPayout({ ...pb, partnerId: "PA", status: "paid", providerRef: "EVIL" });
    assert.equal(await s.reservePayout("PA", NOW, 1000, maker("PA")), undefined, "PA's own 100c is under the minimum; PB's 13,000c is not PA's");
    await assert.rejects(() => s.reservePayout("PA", NOW, 50, maker("PB")), /reserve_mismatch/, "a make() callback cannot redirect A's reservation at B");
    assert.equal(await s.addLedger(led("PA", 1, { uniq: "commission:invB" })), true, "same uniq for another partner is a different row");
    await s.setEnforcement("A", true);
    await assert.rejects(() => r.approvals.decide({ payoutId: pb.id, decision: "deny", cardId: "EVIL", decidedAt: NOW, expiresAt: NOW }, "PA"), /approval_payout_unknown/);
    assert.equal((await r.approvals.get(pb.id, "PB"))!.cardId, "card_B", "B's decision untouched by A's attempt");

    assert.equal(await snap(), before, "tenant B untouched by every attack");
    assert.equal((await s.tenantById("A"))!.ssoEnforced, true, "A's own enforcement toggle worked");
    assert.equal((await s.tenantById("B"))!.ssoEnforced, false);
    assert.equal((await s.assetOf("B", "as-B"))!.label, "CANARY_ASSET_B");
    assert.equal(await s.assetOf("A", "as-B"), undefined, "A did not gain a copy under B's id");
    assert.equal((await s.inviteById("inv-B", "B"))!.email, "canary-b@example.test");
    assert.equal(r.rawStates("B"), 2, "B's expired state was not purged by A (B's own call purges it)");
    assert.equal(await s.openSsoStates("B", NOW), 1, "B's own call purges its dead state and counts the live one");
  });
}

// every public method of D1EntStore must be covered by the leak test above: adding a method without listing it here fails the build
test("LEAK coverage guard: every EntStore method is listed with its scoping rule", () => {
  const SCOPED = ["referralsOfPartner", "payoutsByStatus", "memberOf", "membersOf", "removeMember", "putMember", "invitesOf", "putInvite", "deleteInvite", "deleteInvitesBy", "putAsset", "assetsOf", "assetOf", "deleteAsset", "putSso", "ssoOf", "putSsoState", "openSsoStates", "evictOldestSsoState", "markSsoSession", "isSsoSession", "setEnforcement", "addAudit", "auditOf", "addLedger", "ledgerOf", "reservePayout", "putPayout", "transitionPayout", "payoutsOf", "childrenOf", "payoutById", "inviteById"];
  const BY_DESIGN = [  // global-key lookups or account-scoped/system operations, each with a stated reason
    "tenantById", "tenantBySlug", "putTenant", "partnerByRefCode",   // the tenant row itself; slug / ref code are public identifiers
    "membershipsFor", "removeAccount", "invitesForEmail", "putReferral", "referralOf",   // keyed by ACCOUNT (the caller's own identity), not tenant
    "verifiedAssetOwner",   // domain-uniqueness check: must see across tenants
    "consumeSsoState",      // keyed by the unguessable state hash (a capability); tenant comes back in the row
    "ledgerForInvoice", "updateLedger",     // refund clawback walks every partner's rows for one invoice
    "noteFailure", "failures",   // operator log
  ];
  const own = Object.getOwnPropertyNames(D1EntStore.prototype).filter((m) => m !== "constructor" && !["q", "all", "one", "run", "tx"].includes(m)).sort();
  assert.deepEqual([...SCOPED, ...BY_DESIGN].sort(), own);
  const mem = Object.getOwnPropertyNames(MemoryEntStore.prototype).filter((m) => m !== "constructor").sort();
  assert.deepEqual(mem, own, "both adapters expose the same method set");
});

test("D1 SQL shape: tenant id is a bound argument in every tenant-owned query; no string-built SQL; the reservation is one batch", async () => {
  const r = await d1(); const f = r.fake!; const s = r.store;
  r.account("a1");
  await s.putTenant(tenant("T-SHAPE", "enterprise")); await seedPartner(r, "P-SHAPE");
  f.log.length = 0;
  await s.membersOf("T-SHAPE"); await s.assetOf("T-SHAPE", "x"); await s.invitesOf("T-SHAPE"); await s.auditOf("T-SHAPE", 5); await s.payoutsOf("P-SHAPE"); await s.ledgerOf("P-SHAPE"); await s.ssoOf("T-SHAPE");
  for (const q of f.log) { assert.ok(!q.sql.includes("T-SHAPE") && !q.sql.includes("P-SHAPE"), `id never in SQL text: ${q.sql}`); assert.ok(q.args.includes("T-SHAPE") || q.args.includes("P-SHAPE"), `id is bound: ${q.sql}`); assert.match(q.sql, /(tenant_id|partner_id)\s*=\s*\?/); }
  await s.addLedger(led("P-SHAPE", 9000)); f.log.length = 0;
  await s.reservePayout("P-SHAPE", NOW, 1000, maker("P-SHAPE"));
  const writes = f.log.filter((q) => /^\s*INSERT/i.test(q.sql));
  assert.equal(writes.length, 2, "ledger debit and payout row travel together in one batch");
  assert.match(writes[0].sql, /WHERE \(SELECT COALESCE\(SUM/, "the debit is guarded by the balance compare-and-set");
  assert.ok(!/INSERT OR REPLACE/i.test(JSON.stringify(f.log)), "no INSERT OR REPLACE");
  await assert.rejects(async () => { const bare = new D1EntStore({ prepare: f.prepare.bind(f) } as never); await bare.addLedger(led("P-SHAPE", 5)); await bare.reservePayout("P-SHAPE", NOW, 1, maker("P-SHAPE")); }, /d1_batch_unavailable/, "no batch = fail closed, never sequential writes");
  assert.throws(() => new D1EntStore(undefined as never), /needs_db/);
  assert.throws(() => new D1ApprovalStore(undefined as never), /needs_db/);
});
