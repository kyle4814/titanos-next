import { PRODUCTS, refundVerdict, type Product } from "./catalogue.ts";
import { buildRefundCard, applyRefundDecision, type RefundCase, type RefundCard, type RefundDecision } from "./refund_card.ts";
import { normaliseDomain, verifyRecordName, verifyRecordValue, type TxtResolver } from "./dns.ts";
import type { BillingProvider } from "./stripe.ts";
import type { Store, Account, Purchase, Invoice, Subscription, ApiKey } from "./store.ts";
import { capsOf, dayStartOf, DEFAULT_KEY_CAP_DAILY, DEFAULT_KEY_CAP_TOTAL, MAX_KEY_CAP_DAILY, MAX_KEY_CAP_TOTAL } from "./agent/caps.ts";
import { normaliseEmail, randomToken, sha256Hex } from "./util.ts";
import type { EntContext } from "./enterprise/service.ts";
import * as entSvc from "./enterprise/service.ts";
import { SCOPES } from "./agent/tools.ts";
import { isTier, periodFromStripe, initPlanFromStripe, observePeriod, type StripePeriod, type Tier } from "./plan_change.ts";
import { changePlan } from "./plan_change_service.ts";
import { renderInvoiceDoc, type GstMode, type RenderedDoc } from "./invoice_render.ts";

// ONE config constant for the GST mode. app/terms/page.tsx says the seller is NOT registered for GST; flip to "registered" only when that changes.
export const INVOICE_GST_MODE: GstMode = "not_registered";

export interface Mailer { send(to: string, subject: string, text: string): Promise<void> }
export class MockMailer implements Mailer { outbox: { to: string; subject: string; text: string }[] = []; async send(to: string, subject: string, text: string) { this.outbox.push({ to, subject, text }); } }

import type { OwnerStore, ZoneProvider } from "./owner/engine.ts";
import type { DohFetch } from "../../lib/guestscan/scan.ts";
export interface OwnerDeps { store: OwnerStore; doh: (domain: string) => DohFetch; zones: ZoneProvider }
import { marketExport, hasActiveMarketJobs, type MarketDeps } from "./market/service.ts";
export interface Deps { subscribers?: import("./subscribe.ts").SubscriberStore; owner?: OwnerDeps; market?: MarketDeps; store: Store; billing: BillingProvider; dns: TxtResolver; mailer: Mailer; now: () => number; siteOrigin: string; webhookSecret?: string; receiptSecret?: string; receiptKeyring?: import("./agent/receipt.ts").ReceiptKeyring; operatorSecret?: string; log?: (line: string) => void; model?: import("./agent/tools.ts").ModelClient; ent?: EntContext; throttle?: import("./throttle.ts").Throttle; booking?: import("./booking/types.ts").BookingDeps }
// f181: HttpError lives in util.ts (service.ts <-> plan_change_service.ts was a runtime import cycle); re-exported so every caller keeps working.
export { HttpError } from "./util.ts";
import { HttpError } from "./util.ts";
const DAY = 86_400_000;
export const LOGIN_TTL_MS = 15 * 60_000, SESSION_TTL_MS = 30 * DAY, LOGIN_LIMIT = 5, LOGIN_WINDOW_MS = 3_600_000;

// 1 SIGN UP / LOGIN: one passwordless door. The first verified link creates the account.
export async function requestLogin(d: Deps, emailIn: unknown): Promise<void> {
  const email = normaliseEmail(emailIn);
  if (!email) throw new HttpError(400, "invalid_email");
  const now = d.now();
  if ((await d.store.loginRequestsSince(email, now - LOGIN_WINDOW_MS)) >= LOGIN_LIMIT) throw new HttpError(429, "too_many_requests");
  await d.store.noteLoginRequest(email, now);
  const token = randomToken("ll");
  await d.store.putLoginToken({ hash: await sha256Hex(token), email, expiresAt: now + LOGIN_TTL_MS, used: false });
  await d.mailer.send(email, "Your TITANOS login link", `Open this link within 15 minutes to sign in:\n${d.siteOrigin}/app/login#token=${token}\nIf you did not ask for this, ignore it.`);
}
export async function verifyLogin(d: Deps, tokenIn: unknown): Promise<{ session: string; account: Pick<Account, "id" | "email" | "seat"> }> {
  if (typeof tokenIn !== "string" || !tokenIn.startsWith("ll_")) throw new HttpError(400, "invalid_token");
  const now = d.now();
  const lt = await d.store.consumeLoginToken(await sha256Hex(tokenIn), now);
  if (!lt) throw new HttpError(401, "token_invalid_or_used");
  let acct = await d.store.accountByEmail(lt.email);
  if (acct?.deletedAt) acct = undefined;
  if (!acct) { acct = { id: randomToken("acc", 12), email: lt.email, seat: "owner", createdAt: now }; await d.store.putAccount(acct); }
  const session = randomToken("ss");
  await d.store.putSession({ hash: await sha256Hex(session), accountId: acct.id, expiresAt: now + SESSION_TTL_MS });
  return { session, account: { id: acct.id, email: acct.email, seat: acct.seat } };
}
export async function authenticate(d: Deps, bearer: string | null): Promise<Account> {
  const m = bearer?.match(/^Bearer (ss_[0-9a-f]+)$/);
  if (!m) throw new HttpError(401, "unauthenticated");
  const s = await d.store.sessionByHash(await sha256Hex(m[1]), d.now());
  const a = s && (await d.store.accountById(s.accountId));
  if (!a || a.deletedAt) throw new HttpError(401, "unauthenticated");
  return a;
}

// 2 VERIFY A DOMAIN (DNS TXT)
export async function addDomain(d: Deps, a: Account, domainIn: unknown) {
  const domain = normaliseDomain(domainIn);
  if (!domain) throw new HttpError(400, "invalid_domain");
  const mine = (await d.store.domainsFor(a.id)).find((x) => x.domain === domain);
  if (mine) return present(mine);
  const owner = await d.store.verifiedOwnerOf(domain);
  if (owner) throw new HttpError(409, "domain_already_verified_by_another_account");
  const row = { id: randomToken("dom", 8), accountId: a.id, domain, token: randomToken("v", 16) };
  await d.store.putDomain(row);
  return present(row);
}
const present = (r: { id: string; domain: string; token: string; verifiedAt?: number }) =>
  ({ id: r.id, domain: r.domain, verified: !!r.verifiedAt, record: { type: "TXT", name: verifyRecordName(r.domain), value: verifyRecordValue(r.token) } });
