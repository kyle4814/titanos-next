import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as REAL from "../src/plan_change.ts";
import { MemoryStore } from "../src/store.ts";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { STORE_KINDS, newStore, seedSub, type StoreKind } from "./harness.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, type Deps } from "../src/service.ts";
import { changePlan } from "../src/plan_change_service.ts";

// C2 plan change suite (f96). SYNTHETIC labelled fixtures only: no network, no Stripe key, no model call, no live request.
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 6, 1, 2, 3);
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type M = typeof REAL;
type Step = { at: number; req: any; replayOf?: number };

// Independent oracle for the minimum term: start + 3 calendar months, day clamped to the target month (not periodStart).
function calTermEnd(start: number): number {
  const s = new Date(start), m = s.getUTCMonth() + 3, y = s.getUTCFullYear() + Math.floor(m / 12), mm = m % 12;
  const last = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
  return Date.UTC(y, mm, Math.min(s.getUTCDate(), last), s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds(), s.getUTCMilliseconds());
}
// ---------- generated histories ----------
const GROW = "ai_growth", OPS = "ai_ops", EMB = "ai_embedded";
function genHistory(r: () => number): { start: number; tier: any; steps: Step[] } {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const start = Date.UTC(2026, Math.floor(r() * 12), 1 + Math.floor(r() * 31), Math.floor(r() * 24), Math.floor(r() * 60));
  const tier = pick([GROW, OPS, EMB]);
  const steps: Step[] = []; let at = start; const n = 4 + Math.floor(r() * 11);
  for (let i = 0; i < n; i++) {
    at += Math.floor(r() * 45 * DAY * (r() < 0.2 ? 0.02 : 1));
    const roll = r();
    if (roll < 0.15 && steps.length) { const k = Math.floor(r() * steps.length); steps.push({ at, req: steps[k].req, replayOf: k }); continue; }
    if (roll < 0.20) { steps.push({ at: at - Math.floor(r() * 20 * DAY) - 1, req: { eventId: `evt_${i}_b`, kind: "upgrade", to: pick([GROW, OPS, EMB]) } }); continue; }
    const kind = pick(["upgrade", "upgrade", "downgrade", "downgrade", "cancel", "keep"]);
    steps.push({ at, req: kind === "upgrade" || kind === "downgrade" ? { eventId: `evt_${i}`, kind, to: pick([GROW, OPS, EMB]) } : { eventId: `evt_${i}`, kind } });
  }
  return { start, tier, steps };
}

