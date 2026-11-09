// C8 f313: the production BookFactsSource (src/enterprise/book_facts.ts) and the partner-scoped referral identity in the partner book.
// ALL DATA IS SYNTHETIC. One world spec is loaded into BOTH adapters (in-memory stores, and real SQLite via FakeD1 running the real
// migrations incl. 0019); every expectation below is hand-written from the spec, never read back from the code under test.
// Mutation-checked: scripts/mutate_book_facts.mjs plants each mutant and requires this suite to FAIL.
import test from "node:test";
import assert from "node:assert/strict";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { MemoryStore } from "../src/store.ts";
import { MemoryMarketStore } from "../src/market/store.ts";
import { BillingMarketBookFacts, D1BookFacts, deriveFacts, makeBookFacts } from "../src/enterprise/book_facts.ts";
import { listPartnerBook, type BookFactsSource } from "../src/enterprise/partner_book.ts";
import { sha256Hex } from "../src/util.ts";
import type { Tenant, LedgerEntry } from "../src/enterprise/types.ts";
import { FakeD1 } from "./fake_d1.ts";
import { makeEnt } from "./ent_harness.ts";

const T0 = Date.UTC(2027, 0, 1);
const tenant = (id: string, kind: "partner" | "client", parentId?: string, consent = false): Tenant => ({ id, slug: id.replace(/_/g, "-"), name: `SYNTHETIC ${id}`, kind, parentId, createdAt: T0, ssoEnforced: false, partnerAccess: consent, termsAcceptedAt: kind === "partner" ? T0 : undefined } as Tenant);

// ---- the spec (single source of truth for both adapters) ----
interface JobSpec { id: string; owner: string; domain: string; scanId: string; at: number; status?: "reproved" | "paid" }
const SPEC = {
  partners: ["ten_pa", "ten_pb"],
  clients: [["cli_a1", "ten_pa", true], ["cli_a2", "ten_pa", false], ["cli_b1", "ten_pb", true]] as [string, string, boolean][],   // a2 has NOT consented to estate sharing
  members: [["cli_a1", "acc_a1"], ["cli_a2", "acc_a2"], ["cli_b1", "acc_b1"]] as [string, string][],
  assets: [{ tenant: "cli_a1", domain: "a1.example.test", verified: true }],
  accountDomains: [{ acc: "acc_a2", domain: "a2.example.test", verified: false }, { acc: "acc_b1", domain: "b1.example.test", verified: true }, { acc: "acc_b1", domain: "a1.example.test", verified: false }, { acc: "acc_r1", domain: "r1.example.test", verified: true }, { acc: "acc_r2", domain: "r2.example.test", verified: true }, { acc: "acc_a1", domain: "a1.example.test", verified: true }],
  subs: [{ acc: "acc_a1", product: "prod_pro", tier: "pro", startedAt: T0 }, { acc: "acc_b1", product: "prod_std", tier: "standard", startedAt: T0 }, { acc: "acc_r1", product: "prod_ret", tier: "retainer_1500", startedAt: T0 }, { acc: "acc_r2", product: "prod_ret", tier: "retainer_1500", startedAt: T0 }],
  purchases: [{ acc: "acc_a2", status: "pending", amount: 150_000, refunded: 0 }],
  referrals: [["acc_r1", "ten_pa"], ["acc_r2", "ten_pb"]] as [string, string][],
  jobs: [
    { id: "j1", owner: "acc_a1", domain: "a1.example.test", scanId: "scan_a1_old", at: 50 },
    { id: "j2", owner: "acc_a1", domain: "a1.example.test", scanId: "scan_a1", at: 100, status: "paid" },
    { id: "j3", owner: "acc_a1", domain: "other.example.test", scanId: "scan_other_domain", at: 200 },          // another domain of the same client
    { id: "j4", owner: "acc_b1", domain: "a1.example.test", scanId: "scan_trap_other_client", at: 999 },        // ANOTHER client's job on a1's domain name
    { id: "j5", owner: "acc_b1", domain: "b1.example.test", scanId: "scan_b1", at: 10 },
    { id: "j6", owner: "acc_r1", domain: "r1.example.test", scanId: "scan_r1", at: 77 },
    { id: "j7", owner: "acc_r2", domain: "r2.example.test", scanId: "scan_r2", at: 88 },
  ] as JobSpec[],
};
const TIERS_ANY = (s: string) => s as never;

