import { PRODUCTS, refundVerdict, type Product } from "./catalogue.ts";
import { buildRefundCard, applyRefundDecision, type RefundCase, type RefundCard, type RefundDecision } from "./refund_card.ts";
import { normaliseDomain, verifyRecordName, verifyRecordValue, type TxtResolver } from "./dns.ts";
import type { BillingProvider } from "./stripe.ts";
import { subStateKey, type Store, type Account, type Purchase, type Invoice, type Subscription } from "./store.ts";
import { normaliseEmail, randomToken, sha256Hex } from "./util.ts";
import { isTier, periodFromStripe, initPlanFromStripe, observePeriod, type StripePeriod, type Tier } from "./plan_change.ts";
import { changePlan } from "./plan_change_service.ts";

export interface Mailer { send(to: string, subject: string, text: string): Promise<void> }
export class MockMailer implements Mailer { outbox: { to: string; subject: string; text: string }[] = []; async send(to: string, subject: string, text: string) { this.outbox.push({ to, subject, text }); } }

export interface Deps { store: Store; billing: BillingProvider; dns: TxtResolver; mailer: Mailer; now: () => number; sleep?: (ms: number) => Promise<void>; siteOrigin: string; webhookSecret?: string; log?: (line: string) => void }
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
  if (!(await d.store.claimEvent(ev.id))) return "duplicate";
  const o = ev.data.object;
  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
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
    await casEditSubscription(d, subId, async (s, dd) => { await seedPeriod(dd, s, period, !cycle); return true; }); // f248: CAS on the row just read, never a blind put of a stale copy (a cancel landing in between survives)
    if (!cycle) return "handled"; // the first invoice is issued by markPaid
    const pur = await d.store.purchaseById(sub.purchaseId);
    if (pur) await issueInvoice(d, pur, Number(o.amount_paid ?? PRODUCTS[sub.productId].amountCents), ev.id);
    return "handled";
  }
  if (ev.type === "customer.subscription.deleted") {
    const sub = await d.store.subscriptionById(String(o.id));
    if (!sub) { await d.store.holdFact(`sub:${String(o.id)}`, { kind: "cancel" }); return "handled"; } // cancel before its payment: held
    if (!sub.cancelledAt) await casEditSubscription(d, sub.id, (s) => { if (s.cancelledAt) return false; s.cancelledAt = d.now(); return true; }); // f248: CAS; a lost CAS re-reads, and a row already cancelled is left alone (cancelled is never undone, never re-stamped)
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
export const MEMO_LEASE_MS = 60_000, MEMO_POLL_MS = 250, MEMO_TTL_MS = 7 * 86_400_000;
export class RefundInFlight extends RefundContention { constructor(id: string) { super(id); this.message = `refund for purchase ${id} is in flight on another call; retry`; this.name = "RefundInFlight"; } }
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
    if (o.subscription) { // f250: the winner's first write is insert-if-absent, never a blind upsert. If the row already exists (the f237 sweep seeded it after our lease expired, and a cancel webhook may have landed on it) it stands,
      // and the only thing this winner took that the sweep may not have is the held cancel and the plan: merged onto the stored row by CAS, never overwriting.
      const { sub: built, periods: taken } = await buildSubscriptionTaken(d, pur, o.subscription, now);
      if (!(await d.store.putSubscriptionOnce(built))) await casEditSubscription(d, built.id, (s) => {
        let ch = false;
        if (built.cancelledAt && !s.cancelledAt) { s.cancelledAt = built.cancelledAt; ch = true; }
        if (!s.plan && built.plan) { s.plan = built.plan; ch = true; }
        else if (mergeTakenPeriods(d, s, taken)) ch = true; // f251: the periods this winner took (its session period, an invoice that beat the checkout) are observed onto the sweep's plan: the later one wins, a repeat is a no-op
        return ch;
      });
    }
    if (pur.paymentIntent) for (const f of await d.store.takeFacts(`pi:${pur.paymentIntent}`)) await recordRefund(d, pur.id, Number(f.cents)); // f238: CAS merge, not a blind put (the claim already wrote the paid row)
    Object.assign(pur, (await d.store.purchaseById(pur.id)) ?? {}); // bring the caller's object to the stored truth (a concurrent refund may have landed)
    if (o.customer) { const a = await d.store.accountById(pur.accountId); if (a) await d.store.putAccount({ ...a, stripeCustomerId: String(o.customer) }); }
    await issueInvoiceOnce(d, pur, PRODUCTS[pur.productId].amountCents, eventId);
    return { won: true, purchase: pur };
  } finally { await d.store.releaseLease(leaseKey(pur.id), owner); }
}
// f248: the subscription row is changed by compare-and-set on the exact state read (as casPurchase does), never a blind put of a copy read earlier. A lost CAS re-reads the fresh row, re-runs `edit` on a clone of it and retries,
// so a cancel (or a period advance) that landed in between is merged with, never overwritten. `edit` mutates the clone and returns true when it changed something; false = nothing to write (the stored row is returned).
// Side effects of `edit` on held facts are made retry-safe: holdFact is deferred until the CAS lands, takeFacts is memoised per key across attempts (a destructive take happens once) and re-held if the retries run out.
export class SubscriptionContention extends Error { constructor(id: string) { super(`subscription CAS lost ${SUB_TRIES} times on ${id}; nothing silently dropped, the caller must retry (Stripe re-delivers the webhook)`); this.name = "SubscriptionContention"; } }
const SUB_TRIES = 8;
export async function casEditSubscription(d: Pick<Deps, "store" | "log" | "now">, id: string, edit: (s: Subscription, dd: Deps) => Promise<boolean> | boolean): Promise<Subscription | undefined> {
  const taken = new Map<string, Record<string, unknown>[]>();
  let pending: [string, Record<string, unknown>][] = [];
  const store = new Proxy(d.store, { get: (t, p) => {
    if (p === "holdFact") return async (k: string, f: Record<string, unknown>) => { pending.push([k, f]); };
    if (p === "takeFacts") return async (k: string) => { if (!taken.has(k)) taken.set(k, await t.takeFacts(k)); return taken.get(k)!.map((f) => ({ ...f })); };
    const v = (t as any)[p]; return typeof v === "function" ? v.bind(t) : v;
  } }) as Store;
  const dd = { ...d, store } as Deps;
  for (let i = 0; i < SUB_TRIES; i++) {
    pending = [];
    const cur = await d.store.subscriptionById(id);
    if (!cur) break;
    const expected = structuredClone(cur), next = structuredClone(cur);
    if (!(await edit(next, dd)) || subStateKey(next) === subStateKey(expected)) { for (const [k, f] of pending) await d.store.holdFact(k, f); return cur; }
    if (await d.store.casSubscription(next, expected)) { for (const [k, f] of pending) await d.store.holdFact(k, f); return next; }
  }
  for (const [k, fs] of taken) for (const f of fs) await d.store.holdFact(k, f); // gave up (or the row vanished): the facts this call consumed go back so the next replay applies them
  if ((await d.store.subscriptionById(id))) throw new SubscriptionContention(id);
  return undefined;
}
// f242: a fact held for this subscription AFTER the seed read its facts (a webhook that looked the row up, found none, then held) is replayed onto the row once it is written. Take = remove, so each fact applies once.
// f248: the replay re-reads the stored row (the `sub` argument may be a stale copy) and writes through casEditSubscription: a cancel webhook that wrote between the read and the write is never resurrected.
export async function replayLateFacts(d: Pick<Deps, "store" | "log" | "now">, sub: Subscription): Promise<boolean> {
  let any = false;
  const out = await casEditSubscription(d, sub.id, async (s, dd) => {
    const late = await dd.store.takeFacts(`sub:${sub.id}`);
    if (late.length === 0) return false;
    any = true;
    if (late.some((f) => f.kind === "cancel") && !s.cancelledAt) s.cancelledAt = d.now();
    for (const hp of heldPeriods(late).rest) await seedPeriod(dd, s, hp, false);
    return true;
  });
  if (out && out !== sub) Object.assign(sub, out);
  return any;
}
// f237: the subscription row for a paid subscription purchase, built from held facts (cancels, periods) and Stripe's own subscription (id or expanded). Shared by markPaid (winner)
// and the f237 repair in reconcile.ts, so a repaired row is the row markPaid would have written.
export async function buildSubscription(d: Pick<Deps, "store" | "log">, pur: Purchase, stripeSub: unknown, now: number): Promise<Subscription> { return (await buildSubscriptionTaken(d, pur, stripeSub, now)).sub; }
// f251: the same build, but it also returns every Stripe PERIOD it took (the session/subscription_create period, then each held invoice period oldest first). A winner whose row lost to the sweep's seed
// (its lease stalled past the TTL) observes these onto the stored row (mergeTakenPeriods), so a period it consumed from the held facts is never lost with the row it built.
export async function buildSubscriptionTaken(d: Pick<Deps, "store" | "log">, pur: Purchase, stripeSub: unknown, now: number): Promise<{ sub: Subscription; periods: StripePeriod[] }> {
  const facts = await d.store.takeFacts(`sub:${pur.subscriptionId}`); // held facts are cancels AND (f101) Stripe periods: only a cancel cancels
  const cancel = facts.some((f) => f.kind === "cancel");
  const held = heldPeriods(facts), sp = stripePeriodOf(stripeSub) ?? held.first;
  const sub: Subscription = { id: pur.subscriptionId as string, accountId: pur.accountId, purchaseId: pur.id, productId: pur.productId, startedAt: sp ? sp.start : now, ...(cancel ? { cancelledAt: now } : {}) };
  await seedPeriod(d as Deps, sub, sp, true);
  for (const hp of held.rest) await seedPeriod(d as Deps, sub, hp, false); // invoices that beat the checkout, oldest first
  return { sub, periods: [...(sp ? [sp] : []), ...held.rest] };
}
// f251: observe periods onto a stored row's plan, oldest first. observePeriod is pure and idempotent by period start (older = stale, same = no change), so the later period wins and a replay changes nothing. True when the plan moved.
export function mergeTakenPeriods(d: Pick<Deps, "log">, s: Subscription, periods: StripePeriod[]): boolean {
  if (!s.plan || !isTier(s.productId)) return false;
  let ch = false;
  for (const p of [...periods].sort((a, b) => a.start - b.start)) {
    const r = observePeriod(s.plan, p);
    if (r.applied === "advanced") { s.plan = r.state; ch = true; }
    else if (r.applied === "offgrid") d.log?.(`stripe period off the billing grid for ${s.id}: start ${p.start} (state untouched)`);
  }
  return ch;
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
}
// The FIRST invoice of a purchase (markPaid, and the f203 reconciler). At most one per purchase, whoever gets there first: the pre-check saves a burned invoice number, the
// store's atomic putInvoiceOnce is the real guard (two racers can both pass the pre-check; only one insert lands). The loser burns one number (known, receipt limit).
export async function issueInvoiceOnce(d: Pick<Deps, "store" | "now">, pur: Purchase, amountCents: number, eventId: string): Promise<boolean> {
  if (await d.store.purchaseInvoiced(pur.id)) return false;
  const inv: Invoice = { id: randomToken("inv", 8), accountId: pur.accountId, purchaseId: pur.id, number: await d.store.nextInvoiceNumber(), productId: pur.productId, amountCents, issuedAt: d.now(), stripeEventId: eventId };
  return d.store.putInvoiceOnce(inv);
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
  await casEditSubscription(d, sub.id, (s) => { if (s.cancelAt === periodEnd) return false; s.cancelAt = periodEnd; return true; }); // f250: CAS on the row just read (was re-read-then-put: a webhook cancel landing in the gap was erased); a lost CAS re-reads and merges
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
  // f247: the rival wait is bounded by the CLOCK (d.now(), injectable), not a yield count: it ends at start + MEMO_LEASE_MS, the intent lease. d.sleep (injectable; the Worker supplies a real timer) paces the polls; with none the
  // wait only yields, and `waited` (sum of the poll steps) is a second bound so a frozen test clock still ends. Past the deadline a live intent is RefundInFlight (503), never a Stripe call.
  const deadline = d.now() + MEMO_LEASE_MS, nap = d.sleep ?? (() => new Promise<void>((r) => setImmediate(r)));
  for (let waited = 0; !mine && !sent; waited += MEMO_POLL_MS) {
    const intent = { state: "intent", at: d.now() };
    if (await d.store.memoInsert(memo, intent)) { mine = intent; break; }
    const cur = await d.store.memoPeek(memo);
    if (cur) {
      if (typeof cur.refundId === "string") { sent = cur as { refundId: string }; break; }
      if (d.now() - Number(cur.at) > MEMO_LEASE_MS && await d.store.memoSwap(memo, cur, intent)) { mine = intent; break; }
    }
    if (d.now() >= deadline || waited >= MEMO_LEASE_MS) break;
    await nap(MEMO_POLL_MS);
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
export async function createKey(d: Deps, a: Account, scopesIn: unknown) {
  const scopes = Array.isArray(scopesIn) ? scopesIn.filter((s): s is string => typeof s === "string" && /^[a-z:_]{1,32}$/.test(s)).slice(0, 10) : [];
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
  };
}
export async function deleteAccount(d: Deps, a: Account, confirm: unknown) {
  if (confirm !== "DELETE") throw new HttpError(400, "confirmation_required");
  for (const s of await d.store.subscriptionsFor(a.id)) if (!s.cancelledAt && !s.cancelAt) await cancelSubscription(d, a, s.id);
  await d.store.anonymiseAccount(a.id, d.now());
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