// ---------- the invariant checker (runs against any module with the REAL shape; mutants reuse it) ----------
const price = (t: string) => ({ [GROW]: 150000, [OPS]: 250000, [EMB]: 500000 } as Record<string, number>)[t];
function check(m: M, h: ReturnType<typeof genHistory>): string[] {
  const bad: string[] = [];
  let s = m.initPlan(h.start, h.tier);
  const first: Record<string, any> = {}; let modelPending: string = "none", modelTier = h.tier as string, modelCancelAt = 0;
  const T = calTermEnd(h.start);
  for (const st of h.steps) {
    const before = s, clockBefore = s.lastAt;
    let res: any;
    try { res = m.planChange(s, st.req, st.at); } catch (e) { bad.push("throw:" + (e as Error).message); return bad; }
    const o = res.outcome;
    if (st.replayOf !== undefined || first[st.req.eventId]) {
      // I5 replay is idempotent: same outcome, state untouched, no new ledger line
      if (!res.replayed) bad.push("I5 replay not flagged");
      if (JSON.stringify(o) !== JSON.stringify(first[st.req.eventId])) bad.push("I5 replay outcome differs");
      if (JSON.stringify(res.state) !== JSON.stringify(before)) bad.push("I5 replay changed state");
      continue;
    }
    first[st.req.eventId] = o;
    if (st.at < clockBefore) {
      // I8 time never runs backwards
      if (o.ok) bad.push("I8 backwards accepted");
      if (res.state.ledger.length !== before.ledger.length || res.state.lastAt !== before.lastAt) bad.push("I8 backwards moved state");
      s = res.state; continue;
    }
    s = res.state;
    // I1 never negative, integers only, refund always zero
    if (o.ok) {
      if (!Number.isSafeInteger(o.chargeCents) || o.chargeCents < 0) bad.push("I1 charge " + o.chargeCents);
      if (o.refundCents !== 0) bad.push("I1 refund " + o.refundCents);
    }
    for (const e of s.ledger) if (!Number.isSafeInteger(e.cents) || e.cents < 0) bad.push("I1 ledger " + e.cents);
    if (!o.ok) { continue; }
    if (o.kind === "upgrade") {
      // I2 proration equals an independent BigInt oracle and never exceeds the price difference
      const k = before.billedPeriods; // advance() may have rolled; recompute from the advanced state instead
      const adv = m.advance(before, st.at), ps = m.periodStart(adv.startedAt, adv.billedPeriods - 1), pe = m.periodStart(adv.startedAt, adv.billedPeriods);
      const diff = price(st.req.to) - price(adv.tier);
      const want = Number((BigInt(diff) * BigInt(pe - st.at)) / BigInt(pe - ps));
      if (o.chargeCents !== want) bad.push(`I2 charge ${o.chargeCents} want ${want}`);
      if (o.chargeCents > diff) bad.push("I2 above diff");
      if (s.tier !== st.req.to) bad.push("I2 tier not switched");
      if (s.startedAt !== h.start) bad.push("I2 term start moved");
      void k;
    }
    if (o.kind === "downgrade" || o.kind === "cancel") {
      // I4 minimum term: effective no earlier than 3 calendar months, on a period boundary, in the future
      if (o.effectiveAt < T) bad.push("I4 effective inside minimum term");
      if (o.effectiveAt <= st.at) bad.push("I4 effective not in future");
      if (o.chargeCents !== 0) bad.push("I4 downgrade/cancel charged");
    }
    // I10 the scheduled change follows the LATEST request: upgrade and keep clear it, downgrade and cancel replace it
    if (o.kind === "upgrade" || o.kind === "keep") modelPending = "none";
    if (o.kind === "upgrade") modelTier = st.req.to;
    if (o.kind === "keep" || o.kind === "cancel") modelTier = s.tier;
    if (o.kind === "downgrade") modelTier = st.req.to;
    if (o.kind === "downgrade") modelPending = "d:" + st.req.to;
    if (o.kind === "cancel") modelPending = "c";
    if (o.kind === "cancel") modelCancelAt = o.effectiveAt;
    const got = s.pending ? (s.pending.kind === "cancel" ? "c" : "d:" + s.pending.to) : "none";
    if (!s.endedAt && got !== modelPending && !(modelPending !== "none" && got === "none")) bad.push(`I10 pending ${got} model ${modelPending}`);
    if (o.kind === "downgrade") modelCancelAt = 0;
    if (o.kind === "upgrade" || o.kind === "keep") modelCancelAt = 0;
  }
  // roll far into the future and check the end state against the model
  const end = m.advance(s, (s.lastAt) + 400 * DAY);
  // I6 ledger: one line per billed period, at its boundary, at exactly the tier price, strictly in order
  const per = end.ledger.filter((e) => e.kind === "period");
  per.forEach((e, i) => { if (e.cents !== price(e.tier)) bad.push("I6 period price"); if (i && e.at <= per[i - 1].at) bad.push("I6 order"); });
  // I12 boundary k sits in month startMonth + k (day clamped, never overflowing into the next month)
  const sm = new Date(h.start).getUTCMonth();
  for (let k = 0; k < 14; k++) { if (new Date(m.periodStart(h.start, k)).getUTCMonth() !== (sm + k) % 12) { bad.push("I12 month overflow k=" + k); break; } }
  // I4b inside the minimum term the tier never falls
  let prev = 0; for (const e of end.ledger) { if (e.at < T) { if (price(e.tier) < prev) bad.push("I4b tier fell inside minimum term"); prev = Math.max(prev, price(e.tier)); } }
  // I7 nothing is charged at or after the end; the cancel lands exactly on the effective boundary
  if (end.endedAt !== undefined) for (const e of end.ledger) if (e.at >= end.endedAt) bad.push("I7 charged after end");
  if (modelCancelAt && !s.endedAt && s.pending?.kind === "cancel") { if (end.endedAt !== modelCancelAt) bad.push(`I7 ended ${end.endedAt} want ${modelCancelAt}`); }
  else if (!s.endedAt && s.pending?.kind !== "cancel" && end.endedAt) bad.push("I7 ended without a cancel");
  // I11 a scheduled downgrade is applied at its boundary
  if (!s.endedAt && s.pending?.kind === "downgrade" && end.tier !== s.pending.to) bad.push("I11 downgrade never applied");
  if (!s.endedAt && !s.pending && end.tier !== modelTier && modelTier !== "") bad.push("I11 tier drift " + end.tier + " vs " + modelTier);
  return bad;
}
const SEED = 96_2026_11_07, N = 500;
const histories = (() => { const r = rng(SEED); return Array.from({ length: N }, () => genHistory(r)); })();

