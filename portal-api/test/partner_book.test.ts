// C8 f311: the partner's BOOK OF CLIENTS read model (src/enterprise/partner_book.ts) and GET /partner/book.
// ALL DATA IS SYNTHETIC (3 SYNTHETIC partners x 5 SYNTHETIC clients, fixed amounts). No Stripe, no network, no payouts.
// Oracle for every money figure is computed here from the raw ledger map, never from the code under test.
// Mutation-checked: scripts/mutate_partner_book.mjs plants each mutant and requires this suite to FAIL.
import test from "node:test";
import assert from "node:assert/strict";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { RATE_V1, clawback, recordCommission } from "../src/enterprise/share.ts";
import { MemoryBookFacts, listPartnerBook, makeCursor } from "../src/enterprise/partner_book.ts";
import type { LedgerEntry, Tenant } from "../src/enterprise/types.ts";
import type { Invoice } from "../src/store.ts";
import { makeEnt } from "./ent_harness.ts";

const DAY = 86_400_000, T0 = Date.UTC(2027, 0, 1);
const P = ["ten_pa", "ten_pb", "ten_pc"] as const;
const acc = (p: string, c: number) => `acc_${p}_${c}`;
const cid = (p: string, c: number) => `cli_${p}_${c}`;
const boss = (p: string) => `boss_${p}`;

async function world() {
  const e = new MemoryEntStore(), facts = new MemoryBookFacts();
  for (const p of P) {
    await e.putTenant({ id: p, slug: p.replace("_", "-"), name: `SYNTHETIC partner ${p}`, kind: "partner", createdAt: T0, ssoEnforced: false, partnerAccess: false, termsAcceptedAt: T0 } as Tenant);
    await e.putMember({ tenantId: p, accountId: boss(p), role: "admin", addedAt: T0 });
    await e.putMember({ tenantId: p, accountId: `viewer_${p}`, role: "viewer", addedAt: T0 });
    for (let c = 0; c < 5; c++) {
      await e.putTenant({ id: cid(p, c), slug: cid(p, c).replace(/_/g, "-"), name: `SYNTHETIC client ${p} #${c}`, kind: "client", parentId: p, createdAt: T0, ssoEnforced: false, partnerAccess: false } as Tenant);
      await e.putMember({ tenantId: cid(p, c), accountId: acc(p, c), role: "admin", addedAt: T0 });
      facts.set(cid(p, c), { domain: `synthetic-${p}-${c}.example.test`, plan: "retainer_1500", status: "active", lastRescanProofId: `proof_${p}_${c}` });
    }
  }
  const invs: Invoice[] = [];
  let n = 0;
  for (const [pi, p] of P.entries()) for (let c = 0; c < 5; c++) {
    const amount = 150_000 + pi * 7_001 + c * 1_337 + 3;   // distinct per partner and client; non-round so floors matter
    const inv: Invoice = { id: `inv_${p}_${c}`, accountId: acc(p, c), purchaseId: `pur_${p}_${c}`, number: `SYN-${n++}`, productId: "synthetic", amountCents: amount, issuedAt: T0 + c * DAY, stripeEventId: `evt_${p}_${c}` };
    invs.push(inv);
    await recordCommission(e, RATE_V1, inv, inv.issuedAt);
  }
  return { e, facts, invs, deps: { store: e, facts } };
}
const sumLedger = (e: MemoryEntStore, partnerId: string, kinds: string[]) => [...e.ledger.values()].filter((x) => x.partnerId === partnerId && kinds.includes(x.kind)).reduce((n, x) => n + x.amountCents, 0);
const allPages = async (deps: any, caller: string, pid: string, limit: number) => {
  const rows: any[] = []; let cursor: string | undefined; let last: any;
  for (let i = 0; i < 50; i++) { const r = await listPartnerBook(deps, caller, pid, { limit, cursor }); assert.equal(r.status, 200); last = r.body; rows.push(...(r.body as any).rows); cursor = (r.body as any).nextCursor ?? undefined; if (!cursor) break; }
  return { rows, last };
};