async function loadMemory() {
  const ent = new MemoryEntStore(), billing = new MemoryStore(), market = new MemoryMarketStore();
  for (const p of SPEC.partners) await ent.putTenant(tenant(p, "partner"));
  for (const [c, p, k] of SPEC.clients) await ent.putTenant(tenant(c, "client", p, k));
  for (const [c, a] of SPEC.members) await ent.putMember({ tenantId: c, accountId: a, role: "admin", addedAt: T0 });
  for (const a of SPEC.assets) await ent.putAsset({ id: `as_${a.domain}`, tenantId: a.tenant, domain: a.domain, label: a.domain, group: "g", token: "t", verifiedAt: a.verified ? T0 : undefined });
  SPEC.accountDomains.forEach((d, i) => billing.putDomain({ id: `dom_${i}`, accountId: d.acc, domain: d.domain, token: "t", verifiedAt: d.verified ? T0 : undefined }));
  SPEC.subs.forEach((s, i) => billing.putSubscription({ id: `sub_${i}`, accountId: s.acc, purchaseId: `pur_s${i}`, productId: s.product, startedAt: s.startedAt, plan: { tier: TIERS_ANY(s.tier) } as never }));
  SPEC.purchases.forEach((p, i) => billing.putPurchase({ id: `pur_${i}`, accountId: p.acc, productId: "prod_x", checkoutId: `co_${i}`, amountCents: p.amount, refundedCents: p.refunded, status: p.status as never, deliverableIssued: false }));
  for (const [a, p] of SPEC.referrals) await ent.putReferral({ accountId: a, partnerId: p, claimedAt: T0 });
  for (const j of SPEC.jobs) await market.putJob({ id: j.id, ownerAccountId: j.owner, domainId: `d_${j.id}`, domain: j.domain, check: "dmarc", severity: "FAIL", tier: "small", priceCents: 1000, claimFeeCents: 0, status: j.status ?? "reproved", createdAt: T0, updatedAt: T0, baseline: { at: T0, status: "FAIL", detail: "x" }, abandonedBy: [], rescans: 1, warrantyChecks: 0, events: [], proof: { scanId: j.scanId, at: j.at, baseline: "FAIL", now: "PASS", detail: "x" } } as never);
  const facts = new BillingMarketBookFacts({ ent, billing, market });
  return { ent, facts };
}
function loadD1() {
  const d = new FakeD1(), x = d.db;
  const accounts = new Set<string>([...SPEC.members.map((m) => m[1]), ...SPEC.accountDomains.map((a) => a.acc), ...SPEC.referrals.map((r) => r[0]), ...SPEC.jobs.map((j) => j.owner)]);
  for (const a of accounts) x.prepare("INSERT INTO accounts (id, email) VALUES (?, ?)").run(a, `${a}@synthetic.example.test`);
  for (const p of SPEC.partners) x.prepare("INSERT INTO tenants (id, slug, name, kind, created_at) VALUES (?,?,?, 'partner', ?)").run(p, p, p, T0);
  for (const [c, p, k] of SPEC.clients) x.prepare("INSERT INTO tenants (id, slug, name, kind, parent_id, created_at, partner_access) VALUES (?,?,?, 'client', ?, ?, ?)").run(c, c, c, p, T0, k ? 1 : 0);
  for (const [c, a] of SPEC.members) x.prepare("INSERT INTO tenant_members (tenant_id, account_id, role, added_at) VALUES (?,?, 'admin', ?)").run(c, a, T0);
  for (const a of SPEC.assets) x.prepare("INSERT INTO tenant_assets (id, tenant_id, domain, label, grp, token, verified_at) VALUES (?,?,?,?, 'g', 't', ?)").run(`as_${a.domain}`, a.tenant, a.domain, a.domain, a.verified ? T0 : null);
  SPEC.accountDomains.forEach((dm, i) => x.prepare("INSERT INTO domains (id, account_id, domain, verify_token, verified_at) VALUES (?,?,?, 't', ?)").run(`dom_${i}`, dm.acc, dm.domain, dm.verified ? "2027-01-01" : null));
  SPEC.subs.forEach((s, i) => { x.prepare("INSERT INTO purchases (id, account_id, product_id, checkout_id, amount_cents, status) VALUES (?,?,?,?,?, 'paid')").run(`pur_s${i}`, s.acc, s.product, `cos_${i}`, 150_000); x.prepare("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, plan_json) VALUES (?,?,?,?,?,?)").run(`sub_${i}`, s.acc, `pur_s${i}`, s.product, s.startedAt, JSON.stringify({ tier: s.tier })); });
  SPEC.purchases.forEach((p, i) => x.prepare("INSERT INTO purchases (id, account_id, product_id, checkout_id, amount_cents, refunded_cents, status) VALUES (?,?,'prod_x',?,?,?,?)").run(`pur_${i}`, p.acc, `co_${i}`, p.amount, p.refunded, p.status));
  for (const [a, p] of SPEC.referrals) x.prepare("INSERT INTO referrals (account_id, partner_id, claimed_at) VALUES (?,?,?)").run(a, p, T0);
  SPEC.jobs.forEach((j, i) => {
    x.prepare("INSERT INTO domains (id, account_id, domain, verify_token) VALUES (?,?,?, 't') ON CONFLICT DO NOTHING").run(`jd_${j.id}`, j.owner, `job-${j.id}.example.test`);
    x.prepare("INSERT INTO market_jobs (id, owner_account_id, domain_id, check_name, status, state_json, updated_at) VALUES (?,?,?,?,?,?,?)").run(j.id, j.owner, `jd_${j.id}`, `dmarc${i}`, j.status ?? "reproved", JSON.stringify({ id: j.id, domain: j.domain, proof: { scanId: j.scanId, at: j.at } }), T0);
  });
  return new D1BookFacts(d);
}

