// C2 plan change (f96): upgrade, downgrade and cancel across the three AI retainer tiers, as a PURE module.
// No I/O, no Stripe, no clock of its own: the caller passes `at` (ms). All money is integer AUD cents.
// Rules mirror the terms page and NUM1: 3-month minimum term (calendar months, the public promise; unified with live cancel in f100), no refund of a paid period, no GST line
// (the supplier is not registered for GST, see service.ts invoice text), so nothing here models GST.
import { PRODUCTS } from "./catalogue.ts";

export const TIERS = ["ai_growth", "ai_ops", "ai_embedded"] as const;
export type Tier = (typeof TIERS)[number];
export const MIN_TERM_MONTHS = 3;
const DAY = 86_400_000;
export const priceOf = (t: Tier): number => PRODUCTS[t].amountCents;
export const isTier = (x: unknown): x is Tier => typeof x === "string" && (TIERS as readonly string[]).includes(x);

export type LedgerKind = "period" | "upgrade";
export interface LedgerEntry { kind: LedgerKind; cents: number; at: number; tier: Tier; eventId?: string }
export interface Pending { kind: "downgrade" | "cancel"; to?: Tier; effectiveAt: number; requestedAt: number }
export type Request =
  | { eventId: string; kind: "upgrade" | "downgrade"; to: Tier }
  | { eventId: string; kind: "cancel" | "keep" };
export type Outcome =
  | { ok: true; kind: Request["kind"]; chargeCents: number; refundCents: 0; effectiveAt: number; note?: string }
  | { ok: false; reason: string };
export interface PlanState {
  startedAt: number;
  tier: Tier;
  billedPeriods: number;            // periods 0..billedPeriods-1 have been charged
  pending?: Pending;
  endedAt?: number;
  lastAt: number;                   // newest `at` seen: time never runs backwards
  cycle?: Cycle;                    // Stripe's billing grid, seeded from the webhook (f101). Absent = calendar months from startedAt.
  periodNow?: { start: number; end: number }; // newest Stripe period observed (monotone)
  ledger: LedgerEntry[];            // charges this module made (SYNTHETIC or real, the caller decides)
  outcomes: Record<string, Outcome>; // eventId -> first outcome, so a replay returns it and changes nothing
}
export type Result = { outcome: Outcome; state: PlanState; replayed: boolean };

function dim(y: number, m: number) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
// Start of billing period k: calendar months from startedAt, day clamped (31 Jan + 1 month = 28/29 Feb). Never cumulative.
export function periodStart(startedAt: number, k: number): number {
  return addMonths(startedAt, k);
}
// startedAt + k calendar months, day-of-month clamped to the target month, time of day kept. Never cumulative.
export function addMonths(startedAt: number, k: number): number {
  const s = new Date(startedAt), m = s.getUTCMonth() + k, y = s.getUTCFullYear() + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return Date.UTC(y, mm, Math.min(s.getUTCDate(), dim(y, mm)), s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds(), s.getUTCMilliseconds());
}
// The ONE minimum-term rule: three calendar months from the start (day clamped), i.e. 89 to 92 days. Never stricter than the public "3-month minimum".
export const termEnd = (startedAt: number) => periodStart(startedAt, MIN_TERM_MONTHS);

// ---- f101: Stripe's billing periods ----------------------------------------------------------------------------------
// Boundary 0 is startedAt (Stripe current_period_start of the first period). Boundary k>=1 is anchor + (offset + k - 1) calendar
// months, where anchor is Stripe's billing_cycle_anchor. A default subscription (anchor = start) has offset 1, which is exactly the
// old calendar-months-from-start rule, so a plan with no `cycle` behaves as before. A delayed anchor gives a short first period.
export interface Cycle { anchor: number; offset: number; irregular?: boolean }
export const boundary = (s: { startedAt: number; cycle?: Cycle }, k: number): number =>
  k <= 0 ? s.startedAt : addMonths(s.cycle ? s.cycle.anchor : s.startedAt, (s.cycle ? s.cycle.offset : 1) + k - 1);
export interface StripePeriod { start: number; end: number; anchor?: number } // ms
const okSec = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x > 0;
// Stripe sends seconds. Returns undefined for anything unusable (missing, non-integer, start >= end): callers then keep calendar months.
export function periodFromStripe(startSec: unknown, endSec: unknown, anchorSec?: unknown): StripePeriod | undefined {
  if (!okSec(startSec) || !okSec(endSec) || startSec >= endSec) return undefined;
  const p: StripePeriod = { start: startSec * 1000, end: endSec * 1000 };
  if (okSec(anchorSec)) p.anchor = anchorSec * 1000;
  return p;
}
// Build the grid so boundary(1) === period.end. If the reported end is not a whole number of months from the anchor, Stripe's end
// still wins for boundary 1 and the grid continues monthly from it (flagged irregular).
export function cycleFor(p: StripePeriod): Cycle {
  const anchor = p.anchor ?? p.start;
  for (let m = 0; m <= 14; m++) if (addMonths(anchor, m) === p.end) return { anchor, offset: m };
  return { anchor: p.end, offset: 0, irregular: true };
}
export function initPlanFromStripe(tier: Tier, p: StripePeriod): PlanState {
  return { ...initPlan(p.start, tier), cycle: cycleFor(p), periodNow: { start: p.start, end: p.end } };
}
// Observe a paid Stripe period (invoice.paid). Pure, idempotent by period start, tolerant of arrival order:
//  - older than the newest seen: stale, nothing changes (an out-of-order older invoice never rewinds the plan);
//  - the same period again: nothing changes (a replay under a fresh event id);
//  - a newer period on the grid: the plan rolls forward through every boundary up to its start;
//  - a newer period whose start is NOT on the grid: refused ("offgrid"), state untouched, the caller logs it.
export function observePeriod(s: PlanState, p: StripePeriod): { state: PlanState; applied: "same" | "stale" | "advanced" | "offgrid" } {
  const cur = s.periodNow;
  if (cur && p.start < cur.start) return { state: s, applied: "stale" };
  if (cur && p.start === cur.start) return { state: s, applied: "same" };
  let k = 0; while (boundary(s, k) < p.start && k < 1200) k += 1;
  if (boundary(s, k) !== p.start) return { state: s, applied: "offgrid" };
  return { state: { ...advance(s, p.start), periodNow: { start: p.start, end: p.end } }, applied: "advanced" };
}