test("T1 isolation: 3 partners x 5 clients, partner A never sees B or C rows or totals", async () => {
  const { deps } = await world();
  for (const p of P) {
    const r = await listPartnerBook(deps, boss(p), p);
    assert.equal(r.status, 200);
    const b = (r as any).body;
    assert.equal(b.partnerId, p);
    assert.equal(b.rows.length, 5);
    assert.deepEqual(b.rows.map((x: any) => x.clientId).sort(), [0, 1, 2, 3, 4].map((c) => cid(p, c)).sort());
    const text = JSON.stringify(b);
    for (const other of P.filter((x) => x !== p)) { assert.ok(!text.includes(other), `${p} body mentions ${other}`); assert.ok(!text.includes(`proof_${other}`)); assert.ok(!text.includes(`synthetic-${other}-`)); }
    for (const row of b.rows) assert.ok(row.label.includes(p) && row.domain.includes(p) && row.lastRescanProofId.includes(p));
  }
  // totals differ per partner (distinct amounts), so a shared total would show
  const tot = await Promise.all(P.map(async (p) => ((await listPartnerBook(deps, boss(p), p)) as any).body.totals.accruedCents));
  assert.equal(new Set(tot).size, 3);
});

test("T1b isolation holds even if the store adapter is mis-scoped (ledgerOf / childrenOf return EVERYTHING)", async () => {
  const { e, facts } = await world();
  const leaky = Object.create(e) as MemoryEntStore;
  leaky.ledgerOf = async () => [...e.ledger.values()];
  leaky.childrenOf = async () => [...e.tenants.values()].filter((t) => t.kind === "client");
  const r = (await listPartnerBook({ store: leaky, facts }, boss(P[0]), P[0])) as any;
  assert.equal(r.status, 200);
  assert.equal(r.body.rows.length, 5, "only partner A's own five clients");
  assert.ok(r.body.rows.every((x: any) => x.label.includes(P[0])));
  assert.equal(r.body.totals.accruedCents, sumLedger(e, P[0], ["commission", "clawback"]) + 0, "leaky adapter must not inflate the total");
});

test("T2 totals equal the ledger to the cent (commission, clawback, held, paid out), per partner and across pages", async () => {
  const { e, deps, invs } = await world();
  // partial refund on client 1, full refund on client 2, a payout on partner A, a held commission on partner B client 0
  await clawback(e, [invs.find((i) => i.id === `inv_${P[0]}_1`)!], 77_777, T0 + 9 * DAY);
  await clawback(e, [invs.find((i) => i.id === `inv_${P[0]}_2`)!], invs.find((i) => i.id === `inv_${P[0]}_2`)!.amountCents, T0 + 9 * DAY);
  const pay: LedgerEntry = { id: "led_pay", uniq: "payout:1", partnerId: P[0], kind: "payout", amountCents: -12_345, at: T0 + 40 * DAY, availableAt: T0 + 40 * DAY, payoutId: "po_1" };
  await e.addLedger(pay);
  const held = [...e.ledger.values()].find((x) => x.partnerId === P[1] && x.invoiceId === `inv_${P[1]}_0`)!;
  await e.updateLedger(held.id, { held: true, holdReasons: ["SYNTHETIC"] });
  for (const p of P) {
    const { rows, last } = await allPages(deps, boss(p), p, 2);
    assert.equal(rows.length, 5);
    const rowSum = rows.reduce((n, r) => n + r.shareCents, 0);
    const t = last.totals;
    assert.equal(t.accruedCents, sumLedger(e, p, ["commission", "clawback"]), `${p} accrued != ledger`);
    assert.equal(rowSum, t.accruedCents, `${p} rows do not add to the total`);
    assert.equal(t.commissionCents, sumLedger(e, p, ["commission"]));
    assert.equal(t.clawbackCents, sumLedger(e, p, ["clawback"]));
    assert.equal(t.paidOutCents, sumLedger(e, p, ["payout", "payout_reversal"]));
    assert.equal(t.unsourcedCents, 0);
    assert.ok(Number.isInteger(t.accruedCents) && rows.every((r) => Number.isInteger(r.shareCents)));
  }
  const a = (await listPartnerBook(deps, boss(P[0]), P[0])) as any;
  assert.equal(a.body.totals.paidOutCents, -12_345);
  assert.equal((await listPartnerBook(deps, boss(P[1]), P[1]) as any).body.totals.heldCents, held.amountCents);
});