function capProp(m: M): string[] {
  const bad: string[] = [], r = rng(SEED + 1);
  for (let i = 0; i < 2000; i++) {
    const paid = Math.floor(r() * 600000), already = Math.floor(r() * (paid + 1)), req = Math.floor((r() - 0.3) * 900000);
    const v = m.capRefund(paid, already, req);
    if (v < 0) bad.push("I3 negative"); if (v > paid - already) bad.push("I3 beyond paid"); if (v > Math.max(0, req)) bad.push("I3 beyond request");
  }
  for (const x of [NaN, Infinity, -5, 1e12]) { const v = m.capRefund(1000, 200, x); if (!(v >= 0 && v <= 800)) bad.push("I3 hostile " + x); }
  return bad;
}
function monotoneProp(m: M): string[] {
  const bad: string[] = [], r = rng(SEED + 2), per = 30 * DAY;
  for (let i = 0; i < 500; i++) {
    const diff = 1 + Math.floor(r() * 350000), a = Math.floor(r() * per), b = Math.floor(r() * per), [lo, hi] = a < b ? [a, b] : [b, a];
    // remaining time is larger when `at` is earlier, so charge(earlier) >= charge(later)
    if (m.prorateUpgrade(diff, per - lo, per) < m.prorateUpgrade(diff, per - hi, per)) bad.push("I9 not monotone");
    if (m.prorateUpgrade(diff, per, per) !== diff) bad.push("I9 full period must equal diff");
    if (m.prorateUpgrade(diff, 0, per) !== 0) bad.push("I9 empty remainder must be 0");
  }
  return bad;
}
function all(m: M): string[] { const bad: string[] = [...capProp(m), ...monotoneProp(m)]; for (const h of histories) bad.push(...check(m, h)); return bad; }