const EXPECT: Record<string, { domain: string | null; plan: string | null; status: string; lastRescanProofId: string | null; estateConsent: boolean }> = {
  cli_a1: { domain: "a1.example.test", plan: "pro", status: "active", lastRescanProofId: "scan_a1", estateConsent: true },
  cli_a2: { domain: null, plan: null, status: "pending", lastRescanProofId: null, estateConsent: false },   // unconsented: domain and proof withheld
  cli_b1: { domain: "b1.example.test", plan: "standard", status: "active", lastRescanProofId: "scan_b1", estateConsent: true },
};

for (const [name, load] of [["memory", async () => (await loadMemory()).facts], ["d1", async () => loadD1()]] as [string, () => Promise<BookFactsSource>][]) {
  test(`B1 ${name}: plan, status, domain and the re-scan proof id come from billing, market and estate`, async () => {
    const f = await load();
    for (const [partner, cl] of [["ten_pa", ["cli_a1", "cli_a2"]], ["ten_pb", ["cli_b1"]]] as [string, string[]][])
      for (const c of cl) assert.deepEqual(await f.factsFor(c, partner), EXPECT[c], c);
  });
  test(`B2 ${name}: a client is invisible to any partner that is not its parent; non-client ids give nothing`, async () => {
    const f = await load();
    assert.equal(await f.factsFor("cli_a1", "ten_pb"), undefined);
    assert.equal(await f.factsFor("cli_b1", "ten_pa"), undefined);
    assert.equal(await f.factsFor("ten_pa", "ten_pa"), undefined, "a partner tenant is not a client");
    assert.equal(await f.factsFor("cli_nope", "ten_pa"), undefined);
  });
  test(`B3 ${name}: the proof id is never taken from another client's job, nor from another domain of the same client`, async () => {
    const f = await load();
    const a1 = await f.factsFor("cli_a1", "ten_pa");
    assert.equal(a1?.lastRescanProofId, "scan_a1");
    assert.notEqual(a1?.lastRescanProofId, "scan_trap_other_client");
    assert.notEqual(a1?.lastRescanProofId, "scan_other_domain");
    assert.notEqual(a1?.lastRescanProofId, "scan_a1_old", "newest proof wins");
  });
  test(`B4 ${name}: a referral account resolves only for the partner its referral row names`, async () => {
    const f = await load();
    assert.deepEqual(await f.factsForAccount!("acc_r1", "ten_pa"), { domain: "r1.example.test", plan: "retainer_1500", status: "active", lastRescanProofId: "scan_r1" });
    assert.equal(await f.factsForAccount!("acc_r1", "ten_pb"), undefined);
    assert.equal(await f.factsForAccount!("acc_r2", "ten_pa"), undefined);
    assert.equal(await f.factsForAccount!("acc_a1", "ten_pa"), undefined, "a client member is not a referral");
  });
}