export function initPlan(startedAt: number, tier: Tier): PlanState {
  return { startedAt, tier, billedPeriods: 1, lastAt: startedAt, ledger: [{ kind: "period", cents: priceOf(tier), at: startedAt, tier }], outcomes: {} };
}

// Roll forward every period boundary <= at: apply a due pending change, then charge the next period at the tier then in force.
export function advance(s: PlanState, at: number): PlanState {
  const n: PlanState = { ...s, ledger: [...s.ledger], outcomes: s.outcomes };
  while (!n.endedAt) {
    const b = boundary(n, n.billedPeriods);
    if (b > at) break;
    if (n.pending && n.pending.effectiveAt <= b) {
      if (n.pending.kind === "cancel") { n.endedAt = b; n.pending = undefined; break; }
      n.tier = n.pending.to as Tier; n.pending = undefined;
    }
    n.ledger.push({ kind: "period", cents: priceOf(n.tier), at: b, tier: n.tier });
    n.billedPeriods += 1;
  }
  return n;
}

// First period boundary that is >= the end of the minimum term (termEnd) and strictly after `at`.
export function earliestEffective(s: PlanState, at: number): number {
  const floor = termEnd(s.startedAt);
  let k = s.billedPeriods;
  for (;;) { const b = boundary(s, k); if (b >= floor && b > at) return b; k += 1; }
}

// Proration for an upgrade: the unused share of the current period times the price difference, floored (the customer's side
// of the rounding), in integers only. Always within [0, diff].
export function prorateUpgrade(diffCents: number, remainingMs: number, periodMs: number): number {
  if (!(Number.isSafeInteger(diffCents) && Number.isSafeInteger(remainingMs) && Number.isSafeInteger(periodMs)) || periodMs <= 0 || diffCents <= 0) return 0;
  const rem = Math.min(Math.max(remainingMs, 0), periodMs);
  return Math.floor((diffCents * rem) / periodMs);
}

// A refund can never exceed what was paid and not yet refunded, and is never negative.
export function capRefund(paidCents: number, alreadyRefundedCents: number, requestedCents: number): number {
  const room = Math.max(0, paidCents - Math.max(0, alreadyRefundedCents));
  return Math.max(0, Math.min(Math.trunc(requestedCents) || 0, room));
}

export function planChange(prior: PlanState, req: Request, at: number): Result {
  const seen = prior.outcomes[req.eventId];
  if (seen) return { outcome: seen, state: prior, replayed: true };
  const fin = (s: PlanState, o: Outcome): Result => ({ outcome: o, state: { ...s, outcomes: { ...s.outcomes, [req.eventId]: o } }, replayed: false });
  if (!Number.isSafeInteger(at) || at < prior.lastAt) return fin(prior, { ok: false, reason: "clock_backwards" });
  let s = advance(prior, at); s.lastAt = at;
  if (s.endedAt) return fin(s, { ok: false, reason: "subscription_ended" });
  if (req.kind === "keep") {
    const had = !!s.pending; s.pending = undefined;
    return fin(s, { ok: true, kind: "keep", chargeCents: 0, refundCents: 0, effectiveAt: at, note: had ? "scheduled_change_cleared" : "nothing_scheduled" });
  }
  if (req.kind === "cancel") {
    const eff = earliestEffective(s, at);
    s.pending = { kind: "cancel", effectiveAt: eff, requestedAt: at };
    return fin(s, { ok: true, kind: "cancel", chargeCents: 0, refundCents: 0, effectiveAt: eff, note: "no_refund_current_period" });
  }
  if (!isTier(req.to)) return fin(s, { ok: false, reason: "unknown_tier" });
  const cur = priceOf(s.tier), next = priceOf(req.to);
  if (next === cur) return fin(s, { ok: false, reason: "same_tier" });
  if (next > cur) {
    const k = s.billedPeriods - 1, ps = boundary(s, k), pe = boundary(s, k + 1);
    const charge = prorateUpgrade(next - cur, pe - at, pe - ps);
    s.tier = req.to; s.pending = undefined; // an upgrade supersedes any scheduled downgrade or cancel
    if (charge > 0) s.ledger.push({ kind: "upgrade", cents: charge, at, tier: req.to, eventId: req.eventId });
    return fin(s, { ok: true, kind: "upgrade", chargeCents: charge, refundCents: 0, effectiveAt: at });
  }
  const eff = earliestEffective(s, at);
  s.pending = { kind: "downgrade", to: req.to, effectiveAt: eff, requestedAt: at };
  return fin(s, { ok: true, kind: "downgrade", chargeCents: 0, refundCents: 0, effectiveAt: eff, note: "no_credit_no_refund" });
}
export const totalCharged = (s: PlanState) => s.ledger.reduce((a, e) => a + e.cents, 0);