export async function verifyDomain(d: Deps, a: Account, id: string) {
  const row = await d.store.domainById(id);
  if (!row || row.accountId !== a.id) throw new HttpError(404, "not_found");
  if (row.verifiedAt) return present(row);
  const owner = await d.store.verifiedOwnerOf(row.domain);
  if (owner && owner.accountId !== a.id) throw new HttpError(409, "domain_already_verified_by_another_account");
  let values: string[];
  try { values = await d.dns.txt(verifyRecordName(row.domain)); } catch { throw new HttpError(502, "dns_lookup_failed"); }
  if (!values.includes(verifyRecordValue(row.token))) throw new HttpError(422, "txt_record_not_found");
  row.verifiedAt = d.now();
  await d.store.putDomain(row);
  return present(row);
}

// 3 BUY: Stripe checkout (mock in tests). Domain-bound products need a domain this account has verified.
export async function startCheckout(d: Deps, a: Account, productId: unknown, domainIn: unknown) {
  const p: Product | undefined = typeof productId === "string" ? PRODUCTS[productId] : undefined;
  if (!p) throw new HttpError(400, "unknown_product");
  let domain: string | undefined;
  if (p.needsVerifiedDomain) {
    domain = normaliseDomain(domainIn) ?? undefined;
    const ok = domain && (await d.store.domainsFor(a.id)).some((x) => x.domain === domain && x.verifiedAt);
    if (!ok) throw new HttpError(403, "verified_domain_required");
  }
  const purchaseId = randomToken("pur", 8);
  const cs = await d.billing.createCheckout({
    email: a.email, mode: p.mode, name: p.name, amountCents: p.amountCents, interval: p.interval, accountId: a.id, productId: p.id,
    successUrl: `${d.siteOrigin}/app/billing?done=${purchaseId}`, cancelUrl: `${d.siteOrigin}/app/billing?cancelled=1`, idempotencyKey: purchaseId,
  });
  await d.store.putPurchase({ id: purchaseId, accountId: a.id, productId: p.id, domain, checkoutId: cs.id, amountCents: p.amountCents, deliverableIssued: false, refundedCents: 0, status: "pending", createdAt: d.now() });
  return { purchaseId, checkoutUrl: cs.url };
}