test("B5 deriveFacts: cancelled, refunded, ended and unknown statuses; plan falls back to the product id", () => {
  const base = { domains: [], subs: [], purchases: [], proofs: [] };
  assert.equal(deriveFacts({ ...base, subs: [{ productId: "p", startedAt: 1, cancelledAt: 5 }] }).status, "cancelled");
  assert.equal(deriveFacts({ ...base, subs: [{ productId: "p", startedAt: 1, endedAt: 5, tier: "t" }] }).status, "cancelled");
  assert.equal(deriveFacts({ ...base, subs: [{ productId: "prod_only", startedAt: 1 }] }).plan, "prod_only");
  assert.equal(deriveFacts({ ...base, purchases: [{ status: "refunded", amountCents: 100, refundedCents: 100 }] }).status, "refunded");
  assert.equal(deriveFacts({ ...base, purchases: [{ status: "paid", amountCents: 100, refundedCents: 100 }, { status: "refunded", amountCents: 1, refundedCents: 1 }] }).status, "unknown");
  assert.equal(deriveFacts(base).status, "unknown");
  assert.deepEqual(deriveFacts({ ...base, subs: [{ productId: "old", startedAt: 1 }, { productId: "new", startedAt: 9 }] }).plan, "new", "newest subscription wins");
  assert.equal(deriveFacts({ ...base, domains: [{ domain: "b.test", verified: false }, { domain: "z.test", verified: true }] }).domain, "z.test", "verified domain first");
  assert.equal(makeBookFacts({}), undefined);
  assert.ok(makeBookFacts({ DB: new FakeD1() }) instanceof D1BookFacts);
});

// ---- the partner book with the production source: referral identity, unattributed, totals to the cent ----
const led = (partnerId: string, id: string, cents: number, sourceKey: string, kind: LedgerEntry["kind"] = "commission"): LedgerEntry => ({ id, uniq: id, partnerId, kind, amountCents: cents, at: T0, availableAt: T0, sourceKey, sourceLabel: sourceKey.startsWith("ref:") ? "Referral" : "x" });
async function bookWorld() {
  const { ent, facts } = await loadMemory();
  const h10 = async (a: string) => `ref:${(await sha256Hex(a)).slice(0, 10)}`;
  await ent.putMember({ tenantId: "ten_pa", accountId: "boss_a", role: "admin", addedAt: T0 });
  await ent.putMember({ tenantId: "ten_pb", accountId: "boss_b", role: "admin", addedAt: T0 });
  await ent.addLedger(led("ten_pa", "l1", 45_001, "tenant:cli_a1"));
  await ent.addLedger(led("ten_pa", "l2", 30_003, "tenant:cli_a2"));
  await ent.addLedger(led("ten_pa", "l3", 20_007, await h10("acc_r1")));
  await ent.addLedger(led("ten_pa", "l4", 11, await h10("acc_r2")));           // a hash that belongs to PARTNER B's referral: unattributed for A
  await ent.addLedger(led("ten_pa", "l5", 5, "ref:0000000000"));               // a hash nobody owns
  await ent.addLedger(led("ten_pb", "l6", 9_999, "tenant:cli_b1"));
  await ent.addLedger(led("ten_pb", "l7", 777, await h10("acc_r2")));
  return { ent, facts, deps: { store: ent, facts } };
}
test("B6 referral rows resolve identity through the calling partner's own referral rows; foreign and unknown hashes are 'unattributed'", async () => {
  const { deps } = await bookWorld();
  const a = (await listPartnerBook(deps, "boss_a", "ten_pa")) as any;
  assert.equal(a.status, 200);
  const refs = a.body.rows.filter((r: any) => r.kind === "referral");
  assert.equal(refs.length, 3);
  const byShare = new Map<number, any>(refs.map((r: any) => [r.shareCents, r]));
  assert.deepEqual([byShare.get(20_007).identity, byShare.get(20_007).domain, byShare.get(20_007).lastRescanProofId, byShare.get(20_007).plan], ["attributed", "r1.example.test", "scan_r1", "retainer_1500"]);
  for (const c of [11, 5]) { const r = byShare.get(c); assert.deepEqual([r.identity, r.label, r.domain, r.plan, r.lastRescanProofId], ["unattributed", "Unattributed", null, null, null], `share ${c}`); }
  assert.ok(!JSON.stringify(a.body).includes("r2.example.test"), "partner B's referral identity never reaches A");
  assert.ok(!JSON.stringify(a.body).includes("acc_r"), "no account id leaks");
  const b = (await listPartnerBook(deps, "boss_b", "ten_pb")) as any;
  const bref = b.body.rows.find((r: any) => r.kind === "referral");
  assert.equal(bref.domain, "r2.example.test"); assert.equal(bref.shareCents, 777);
});
test("B7 tenant rows carry domain, plan, status, proof from the production source; totals equal the ledger sum to the cent", async () => {
  const { deps } = await bookWorld();
  const a = (await listPartnerBook(deps, "boss_a", "ten_pa")) as any;
  const row = (id: string) => a.body.rows.find((r: any) => r.clientId === id);
  assert.deepEqual([row("cli_a1").domain, row("cli_a1").plan, row("cli_a1").status, row("cli_a1").lastRescanProofId, row("cli_a1").identity], ["a1.example.test", "pro", "active", "scan_a1", "attributed"]);
  assert.deepEqual([row("cli_a2").domain, row("cli_a2").plan, row("cli_a2").status, row("cli_a2").lastRescanProofId, row("cli_a2").estateConsent], [null, null, "pending", null, false]);
  assert.equal(a.body.totals.accruedCents, 45_001 + 30_003 + 20_007 + 11 + 5);
  assert.equal(a.body.rows.reduce((n: number, r: any) => n + r.shareCents, 0), a.body.totals.accruedCents);
  assert.equal(a.body.totals.unsourcedCents, 0);
  assert.equal(a.body.rows.find((r: any) => r.clientId === "cli_b1"), undefined);
});
test("B8 fail closed: a facts source that throws never turns into an empty 200; an absent source is 503 book_unavailable", async () => {
  const { ent } = await bookWorld();
  const boom: BookFactsSource = { async factsFor() { throw new Error("billing_down"); } };
  await assert.rejects(() => listPartnerBook({ store: ent, facts: boom }, "boss_a", "ten_pa"), /billing_down/);
  const { ent: ent2 } = await loadMemory();
  const brokenEnt = Object.create(ent2, { tenantById: { value: async () => { throw new Error("ent_down"); } } });
  const f = new BillingMarketBookFacts({ ent: brokenEnt, billing: new MemoryStore(), market: new MemoryMarketStore() });
  await assert.rejects(() => f.factsFor("cli_a1", "ten_pa"), /ent_down/, "an upstream failure is an error, never empty facts");
  const e = makeEnt(); e.deps.ent!.book = undefined;
  const p = await e.provision("partner", "boss503@synthetic.example.test", "SYNTHETIC 503 partner", "syn-503");
  const res = await e.req("GET", "/api/partner/book", { token: p.session });
  assert.equal(res.status, 503);
  assert.equal((await res.json() as any).error, "book_unavailable");
});

