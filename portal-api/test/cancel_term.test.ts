import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync, cpSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { make, STORE_KINDS, seedSub } from "./harness.ts";
import { MemoryStore } from "../src/store.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";

// C2 cancel/term unify (f100). SYNTHETIC labelled fixtures only: example.invalid-style accounts, fixed dates, MockBilling. No network, no Stripe key.
// ONE minimum-term rule: live cancelSubscription routes retainers through plan_change.planChange (3 calendar months, then the next period boundary).
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// ---------- independent oracles (not the code under test) ----------
function calAdd(start: number, k: number): number { // start + k calendar months, day clamped to the target month
  const s = new Date(start), m = s.getUTCMonth() + k, y = s.getUTCFullYear() + Math.floor(m / 12), mm = m % 12;
  const last = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
  return Date.UTC(y, mm, Math.min(s.getUTCDate(), last), s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds(), s.getUTCMilliseconds());
}
function legacy(start: number, now: number): number { // the pre-f100 live rule, copied verbatim in behaviour (setUTCMonth overflow included)
  const add = (ms: number, n: number) => { const x = new Date(ms); x.setUTCMonth(x.getUTCMonth() + n); return x.getTime(); };
  let t = start; while (t <= now) t = add(t, 1);
  return Math.max(add(start, 3), t);
}

