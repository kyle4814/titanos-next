// f88: seeded PROPERTY suite for the C8 revenue-share money arithmetic (src/enterprise/share.ts).
// ALL DATA IS SYNTHETIC: a fixed-seed PRNG drives 5,000 invoice events across 3 SYNTHETIC partner tenants. No Stripe, no
// network, no payouts. Everything is integer cents; the oracle is BigInt so it cannot share a float error with the code.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MemoryEntStore, availableCents } from "../src/enterprise/store.ts";
import { RATE_V1, HOLD_DAYS, balanceCents, clawback, commissionCents, recordCommission, splitCents, statement } from "../src/enterprise/share.ts";
import type { LedgerEntry, RateTable, Tenant } from "../src/enterprise/types.ts";
import type { Invoice } from "../src/store.ts";

const DAY = 86_400_000;
const SEED = 0x5ca1ab1e;
const N_EVENTS = 5000;
const T0 = Date.UTC(2027, 0, 1); // SYNTHETIC calendar: Jan to Mar 2027
// SYNTHETIC rate table with tiers so the 3000 / 4000 / 5000 bps paths are all exercised
const RATES: RateTable = { ...RATE_V1, version: "SYNTHETIC-f88", tiers: [{ minActive: 3, bps: 4000 }, { minActive: 4, bps: 5000 }] };