// Stripe webhook. Signature is checked by the caller; this handles the verified event, once per event id.
export async function handleStripeEvent(d: Deps, ev: { id: string; type: string; data: { object: Record<string, any> } }): Promise<"handled" | "duplicate" | "ignored"> {
  const o = ev.data.object;
  const checkoutDone = ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded";
  if (checkoutDone && o.payment_status === "unpaid") return "ignored";   // F-C2: an unpaid event must not burn its id; the async success arrives under another id
  if (!(await d.store.claimEvent(ev.id))) return "duplicate";
  if (checkoutDone) {
    const pur = await d.store.purchaseByCheckout(String(o.id));
    if (!pur || o.payment_status !== "paid") return "ignored"; // unpaid (async method) waits for async_payment_succeeded
    if (pur.status === "pending") await markPaid(d, pur, o, ev.id); // a second paid signal for the same session never funds or invoices again
    return "handled";
  }
  if (ev.type === "charge.refunded") {
    const pi = String(o.payment_intent ?? ""), pur = pi ? await d.store.purchaseByPaymentIntent(pi) : undefined;
    if (!pi) return "ignored";
    if (!pur) { // refund before its payment: held, reconciled by markPaid
      await d.store.holdFact(`pi:${pi}`, { kind: "refund", cents: Number(o.amount_refunded ?? 0) });
      const late = await d.store.purchaseByPaymentIntent(pi); // f238: the claim may have landed between the lookup and the hold, after markPaid's takeFacts: re-check and drain
      if (late) for (const f of await d.store.takeFacts(`pi:${pi}`)) await recordRefund(d, late.id, Number(f.cents));
      return "handled";
    }
    await recordRefund(d, pur.id, Number(o.amount_refunded ?? 0));
    return "handled";
  }
  if (ev.type === "invoice.paid" && o.subscription && (o.billing_reason === "subscription_cycle" || o.billing_reason === "subscription_create")) {
    const subId = String(typeof o.subscription === "object" ? o.subscription.id : o.subscription), cycle = o.billing_reason === "subscription_cycle";
    const period = invoicePeriod(o);
    const sub0 = await d.store.subscriptionById(subId);
    if (!sub0) { // the invoice beat its checkout: hold the Stripe period for markPaid to seed from (a cycle invoice with no period stays "ignored", as before f101)
      if (!period) return "ignored";
      await d.store.holdFact(`sub:${subId}`, { kind: "period", start: period.start, end: period.end, create: !cycle });
      await sweepLateFacts(d, subId); // f191: the row may have appeared between the read above and the hold
      return "handled";
    }
    const sub = await updateSubscription(d, subId, async (x, fx) => { await seedPeriod(d, x, period, !cycle, fx); return true; }) ?? sub0;
    if (!cycle) return "handled"; // the first invoice is issued by markPaid
    const pur = await d.store.purchaseById(sub.purchaseId);
    if (pur) await issueInvoice(d, pur, Number(o.amount_paid ?? PRODUCTS[sub.productId].amountCents), ev.id);
    return "handled";
  }
  if (ev.type === "customer.subscription.deleted") {
    const sub = await d.store.subscriptionById(String(o.id));
    if (!sub) { await d.store.holdFact(`sub:${String(o.id)}`, { kind: "cancel" }); await sweepLateFacts(d, String(o.id)); return "handled"; } // cancel before its payment: held; f191: re-check after the hold
    await updateSubscription(d, sub.id, (x) => { if (x.cancelledAt) return false; x.cancelledAt = d.now(); return true; }); // CAS: never overwrites a racing changePlan winner
    return "handled";
  }
  d.log?.(`webhook ignored unknown event type ${ev.type} (${ev.id})`);
  return "ignored";
}
// Cumulative Stripe amount_refunded: idempotent and monotone, clamped to [0, amount], never negative.
function applyRefund(pur: Purchase, cents: number) {
  pur.refundedCents = Math.max(pur.refundedCents, Math.min(pur.amountCents, Math.max(0, Math.trunc(cents) || 0)));
  if (pur.refundedCents >= pur.amountCents) pur.status = "refunded";
}
// f238: a refund is a compare-and-set from the status just read, never a blind put. paid -> refunded (and cancelled -> refunded when money moved, i.e. a payment intent exists);
// pending / abandoned never took money, so a refund signal leaves them alone. A lost CAS re-reads and retries on the fresh row; a replay or a row already at the target changes nothing (no-op, stored row returned).
// markPaid never writes the purchase after its claim, so it can no longer erase a refund back to paid, and a late write can never revive refunded.
export class RefundContention extends Error { constructor(id: string) { super(`refund CAS lost ${REFUND_TRIES} times on purchase ${id}; nothing silently dropped, the caller must retry (Stripe re-delivers the webhook)`); } }
const REFUND_TRIES = 8;
// f243: how long an unfinished refund intent is respected before another caller may take it over, how many waits a rival makes for the winner, and when the reaper may delete a settled memo.
export const MEMO_LEASE_MS = 60_000, MEMO_WAIT = 200, MEMO_TTL_MS = 7 * 86_400_000;
export class RefundInFlight extends RefundContention { constructor(id: string) { super(id); this.message = `refund for purchase ${id} is in flight on another call; retry`; this.name = "RefundInFlight"; } }
// f240: Stripe has ALREADY refunded when requestRefund's own recordRefund runs out of retries. This typed error (a RefundContention, so existing catches still match) carries the Stripe refund id and the idempotency key:
// the caller gets a 503 refund_record_pending with the id, the next charge.refunded webhook (or a replayed requestRefund, which reuses the remembered refund and never calls Stripe again) heals the ledger. Never a silent drop, never a second refund.
export class RefundRecordPending extends RefundContention { purchaseId: string; refundId: string; idempotencyKey: string; constructor(purchaseId: string, refundId: string, idempotencyKey: string) { super(purchaseId); this.purchaseId = purchaseId; this.refundId = refundId; this.idempotencyKey = idempotencyKey; this.name = "RefundRecordPending"; } }
// f239: the CAS guards status AND the refunded_cents just read, so two concurrent partial refunds cannot lose the smaller cumulative: the loser re-reads, re-merges (cumulative, monotone, clamped) and retries.
// Exhausting the bounded retries throws RefundContention (a webhook fails and is re-delivered); it never returns a stale row as if the refund had landed.
export async function recordRefund(d: Pick<Deps, "store"> & Partial<Pick<Deps, "now">>, purchaseId: string, cents: number): Promise<Purchase | undefined> {
  for (let i = 0; i < REFUND_TRIES; i++) {
    const cur = await d.store.purchaseById(purchaseId);
    if (!cur || !(cur.status === "paid" || cur.status === "refunded" || (cur.status === "cancelled" && cur.paymentIntent))) return cur;
    const next: Purchase = { ...cur }; applyRefund(next, cents);
    if (d.now && next.status === "refunded" && next.refundedAt === undefined) next.refundedAt = d.now(); // f285: the moment a customer-requested refund landed (credit note date)
    if (next.refundedCents === cur.refundedCents && next.status === cur.status) return cur;
    if (await d.store.casPurchase(next, cur.status, cur.refundedCents)) return next;
  }
  throw new RefundContention(purchaseId);
}
// f236: the pending -> paid transition is a compare-and-set that runs FIRST. Whoever wins it (webhook or the f210 sweep) runs the side effects (takeFacts, seeds, account, invoice) exactly once;
// the loser is a no-op and returns the winner's purchase. `pur` is never mutated before the win (MemoryStore hands out live objects), and is brought up to date after it.
export const LEASE_MS = 5 * 60_000; // f242: how long a winner's claim lease lives (a killed isolate frees it by expiry); must stay below the sweep grace window
export const leaseKey = (purchaseId: string) => `claim:${purchaseId}`;
export async function markPaid(d: Deps, pur: Purchase, o: Record<string, any>, eventId: string): Promise<{ won: boolean; purchase: Purchase }> {
  const now = d.now(), owner = randomToken("lease", 8);
  // f242: the lease is taken BEFORE the claim, so no sweep can see this purchase paid without also seeing the lease. A caller that cannot get it lost to a live winner.
  if (!(await d.store.acquireLease(leaseKey(pur.id), owner, now, LEASE_MS))) return { won: false, purchase: (await d.store.purchaseById(pur.id)) ?? pur };
  try {
    const claim: Purchase = { ...pur, status: "paid", paidAt: now, paymentIntent: o.payment_intent ? String(o.payment_intent) : pur.paymentIntent };
    if (o.subscription) claim.subscriptionId = String(typeof o.subscription === "object" ? o.subscription.id : o.subscription); // id, or expanded (f101)
    if (!(await d.store.casPurchase(claim, "pending"))) return { won: false, purchase: (await d.store.purchaseById(pur.id)) ?? pur }; // lost the race: the winner does the work
    Object.assign(pur, claim);
    if (o.subscription) {
      // f245: the winner writes ONCE. A winner that stalled past LEASE_MS may find the f237 sweep has already seeded the row (the lease expired, the sweep proceeded): an upsert here would overwrite the sweep's row. putSubscriptionOnce
      // leaves it alone (the sweep's row stands, and its own invoice path dedups on the purchase), and the only thing this winner took that the sweep may not have is the held cancel, which is merged onto the sweep's row.
      const parts: SeedParts = {};
      const sub = await buildSubscription(d, pur, o.subscription, now, parts);
      if (await d.store.putSubscriptionOnce(sub)) await replayLateFacts(d, sub); // f245: a hold written during the winner window (after buildSubscription's takeFacts) is replayed onto the landed row
      else { await mergeLostSeed(d, sub, parts); await sweepLateFacts(d, sub.id); } // f191: a fact held after the take above lands on the standing row. f186 on int3's shape: the facts THIS call took are applied to the row that won, never consumed without effect
    }
    if (pur.paymentIntent) for (const f of await d.store.takeFacts(`pi:${pur.paymentIntent}`)) await recordRefund(d, pur.id, Number(f.cents)); // f238: CAS merge, not a blind put (the claim already wrote the paid row)
    Object.assign(pur, (await d.store.purchaseById(pur.id)) ?? {}); // bring the caller's object to the stored truth (a concurrent refund may have landed)
    if (o.customer) { const a = await d.store.accountById(pur.accountId); if (a) await d.store.putAccount({ ...a, stripeCustomerId: String(o.customer) }); }
    await issueInvoiceOnce(d, pur, PRODUCTS[pur.productId].amountCents, eventId);
    return { won: true, purchase: pur };
  } finally { await d.store.releaseLease(leaseKey(pur.id), owner); }
}
// f245: the winner lost putSubscriptionOnce to a sweep that seeded after the TTL. The sweep's row stands; a cancel this winner took from the held facts (and the sweep never saw) is carried onto it.
async function mergeLostSeed(d: Deps, mine: Subscription, p: SeedParts) {
  const theirs = await d.store.subscriptionByPurchase(mine.purchaseId);
  if (!theirs) return;
  await updateSubscription(d, theirs.id, async (x, fx) => { // f183 CAS; f186: the cancel AND the Stripe periods this winner took from the held facts are applied to the row that stands
    const before = JSON.stringify(x);
    fx.taken = p.facts; fx.used = true; // consumed here on purpose: never put back (nobody would ever take them again)
    if (p.cancel && !x.cancelledAt) x.cancelledAt = mine.cancelledAt;
    const planned = !!x.plan;
    await seedPeriod(d, x, p.sp, true, fx); // no plan yet: seeds it and replays the held rest from fx.taken; a plan already there: observePeriod, idempotent
    if (planned) for (const hp of p.rest ?? []) await seedPeriod(d, x, hp, false, fx);
    return JSON.stringify(x) !== before;
  });
}
// f242: a fact held for this subscription AFTER the seed read its facts (a webhook that looked the row up, found none, then held) is replayed onto the row once it is written. Take = remove, so each fact applies once.
export async function replayLateFacts(d: Deps, sub: Subscription): Promise<boolean> {
  const late = await d.store.takeFacts(`sub:${sub.id}`);
  if (late.length === 0) return false;
  const cancel = late.some((f) => f.kind === "cancel"), held = heldPeriods(late);
  try { // f183: CAS update (holds deferred until the write lands); the facts are taken once, so a lost CAS re-applies the same facts to the winner's row
    const stored = await updateSubscription(d, sub.id, async (x, fx) => {
      fx.taken = late; fx.used = true; // consumed here on purpose: put back only if the update throws (below)
      if (cancel && !x.cancelledAt) x.cancelledAt = d.now();
      const planned = !!x.plan;
      await seedPeriod(d, x, held.first, true, fx); // f191: a held create-period seeds a planless row (and replays the rest from fx.taken)
      if (planned || !held.first) for (const hp of held.rest) await seedPeriod(d, x, hp, false, fx); // no first period and no plan: the rest are re-held (via fx) until the first arrives
      return true;
    });
    if (stored) Object.assign(sub, stored); // the caller's object follows the stored truth
  } catch (e) { if (!(e as { factsRestored?: boolean })?.factsRestored) for (const f of late) await d.store.holdFact(`sub:${sub.id}`, f); throw e; } // nothing written: put the facts back (once: updateSubscription may already have), never lose them
  return true;
}
// f237: the subscription row for a paid subscription purchase, built from held facts (cancels, periods) and Stripe's own subscription (id or expanded). Shared by markPaid (winner)
// and the f237 repair in reconcile.ts, so a repaired row is the row markPaid would have written.
export type SeedParts = { facts?: Record<string, unknown>[]; cancel?: boolean; sp?: StripePeriod; rest?: StripePeriod[] }; // what buildSubscription consumed from the held facts (f186: a loser of putSubscriptionOnce re-applies it to the winner's row)
export async function buildSubscription(d: Pick<Deps, "store" | "log">, pur: Purchase, stripeSub: unknown, now: number, out?: SeedParts): Promise<Subscription> {
  const facts = await d.store.takeFacts(`sub:${pur.subscriptionId}`); // held facts are cancels AND (f101) Stripe periods: only a cancel cancels
  const cancel = facts.some((f) => f.kind === "cancel");
  const held = heldPeriods(facts), sp = stripePeriodOf(stripeSub, d.log) ?? held.first;
  if (out) { out.facts = facts; out.cancel = cancel; out.sp = sp; out.rest = held.rest; }
  const sub: Subscription = { id: pur.subscriptionId as string, accountId: pur.accountId, purchaseId: pur.id, productId: pur.productId, startedAt: sp ? sp.start : now, ...(cancel ? { cancelledAt: now } : {}) };
  await seedPeriod(d as Deps, sub, sp, true);
  for (const hp of held.rest) await seedPeriod(d as Deps, sub, hp, false); // invoices that beat the checkout, oldest first
  return sub;
}
// ---- f101: seed PlanState from Stripe's own period (current_period_start/end, billing_cycle_anchor), seconds on the wire ----
// checkout.session.completed carries `subscription` as an id, or expanded as an object; invoice.paid carries the service period on
// its first line (lines.data[0].period), which is the period just paid (the invoice's own period_start/end is the usage window).
// f177: newer Stripe API versions moved current_period_start/end onto subscription items (items.data[]). Read both shapes:
// top-level wins when it is valid; else take the min start and max end across the valid items. Unusable input never throws:
// it returns undefined (calendar months keep applying) and, when a logger is given, says why.
export function stripePeriodOf(sub: unknown, log?: (m: string) => void): StripePeriod | undefined {
  if (!sub || typeof sub !== "object") return undefined;
  const x = sub as Record<string, any>;
  const top = periodFromStripe(x.current_period_start, x.current_period_end, x.billing_cycle_anchor);
  if (top) return top;
  const items: unknown[] = Array.isArray(x.items?.data) ? x.items.data : [];
  let start = Infinity, end = -Infinity, bad = 0;
  for (const it of items) {
    const i = (it && typeof it === "object" ? it : {}) as Record<string, any>;
    const p = periodFromStripe(i.current_period_start, i.current_period_end);
    if (!p) { bad++; continue; }
    start = Math.min(start, p.start); end = Math.max(end, p.end);
  }
  if (end > start) return periodFromStripe(start / 1000, end / 1000, x.billing_cycle_anchor);
  const hinted = x.current_period_start !== undefined || x.current_period_end !== undefined || items.length > 0;
  if (hinted) log?.(`stripe subscription ${typeof x.id === "string" ? x.id : "?"}: no usable period (top-level invalid, ${bad} of ${items.length} items invalid); calendar months apply`);
  else if (x.id !== undefined) log?.(`stripe subscription ${String(x.id)}: no period fields at all (neither top-level nor items); calendar months apply`);
  return undefined;
}
function invoicePeriod(inv: Record<string, any>): StripePeriod | undefined {
  const line = inv.lines?.data?.[0]?.period;
  const anchor = typeof inv.subscription === "object" ? inv.subscription?.billing_cycle_anchor : inv.billing_cycle_anchor;
  return line ? periodFromStripe(line.start, line.end, anchor) : undefined;
}
function heldPeriods(facts: Record<string, unknown>[]): { first?: StripePeriod; rest: StripePeriod[] } {
  const ps = facts.filter((f) => f.kind === "period").map((f) => ({ create: f.create === true, p: periodFromStripe(Number(f.start) / 1000, Number(f.end) / 1000) })).filter((x): x is { create: boolean; p: StripePeriod } => !!x.p)
    .sort((a, b) => a.p.start - b.p.start);
  const first = ps.find((x) => x.create)?.p; // only a subscription_create invoice may define the start; a held cycle invoice alone never does
  return { first, rest: ps.map((x) => x.p).filter((p) => p !== first) };
}
// Side effects of seedPeriod that must happen ONCE even when a CAS retry re-runs it (f183): facts taken from the store are cached across
// attempts, holds are deferred until the write lands, and facts taken but not used by the winning attempt are put back.
type SeedFx = { taken?: Record<string, unknown>[]; used: boolean; holds: Record<string, unknown>[] };
export const SUB_CAS_RETRIES = 8;
// Read-modify-write on a subscription guarded by compare-and-set (f175 pattern, extended to every writer in f183). mutate gets a COPY and
// returns false for "nothing to write". A loser re-reads and re-runs mutate against the winner's state; after SUB_CAS_RETRIES losses
// it throws 409 subscription_conflict having written nothing. Returns the stored subscription (undefined if the row does not exist).
export async function updateSubscription(d: Deps, id: string, mutate: (sub: Subscription, fx: SeedFx) => boolean | Promise<boolean>): Promise<Subscription | undefined> {
  const fx: SeedFx = { used: false, holds: [] };
  for (let attempt = 0; attempt < SUB_CAS_RETRIES; attempt++) {
    const v = await d.store.subscriptionVersioned(id);
    if (!v) return undefined;
    fx.holds = []; fx.used = false;
    if (!(await mutate(v.sub, fx))) return v.sub;
    if (!(await d.store.casSubscription(v.sub, v.version))) continue;
    for (const h of fx.holds) await d.store.holdFact(`sub:${id}`, h);
    if (fx.taken && !fx.used) for (const f of fx.taken) await d.store.holdFact(`sub:${id}`, f);
    return v.sub;
  }
  // f261 on int3's shape: no attempt landed, so nothing the callers took (fx.taken: held cancels and periods) was applied. Put them back before
  // the 409, or a lost-CAS markPaid/sweep would consume them for good (the webhook event is already claimed: a redelivery is a duplicate).
  if (fx.taken) for (const f of fx.taken) await d.store.holdFact(`sub:${id}`, f);
  throw Object.assign(new HttpError(409, "subscription_conflict"), { factsRestored: !!fx.taken });
}
// Retainer tiers only (the three AI tiers own a PlanState). No period = no plan: calendar months apply until Stripe's numbers arrive.
// Only the FIRST period (checkout's expanded subscription, or the subscription_create invoice) may define the start and the grid;
// a later cycle period seen while no plan exists is held and replayed in order once the first arrives.
async function seedPeriod(d: Deps, sub: Subscription, p: StripePeriod | undefined, create: boolean, fx?: SeedFx) {
  if (!p || !isTier(sub.productId)) return;
  if (!sub.plan) {
    if (!create) { const f = { kind: "period", start: p.start, end: p.end, create: false }; if (fx) fx.holds.push(f); else await d.store.holdFact(`sub:${sub.id}`, f); return; }
    sub.startedAt = p.start; sub.plan = initPlanFromStripe(sub.productId as Tier, p);
    let facts: Record<string, unknown>[];
    if (fx) { fx.taken ??= await d.store.takeFacts(`sub:${sub.id}`); fx.used = true; facts = fx.taken; } else facts = await d.store.takeFacts(`sub:${sub.id}`);
    if (facts.some((f) => f.kind === "cancel") && !sub.cancelledAt) sub.cancelledAt = d.now(); // f191: a cancel held in the same bucket is taken with the periods; never consume it without effect
    for (const hp of heldPeriods(facts).rest) await seedPeriod(d, sub, hp, false, fx);
    return;
  }
  const r = observePeriod(sub.plan, p);
  if (r.applied === "advanced") sub.plan = r.state;
  else if (r.applied === "offgrid") d.log?.(`stripe period off the billing grid for ${sub.id}: start ${p.start} (state untouched)`);
}
// f191: hold-then-create ordering window. A webhook reads "no subscription", holds its fact; markPaid takes facts, then creates the row.
// If the hold lands after the take, the fact sits under a key nobody takes again. Both sides therefore re-check: the webhook sweeps after
// its hold (row exists now?), markPaid sweeps after its create. takeFacts removes atomically, so each fact is applied exactly once, by
// whichever side takes it, and a fact held while there is still no row is picked up by markPaid's sweep.
async function sweepLateFacts(d: Deps, subId: string) {
  const row = await d.store.subscriptionById(subId);
  if (row) await replayLateFacts(d, row); // still no row: the winner's post-create replay will take it
}
async function issueInvoice(d: Deps, pur: Purchase, amountCents: number, eventId: string) {
  // Renewal invoice: one per (purchase, event). The number is taken inside the guarded write (f366); a duplicate event is a clean no-op and burns no number.
  const inv = await d.store.issueInvoiceNumbered({ id: randomToken("inv", 8), accountId: pur.accountId, purchaseId: pur.id, productId: pur.productId, amountCents, issuedAt: d.now(), stripeEventId: eventId }, "purchase_event");
  if (inv) await entSvc.onInvoice(d, inv); // C8: partner commission, recorded; a failure is logged to the operator, never thrown into the webhook
}
// The FIRST invoice of a purchase (markPaid, and the f203 reconciler). At most one per purchase, whoever gets there first: the pre-check saves a round trip, the store's
// issueInvoiceNumbered is the real guard AND takes the number inside the same atomic write (f366), so a race loser burns NO number and the sequence stays gap-free.
export async function issueInvoiceOnce(d: Pick<Deps, "store" | "now">, pur: Purchase, amountCents: number, eventId: string): Promise<boolean> {
  if (await d.store.purchaseInvoiced(pur.id)) return false;
  const inv = await d.store.issueInvoiceNumbered({ id: randomToken("inv", 8), accountId: pur.accountId, purchaseId: pur.id, productId: pur.productId, amountCents, issuedAt: d.now(), stripeEventId: eventId }, "purchase");
  if (inv) await entSvc.onInvoice(d as Deps, inv); // C8: partner commission, recorded once with the invoice that won
  return inv !== undefined;
}