// ---------- tests ----------
test("worked examples (synthetic): upgrade proration, downgrade deferral, cancel, no refund", () => {
  const s0 = REAL.initPlan(Date.UTC(2026, 0, 1), GROW as any);
  // upgrade growth -> ops exactly halfway through a 31-day January (period 0 = 1 Jan to 1 Feb)
  const half = Date.UTC(2026, 0, 1) + 15.5 * DAY;
  const u = REAL.planChange(s0, { eventId: "e1", kind: "upgrade", to: OPS as any }, half);
  assert.equal(u.outcome.ok && u.outcome.chargeCents, 50000); // (250000-150000) * 15.5/31
  assert.equal(u.state.tier, OPS);
  // replay of the same event: same outcome, state untouched, no second charge
  const again = REAL.planChange(u.state, { eventId: "e1", kind: "upgrade", to: OPS as any }, half + DAY);
  assert.equal(again.replayed, true); assert.deepEqual(again.state, u.state);
  // downgrade at day 20: term end is 1 Jan + 3 calendar months = 1 Apr 2026 (day 90); the 1 Apr boundary is on the term end, so it lands on 1 Apr (f100: was 1 May under the flat 92-day rule)
  const d = REAL.planChange(u.state, { eventId: "e2", kind: "downgrade", to: GROW as any }, Date.UTC(2026, 0, 21));
  assert.ok(d.outcome.ok && d.outcome.effectiveAt >= REAL.termEnd(s0.startedAt));
  assert.equal(d.outcome.ok && d.outcome.chargeCents, 0);
  assert.equal(new Date((d.outcome as any).effectiveAt).toISOString(), "2026-04-01T00:00:00.000Z");
});
test("unknown tier, same tier, backwards clock and ended subscription are rejected without state change", () => {
  const s0 = REAL.initPlan(T0, OPS as any);
  assert.deepEqual(REAL.planChange(s0, { eventId: "a", kind: "upgrade", to: "bogus" as any }, T0 + DAY).outcome, { ok: false, reason: "unknown_tier" });
  assert.deepEqual(REAL.planChange(s0, { eventId: "b", kind: "upgrade", to: OPS as any }, T0 + DAY).outcome, { ok: false, reason: "same_tier" });
  const c = REAL.planChange(s0, { eventId: "c", kind: "cancel" }, T0 + 2 * DAY);
  assert.deepEqual(REAL.planChange(c.state, { eventId: "d", kind: "keep" }, T0 + DAY).outcome, { ok: false, reason: "clock_backwards" });
  const ended = REAL.advance(c.state, T0 + 200 * DAY);
  assert.ok(ended.endedAt);
  assert.deepEqual(REAL.planChange(ended, { eventId: "e", kind: "upgrade", to: EMB as any }, T0 + 201 * DAY).outcome, { ok: false, reason: "subscription_ended" });
});
test("property: 500 seeded histories hold every invariant on the real module", () => {
  const bad = all(REAL);
  console.log(`PLANCHG_COUNTS histories=${N} seed=${SEED} steps=${histories.reduce((a, h) => a + h.steps.length, 0)} replays=${histories.reduce((a, h) => a + h.steps.filter((x) => x.replayOf !== undefined).length, 0)}`);
  assert.deepEqual(bad.slice(0, 5), []);
});