test("B9 referralsOfPartner is partner-scoped at the store; the book passes the calling partner to the facts source", async () => {
  const { ent, deps } = await bookWorld();
  assert.deepEqual((await ent.referralsOfPartner("ten_pa")).map((r) => r.accountId), ["acc_r1"]);
  assert.deepEqual((await ent.referralsOfPartner("ten_pb")).map((r) => r.accountId), ["acc_r2"]);
  assert.deepEqual(await ent.referralsOfPartner("ten_none"), []);
  const seen: (string | undefined)[] = [];
  const spy: BookFactsSource = { async factsFor(id, p) { seen.push(p); return deps.facts.factsFor(id, p); }, async factsForAccount(a, p) { seen.push(p); return deps.facts.factsForAccount!(a, p); } };
  await listPartnerBook({ store: ent, facts: spy }, "boss_a", "ten_pa");
  assert.ok(seen.length >= 3 && seen.every((p) => p === "ten_pa"), `partner id passed on every call: ${seen}`);
});
test("B10 an ambiguous hash (two referral rows own it) is 'unattributed', never a guess", async () => {
  const { ent, deps } = await bookWorld();
  const dup = Object.create(ent, { referralsOfPartner: { value: async (p: string) => { const r = await ent.referralsOfPartner(p); return [...r, ...r]; } } });
  const a = (await listPartnerBook({ store: dup, facts: deps.facts }, "boss_a", "ten_pa")) as any;
  const r1 = a.body.rows.find((r: any) => r.kind === "referral" && r.shareCents === 20_007);
  assert.equal(r1.identity, "unattributed"); assert.equal(r1.domain, null);
});