test("T3 unattributed, refunded-in-policy, deleted and referral clients follow the ledger rules", async () => {
  const { e, deps, invs, facts } = await world();
  // an unattributed account: pays, but belongs to no partner tenant and has no referral -> no ledger line, no row anywhere
  const orphan: Invoice = { id: "inv_orphan", accountId: "acc_orphan", purchaseId: "pur_orphan", number: "SYN-O", productId: "synthetic", amountCents: 999_999, issuedAt: T0, stripeEventId: "evt_orphan" };
  assert.equal(await recordCommission(e, RATE_V1, orphan, T0), undefined);
  // a client tenant with NO parent link that mentions partner A in its name
  await e.putTenant({ id: "cli_loose", slug: "cli-loose", name: `SYNTHETIC loose client of ${P[0]}`, kind: "client", createdAt: T0, ssoEnforced: false, partnerAccess: false } as Tenant);
  // a partner whose terms are NOT accepted earns nothing, so its client has zero share but IS attributed by parent
  await e.putTenant({ id: "ten_pd", slug: "ten-pd", name: "SYNTHETIC partner D (terms unsigned)", kind: "partner", createdAt: T0, ssoEnforced: false, partnerAccess: false } as Tenant);
  await e.putMember({ tenantId: "ten_pd", accountId: boss("ten_pd"), role: "admin", addedAt: T0 });
  await e.putTenant({ id: "cli_d0", slug: "cli-d0", name: "SYNTHETIC client D0", kind: "client", parentId: "ten_pd", createdAt: T0, ssoEnforced: false, partnerAccess: false } as Tenant);
  await e.putMember({ tenantId: "cli_d0", accountId: "acc_d0", role: "admin", addedAt: T0 });
  assert.equal(await recordCommission(e, RATE_V1, { ...orphan, id: "inv_d0", accountId: "acc_d0" }, T0), undefined);
  // full refund in policy on client 3, partial on client 4, deletion of client 0 (history kept)
  const inv3 = invs.find((i) => i.id === `inv_${P[0]}_3`)!, inv4 = invs.find((i) => i.id === `inv_${P[0]}_4`)!;
  await clawback(e, [inv3], inv3.amountCents, T0 + 5 * DAY);
  await clawback(e, [inv4], Math.floor(inv4.amountCents / 3), T0 + 5 * DAY);
  await e.putTenant({ ...(await e.tenantById(cid(P[0], 0)))!, deletedAt: T0 + 6 * DAY });
  // a referral-attributed payer for partner A
  await e.putReferral({ accountId: "acc_ref", partnerId: P[0], claimedAt: T0 });
  const ref: Invoice = { ...orphan, id: "inv_ref", accountId: "acc_ref", amountCents: 20_001 };
  await recordCommission(e, RATE_V1, ref, T0 + DAY);

  const a = (await listPartnerBook(deps, boss(P[0]), P[0])) as any;
  const byId = new Map<string, any>(a.body.rows.map((r: any) => [r.clientId ?? "ref", r]));
  assert.ok(![...byId.keys()].includes("cli_loose"), "unparented tenant never appears");
  assert.ok(!JSON.stringify(a.body).includes("acc_orphan") && !JSON.stringify(a.body).includes("999999"));
  assert.equal(byId.get(cid(P[0], 3)).status, "refunded");
  assert.equal(byId.get(cid(P[0], 3)).shareCents, 0, "fully refunded in policy nets to zero");
  assert.equal(byId.get(cid(P[0], 4)).status, "active");
  assert.equal(byId.get(cid(P[0], 4)).shareCents, sumLedger(e, P[0], ["commission", "clawback"]) - [...byId.values()].filter((r) => r !== byId.get(cid(P[0], 4))).reduce((n, r) => n + r.shareCents, 0));
  assert.equal(byId.get(cid(P[0], 0)).status, "closed", "deleted client keeps its historic share, flagged closed");
  assert.ok(byId.get(cid(P[0], 0)).shareCents > 0);
  assert.equal(byId.get("ref").kind, "referral");
  assert.equal(byId.get("ref").shareCents, Math.floor((20_001 * 3000) / 10_000));
  assert.equal(a.body.totals.accruedCents, sumLedger(e, P[0], ["commission", "clawback"]));
  assert.equal(a.body.totals.unsourcedCents, 0);
  const d = (await listPartnerBook(deps, boss("ten_pd"), "ten_pd")) as any;
  assert.equal(d.body.rows.length, 1); assert.equal(d.body.rows[0].shareCents, 0); assert.equal(d.body.totals.accruedCents, 0);
  assert.ok(facts);
});

test("T3b a corrupt ledger line pointing at ANOTHER partner's client is never shown as a row and is surfaced in unsourcedCents", async () => {
  const { e, deps } = await world();
  await e.addLedger({ id: "led_bad", uniq: "commission:bad", partnerId: P[0], kind: "commission", amountCents: 4_242, at: T0, availableAt: T0, sourceKey: `tenant:${cid(P[1], 0)}`, sourceLabel: "SYNTHETIC corrupt" });
  const r = (await listPartnerBook(deps, boss(P[0]), P[0])) as any;
  assert.equal(r.body.rows.length, 5);
  assert.ok(!JSON.stringify(r.body).includes(cid(P[1], 0)) && !JSON.stringify(r.body).includes("proof_ten_pb_0"));
  assert.equal(r.body.totals.unsourcedCents, 4_242);
  assert.equal(r.body.totals.accruedCents, sumLedger(e, P[0], ["commission", "clawback"]), "total still equals the ledger to the cent");
});

