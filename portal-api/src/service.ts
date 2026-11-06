import { PRODUCTS, refundVerdict, type Product } from "./catalogue.ts";
import { normaliseDomain, verifyRecordName, verifyRecordValue, type TxtResolver } from "./dns.ts";
import type { BillingProvider } from "./stripe.ts";
import type { Store, Account, Purchase, Invoice } from "./store.ts";
import { normaliseEmail, randomToken, sha256Hex } from "./util.ts";
import type { EntContext } from "./enterprise/service.ts";
import * as entSvc from "./enterprise/service.ts";
import { SCOPES } from "./agent/tools.ts";

export interface Mailer { send(to: string, subject: string, text: string): Promise<void> }
export class MockMailer implements Mailer { outbox: { to: string; subject: string; text: string }[] = []; async send(to: string, subject: string, text: string) { this.outbox.push({ to, subject, text }); } }

import type { OwnerStore, ZoneProvider } from "./owner/engine.ts";
import type { DohFetch } from "../../lib/guestscan/scan.ts";
export interface OwnerDeps { store: OwnerStore; doh: (domain: string) => DohFetch; zones: ZoneProvider }
import { marketExport, hasActiveMarketJobs, type MarketDeps } from "./market/service.ts";
export interface Deps { owner?: OwnerDeps; market?: MarketDeps; store: Store; billing: BillingProvider; dns: TxtResolver; mailer: Mailer; now: () => number; siteOrigin: string; webhookSecret?: string; receiptSecret?: string; receiptKeyring?: import("./agent/receipt.ts").ReceiptKeyring; operatorSecret?: string; log?: (line: string) => void; model?: import("./agent/tools.ts").ModelClient; ent?: EntContext }
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
  await d.store.putPurchase({ id: purchaseId, accountId: a.id, productId: p.id, domain, checkoutId: cs.id, amountCents: p.amountCents, deliverableIssued: false, refundedCents: 0, status: "pending" });
  return { purchaseId, checkoutUrl: cs.url };
}

// Stripe webhook. Signature is checked by the caller; this handles the verified event, once per event id.
export async function handleStripeEvent(d: Deps, ev: { id: string; type: string; data: { object: Record<string, any> } }): Promise<"handled" | "duplicate" | "ignored"> {
  if (!(await d.store.claimEvent(ev.id))) return "duplicate";
  const o = ev.data.object;
  if (ev.type === "checkout.session.completed") {
    const pur = await d.store.purchaseByCheckout(String(o.id));
    if (!pur || o.payment_status === "unpaid") return "ignored";
    const now = d.now();
    const p = PRODUCTS[pur.productId];
    pur.status = "paid"; pur.paidAt = now; pur.paymentIntent = o.payment_intent ? String(o.payment_intent) : pur.paymentIntent;
    if (o.subscription) {
      pur.subscriptionId = String(o.subscription);
      await d.store.putSubscription({ id: pur.subscriptionId, accountId: pur.accountId, purchaseId: pur.id, productId: pur.productId, startedAt: now });
    }
    await d.store.putPurchase(pur);
    if (o.customer) { const a = await d.store.accountById(pur.accountId); if (a) await d.store.putAccount({ ...a, stripeCustomerId: String(o.customer) }); }
    await issueInvoice(d, pur, p.amountCents, ev.id);
    return "handled";
  }
  if (ev.type === "invoice.paid" && o.subscription && o.billing_reason === "subscription_cycle") {
    const sub = await d.store.subscriptionById(String(o.subscription));
    if (!sub) return "ignored";
    const pur = await d.store.purchaseById(sub.purchaseId);
    if (pur) await issueInvoice(d, pur, Number(o.amount_paid ?? PRODUCTS[sub.productId].amountCents), ev.id);
    return "handled";
  }
  if (ev.type === "customer.subscription.deleted") {
    const sub = await d.store.subscriptionById(String(o.id));
    if (!sub) return "ignored";
    sub.cancelledAt = d.now(); await d.store.putSubscription(sub);
    return "handled";
  }
  return "ignored";
}
async function issueInvoice(d: Deps, pur: Purchase, amountCents: number, eventId: string) {
  const inv: Invoice = { id: randomToken("inv", 8), accountId: pur.accountId, purchaseId: pur.id, number: await d.store.nextInvoiceNumber(), productId: pur.productId, amountCents, issuedAt: d.now(), stripeEventId: eventId };
  await d.store.putInvoice(inv);
  await entSvc.onInvoice(d, inv); // C8: partner commission, recorded; a failure is logged to the operator, never thrown into the webhook
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
  const minEnd = p.minMonths ? addMonths(sub.startedAt, p.minMonths) : 0;
  const periodEnd = Math.max(minEnd, nextPeriodEnd(sub.startedAt, p.interval ?? "month", d.now()));
  await d.billing.cancelSubscription(sub.id, true);
  sub.cancelAt = periodEnd; await d.store.putSubscription(sub);
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
  const v = refundVerdict(PRODUCTS[pur.productId], pur.paidAt, d.now(), pur.deliverableIssued, pur.refundedCents > 0);
  if (!v.auto) {
    await d.store.putCard({ id: randomToken("card", 8), accountId: a.id, purchaseId: pur.id, kind: "refund_outside_policy", reason: v.reason, createdAt: d.now(), resolved: false });
    return { status: "needs_review" as const, reason: v.reason };
  }
  await d.billing.refund(pur.paymentIntent, pur.amountCents - pur.refundedCents, `refund-${pur.id}`);
  pur.refundedCents = pur.amountCents; pur.status = "refunded"; await d.store.putPurchase(pur);
  await entSvc.onRefund(d, pur.id, pur.refundedCents); // C8: claw back the partner commission
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