// ---------- invariant checker: runs against any copy of the src tree (mutants reuse it) ----------
type Mods = { svc: any; MemoryStore: any; MockBilling: any; fakeResolver: any };
async function cancelAt(m: Mods, tier: string, start: number, now: number, twice = false) {
  const store = new m.MemoryStore(), billing = new m.MockBilling(), clock = { t: now };
  const d = { store, billing, dns: m.fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => clock.t, siteOrigin: "https://synthetic.invalid" };
  const a = { id: "acc_syn", email: "syn@example.invalid", seat: "owner", createdAt: start };
  await store.putAccount(a);
  await store.putSubscription({ id: "sub_syn", accountId: a.id, purchaseId: "p_syn", productId: tier, startedAt: start });
  const r = await m.svc.cancelSubscription(d, a, "sub_syn");
  let r2; if (twice) { clock.t += DAY; r2 = await m.svc.cancelSubscription(d, a, "sub_syn"); }
  const sub = await store.subscriptionById("sub_syn");
  return { r, r2, sub, billing };
}
const FIX: { name: string; start: number; offs: number[] }[] = [
  { name: "SYNTHETIC mid-month 6 Nov", start: Date.UTC(2026, 10, 6, 1, 2, 3), offs: [0, 1, 30, 91, 92, 93, 120, 200] },
  { name: "SYNTHETIC 1 Dec (term end day 90)", start: Date.UTC(2026, 11, 1), offs: [0, 89, 90, 91, 92, 150] },
  { name: "SYNTHETIC 1 Jan (term end day 90)", start: Date.UTC(2026, 0, 1), offs: [0, 89, 90, 91, 92] },
  { name: "SYNTHETIC 31 Aug (clamps to 30 Nov)", start: Date.UTC(2026, 7, 31), offs: [0, 1, 90, 91, 92] },
  { name: "SYNTHETIC 30 Nov (clamps to 28 Feb)", start: Date.UTC(2026, 10, 30), offs: [0, 60, 90, 91, 92] },
  { name: "SYNTHETIC 31 Jan (clamps to 30 Apr)", start: Date.UTC(2027, 0, 31), offs: [0, 88, 89, 90, 91, 92, 119] },
  { name: "SYNTHETIC 29 Feb leap year", start: Date.UTC(2028, 1, 29), offs: [0, 90, 91, 92] },
  { name: "SYNTHETIC 31 Dec year wrap", start: Date.UTC(2026, 11, 31), offs: [0, 89, 90, 91, 92] },
];
async function violations(m: Mods): Promise<string[]> {
  const bad: string[] = [];
  for (const f of FIX) for (const off of f.offs) for (const tier of ["ai_growth", "ai_ops", "ai_embedded"]) {
    const now = f.start + off * DAY, tag = `${f.name} day ${off} ${tier}`;
    const { r, r2, sub, billing } = await cancelAt(m, tier, f.start, now, true);
    const e: number = r.effectiveAt, term = calAdd(f.start, 3);
    if (r.status !== "cancel_scheduled") bad.push(`N0 status ${tag}`);
    if (e < term) bad.push(`N1 inside minimum term ${tag}`);                       // never earlier than 3 calendar months
    if (e <= now) bad.push(`N1b not in the future ${tag}`);
    // N2 no behaviour stricter than before. Exception, DEMONSTRATED legacy defect: for start days 29-31 the old cumulative setUTCMonth
    // stepping overflowed (30 Nov -> 30 Dec -> 30 Jan -> 2 Mar) and returned a date that is not a billing boundary; only a legacy date that IS a clamped boundary binds.
    const lg = legacy(f.start, now); let lgBoundary = false, onBoundary = false, tight = true;
    for (let k = 1; k < 40; k++) if (calAdd(f.start, k) === lg) lgBoundary = true;
    if (e > lg && lgBoundary) bad.push(`N2 stricter than before ${tag}`);
    for (let k = 1; k < 40; k++) { const b = calAdd(f.start, k); if (b === e) onBoundary = true; if (b >= term && b > now && b < e) tight = false; }
    if (!onBoundary) bad.push(`N3 not a period boundary ${tag}`);
    if (!tight) bad.push(`N4 later than the first allowed boundary ${tag}`);       // the earliest legal date, no extra month
    if (r2.effectiveAt !== e || sub.cancelAt !== e) bad.push(`N5 second cancel moved the date ${tag}`);
    if (Object.keys(sub.plan?.outcomes ?? {}).length !== 1) bad.push(`N6 cancel not idempotent (one outcome per sub) ${tag}`);
    if (billing.calls.some((c: any) => c.op === "refund")) bad.push(`N7 cancel refunded money ${tag}`);
    if (billing.calls.filter((c: any) => c.op === "cancel").length !== 2 || billing.calls.some((c: any) => c.op === "cancel" && c.args.atPeriodEnd !== true)) bad.push(`N8 billing cancel must be at period end ${tag}`);
  }
  return bad;
}
async function load(srcDir: string, edits: [string, string][] = []) {
  const root = mkdtempSync(join(tmpdir(), "f100-")); if (!root.startsWith(tmpdir())) throw new Error("bad tmp");
  // Mirror the repo layout (portal-api/src plus a lib link) so src/*/ subdirectories and their ../../lib imports resolve.
  const dir = join(root, "portal-api", "src");
  try {
    cpSync(srcDir, dir, { recursive: true }); symlinkSync(resolve(srcDir, "../../lib"), join(root, "lib"));
    for (const [file, from, to] of edits.map((x) => x as unknown as [string, string, string])) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = async (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { svc: await imp("service.ts"), MemoryStore: (await imp("store.ts")).MemoryStore, MockBilling: (await imp("stripe.ts")).MockBilling, fakeResolver: (await imp("dns.ts")).fakeResolver } as Mods;
  } finally { /* modules are already evaluated; the dir is removed below */ setTimeout(() => rmSync(root, { recursive: true, force: true }), 0); }
}
const SRC = resolve(import.meta.dirname, "../src");

test("real code holds N0..N8 over the synthetic fixture grid (8 start dates x 3 tiers)", async () => {
  const m = await load(SRC);
  const bad = await violations(m);
  const n = FIX.reduce((a, f) => a + f.offs.length * 3, 0);
  console.log(`CANCELTERM_COUNTS cases=${n} invariants=9 violations=${bad.length}`);
  assert.deepEqual(bad, []);
});

// ---------- worked examples through the HTTP surface (day 0, 91, 92, refund-in-policy) ----------
async function retainer(h: ReturnType<typeof make>, product = "ai_growth") {
  const a = await h.login("syn@example.invalid");
  await h.req("POST", "/checkout", { token: a.session, body: { product } });
  const r = await h.pay(product);
  return { a, subId: `sub_${r.purchase.id}`, purchase: r.purchase };
}
// sessions last 30 days, so a cancel made after a long clock jump signs in again first (same account by email)
const cancel = async (h: ReturnType<typeof make>, _a: unknown, subId: string) => { const a = await h.login("syn@example.invalid"); return h.j(await h.req("POST", `/subscriptions/${subId}/cancel`, { token: a.session })); };
for (const kind of STORE_KINDS) {
test(`[${kind}] SYNTHETIC retainer started 2026-11-06: cancel at day 0 and day 91 land on 2027-02-06, day 92 (the boundary itself) on 2027-03-06`, async () => {
  for (const [days, want] of [[0, "2027-02-06"], [1, "2027-02-06"], [91, "2027-02-06"], [92, "2027-03-06"], [93, "2027-03-06"]] as const) {
    const h = make(kind); const { a, subId } = await retainer(h);
    h.clock.t += days * DAY;
    const c = await cancel(h, a, subId);
    assert.equal(c.status, "cancel_scheduled"); assert.equal(iso(c.effectiveAt), want, `day ${days}`);
    assert.equal(legacy((await h.store.subscriptionById(subId))!.startedAt, h.clock.t) >= c.effectiveAt, true, "never stricter than the old rule");
  }
});
test(`[${kind}] SYNTHETIC month-end starts: the term ends on the clamped calendar date (89 to 92 days), not a flat 92 days`, async () => {
  const cases: [number, string, string][] = [
    [Date.UTC(2026, 11, 1), "2027-03-01", "1 Dec: 90-day term; f96 planChange alone would have said 2027-04-01"],
    [Date.UTC(2026, 7, 31), "2026-11-30", "31 Aug clamps to 30 Nov; the old live rule overflowed to 1 Dec"],
    [Date.UTC(2026, 10, 30), "2027-02-28", "30 Nov clamps to 28 Feb"],
    [Date.UTC(2027, 0, 31), "2027-04-30", "31 Jan clamps to 30 Apr"],
    [Date.UTC(2028, 1, 29), "2028-05-29", "leap-day start"],
  ];
  for (const [start, want, why] of cases) {
    const h = make(kind); const a = await h.login("syn@example.invalid");
    await seedSub(h.store, a.account.id, { id: "sub_m", purchaseId: "p_m", productId: "ai_ops", startedAt: start });
    h.clock.t = start + DAY;
    const c = await cancel(h, a, "sub_m");
    assert.equal(iso(c.effectiveAt), want, why);
  }
});
test(`[${kind}] SYNTHETIC cancel after the term ends at the next monthly boundary (day 130 of a 6 Nov start -> 2027-04-06)`, async () => {
  const h = make(kind); const { a, subId } = await retainer(h, "ai_embedded");
  h.clock.t += 130 * DAY; // 2027-03-16
  assert.equal(iso((await cancel(h, a, subId)).effectiveAt), "2027-04-06");
});
test(`[${kind}] DEMONSTRATED legacy defect (repro, oracle only): a 30 Nov start cancelled on 28 Feb returned 2 Mar, which is not a billing boundary; the unified rule returns 30 Mar`, async () => {
  const start = Date.UTC(2026, 10, 30), now = Date.UTC(2027, 1, 28);
  assert.equal(iso(legacy(start, now)), "2027-03-02");
  const h = make(kind); const a = await h.login("syn@example.invalid");
  await seedSub(h.store, a.account.id, { id: "sub_l", purchaseId: "p_l", productId: "ai_growth", startedAt: start });
  h.clock.t = now;
  assert.equal(iso((await cancel(h, a, "sub_l")).effectiveAt), "2027-03-30");
});
test(`[${kind}] monitor is unchanged by the unification: ends at the next period boundary, no minimum`, async () => {
  const h = make(kind); const a = await h.login("syn@example.invalid");
  await h.verifiedDomain(a.session, "synthetic-acme.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "monitor_monthly", domain: "synthetic-acme.com.au" } });
  const m = await h.pay("monitor_monthly"); h.clock.t += 10 * DAY;
  assert.equal(iso((await cancel(h, a, `sub_${m.purchase.id}`)).effectiveAt), "2026-12-06");
});
test(`[${kind}] refund-in-policy: cancelling a retainer at day 0 refunds nothing; an in-policy compliance refund stays automatic and exact; a retainer refund still goes to review`, async () => {
  const h = make(kind); const a = await h.login("syn@example.invalid");
  await h.verifiedDomain(a.session, "synthetic-acme.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "compliance_pack", domain: "synthetic-acme.com.au" } });
  const comp = await h.pay("compliance_pack");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "ai_growth" } });
  const ret = await h.pay("ai_growth");
  const c = await cancel(h, a, `sub_${ret.purchase.id}`);
  assert.equal(c.status, "cancel_scheduled"); assert.equal(h.billing.calls.filter((x) => x.op === "refund").length, 0, "cancel at day 0 is not a refund");
  h.clock.t += 13 * DAY;
  assert.deepEqual(await h.j(await h.req("POST", "/refunds", { token: a.session, body: { purchaseId: comp.purchase.id } })), { status: "refunded", amountCents: 599700 });
  const rr = await h.j(await h.req("POST", "/refunds", { token: a.session, body: { purchaseId: ret.purchase.id } }));
  assert.equal(rr.status, "needs_review"); assert.equal(rr.reason, "scope_terms_apply");
  assert.equal(h.billing.calls.filter((x) => x.op === "refund").length, 1, "only the in-policy compliance refund moved money");
});
test(`[${kind}] a cancelled retainer cannot be cancelled twice into a different date, and deleting the account reuses the same rule`, async () => {
  const h = make(kind); const { a, subId } = await retainer(h);
  h.clock.t += 5 * DAY; const c1 = await cancel(h, a, subId);
  h.clock.t += 100 * DAY; const c2 = await cancel(h, a, subId);
  assert.equal(c2.effectiveAt, c1.effectiveAt, "replay returns the first date even after the boundary has passed");
  const h2 = make(kind); const r2 = await retainer(h2); h2.clock.t += 3 * DAY;
  const s2 = await h2.login("syn@example.invalid");
  const del = await h2.req("DELETE", "/account", { token: s2.session, body: { confirm: "DELETE" } }); assert.equal(del.status, 200);
  assert.equal(iso((await h2.store.subscriptionById(r2.subId))!.cancelAt!), "2027-02-06");
});
}