test("T4 not-my-partner: empty 403, zero rows, and the foreign ledger is never even read", async () => {
  const { e, facts } = await world();
  const reads: string[] = [];
  const spy = new Proxy(e, { get(t, k, r) { const v = Reflect.get(t, k, r); return typeof v === "function" && (k === "ledgerOf" || k === "childrenOf") ? (...a: any[]) => { reads.push(`${String(k)}:${a[0]}`); return v.apply(t, a); } : typeof v === "function" ? v.bind(t) : v; } });
  const deps = { store: spy as MemoryEntStore, facts };
  const cases: [string, unknown][] = [
    [boss(P[0]), P[1]], [boss(P[1]), P[0]], [acc(P[0], 0), cid(P[0], 0)], [boss(P[0]), "ten_nope"], [boss(P[0]), cid(P[0], 0)], [`viewer_${P[0]}`, P[0]], [acc(P[0], 0), P[0]],
    ["acc_stranger", P[0]], [boss(P[0]), undefined], [boss(P[0]), ""], [boss(P[0]), `${P[0]}/../${P[1]}`], [boss(P[0]), { toString: () => P[0] }],
  ];
  for (const [caller, pid] of cases) {
    const r = await listPartnerBook(deps, caller, pid);
    assert.equal(r.status, 403, `${caller} -> ${String(pid)}`);
    assert.equal(r.body, null, "403 body is empty");
  }
  assert.deepEqual(reads, [], "no ledger or child read happens before the guard passes");
  // a deleted partner seat is also an empty 403
  await e.putTenant({ ...(await e.tenantById(P[2]))!, deletedAt: T0 });
  assert.equal((await listPartnerBook(deps, boss(P[2]), P[2])).status, 403);
});

test("T5 pagination: pages are disjoint and complete; a cursor cannot be forged to cross tenants", async () => {
  const { deps } = await world();
  const { rows } = await allPages(deps, boss(P[0]), P[0], 2);
  assert.equal(rows.length, 5); assert.equal(new Set(rows.map((r) => r.clientId)).size, 5);
  const first = (await listPartnerBook(deps, boss(P[0]), P[0], { limit: 2 })) as any;
  assert.ok(first.body.nextCursor);
  // B replaying A's cursor: refused, zero rows
  const replay = await listPartnerBook(deps, boss(P[1]), P[1], { cursor: first.body.nextCursor });
  assert.equal(replay.status, 400); assert.deepEqual(replay.body, { error: "invalid_cursor" });
  // a cursor hand-built for B's key space but presented under A's id: partner binding fails
  const forgedForB = await makeCursor(P[1], `tenant:${cid(P[1], 0)}`);
  assert.equal((await listPartnerBook(deps, boss(P[0]), P[0], { cursor: forgedForB })).status, 400);
  // a correctly bound cursor carrying a FOREIGN row key can only position inside A's own rows
  const crafted = await makeCursor(P[0], `tenant:${cid(P[1], 4)}`);
  const r = (await listPartnerBook(deps, boss(P[0]), P[0], { cursor: crafted, limit: 100 })) as any;
  assert.equal(r.status, 200);
  assert.ok(r.body.rows.every((x: any) => x.label.includes(P[0])), "only A rows");
  assert.ok(!JSON.stringify(r.body).includes(P[1]));
  // garbage, wrong version, injection, oversize
  for (const bad of ["x", "v2.0000000000000000.YQ", `v1.${"0".repeat(16)}.!!!`, "v1." + "a".repeat(5000), "../../etc/passwd", 7, {}]) assert.equal((await listPartnerBook(deps, boss(P[0]), P[0], { cursor: bad as any })).status, 400, String(bad));
  for (const bad of [0, -1, 101, 1.5, "abc", "1e3"]) assert.equal((await listPartnerBook(deps, boss(P[0]), P[0], { limit: bad as any })).status, 400, `limit ${bad}`);
  // the totals on every page cover the WHOLE book, not the page
  const full = ((await listPartnerBook(deps, boss(P[0]), P[0])) as any).body.totals;
  assert.deepEqual(first.body.totals, full);
});