// ---------- mutation: each mutant breaks one invariant and the checker must see it ----------
const SRC = readFileSync(resolve(import.meta.dirname, "../src/plan_change.ts"), "utf8");
const CAT = pathToFileURL(resolve(import.meta.dirname, "../src/catalogue.ts")).href;
async function load(edits: [string, string][]): Promise<M> {
  let t = SRC;
  for (const [a, b] of edits) { assert.equal(t.split(a).length - 1, 1, "mutation anchor must match exactly once: " + a); t = t.replace(a, b); }
  const dir = mkdtempSync(join(tmpdir(), "planchg_mut_"));
  try { const f = join(dir, "m.ts"); writeFileSync(f, t.replace('"./catalogue.ts"', JSON.stringify(CAT))); return (await import(pathToFileURL(f).href + "?" + Math.random())) as M; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
const MUTANTS: { id: string; inv: string; edits: [string, string][] }[] = [
  { id: "M1 ceil instead of floor", inv: "I2", edits: [["return Math.floor((diffCents * rem) / periodMs);", "return Math.ceil((diffCents * rem) / periodMs);"]] },
  { id: "M2 no floor (fractional cents)", inv: "I1", edits: [["return Math.floor((diffCents * rem) / periodMs);", "return (diffCents * rem) / periodMs;"]] },
  { id: "M3 charge full new price", inv: "I2", edits: [["prorateUpgrade(next - cur,", "prorateUpgrade(next,"]] },
  { id: "M4 negative charge (reversed diff, no guard)", inv: "I1", edits: [["prorateUpgrade(next - cur,", "prorateUpgrade(cur - next,"], ["|| periodMs <= 0 || diffCents <= 0) return 0;", "|| periodMs <= 0) return 0;"]] },
  { id: "M5 refund beyond paid", inv: "I3", edits: [["Math.min(Math.trunc(requestedCents) || 0, room)", "(Math.trunc(requestedCents) || 0)"]] },
  { id: "M6 minimum term ignored", inv: "I4", edits: [["const floor = termEnd(s.startedAt);", "const floor = 0;"]] },
  { id: "M7 replay re-applied", inv: "I5", edits: [["if (seen) return", "if (false as boolean) return"]] },
  { id: "M8 clock may run backwards", inv: "I8", edits: [["at < prior.lastAt", "false"]] },
  { id: "M9 upgrade keeps the scheduled downgrade", inv: "I10", edits: [["s.tier = req.to; s.pending = undefined;", "s.tier = req.to;"]] },
  { id: "M10 downgrade never applied at its boundary", inv: "I11", edits: [["n.tier = n.pending.to as Tier; n.pending = undefined;", "n.pending = undefined;"]] },
  { id: "M11 pending applied one period late", inv: "I7", edits: [["n.pending.effectiveAt <= b", "n.pending.effectiveAt < b"]] },
  { id: "M12 month day not clamped", inv: "I12", edits: [["Math.min(s.getUTCDate(), dim(y, mm))", "s.getUTCDate()"]] },
  { id: "M13 non-monotone proration", inv: "I9", edits: [["const rem = Math.min(Math.max(remainingMs, 0), periodMs);", "const rem = Math.min(Math.max(remainingMs, 0), periodMs); if (rem % 7 === 3) return 0;"]] },
];
for (const mu of MUTANTS) {
  test(`mutant ${mu.id} is killed by ${mu.inv}`, async () => {
    const m = await load(mu.edits);
    const bad = all(m);
    assert.ok(bad.length > 0, "SURVIVED: " + mu.id);
    assert.ok(bad.some((b) => b.startsWith(mu.inv)), `killed, but not by ${mu.inv}: ${bad.slice(0, 3).join(" | ")}`);
  });
}

// ---------- Store wiring, run against BOTH stores (f172): MemoryStore and D1PlanStore over FakeD1; no Stripe call ----------
for (const kind of STORE_KINDS) test(`[${kind}] changePlan through the Store: persists plan, sets cancelAt, replay is a no-op, billing is data only`, async () => {
  const store = newStore(kind), billing = new MockBilling(); let t = T0 + 10 * DAY;
  const d: Deps = { store, billing, dns: fakeResolver({}), mailer: new MockMailer(), now: () => t, siteOrigin: "https://titanos.tech", webhookSecret: "whsec_test_fixture" };
  const a = { id: "acc_syn1", email: "synthetic@example.invalid", seat: "owner", createdAt: T0 };
  await store.putAccount(a);
  await seedSub(store, a.id, { id: "sub_syn1", purchaseId: "pur_syn1", productId: GROW, startedAt: T0 });
  const up = await changePlan(d, a, "sub_syn1", { eventId: "evt_u", kind: "upgrade", to: EMB as any });
  assert.equal(up.outcome.ok, true); assert.ok(up.billingIntent && up.billingIntent.live === false && up.billingIntent.amountCents > 0);
  assert.equal((await store.subscriptionById("sub_syn1"))!.productId, EMB);
  t += DAY;
  const up2 = await changePlan(d, a, "sub_syn1", { eventId: "evt_u", kind: "upgrade", to: EMB as any });
  assert.equal(up2.replayed, true);
  assert.equal((await store.subscriptionById("sub_syn1"))!.plan!.ledger.filter((e) => e.kind === "upgrade").length, 1);
  const c = await changePlan(d, a, "sub_syn1", { eventId: "evt_c", kind: "cancel" });
  const sub = (await store.subscriptionById("sub_syn1"))!;
  assert.equal(sub.cancelAt, c.outcome.ok ? c.outcome.effectiveAt : -1); assert.ok(sub.cancelAt! >= REAL.termEnd(T0));
  assert.equal(billing.calls.length, 0, "no billing call is made by plan change");
  await assert.rejects(() => changePlan(d, { ...a, id: "acc_other" }, "sub_syn1", { eventId: "x", kind: "keep" }), /not_found/);
  await seedSub(store, a.id, { id: "sub_mon", purchaseId: "p", productId: "monitor_monthly", startedAt: T0 });
  await assert.rejects(() => changePlan(d, a, "sub_mon", { eventId: "y", kind: "keep" }), /not_a_retainer/);
});

// ---------- generated histories through the Store, differential: memory vs D1 with a RESTART before every step (f172) ----------
// The same seeded histories as the pure property run are driven through changePlan. The D1 run builds a NEW D1PlanStore over the same
// FakeD1 before each step, so every read comes from SQLite rows and nothing survives in process memory. The final plan, cancelAt and
// product must equal the MemoryStore run byte for byte, and every accepted cancel must respect the independent minimum-term oracle.
const DN = 120;
async function driveStore(kind: StoreKind, h: ReturnType<typeof genHistory>, restart: boolean) {
  const d1 = new FakeD1(); let store = newStore(kind, d1), t = h.start; const billing = new MockBilling();
  const mk = (): Deps => ({ store, billing, dns: fakeResolver({}), mailer: new MockMailer(), now: () => t, siteOrigin: "https://synthetic.invalid", webhookSecret: "whsec_test_fixture" });
  const a = { id: "acc_h", email: "synthetic@example.invalid", seat: "owner", createdAt: h.start };
  await store.putAccount(a); await seedSub(store, a.id, { id: "sub_h", purchaseId: "pur_h", productId: h.tier, startedAt: h.start });
  const outs: string[] = [];
  for (const st of h.steps) {
    if (restart && kind === "d1") store = new D1PlanStore(d1);
    t = st.at;
    const r = await changePlan(mk(), a, "sub_h", st.req);
    outs.push(JSON.stringify([r.outcome, r.replayed, r.billingIntent]));
  }
  if (restart && kind === "d1") store = new D1PlanStore(d1);
  return { sub: await store.subscriptionById("sub_h"), outs, billing };
}
test(`[d1 restart vs memory] ${DN} seeded histories end in the same plan, cancelAt and product, with a new store before every step`, async () => {
  const r = rng(SEED + 172); const hs = Array.from({ length: DN }, () => genHistory(r)); let steps = 0, cancels = 0;
  for (const [i, h] of hs.entries()) {
    const mem = await driveStore("memory", h, false), d1 = await driveStore("d1", h, true);
    assert.deepEqual(d1.outs, mem.outs, `history ${i}: outcomes differ`);
    assert.deepEqual(JSON.parse(JSON.stringify(d1.sub)), JSON.parse(JSON.stringify(mem.sub)), `history ${i}: stored subscription differs`);
    assert.equal(d1.billing.calls.length, 0);
    steps += h.steps.length;
    if (d1.sub!.cancelAt !== undefined) { cancels += 1; assert.ok(d1.sub!.cancelAt >= calTermEnd(h.start), `history ${i}: cancel inside the minimum term`); }
  }
  assert.ok(cancels > 10, "the run must actually exercise cancels: " + cancels);
  console.log(`PLAND1_COUNTS histories=${DN} steps=${steps} cancels=${cancels} stores=memory,d1(restart each step)`);
});