// 4 INVOICES. Rendered by the pure f281 renderer (invoice_render.ts). The GST wording comes from INVOICE_GST_MODE, never invented here.
export async function listInvoices(d: Deps, a: Account) { return (await d.store.invoicesFor(a.id)).sort((x, y) => x.issuedAt - y.issuedAt); }
async function ownInvoice(d: Deps, a: Account, id: string): Promise<Invoice> {
  const i = await d.store.invoiceById(id);
  if (!i || i.accountId !== a.id) throw new HttpError(404, "not_found"); // another account's id is a 404, never a 403
  return i;
}
export async function renderInvoice(d: Deps, a: Account, id: string): Promise<RenderedDoc> {
  const i = await ownInvoice(d, a, id);
  return renderInvoiceDoc({ invoice: i, billedToEmail: a.email, itemName: PRODUCTS[i.productId]?.name ?? i.productId, gst: INVOICE_GST_MODE });
}
// Credit note for a refunded purchase: attached to the purchase's first invoice, amount = refundedCents (capped at that invoice), dated refundedAt.
export async function renderCreditNote(d: Deps, a: Account, id: string): Promise<RenderedDoc> {
  const i = await ownInvoice(d, a, id);
  const pur = i.purchaseId ? await d.store.purchaseById(i.purchaseId) : undefined;
  if (!pur || pur.accountId !== a.id || pur.refundedCents <= 0 || pur.refundedAt === undefined) throw new HttpError(404, "not_found");
  const first = (await d.store.invoicesFor(a.id)).filter((x) => x.purchaseId === pur.id).sort((x, y) => x.issuedAt - y.issuedAt || x.number.localeCompare(y.number))[0];
  if (!first || first.id !== i.id) throw new HttpError(404, "not_found");
  return renderInvoiceDoc({ invoice: i, billedToEmail: a.email, itemName: PRODUCTS[i.productId]?.name ?? i.productId, gst: INVOICE_GST_MODE,
    creditNote: { amountCents: Math.min(pur.refundedCents, i.amountCents), issuedAt: pur.refundedAt, reason: "Refund of purchase" } });
}