test("T6 HTTP: GET /partner/book and /api/partner/book through the session guard (empty 403, no leak, 401 unauthenticated, 404 wrong method)", async () => {
  const h = makeEnt();
  const prov = async (k: string) => h.provision("partner", `boss-${k}@msp${k}.com.au`, `Msp${k}`, `msp-${k}`, { termsAccepted: true, payoutAccount: `acct_canary_${k}` });
  const p1 = await prov("one"), p2 = await prov("two");
  const mk = async (partner: typeof p1, key: string) => {
    const email = `owner-${key}@client${key}.com.au`, c = await h.login(email);
    const portal = await h.post(partner.session, `/partners/${partner.tenant.id}/portals`, { name: `Client${key}Name`, slug: `client-${key}`, clientAdminEmail: email });
    const inv = (await h.get(c.session, "/invites")).invites[0]; await h.post(c.session, `/invites/${inv.id}/accept`);
    h.book.set(portal.id, { domain: `${key}.example.test`, plan: "leads_starter", status: "active", lastRescanProofId: `proof_${key}` });
    await h.req("POST", "/checkout", { token: c.session, body: { product: "leads_starter" } }); await h.pay("leads_starter");
    return portal.id as string;
  };
  const c1 = await mk(p1, "alpha"), c2 = await mk(p2, "beta");
  for (const base of ["/partner/book", "/api/partner/book"]) {
    const own = await h.req("GET", `${base}?partnerId=${p1.tenant.id}`, { token: p1.session });
    assert.equal(own.status, 200, base);
    const b = await own.json() as any;
    assert.deepEqual(b.rows.map((r: any) => r.clientId), [c1]);
    assert.equal(b.rows[0].lastRescanProofId, "proof_alpha");
    const led = (await h.get(p1.session, `/partners/${p1.tenant.id}/ledger`));
    assert.equal(b.totals.accruedCents, led.entries.filter((x: any) => x.kind === "commission" || x.kind === "clawback").reduce((n: number, x: any) => n + x.amountCents, 0));
    assert.ok(b.totals.accruedCents > 0);
    assert.ok(!JSON.stringify(b).includes("Clientbeta") && !JSON.stringify(b).includes(c2) && !JSON.stringify(b).includes("acct_canary"));
    const implicit = await h.req("GET", base, { token: p1.session });   // no partnerId = the caller's only partner seat
    assert.equal(implicit.status, 200); assert.deepEqual((await implicit.json() as any).rows.map((r: any) => r.clientId), [c1]);
    for (const url of [`${base}?partnerId=${p2.tenant.id}`, `${base}?partnerId=ten_00000000000000ff`, `${base}?partnerId=${c1}`]) {
      const r = await h.req("GET", url, { token: p1.session });
      assert.equal(r.status, 403, url); assert.equal(await r.text(), "", "empty body");
    }
    assert.equal((await h.req("GET", base)).status, 401);
    assert.equal((await h.req("POST", `${base}?partnerId=${p1.tenant.id}`, { token: p1.session })).status, 404);
    assert.equal((await h.req("GET", `${base}?partnerId=${p1.tenant.id}&cursor=nope`, { token: p1.session })).status, 400);
  }
  // ambiguity: a caller holding TWO partner seats and no partnerId gets an empty 403, never a guess
  const meId = (await h.get(p1.session, "/me")).id as string;
  await h.store.putMember({ tenantId: p2.tenant.id, accountId: meId, role: "admin", addedAt: 1 });
  const amb = await h.req("GET", "/partner/book", { token: p1.session });
  assert.equal(amb.status, 403); assert.equal(await amb.text(), "");
  assert.equal((await h.req("GET", `/partner/book?partnerId=${p2.tenant.id}`, { token: p1.session })).status, 200, "explicit id still works for a real member");
  await h.store.removeMember(p2.tenant.id, meId);
  // SSO-enforced seat: a non-SSO session is refused 401 before any row is read
  await h.ireq(`/internal/tenants/${p1.tenant.id}/sso-enforce`, { enabled: true });
  const sso = await h.req("GET", `/partner/book?partnerId=${p1.tenant.id}`, { token: p1.session });
  assert.equal(sso.status, 401); assert.ok(!(await sso.text()).includes("proof_alpha"));
  await h.ireq(`/internal/tenants/${p1.tenant.id}/sso-enforce`, { enabled: false });
  // a client admin (not a partner member) gets the same empty 403
  const cl = await h.login("owner-alpha@clientalpha.com.au");
  const r = await h.req("GET", `/partner/book?partnerId=${p1.tenant.id}`, { token: cl.session });
  assert.equal(r.status, 403); assert.equal(await r.text(), "");
  const none = await h.req("GET", "/partner/book", { token: cl.session }); assert.equal(none.status, 403);
});