function mulberry32(a: number) {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pass: Record<string, number> = {};
const ok = (inv: string) => { pass[inv] = (pass[inv] ?? 0) + 1; };
const bigFloor = (a: number, b: number, d: number) => Number((BigInt(a) * BigInt(b)) / BigInt(d)); // exact floor(a*b/d)

// tenant ids are ADVERSARIAL on purpose: shared prefixes, case twins, a LIKE-wildcard lookalike
const PARTNERS = ["ten_a", "ten_ab", "ten_A"];
interface Ev { inv: Invoice; partnerIdx: number; refund?: { refunded: number; at: number; kind: "full" | "partial" | "over" }; group?: Invoice[] }

async function run() {
  const rnd = mulberry32(SEED);
  const pick = (n: number) => Math.floor(rnd() * n);
  const e = new MemoryEntStore();
  for (const [i, id] of PARTNERS.entries()) {
    await e.putTenant({ id, slug: id.toLowerCase() + i, name: `SYNTHETIC partner ${id}`, kind: "partner", createdAt: T0, ssoEnforced: false, partnerAccess: false, termsAcceptedAt: T0 } as Tenant);
    for (let c = 0; c < 5; c++) {
      const cid = `cli_${id}_${c}`, acc = `acc_${id}_${c}`;
      await e.putTenant({ id: cid, slug: cid.toLowerCase() + i, name: `SYNTHETIC client ${cid}`, kind: "client", parentId: id, createdAt: T0, ssoEnforced: false, partnerAccess: false } as Tenant);
      await e.putMember({ tenantId: cid, accountId: acc, role: "admin", addedAt: T0 });
    }
  }
  const events: Ev[] = [];
  const bank = [14_900, 49_700, 150_000, 250_000, 349_700, 500_000];
  let pending: Invoice[] = [];
  for (let i = 0; i < N_EVENTS; i++) {
    const partnerIdx = pick(3), c = pick(5), r = rnd();
    const gross = r < 0.3 ? 1 + pick(999) : r < 0.7 ? 1000 + pick(99_000) : r < 0.9 ? bank[pick(bank.length)] + pick(7) : 100_000 + pick(50_000_000);
    const at = T0 + Math.floor((i / N_EVENTS) * 85 * DAY) + pick(DAY / 4);
    const inv: Invoice = { id: `inv_syn_${i}`, accountId: `acc_${PARTNERS[partnerIdx]}_${c}`, purchaseId: `pur_syn_${i}`, number: `SYN-${i}`, productId: "synthetic", amountCents: gross, issuedAt: at, stripeEventId: `evt_syn_${i}` };
    const ev: Ev = { inv, partnerIdx };
    const k = rnd();
    if (k < 0.1) ev.refund = { refunded: gross, at: at + (1 + pick(5)) * DAY, kind: "full" };
    else if (k < 0.2) ev.refund = { refunded: 1 + pick(Math.max(1, gross - 1)), at: at + (1 + pick(5)) * DAY, kind: "partial" };
    else if (k < 0.23) ev.refund = { refunded: gross + 1 + pick(10_000), at: at + (1 + pick(5)) * DAY, kind: "over" };
    events.push(ev);
  }
  // record every commission in time order (the service records at issue time: now = invoice time)
  for (const ev of events) await recordCommission(e, RATES, ev.inv, ev.inv.issuedAt);
  // refunds in time order
  const refunds = events.filter((x) => x.refund).sort((a, b) => a.refund!.at - b.refund!.at);
  for (const ev of refunds) await clawback(e, [ev.inv], ev.refund!.refunded, ev.refund!.at);
  return { e, events, refunds };
}
const world = await run();
const allLedger = [...world.e.ledger.values()];
const commissions = allLedger.filter((x) => x.kind === "commission");
const claws = allLedger.filter((x) => x.kind === "clawback");

test("INV1 conservation: partner share + platform share === gross exactly, remainder to the platform, floor rule", async () => {
  const byInv = new Map(commissions.map((c) => [c.invoiceId!, c]));
  for (const { inv } of world.events) {
    const ent = byInv.get(inv.id);
    const bps = ent?.rateBps ?? 3000;
    const s = splitCents(inv.amountCents, bps);
    assert.equal(s.partnerCents + s.platformCents, inv.amountCents, `${inv.id} lost or created a cent`);
    assert.equal(s.partnerCents, bigFloor(inv.amountCents, bps, 10_000), `${inv.id} partner share is not the BigInt floor`);
    assert.ok(s.platformCents >= 0 && s.platformCents >= inv.amountCents - s.partnerCents, "platform keeps the remainder");
    const rem = (BigInt(inv.amountCents) * BigInt(bps)) % 10_000n;
    assert.ok(s.partnerCents * 10_000 <= inv.amountCents * bps || rem === 0n, "never rounds in the partner's favour");
    if (ent) assert.equal(ent.amountCents, s.partnerCents, `${inv.id} ledger line differs from the split`);
    else assert.equal(s.partnerCents, 0, `${inv.id} has no ledger line but a non-zero share`);
    ok("INV1");
  }
  // documented remainder cases, hand-checked (SYNTHETIC)
  assert.deepEqual(splitCents(1, 3000), { partnerCents: 0, platformCents: 1 });
  assert.deepEqual(splitCents(3, 3000), { partnerCents: 0, platformCents: 3 }); // 0.9 cents rounds DOWN to 0
  assert.deepEqual(splitCents(4, 3000), { partnerCents: 1, platformCents: 3 }); // 1.2 -> 1
  assert.deepEqual(splitCents(5, 3000), { partnerCents: 1, platformCents: 4 }); // 1.5 rounds DOWN (half down), not up
  assert.deepEqual(splitCents(15, 3000), { partnerCents: 4, platformCents: 11 }); // 4.5 -> 4, half-cent stays with the platform
  assert.deepEqual(splitCents(99_999, 3333), { partnerCents: 33_329, platformCents: 66_670 });
  ok("INV1");
  // sum over the whole run: partner total + platform total === gross total
  const gross = world.events.reduce((n, x) => n + x.inv.amountCents, 0);
  const partner = commissions.reduce((n, x) => n + x.amountCents, 0);
  const platform = world.events.reduce((n, x) => n + splitCents(x.inv.amountCents, byInv.get(x.inv.id)?.rateBps ?? 3000).platformCents, 0);
  assert.equal(partner + platform, gross);
  ok("INV1");
  // rate tiers were genuinely exercised
  const rates = new Set(commissions.map((c) => c.rateBps));
  assert.ok(rates.has(3000) && rates.has(4000) && rates.has(5000), `rates seen: ${[...rates]}`);
});

test("INV2 no negative, fractional or unsafe amount anywhere in the ledger", () => {
  for (const x of allLedger) {
    assert.ok(Number.isSafeInteger(x.amountCents), `${x.uniq} not a safe integer: ${x.amountCents}`);
    assert.ok(Number.isSafeInteger(x.at) && Number.isSafeInteger(x.availableAt));
    if (x.kind === "commission") assert.ok(x.amountCents > 0, "commission lines are strictly positive");
    if (x.kind === "clawback") assert.ok(x.amountCents < 0, "clawback lines are strictly negative");
    ok("INV2");
  }
  for (const ev of world.events) for (const bps of [1, 3000, 3333, 4000, 5000, 9999, 10_000]) {
    const s = splitCents(ev.inv.amountCents, bps);
    assert.ok(Number.isInteger(s.partnerCents) && Number.isInteger(s.platformCents) && s.partnerCents >= 0 && s.platformCents >= 0);
    assert.equal(s.partnerCents + s.platformCents, ev.inv.amountCents);
    ok("INV2");
  }
  assert.equal(commissionCents(-500, 3000), 0, "a negative gross never yields a negative commission");
  assert.equal(commissionCents(0, 3000), 0);
  ok("INV2");
});

test("INV3 refunds reduce the share by exactly the credited amount (full), the exact floor fraction (partial), never below zero", () => {
  const comm = new Map(commissions.map((c) => [c.invoiceId!, c]));
  const clawOf = new Map<string, number>();
  for (const c of claws) clawOf.set(c.invoiceId!, (clawOf.get(c.invoiceId!) ?? 0) + c.amountCents);
  for (const ev of world.refunds) {
    const c = comm.get(ev.inv.id), clawed = 0 - (clawOf.get(ev.inv.id) ?? 0);
    const credited = c?.amountCents ?? 0;
    const refunded = ev.refund!.refunded;
    assert.ok(clawed >= 0 && clawed <= credited, `${ev.inv.id}: clawed ${clawed} outside [0, ${credited}]`);
    assert.ok(credited - clawed >= 0, "net share never below zero");
    if (refunded >= ev.inv.amountCents) assert.equal(clawed, credited, `${ev.inv.id}: a full or over refund must claw exactly the credited amount`);
    else assert.equal(clawed, bigFloor(credited, refunded, ev.inv.amountCents), `${ev.inv.id}: partial clawback is not the exact floor(commission*refunded/gross)`);
    ok("INV3");
  }
  // every invoice (refunded or not): net >= 0
  const net = new Map<string, number>();
  for (const x of allLedger) if (x.invoiceId) net.set(x.invoiceId, (net.get(x.invoiceId) ?? 0) + x.amountCents);
  for (const [id, v] of net) { assert.ok(v >= 0, `${id} net ${v} < 0`); ok("INV3"); }
});

test("INV3b multi-invoice purchases: group refund claws each invoice by its own exact share, no cent invented", async () => {
  const rnd = mulberry32(SEED ^ 0xabcdef);
  let groups = 0;
  for (let g = 0; g < 200; g++) {
    const e = new MemoryEntStore();
    await e.putTenant({ id: "ten_g", slug: "g", name: "SYNTHETIC partner g", kind: "partner", createdAt: T0, ssoEnforced: false, partnerAccess: false, termsAcceptedAt: T0 } as Tenant);
    await e.putTenant({ id: "cli_g", slug: "cg", name: "SYNTHETIC client g", kind: "client", parentId: "ten_g", createdAt: T0, ssoEnforced: false, partnerAccess: false } as Tenant);
    await e.putMember({ tenantId: "cli_g", accountId: "acc_g", role: "admin", addedAt: T0 });
    const invs: Invoice[] = [];
    for (let k = 0; k < 3; k++) invs.push({ id: `inv_g${g}_${k}`, accountId: "acc_g", purchaseId: `pur_g${g}`, number: "S", productId: "s", amountCents: 100 + Math.floor(rnd() * 400_000), issuedAt: T0, stripeEventId: `e${g}${k}` });
    for (const i of invs) await recordCommission(e, RATE_V1, i, T0);
    const total = invs.reduce((n, i) => n + i.amountCents, 0);
    const refunded = Math.floor(rnd() * total * 1.2);
    await clawback(e, invs, refunded, T0 + DAY);
    for (const i of invs) {
      const led = await e.ledgerForInvoice(i.id);
      const c = led.filter((x) => x.kind === "commission").reduce((n, x) => n + x.amountCents, 0);
      const k = -led.filter((x) => x.kind === "clawback").reduce((n, x) => n + x.amountCents, 0);
      const want = refunded >= total ? c : bigFloor(c, refunded, total);
      assert.equal(k, want, `group ${g} ${i.id}`);
      assert.ok(c - k >= 0);
      ok("INV3b");
    }
    groups++;
  }
  assert.equal(groups, 200);
});

test("INV4 replaying the same event id is a no-op (commission and clawback), ledger bytes unchanged", async () => {
  const before = JSON.stringify(allLedger.map((x) => [x.uniq, x.partnerId, x.amountCents, x.availableAt]).sort());
  const balBefore = await Promise.all(PARTNERS.map((p) => balanceCents(world.e, p, T0 + 400 * DAY)));
  let replayed = 0;
  for (const ev of world.events.filter((_, i) => i % 5 === 0)) { // stride 5: the memory adapter scans the ledger per write (O(n)), so a full replay costs 16 s
    const again = await recordCommission(world.e, RATES, ev.inv, ev.inv.issuedAt + 3 * DAY); // later clock, same invoice id
    assert.equal(again, undefined, `${ev.inv.id} replay wrote a second commission`);
    ok("INV4"); replayed++;
  }
  for (const ev of world.refunds.filter((_, i) => i % 5 === 0)) { await clawback(world.e, [ev.inv], ev.refund!.refunded, ev.refund!.at + DAY); await clawback(world.e, [ev.inv], ev.refund!.refunded, ev.refund!.at + 2 * DAY); ok("INV4"); }
  const after = JSON.stringify([...world.e.ledger.values()].map((x) => [x.uniq, x.partnerId, x.amountCents, x.availableAt]).sort());
  assert.equal(after, before, "ledger changed under replay");
  assert.deepEqual(await Promise.all(PARTNERS.map((p) => balanceCents(world.e, p, T0 + 400 * DAY))), balBefore);
  assert.equal(replayed, N_EVENTS / 5);
  // raw store level: the same uniq key is refused
  const first = commissions[0];
  assert.equal(await world.e.addLedger({ ...first, id: "led_dupe" }), false);
  ok("INV4");
  // cumulative refunds converge: partial then full leaves exactly commission clawed, partial replay after full writes nothing
  const e = new MemoryEntStore();
  await e.putTenant({ id: "ten_r", slug: "r", name: "SYNTHETIC", kind: "partner", createdAt: T0, ssoEnforced: false, partnerAccess: false, termsAcceptedAt: T0 } as Tenant);
  await e.putTenant({ id: "cli_r", slug: "cr", name: "SYNTHETIC", kind: "client", parentId: "ten_r", createdAt: T0, ssoEnforced: false, partnerAccess: false } as Tenant);
  await e.putMember({ tenantId: "cli_r", accountId: "acc_r", role: "admin", addedAt: T0 });
  const inv: Invoice = { id: "inv_r", accountId: "acc_r", number: "S", productId: "s", amountCents: 10_001, issuedAt: T0, stripeEventId: "e" };
  await recordCommission(e, RATE_V1, inv, T0);
  await clawback(e, [inv], 3333, T0); await clawback(e, [inv], 10_001, T0); await clawback(e, [inv], 3333, T0); await clawback(e, [inv], 99_999, T0);
  assert.equal((await e.ledgerForInvoice("inv_r")).reduce((n, x) => n + x.amountCents, 0), 0, "fully refunded invoice nets to exactly zero, no overshoot");
  ok("INV4");
});

test("INV5 a tenant's statement total equals the sum of its ledger lines and never includes another tenant's lines", async () => {
  const lines = (pid: string) => allLedger.filter((x) => x.partnerId === pid);
  let sumAll = 0;
  for (const pid of PARTNERS) {
    const own = await world.e.ledgerOf(pid);
    assert.deepEqual(own.map((x) => x.id).sort(), lines(pid).map((x) => x.id).sort(), `${pid} ledger view differs from its own lines`);
    for (const x of own) { assert.equal(x.partnerId, pid); ok("INV5"); }
    sumAll += own.reduce((n, x) => n + x.amountCents, 0);
    // per-month: the statement's Net movement equals the independent sum of that month's lines
    for (const month of ["2027-01", "2027-02", "2027-03"]) {
      const [y, m] = month.split("-").map(Number);
      const mine = own.filter((x) => x.at >= Date.UTC(y, m - 1, 1) && x.at < Date.UTC(y, m, 1));
      const sum = (k: string[]) => mine.filter((x) => k.includes(x.kind)).reduce((n, x) => n + x.amountCents, 0);
      const aud = (c: number) => `${c < 0 ? "-" : ""}AU$${(Math.abs(c) / 100).toFixed(2)}`;
      const st = statement({ id: pid, name: `SYNTHETIC ${pid}` } as Tenant, own, month);
      assert.ok(st.includes(`Commission earned: ${aud(sum(["commission"]))}`));
      assert.ok(st.includes(`Refund clawbacks: ${aud(sum(["clawback"]))}`));
      assert.ok(st.includes(`Net movement: ${aud(mine.reduce((n, x) => n + x.amountCents, 0))}`));
      // HARDENING (f88): handing statement() a MIXED ledger still reports only this tenant
      const mixed = statement({ id: pid, name: `SYNTHETIC ${pid}` } as Tenant, [...allLedger].reverse(), month);
      assert.equal(mixed, st, `${pid} ${month}: statement leaked another tenant's lines`);
      ok("INV5");
    }
  }
  assert.equal(sumAll, allLedger.reduce((n, x) => n + x.amountCents, 0), "tenant ledgers partition the whole ledger");
  // adversarial tenant-id probes: lookalike ids must return nothing, never a neighbour's lines
  for (const probe of ["ten_", "ten_a ", " ten_a", "TEN_A", "ten_a%", "ten_%", "ten_a*", "ten_a' OR '1'='1", "ten_a\0", "ten_a/../ten_ab", "", "__proto__", "constructor"]) {
    assert.deepEqual(await world.e.ledgerOf(probe), [], `probe ${JSON.stringify(probe)} returned lines`);
    ok("INV5");
  }
  // exact prefix/case twins stay separate
  const a = await world.e.ledgerOf("ten_a"), ab = await world.e.ledgerOf("ten_ab"), A = await world.e.ledgerOf("ten_A");
  assert.ok(a.length && ab.length && A.length);
  assert.equal(new Set([...a, ...ab, ...A].map((x) => x.id)).size, a.length + ab.length + A.length, "twins overlap");
  ok("INV5");
});

test("INV6 30-day hold boundary is exact: day 29 held, day 30 releasable (to the millisecond)", () => {
  assert.equal(HOLD_DAYS, 30);
  for (const c of commissions) {
    assert.equal(c.availableAt, c.at + 30 * DAY, `${c.uniq} availableAt is not exactly +30d`);
    assert.equal(availableCents([c], c.at + 29 * DAY), 0, "day 29 must be held");
    assert.equal(availableCents([c], c.at + 30 * DAY - 1), 0, "1ms before day 30 must be held");
    assert.equal(availableCents([c], c.at + 30 * DAY), c.amountCents, "day 30 must be releasable");
    assert.equal(availableCents([c], c.at + 31 * DAY), c.amountCents);
    ok("INV6");
  }
  // clawbacks apply immediately (negative lines are never held)
  for (const k of claws) { assert.equal(k.availableAt, k.at); assert.equal(availableCents([k], k.at), k.amountCents); ok("INV6"); }
});

test("INV6b OBSERVATION (documented, not a defect): a refund inside the hold window shows a transient negative available balance that nets to zero at day 30", () => {
  const ev = world.refunds.find((x) => x.refund!.kind === "full" && commissions.some((c) => c.invoiceId === x.inv.id))!;
  const led = allLedger.filter((x) => x.invoiceId === ev.inv.id);
  const during = availableCents(led, ev.refund!.at);
  assert.ok(during < 0, "clawback is immediate while the commission is still held: balance dips negative");
  assert.equal(availableCents(led, ev.inv.issuedAt + 30 * DAY), 0, "after the hold the pair nets to exactly zero");
  ok("INV6b");
  // once every hold has elapsed, no tenant's available balance is negative and it equals the plain sum of its lines
  for (const pid of PARTNERS) {
    const lines = allLedger.filter((x) => x.partnerId === pid);
    const end = T0 + 400 * DAY;
    assert.equal(availableCents(lines, end), lines.reduce((n, x) => n + x.amountCents, 0));
    assert.ok(availableCents(lines, end) >= 0);
    ok("INV6b");
  }
});

test("INV7 the monthly statement is byte-identical when regenerated, from shuffled input, and from a rebuilt world", async () => {
  const months = ["2027-01", "2027-02", "2027-03"];
  const render = (w: typeof world, shuffle: boolean) => {
    const out: string[] = [];
    for (const pid of PARTNERS) for (const m of months) {
      let lines = [...w.e.ledger.values()].filter((x) => x.partnerId === pid);
      if (shuffle) lines = lines.map((x, i) => [(i * 2654435761) % 4294967296, x] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
      out.push(statement({ id: pid, name: `SYNTHETIC ${pid}` } as Tenant, lines, m));
    }
    return out.join("\n=====\n");
  };
  const h = (s: string) => createHash("sha256").update(s).digest("hex");
  const a = render(world, false);
  assert.equal(h(render(world, false)), h(a)); ok("INV7");
  assert.equal(h(render(world, true)), h(a), "input order changed the bytes"); ok("INV7");
  const again = await run(); // same seed, fresh store, fresh random ledger ids
  assert.equal(h(render(again, false)), h(a), "a rebuilt world renders different bytes"); ok("INV7");
  assert.ok(!/\bNaN\b|undefined|Infinity/.test(a) && !a.includes("—") && !a.includes("–"), "no NaN, undefined or dashes in the statement");
  ok("INV7");
});

test("SUMMARY per-invariant pass counts", () => {
  const events = world.events.length;
  console.log(`SHAREINV events=${events} commissions=${commissions.length} clawbacks=${claws.length} refunds=${world.refunds.length} SYNTHETIC`);
  for (const k of Object.keys(pass).sort()) console.log(`SHAREINV ${k} pass=${pass[k]}`);
  assert.equal(events, N_EVENTS);
  assert.ok(commissions.length > 3000 && claws.length > 500);
});

test("REGRESSION f88-D1: partial clawback is the exact integer floor (the float fraction lost a cent: AU$0.44 invoice at 50%, 30c refunded)", async () => {
  const e = new MemoryEntStore();
  await e.putTenant({ id: "ten_x", slug: "x", name: "SYNTHETIC", kind: "partner", createdAt: T0, ssoEnforced: false, partnerAccess: false, termsAcceptedAt: T0 } as Tenant);
  await e.putTenant({ id: "cli_x", slug: "cx", name: "SYNTHETIC", kind: "client", parentId: "ten_x", createdAt: T0, ssoEnforced: false, partnerAccess: false } as Tenant);
  await e.putMember({ tenantId: "cli_x", accountId: "acc_x", role: "admin", addedAt: T0 });
  const inv: Invoice = { id: "inv_x", accountId: "acc_x", number: "S", productId: "s", amountCents: 44, issuedAt: T0, stripeEventId: "e" };
  await recordCommission(e, { version: "SYNTHETIC", baseBps: 5000, tiers: [] }, inv, T0);
  await clawback(e, [inv], 30, T0);
  const led = await e.ledgerForInvoice("inv_x");
  assert.equal(led.find((x) => x.kind === "commission")!.amountCents, 22);
  assert.equal(led.find((x) => x.kind === "clawback")!.amountCents, -15, "floor(22*30/44) = 15; the float path gave 14");
});

test("REGRESSION f88-D2: statement() ignores lines that belong to another partner even if the caller passes a mixed ledger", () => {
  const mk = (partnerId: string, amountCents: number): LedgerEntry => ({ id: "l" + partnerId, uniq: partnerId, partnerId, kind: "commission", amountCents, at: T0, availableAt: T0 + 30 * DAY });
  const st = statement({ id: "ten_a", name: "SYNTHETIC" } as Tenant, [mk("ten_a", 1000), mk("ten_ab", 99_999)], "2027-01");
  assert.ok(st.includes("Commission earned: AU$10.00") && st.includes("Net movement: AU$10.00"));
});