// 5 CANCEL. Monitor: ends at period end. Retainers: not before the minimum term ends. No auto-refund of the current period.
export async function cancelSubscription(d: Deps, a: Account, subId: string) {
  const sub = await d.store.subscriptionById(subId);
  if (!sub || sub.accountId !== a.id) throw new HttpError(404, "not_found");
  if (sub.cancelledAt) return { status: "already_cancelled" as const, effectiveAt: sub.cancelAt ?? sub.cancelledAt };
  const p = PRODUCTS[sub.productId];
  let periodEnd: number;
  if (isTier(sub.productId)) {
    // Retainers: ONE minimum-term rule, owned by plan_change.planChange (3 calendar months, then the next period boundary). f100.
    const r = await changePlan(d, a, subId, { eventId: `cancel:${sub.id}`, kind: "cancel" });
    if (!r.outcome.ok) {
      if (r.outcome.reason === "subscription_ended") return { status: "already_cancelled" as const, effectiveAt: (await d.store.subscriptionById(subId))?.plan?.endedAt ?? d.now() };
      throw new HttpError(409, r.outcome.reason);
    }
    periodEnd = r.outcome.effectiveAt;
  } else periodEnd = nextPeriodEnd(sub.startedAt, p.interval ?? "month", d.now());
  await d.billing.cancelSubscription(sub.id, true);
  // Retainers: changePlan has ALREADY written cancelAt inside its own CAS with the plan, so a second write here could only re-apply a
  // stale cancelAt over a later upgrade/keep that cleared it (f183). Only the non-retainer path (no PlanState) still sets it, via CAS.
  if (!isTier(sub.productId)) await updateSubscription(d, sub.id, (x) => { x.cancelAt = periodEnd; return true; });
  return { status: "cancel_scheduled" as const, effectiveAt: periodEnd };
}
function addMonths(ms: number, n: number) { const x = new Date(ms); x.setUTCMonth(x.getUTCMonth() + n); return x.getTime(); }
function nextPeriodEnd(start: number, interval: "month" | "year", now: number) {
  let t = start, step = interval === "year" ? 12 : 1;
  while (t <= now) t = addMonths(t, step);
  return t;
}

