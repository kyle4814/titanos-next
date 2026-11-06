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
  ledger: LedgerEntry[];            // charges this module made (SYNTHETIC or real, the caller decides)
  outcomes: Record<string, Outcome>; // eventId -> first outcome, so a replay returns it and changes nothing
}
export type Result = { outcome: Outcome; state: PlanState; replayed: boolean };

function dim(y: number, m: number) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
// Start of billing period k: calendar months from startedAt, day clamped (31 Jan + 1 month = 28/29 Feb). Never cumulative.
export function periodStart(startedAt: number, k: number): number {
  const s = new Date(startedAt), m = s.getUTCMonth() + k, y = s.getUTCFullYear() + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return Date.UTC(y, mm, Math.min(s.getUTCDate(), dim(y, mm)), s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds(), s.getUTCMilliseconds());
}
// The ONE minimum-term rule: three calendar months from the start (day clamped), i.e. 89 to 92 days. Never stricter than the public "3-month minimum".
export const termEnd = (startedAt: number) => periodStart(startedAt, MIN_TERM_MONTHS);

export function initPlan(startedAt: number, tier: Tier): PlanState {
  return { startedAt, tier, billedPeriods: 1, lastAt: startedAt, ledger: [{ kind: "period", cents: priceOf(tier), at: startedAt, tier }], outcomes: {} };
}

// Roll forward every period boundary <= at: apply a due pending change, then charge the next period at the tier then in force.
export function advance(s: PlanState, at: number): PlanState {
  const n: PlanState = { ...s, ledger: [...s.ledger], outcomes: s.outcomes };
  while (!n.endedAt) {
    const b = periodStart(n.startedAt, n.billedPeriods);
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
  for (;;) { const b = periodStart(s.startedAt, k); if (b >= floor && b > at) return b; k += 1; }
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
    const k = s.billedPeriods - 1, ps = periodStart(s.startedAt, k), pe = periodStart(s.startedAt, k + 1);
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
