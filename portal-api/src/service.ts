import { PRODUCTS, refundVerdict, type Product } from "./catalogue.ts";
import { buildRefundCard, applyRefundDecision, type RefundCase, type RefundCard, type RefundDecision } from "./refund_card.ts";
import { normaliseDomain, verifyRecordName, verifyRecordValue, type TxtResolver } from "./dns.ts";
import type { BillingProvider } from "./stripe.ts";
import type { Store, Account, Purchase, Invoice, Subscription } from "./store.ts";
import { normaliseEmail, randomToken, sha256Hex } from "./util.ts";
import type { EntContext } from "./enterprise/service.ts";
import * as entSvc from "./enterprise/service.ts";
import { SCOPES } from "./agent/tools.ts";
import { isTier, periodFromStripe, initPlanFromStripe, observePeriod, type StripePeriod, type Tier } from "./plan_change.ts";
import { changePlan } from "./plan_change_service.ts";

export interface Mailer { send(to: string, subject: string, text: string): Promise<void> }
export class MockMailer implements Mailer { outbox: { to: string; subject: string; text: string }[] = []; async send(to: string, subject: string, text: string) { this.outbox.push({ to, subject, text }); } }

import type { OwnerStore, ZoneProvider } from "./owner/engine.ts";
import type { DohFetch } from "../../lib/guestscan/scan.ts";
export interface OwnerDeps { store: OwnerStore; doh: (domain: string) => DohFetch; zones: ZoneProvider }
import { marketExport, hasActiveMarketJobs, type MarketDeps } from "./market/service.ts";
export interface Deps { owner?: OwnerDeps; market?: MarketDeps; store: Store; billing: BillingProvider; dns: TxtResolver; mailer: Mailer; now: () => number; siteOrigin: string; webhookSecret?: string; receiptSecret?: string; receiptKeyring?: import("./agent/receipt.ts").ReceiptKeyring; operatorSecret?: string; log?: (line: string) => void; model?: import("./agent/tools.ts").ModelClient; ent?: EntContext; entError?: string; throttle?: import("./throttle.ts").Throttle }
export class HttpError extends Error { status: number; code: string; constructor(status: number, code: string) { super(code); this.status = status; this.code = code; } }
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
    const sub = await d.store.subscriptionById(subId);
    if (!sub) { // the invoice beat its checkout: hold the Stripe period for markPaid to seed from (a cycle invoice with no period stays "ignored", as before f101)
      if (!period) return "ignored";
      await d.store.holdFact(`sub:${subId}`, { kind: "period", start: period.start, end: period.end, create: !cycle });
      return "handled";
    }
    await seedPeriod(d, sub, period, !cycle);
    await d.store.putSubscription(sub);
    if (!cycle) return "handled"; // the first invoice is issued by markPaid
    const pur = await d.store.purchaseById(sub.purchaseId);
    if (pur) await issueInvoice(d, pur, Number(o.amount_paid ?? PRODUCTS[sub.productId].amountCents), ev.id);
    return "handled";
  }
  if (ev.type === "customer.subscription.deleted") {
    const sub = await d.store.subscriptionById(String(o.id));
    if (!sub) { await d.store.holdFact(`sub:${String(o.id)}`, { kind: "cancel" }); return "handled"; } // cancel before its payment: held
    if (!sub.cancelledAt) { sub.cancelledAt = d.now(); await d.store.putSubscription(sub); }
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
// f240: Stripe has ALREADY refunded when requestRefund's own recordRefund runs out of retries. This typed error (a RefundContention, so existing catches still match) carries the Stripe refund id and the idempotency key:
// the caller gets a 503 refund_record_pending with the id, the next charge.refunded webhook (or a replayed requestRefund, which reuses the remembered refund and never calls Stripe again) heals the ledger. Never a silent drop, never a second refund.
export class RefundRecordPending extends RefundContention { purchaseId: string; refundId: string; idempotencyKey: string; constructor(purchaseId: string, refundId: string, idempotencyKey: string) { super(purchaseId); this.purchaseId = purchaseId; this.refundId = refundId; this.idempotencyKey = idempotencyKey; this.name = "RefundRecordPending"; } }
// f239: the CAS guards status AND the refunded_cents just read, so two concurrent partial refunds cannot lose the smaller cumulative: the loser re-reads, re-merges (cumulative, monotone, clamped) and retries.
// Exhausting the bounded retries throws RefundContention (a webhook fails and is re-delivered); it never returns a stale row as if the refund had landed.
export async function recordRefund(d: Pick<Deps, "store">, purchaseId: string, cents: number): Promise<Purchase | undefined> {
  for (let i = 0; i < REFUND_TRIES; i++) {
    const cur = await d.store.purchaseById(purchaseId);
    if (!cur || !(cur.status === "paid" || cur.status === "refunded" || (cur.status === "cancelled" && cur.paymentIntent))) return cur;
    const next: Purchase = { ...cur }; applyRefund(next, cents);
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
      const sub = await buildSubscription(d, pur, o.subscription, now);
      if (await d.store.putSubscriptionOnce(sub)) await replayLateFacts(d, sub); // f245: a hold written during the winner window (after buildSubscription's takeFacts) is replayed onto the landed row
      else await mergeLostSeed(d, sub);
    }
    if (pur.paymentIntent) for (const f of await d.store.takeFacts(`pi:${pur.paymentIntent}`)) await recordRefund(d, pur.id, Number(f.cents)); // f238: CAS merge, not a blind put (the claim already wrote the paid row)
    Object.assign(pur, (await d.store.purchaseById(pur.id)) ?? {}); // bring the caller's object to the stored truth (a concurrent refund may have landed)
    if (o.customer) { const a = await d.store.accountById(pur.accountId); if (a) await d.store.putAccount({ ...a, stripeCustomerId: String(o.customer) }); }
    await issueInvoiceOnce(d, pur, PRODUCTS[pur.productId].amountCents, eventId);
    return { won: true, purchase: pur };
  } finally { await d.store.releaseLease(leaseKey(pur.id), owner); }
}
// f245: the winner lost putSubscriptionOnce to a sweep that seeded after the TTL. The sweep's row stands; a cancel this winner took from the held facts (and the sweep never saw) is carried onto it.
async function mergeLostSeed(d: Pick<Deps, "store">, mine: Subscription) {
  const theirs = await d.store.subscriptionByPurchase(mine.purchaseId);
  if (theirs && mine.cancelledAt && !theirs.cancelledAt) await d.store.putSubscription({ ...theirs, cancelledAt: mine.cancelledAt });
}
// f242: a fact held for this subscription AFTER the seed read its facts (a webhook that looked the row up, found none, then held) is replayed onto the row once it is written. Take = remove, so each fact applies once.
export async function replayLateFacts(d: Pick<Deps, "store" | "log" | "now">, sub: Subscription): Promise<boolean> {
  const late = await d.store.takeFacts(`sub:${sub.id}`);
  if (late.length === 0) return false;
  if (late.some((f) => f.kind === "cancel") && !sub.cancelledAt) sub.cancelledAt = d.now();
  for (const hp of heldPeriods(late).rest) await seedPeriod(d as Deps, sub, hp, false);
  await d.store.putSubscription(sub);
  return true;
}
// f237: the subscription row for a paid subscription purchase, built from held facts (cancels, periods) and Stripe's own subscription (id or expanded). Shared by markPaid (winner)
// and the f237 repair in reconcile.ts, so a repaired row is the row markPaid would have written.
export async function buildSubscription(d: Pick<Deps, "store" | "log">, pur: Purchase, stripeSub: unknown, now: number): Promise<Subscription> {
  const facts = await d.store.takeFacts(`sub:${pur.subscriptionId}`); // held facts are cancels AND (f101) Stripe periods: only a cancel cancels
  const cancel = facts.some((f) => f.kind === "cancel");
  const held = heldPeriods(facts), sp = stripePeriodOf(stripeSub) ?? held.first;
  const sub: Subscription = { id: pur.subscriptionId as string, accountId: pur.accountId, purchaseId: pur.id, productId: pur.productId, startedAt: sp ? sp.start : now, ...(cancel ? { cancelledAt: now } : {}) };
  await seedPeriod(d as Deps, sub, sp, true);
  for (const hp of held.rest) await seedPeriod(d as Deps, sub, hp, false); // invoices that beat the checkout, oldest first
  return sub;
}
// ---- f101: seed PlanState from Stripe's own period (current_period_start/end, billing_cycle_anchor), seconds on the wire ----
// checkout.session.completed carries `subscription` as an id, or expanded as an object; invoice.paid carries the service period on
// its first line (lines.data[0].period), which is the period just paid (the invoice's own period_start/end is the usage window).
function stripePeriodOf(sub: unknown): StripePeriod | undefined {
  if (!sub || typeof sub !== "object") return undefined;
  const x = sub as Record<string, any>;
  return periodFromStripe(x.current_period_start, x.current_period_end, x.billing_cycle_anchor);
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
// Retainer tiers only (the three AI tiers own a PlanState). No period = no plan: calendar months apply until Stripe's numbers arrive.
// Only the FIRST period (checkout's expanded subscription, or the subscription_create invoice) may define the start and the grid;
// a later cycle period seen while no plan exists is held and replayed in order once the first arrives.
async function seedPeriod(d: Deps, sub: Subscription, p: StripePeriod | undefined, create: boolean) {
  if (!p || !isTier(sub.productId)) return;
  if (!sub.plan) {
    if (!create) { await d.store.holdFact(`sub:${sub.id}`, { kind: "period", start: p.start, end: p.end, create: false }); return; }
    sub.startedAt = p.start; sub.plan = initPlanFromStripe(sub.productId as Tier, p);
    for (const hp of heldPeriods(await d.store.takeFacts(`sub:${sub.id}`)).rest) await seedPeriod(d, sub, hp, false);
    return;
  }
  const r = observePeriod(sub.plan, p);
  if (r.applied === "advanced") sub.plan = r.state;
  else if (r.applied === "offgrid") d.log?.(`stripe period off the billing grid for ${sub.id}: start ${p.start} (state untouched)`);
}
async function issueInvoice(d: Deps, pur: Purchase, amountCents: number, eventId: string) {
  const inv: Invoice = { id: randomToken("inv", 8), accountId: pur.accountId, purchaseId: pur.id, number: await d.store.nextInvoiceNumber(), productId: pur.productId, amountCents, issuedAt: d.now(), stripeEventId: eventId };
  await d.store.putInvoice(inv);
  await entSvc.onInvoice(d, inv); // C8: partner commission, recorded; a failure is logged to the operator, never thrown into the webhook
}
// The FIRST invoice of a purchase (markPaid, and the f203 reconciler). At most one per purchase, whoever gets there first: the pre-check saves a burned invoice number, the
// store's atomic putInvoiceOnce is the real guard (two racers can both pass the pre-check; only one insert lands). The loser burns one number (known, receipt limit).
export async function issueInvoiceOnce(d: Pick<Deps, "store" | "now">, pur: Purchase, amountCents: number, eventId: string): Promise<boolean> {
  if (await d.store.purchaseInvoiced(pur.id)) return false;
  const inv: Invoice = { id: randomToken("inv", 8), accountId: pur.accountId, purchaseId: pur.id, number: await d.store.nextInvoiceNumber(), productId: pur.productId, amountCents, issuedAt: d.now(), stripeEventId: eventId };
  const won = await d.store.putInvoiceOnce(inv);
  if (won) await entSvc.onInvoice(d as Deps, inv); // C8: partner commission, recorded once with the invoice that won
  return won;
}

// 4 INVOICES. Plain text, no GST line: the terms page says the seller is not registered for GST.
export async function listInvoices(d: Deps, a: Account) { return (await d.store.invoicesFor(a.id)).sort((x, y) => x.issuedAt - y.issuedAt); }
export async function renderInvoice(d: Deps, a: Account, id: string): Promise<string> {
  const i = await d.store.invoiceById(id);
  if (!i || i.accountId !== a.id) throw new HttpError(404, "not_found");
  const p = PRODUCTS[i.productId];
  return [`TAX INVOICE ${i.number}`, `Date: ${new Date(i.issuedAt).toISOString().slice(0, 10)}`, `Billed to: ${a.email}`, `Item: ${p.name}`,
    `Amount: AU$${(i.amountCents / 100).toFixed(2)} (no GST charged: supplier not registered for GST)`, "Supplier: Kyle Montrose Deligny, ABN 34 318 502 254"].join("\n");
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
  const fresh = (await d.store.subscriptionById(sub.id)) ?? sub; fresh.cancelAt = periodEnd; await d.store.putSubscription(fresh);
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
  let sent = (await d.store.takeFacts(memo))[0] as { refundId: string } | undefined;
  const v = sent ? { auto: true as const } : refundVerdict(PRODUCTS[pur.productId], pur.paidAt, d.now(), pur.deliverableIssued, pur.refundedCents > 0);
  if (!v.auto) {
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
  if (!sent) sent = { refundId: (await d.billing.refund(pur.paymentIntent, pur.amountCents - pur.refundedCents, key)).id };
  await d.store.holdFact(memo, sent);
  try { await recordRefund(d, pur.id, pur.amountCents); } // f238: paid -> refunded by CAS; a webhook that got there first makes this a no-op
  catch (e) { if (e instanceof RefundContention) throw new RefundRecordPending(pur.id, sent.refundId, key); throw e; }
  await d.store.takeFacts(memo);
  await entSvc.onRefund(d, pur.id, pur.amountCents); // C8: claw back the partner commission
  return { status: "refunded" as const, amountCents: pur.amountCents };
}

// 7 API KEYS (shown once, hash stored) 8 DATA EXPORT 9 ACCOUNT DELETION
export async function createKey(d: Deps, a: Account, scopesIn: unknown) {
  // F-C7: an allow-list, not a sanitiser. Any scope string the tool catalogue does not define (e.g. "admin") is a 400,
  // never stored. Omitted or empty means a key with no scopes, as before.
  if (scopesIn !== undefined && !Array.isArray(scopesIn)) throw new HttpError(400, "invalid_scope");
  const allowed: readonly string[] = SCOPES;
  const asked = (scopesIn ?? []) as unknown[];
  if (asked.length > 10 || asked.some((s) => typeof s !== "string" || !allowed.includes(s))) throw new HttpError(400, "invalid_scope");
  const scopes = [...new Set(asked as string[])];
  if ((await d.store.keysFor(a.id)).filter((k) => !k.revokedAt).length >= 10) throw new HttpError(409, "key_limit");
  const key = randomToken("tk", 24);
  const row = { id: randomToken("key", 6), accountId: a.id, hash: await sha256Hex(key), scopes, createdAt: d.now() };
  await d.store.putKey(row);
  return { id: row.id, key, scopes, note: "Shown once. Store it now." };
}
export async function listKeys(d: Deps, a: Account) { return (await d.store.keysFor(a.id)).map((k) => ({ id: k.id, scopes: k.scopes, createdAt: k.createdAt, revoked: !!k.revokedAt })); }
export async function revokeKey(d: Deps, a: Account, id: string) {
  const k = await d.store.keyById(id);
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