// 6 REFUND. In policy (compliance, 14 days, no deliverable) is automatic. Anything else raises a review card (GATE1: Kyle taps).
export async function requestRefund(d: Deps, a: Account, purchaseId: string) {
  const pur = await d.store.purchaseById(purchaseId);
  if (!pur || pur.accountId !== a.id) throw new HttpError(404, "not_found");
  if (pur.status !== "paid" || !pur.paymentIntent || !pur.paidAt) throw new HttpError(409, "not_refundable_yet");
  // f240: a remembered Stripe refund (RefundRecordPending earlier) means the money already moved and policy was already passed: the replay only converges the ledger, so it skips the verdict (a rival partial now makes refundedCents > 0, which would wrongly route it to review).
  const key = `refund-${pur.id}`, memo = `refundsent:${pur.id}`;
  // f243: claim the memo with ONE conditional insert BEFORE anything else (was f240 take-then-hold). Exactly one caller inserts the intent and may call Stripe; a rival waits for its refund id (then only converges the ledger),
  // and an intent older than MEMO_LEASE_MS (its owner died) is taken over by CAS. A re-used Stripe idempotency key makes a takeover after a crash between the Stripe call and the remember harmless.
  let mine: Record<string, unknown> | undefined, sent: { refundId: string } | undefined;
  for (let i = 0; i < MEMO_WAIT && !mine && !sent; i++) {
    const intent = { state: "intent", at: d.now() };
    if (await d.store.memoInsert(memo, intent)) { mine = intent; break; }
    const cur = await d.store.memoPeek(memo); if (!cur) continue;
    if (typeof cur.refundId === "string") { sent = cur as { refundId: string }; break; }
    if (d.now() - Number(cur.at) > MEMO_LEASE_MS && await d.store.memoSwap(memo, cur, intent)) { mine = intent; break; }
    await new Promise((r) => setImmediate(r));
  }
  if (mine) { // a winner may have finished (ledger moved, memo cleared) between our status read and our claim: re-read under the claim, never refund twice
    const fresh = await d.store.purchaseById(pur.id);
    if (!fresh || fresh.status !== "paid") { await d.store.memoSwap(memo, mine, null); if (fresh?.status === "refunded") return { status: "refunded" as const, amountCents: pur.amountCents }; throw new HttpError(409, "not_refundable_yet"); }
  }
  if (!mine && !sent) { // the winner finished while we waited (memo gone, ledger moved) or is still in flight
    const now = await d.store.purchaseById(pur.id);
    if (now && now.status === "refunded") return { status: "refunded" as const, amountCents: pur.amountCents };
    throw new RefundInFlight(pur.id);
  }
  const v = sent ? { auto: true as const } : refundVerdict(PRODUCTS[pur.productId], pur.paidAt, d.now(), pur.deliverableIssued, pur.refundedCents > 0);
  if (!v.auto) {
    if (mine) await d.store.memoSwap(memo, mine, null); // no Stripe call was made: release the intent
    // Out of policy: one pending_review RefundCase per purchase (a repeat request returns the same case, never a second card),
    // with the legacy ReviewCard kept in step (same id, resolved false). The card payload is returned as DATA ONLY: nothing is sent.
    const prior = (await d.store.refundCasesFor(pur.id)).filter((r) => r.status !== "denied").sort((x, y) => x.createdAt - y.createdAt)[0];
    let rc = prior;
    if (!rc) {
      const n = (await d.store.refundCasesFor(pur.id)).length;
      rc = { id: n === 0 ? `rf_${pur.id}` : `rf_${pur.id}_${n + 1}`, accountId: a.id, purchaseId: pur.id, productName: PRODUCTS[pur.productId].name, amountCents: pur.amountCents - pur.refundedCents, reason: v.reason, inPolicy: false, status: "pending_review", createdAt: d.now() };
      await d.store.putRefundCase(rc);
      await d.store.putCard({ id: rc.id, accountId: a.id, purchaseId: pur.id, kind: "refund_outside_policy", reason: v.reason, createdAt: rc.createdAt, resolved: false });
    }
    const card = rc.status === "pending_review" ? buildRefundCard(rc) : undefined;
    return { status: "needs_review" as const, reason: v.reason, refundId: rc.id, caseStatus: rc.status, card };
  }
  // f240: the Stripe call is made at most once per purchase key. The refund id is remembered (held fact) until the ledger CAS lands, so a replay after RefundRecordPending skips Stripe and only converges the ledger.
  // A crash between the Stripe call and the remember is safe too: the replay reuses the same idempotency key, which Stripe answers with the same refund.
  if (!sent) { // we hold the intent: the only path that reaches Stripe
    const refundId = (await d.billing.refund(pur.paymentIntent, pur.amountCents - pur.refundedCents, key)).id;
    const next = { refundId, at: d.now() };
    if (await d.store.memoSwap(memo, mine!, next)) mine = next; // lost swap = a takeover after our lease ran out; its Stripe call used the same key, so the refund id is the same
    sent = { refundId };
  }
  try { await recordRefund(d, pur.id, pur.amountCents); } // f238: paid -> refunded by CAS; a webhook that got there first makes this a no-op
  catch (e) { if (e instanceof RefundContention) throw new RefundRecordPending(pur.id, sent.refundId, key); throw e; }
  const cur = await d.store.memoPeek(memo); if (cur) await d.store.memoSwap(memo, cur, null); // ledger landed: clear the memo
  await entSvc.onRefund(d, pur.id, pur.amountCents); // C8: claw back the partner commission (kept from int3; f243's memo clear replaces the old takeFacts(memo))
  return { status: "refunded" as const, amountCents: pur.amountCents };
}