// ---------- mutation tests: each new invariant has a mutant that must be killed by that invariant ----------
const MUT: { id: string; inv: string; edits: [string, string, string][] }[] = [
  { id: "M1 term one month short", inv: "N1", edits: [["plan_change.ts", "export const MIN_TERM_MONTHS = 3;", "export const MIN_TERM_MONTHS = 2;"]] },
  { id: "M2 term one month long", inv: "N2", edits: [["plan_change.ts", "export const MIN_TERM_MONTHS = 3;", "export const MIN_TERM_MONTHS = 4;"]] },
  { id: "M3 flat 92 days again (the f96 rule)", inv: "N2", edits: [["plan_change.ts", "export const termEnd = (startedAt: number) => periodStart(startedAt, MIN_TERM_MONTHS);", "export const termEnd = (startedAt: number) => startedAt + 92 * DAY;"]] },
  { id: "M4 skips the first allowed boundary", inv: "N4", edits: [["plan_change.ts", "if (b >= floor && b > at) return b;", "if (b > floor && b > at) return b;"]] },
  { id: "M5 day not clamped (31 Aug overflow)", inv: "N3", edits: [["plan_change.ts", "Math.min(s.getUTCDate(), dim(y, mm))", "s.getUTCDate()"]] },
  { id: "M6 retainer bypasses planChange (legacy path)", inv: "N4", edits: [["service.ts", "if (isTier(sub.productId)) {", "if (false as boolean) {"]] },
  { id: "M7 fresh event id every call (not idempotent)", inv: "N6", edits: [["service.ts", "eventId: `cancel:${sub.id}`", "eventId: `cancel:${sub.id}:${d.now()}`"]] },
  { id: "M8 cancel refunds the period", inv: "N7", edits: [["service.ts", "await d.billing.cancelSubscription(sub.id, true);", "await d.billing.cancelSubscription(sub.id, true); await d.billing.refund(\"pi_x\", 1, \"k\");"]] },
  { id: "M9 cancel at once not at period end", inv: "N8", edits: [["service.ts", "await d.billing.cancelSubscription(sub.id, true);", "await d.billing.cancelSubscription(sub.id, false);"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants are killed by their named invariant`, async () => {
  let killed = 0; const lines: string[] = [];
  for (const mu of MUT) {
    let bad: string[];
    try { bad = await violations(await load(SRC, mu.edits as any)); } catch (e) { bad = ["THROW " + String(e).slice(0, 80)]; }
    const hit = bad.some((b) => b.startsWith(mu.inv + " ") || b.startsWith(mu.inv));
    lines.push(`${mu.id}: ${hit ? "KILLED by " + mu.inv : "SURVIVED " + JSON.stringify(bad.slice(0, 2))}`);
    if (hit) killed++;
  }
  console.log("CANCELTERM_MUTANTS " + killed + "/" + MUT.length + "\n" + lines.join("\n"));
  assert.equal(killed, MUT.length, lines.join("\n"));
});