// f243 memo reaper: deletes refund memos older than the TTL whose purchase is no longer paid (settled by a webhook or an earlier replay). A memo whose purchase is still paid is a refund still pending
// (Stripe moved the money, the ledger has not): it is NEVER reaped. The delete is a CAS on the exact fact, so a memo a live call just rewrote survives.
export async function reapRefundMemos(d: Deps, ttlMs = MEMO_TTL_MS): Promise<{ reaped: string[]; kept: string[] }> {
  const reaped: string[] = [], kept: string[] = [];
  for (const { key, fact } of await d.store.memoList("refundsent:")) {
    if (d.now() - Number(fact.at ?? 0) <= ttlMs) { kept.push(key); continue; }
    const pur = await d.store.purchaseById(key.slice("refundsent:".length));
    if (pur && pur.status === "paid") { kept.push(key); continue; }
    if (await d.store.memoSwap(key, fact, null)) reaped.push(key); else kept.push(key);
  }
  return { reaped, kept };
}

// 7 API KEYS (shown once, hash stored) 8 DATA EXPORT 9 ACCOUNT DELETION
export function parseCap(v: unknown, max: number, name: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max) throw new HttpError(400, `invalid_${name}`);
  return v;
}
export async function createKey(d: Deps, a: Account, scopesIn: unknown, caps: { capDaily?: unknown; capTotal?: unknown } = {}) {
  // F-C7: an allow-list, not a sanitiser. Any scope string the tool catalogue does not define (e.g. "admin") is a 400,
  // never stored. Omitted or empty means a key with no scopes, as before.
  if (scopesIn !== undefined && !Array.isArray(scopesIn)) throw new HttpError(400, "invalid_scope");
  const allowed: readonly string[] = SCOPES;
  const asked = (scopesIn ?? []) as unknown[];
  if (asked.length > 10 || asked.some((s) => typeof s !== "string" || !allowed.includes(s))) throw new HttpError(400, "invalid_scope");
  const scopes = [...new Set(asked as string[])];
  const capDaily = parseCap(caps.capDaily, MAX_KEY_CAP_DAILY, "capDaily") ?? DEFAULT_KEY_CAP_DAILY;
  const capTotal = parseCap(caps.capTotal, MAX_KEY_CAP_TOTAL, "capTotal") ?? DEFAULT_KEY_CAP_TOTAL;
  if ((await d.store.keysFor(a.id)).filter((k) => !k.revokedAt).length >= 10) throw new HttpError(409, "key_limit");
  const key = randomToken("tk", 24);
  const prefix = key.slice(0, 11); // "tk_" + 8 hex: non-secret handle shown in the keys list (the id-based keytrace prefix is separate)
  const row = { id: randomToken("key", 6), accountId: a.id, hash: await sha256Hex(key), prefix, scopes, createdAt: d.now(), capDaily, capTotal };
  await d.store.putKey(row);
  return { id: row.id, key, prefix, scopes, capDaily, capTotal, note: "Shown once. Store it now." };
}
const keyView = async (d: Deps, k: ApiKey) => {
  const sp = await d.store.keySpend(k.id, dayStartOf(d.now()), k.accountId);
  return { id: k.id, prefix: k.prefix ?? null, scopes: k.scopes, createdAt: k.createdAt, revoked: !!k.revokedAt, ...capsOf(k), spentToday: sp.day, spentTotal: sp.total };
};
export async function listKeys(d: Deps, a: Account) { return Promise.all((await d.store.keysFor(a.id)).map((k) => keyView(d, k))); }
// Owner-only (session auth, never an agent key, so a leaked key cannot raise its own cap).
export async function setKeyCaps(d: Deps, a: Account, id: string, caps: { capDaily?: unknown; capTotal?: unknown }) {
  const k = await d.store.keyById(id, a.id);
  if (!k || k.accountId !== a.id) throw new HttpError(404, "not_found");
  const capDaily = parseCap(caps.capDaily, MAX_KEY_CAP_DAILY, "capDaily"), capTotal = parseCap(caps.capTotal, MAX_KEY_CAP_TOTAL, "capTotal");
  if (capDaily === undefined && capTotal === undefined) throw new HttpError(400, "no_caps");
  await d.store.putKey({ ...k, ...(capDaily !== undefined ? { capDaily } : {}), ...(capTotal !== undefined ? { capTotal } : {}) });
  return keyView(d, (await d.store.keyById(id, a.id))!);
}
export async function revokeKey(d: Deps, a: Account, id: string) {
  const k = await d.store.keyById(id, a.id);
  if (!k || k.accountId !== a.id) throw new HttpError(404, "not_found");
  k.revokedAt = k.revokedAt ?? d.now(); await d.store.putKey(k);
}
export async function exportData(d: Deps, a: Account) {
  return {
    exportedAt: d.now(), account: { id: a.id, email: a.email, seat: a.seat, createdAt: a.createdAt },
    domains: (await d.store.domainsFor(a.id)).map((x) => ({ domain: x.domain, verified: !!x.verifiedAt })),
    purchases: await d.store.purchasesFor(a.id), subscriptions: await d.store.subscriptionsFor(a.id), invoices: await d.store.invoicesFor(a.id),
    apiKeys: await listKeys(d, a),
    ...(await marketExport(d, a)),
    enterprise: await entSvc.exportFor(d, a.id),
  };
}
export async function deleteAccount(d: Deps, a: Account, confirm: unknown) {
  if (confirm !== "DELETE") throw new HttpError(400, "confirmation_required");
  if (await hasActiveMarketJobs(d, a)) throw new HttpError(409, "market_jobs_active");   // funds are held against these: settle, cancel or dispute first
  await entSvc.assertCanDelete(d, a.id); // C8: refuse to orphan a tenant by deleting its last admin
  for (const s of await d.store.subscriptionsFor(a.id)) if (!s.cancelledAt && !s.cancelAt) await cancelSubscription(d, a, s.id);
  await d.store.anonymiseAccount(a.id, d.now());
  await entSvc.onAccountDeleted(d, a.id); // C8: memberships, referral
  return { status: "deleted" as const, retained: "invoices and payment records, kept without your email as required by tax law" };
}

// 6b REFUND DECISION (GATE1, Kyle's tap). Resolves the RefundCase through applyRefundDecision and keeps ReviewCard.resolved in step.
// It moves NO money and sends NOTHING: an approve only records the decision; the Stripe refunds.create call is a CARD NEEDED (receipt).
export async function decideRefund(d: Deps, refundId: string, decision: RefundDecision): Promise<{ changed: boolean; refund: RefundCase }> {
  const rc = await d.store.refundCaseById(refundId);
  if (!rc) throw new HttpError(404, "not_found");
  const r = applyRefundDecision(rc, decision, d.now());
  if (!r.ok) throw new HttpError(r.error === "bad_decision" ? 400 : 409, r.error);
  if (r.changed) await d.store.putRefundCase(r.refund);
  const card = await d.store.cardById(refundId);
  if (card && !card.resolved) await d.store.putCard({ ...card, resolved: true }); // also heals a case decided before a crash
  return { changed: r.changed, refund: r.refund };
}

// 6c MIGRATION of legacy synthetic ReviewCards (no RefundCase) into RefundCases. Idempotent. The old path never moved money for a card,
// so a legacy resolved=true card maps to "denied" (conservative: no refund was ever issued for it); resolved=false maps to pending_review.
export async function migrateReviewCards(d: Deps): Promise<{ migrated: number; skipped: number }> {
  let migrated = 0, skipped = 0;
  for (const c of await d.store.allCards()) {
    if (c.kind !== "refund_outside_policy" || (await d.store.refundCaseById(c.id))) { skipped++; continue; }
    const pur = await d.store.purchaseById(c.purchaseId);
    if (!pur) { skipped++; continue; }
    await d.store.putRefundCase({ id: c.id, accountId: c.accountId, purchaseId: c.purchaseId, productName: PRODUCTS[pur.productId]?.name ?? pur.productId, amountCents: pur.amountCents - pur.refundedCents, reason: c.reason, inPolicy: false, status: c.resolved ? "denied" : "pending_review", createdAt: c.createdAt, ...(c.resolved ? { decidedAt: c.createdAt } : {}) });
    migrated++;
  }
  return { migrated, skipped };
}
