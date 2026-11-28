// Digital products: checkout, webhook fulfilment, download. Pure functions over injected deps (store, bucket, mailer, fetch, clock),
// so every path runs in node tests with no network.
import { findItem, type DigitalItem } from "./catalogue.ts";
import type { R2Like } from "./env.ts";
import { unavailableMailer, type DigitalMailer } from "./mailer.ts";
import { createCheckoutSession, type StripeMode } from "./stripe.ts";
import { MAX_DOWNLOADS, TOKEN_TTL_SEC, mintToken, verifyToken } from "./token.ts";
import type { DigitalStore, OrderRow } from "./store.ts";
import { verifyStripeSignature } from "../../portal-api/src/stripe.ts";
import { HttpError, normaliseEmail, randomToken, sha256Hex } from "../../portal-api/src/util.ts";
import { fileHead, fileStream, json, withSecurityHeaders } from "./http.ts";

export { HttpError };
export interface Deps {
  store: DigitalStore; bucket?: R2Like; mailer: DigitalMailer; items: readonly DigitalItem[]; mode: StripeMode;
  stripeKey?: string; checkoutEnabled?: boolean; webhookSecret?: string; tokenSecret?: string; siteOrigin: string; publicOrigin?: string;
  fetchFn?: typeof fetch; now: () => number; log: (line: string) => void;
}
export const CHECKOUT_PER_HOUR = 20;

// ---- POST /digital/checkout ----
// Body: { slug, email? }. Any other field (price, amount, currency) is ignored by construction: the price is read from the catalogue.
export async function startCheckout(d: Deps, body: Record<string, unknown>, ip: string): Promise<Response> {
  if (!d.checkoutEnabled) throw new HttpError(503, "checkout_disabled");   // the master switch: nothing can be bought until DIGITAL_CHECKOUT_ENABLED = "true"
  if (!d.stripeKey) throw new HttpError(503, "checkout_unavailable");
  const hour = Math.floor(d.now() / 3_600_000);
  if ((await d.store.rateHit((await sha256Hex(ip)).slice(0, 32), hour)) > CHECKOUT_PER_HOUR) throw new HttpError(429, "rate_limited");
  const item = findItem(body.slug, d.items);
  if (!item) throw new HttpError(404, "unknown_product");
  const email = body.email === undefined || body.email === "" ? undefined : normaliseEmail(body.email);
  if (body.email !== undefined && body.email !== "" && !email) throw new HttpError(400, "invalid_email");
  let s;
  try { s = await createCheckoutSession({ key: d.stripeKey, mode: d.mode, item, siteOrigin: d.siteOrigin, email: email ?? undefined, fetchFn: d.fetchFn }); }
  catch (e) { d.log(`digital checkout failed: ${(e as Error).message}`); throw new HttpError(502, "checkout_failed"); }
  return json({ url: s.url, id: s.id }, 201);
}

// ---- email ----
export function downloadUrl(d: Deps, requestOrigin: string, token: string): string { return `${(d.publicOrigin || requestOrigin).replace(/\/+$/, "")}/digital/download?t=${token}`; }
export function composeEmail(item: DigitalItem, o: { orderId: string; link: string; expSec: number }): { subject: string; text: string } {
  const until = new Date(o.expSec * 1000).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane" });
  return {
    subject: `Your download: ${item.title}`,
    text: [
      "Thanks for your order. Your files are ready.", "", item.title, "",
      "Download link (private to you, please do not share it):", o.link, "",
      `The link works until ${until} and for up to ${MAX_DOWNLOADS} downloads. Save the file somewhere safe once you have it.`, "",
      `Order reference: ${o.orderId}`,
      "If anything is wrong with the file or the link, reply to this email and we will sort it out.", "",
      "Kyle at TITANOS", "titanos.tech",
    ].join("\n"),
  };
}

async function deliver(d: Deps, o: OrderRow, requestOrigin: string): Promise<"emailed" | "queued_for_kernel_mailer" | "already_emailed" | "revoked" | "in_progress"> {
  if (o.status === "revoked") return "revoked";
  if (o.emailed_at) return "already_emailed";
  if (d.mailer === unavailableMailer) return "queued_for_kernel_mailer";   // no Worker mail transport: the order stays paid + emailed_at NULL and bin/digital_mailer.py sends it
  if (!(await d.store.leaseEmail(o.id, d.now()))) return "in_progress";
  const item = findItem(o.slug, d.items);
  if (!item) { await d.store.releaseEmail(o.id); throw new Error("order_for_unknown_product"); }
  try {
    const token = await mintToken({ o: o.id, s: o.slug, e: o.token_exp_sec }, d.tokenSecret ?? "");
    const mail = composeEmail(item, { orderId: o.id, link: downloadUrl(d, requestOrigin, token), expSec: o.token_exp_sec });
    await d.mailer.send({ to: o.email, subject: mail.subject, text: mail.text, idempotencyKey: `digital-${o.id}` });
  } catch (e) { await d.store.releaseEmail(o.id); throw e; }
  await d.store.markEmailed(o.id, d.now());
  return "emailed";
}

// ---- POST /digital/webhook ----
export async function handleWebhook(d: Deps, raw: string, sigHeader: string | null, requestOrigin: string): Promise<Response> {
  if (!d.tokenSecret || !d.webhookSecret) throw new HttpError(503, "webhook_unavailable");
  if (raw.length > 1_000_000) throw new HttpError(413, "body_too_large");
  if (!(await verifyStripeSignature(raw, sigHeader, d.webhookSecret, Math.floor(d.now() / 1000)))) throw new HttpError(400, "bad_signature");
  let ev: any; try { ev = JSON.parse(raw); } catch { throw new HttpError(400, "invalid_json"); }
  if (!ev || typeof ev.id !== "string" || typeof ev.type !== "string" || !ev.data?.object) throw new HttpError(400, "invalid_event");
  if (typeof ev.livemode === "boolean" && ev.livemode !== (d.mode === "live")) return json({ result: "ignored_mode_mismatch" });   // a test event never fulfils a live shop and vice versa
  const o = ev.data.object;
  const done = ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded";
  const refund = ev.type === "charge.refunded";
  const dispute = ev.type === "charge.dispute.created";
  if (!done && !refund && !dispute) return json({ result: "ignored" });
  if (done && o.metadata?.kind !== "digital") return json({ result: "ignored_not_digital" });   // some other TITANOS checkout on the same Stripe account
  if (done && o.payment_status !== "paid") return json({ result: "ignored_unpaid" });           // delayed method: the async_payment_succeeded event (new id) fulfils it
  if (await d.store.eventSeen(ev.id)) return json({ result: "duplicate" });
  const now = d.now();
  let result: string;
  if (done) result = await fulfil(d, o, ev.livemode === true, requestOrigin);
  else {
    const pi = typeof o.payment_intent === "string" ? o.payment_intent : "";
    if (!pi) return json({ result: "ignored_no_payment_intent" });
    if (refund && o.refunded !== true && !(Number(o.amount_refunded) >= Number(o.amount) && Number(o.amount) > 0)) result = "partial_refund_kept";   // a partial refund keeps access
    else {
      const reason = refund ? "refunded" : "disputed";
      const n = await d.store.revokeByPaymentIntent(pi, reason, now);
      if (n === 0 && (await d.store.orderCountByPaymentIntent(pi)) === 0) { await d.store.addPendingRevocation(pi, reason, now); result = "held_until_payment"; }
      else result = n > 0 ? "revoked" : "already_revoked";
    }
  }
  await d.store.recordEvent(ev.id, ev.type, now);   // recorded only AFTER the work succeeded: a failure above returns 500 and Stripe retries
  d.log(`digital webhook ${ev.type} -> ${result}`);
  return json({ result });
}

async function fulfil(d: Deps, s: any, livemode: boolean, requestOrigin: string): Promise<string> {
  const sessionId = typeof s.id === "string" ? s.id : "";
  const item = findItem(s.metadata?.slug, d.items);
  const email = normaliseEmail(s.customer_details?.email ?? s.customer_email);
  if (!sessionId || !email) throw new HttpError(400, "invalid_session");
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : null;
  let order = await d.store.orderBySession(sessionId);
  if (!order) {
    const held = pi ? await d.store.pendingRevocation(pi) : null;
    order = await d.store.createOrder({
      id: randomToken("dp", 12), sessionId, paymentIntent: pi, slug: String(s.metadata?.slug ?? ""), email,
      amountCents: Number(s.amount_total ?? 0), currency: String(s.currency ?? "aud"), livemode, tokenExpSec: Math.floor(d.now() / 1000) + TOKEN_TTL_SEC,
      maxDownloads: MAX_DOWNLOADS, now: d.now(), revokedReason: held ?? undefined,
    });
  }
  if (!item) { d.log(`digital order ${order.id} paid for an unknown product (needs a human)`); return "order_logged_unknown_product"; }   // paid but not deliverable: logged, 200 so Stripe stops retrying, Kyle sees it in the log
  return await deliver(d, order, requestOrigin);
}

// ---- GET|HEAD /digital/download?t= ----
export async function handleDownload(d: Deps, token: string | null, method: string): Promise<Response> {
  if (!d.tokenSecret || !d.bucket) throw new HttpError(503, "download_unavailable");
  const nowSec = Math.floor(d.now() / 1000);
  const v = await verifyToken(token, d.tokenSecret, nowSec);
  if (!v.ok) throw new HttpError(v.reason === "expired" ? 410 : 403, v.reason === "expired" ? "link_expired" : "invalid_link");
  const order = await d.store.orderById(v.payload.o);
  const item = order && order.slug === v.payload.s ? findItem(order.slug, d.items) : undefined;
  if (!order || !item) throw new HttpError(403, "invalid_link");
  if (method === "HEAD") {   // link-preview scanners usually HEAD: answer without spending one of the downloads
    if (order.status !== "paid") throw new HttpError(410, "link_revoked");
    return fileHead({ filename: item.filename, size: item.bytes });
  }
  const c = await d.store.consumeDownload(order.id, nowSec);
  await d.store.logDownload(order.id, c, d.now());
  if (c === "revoked") throw new HttpError(410, "link_revoked");
  if (c === "expired") throw new HttpError(410, "link_expired");
  if (c === "limit") throw new HttpError(429, "download_limit_reached");
  if (c !== "ok") throw new HttpError(403, "invalid_link");
  const obj = await d.bucket.get(item.r2Key);
  if (!obj || !obj.body) { await d.store.releaseDownload(order.id); await d.store.logDownload(order.id, "file_missing", d.now()); d.log(`digital file missing in R2 for ${item.slug}`); throw new HttpError(502, "file_unavailable"); }
  return fileStream(obj.body, { filename: item.filename, size: obj.size, etag: obj.httpEtag });
}

// ---- GET /digital/order?s=<session id>: the Stripe success page asks "is this paid?" and, if so, gets the download link now ----
// Source of truth: the webhook-recorded order in D1. If the webhook has not landed yet, the session is retrieved from Stripe
// (server side, read only) and, when Stripe says paid + digital + same mode, the order is recorded (idempotent on session id).
async function paidOrder(d: Deps, sessionId: string): Promise<OrderRow | null> {
  const known = await d.store.orderBySession(sessionId);
  if (known) return known;
  if (!d.stripeKey || !d.tokenSecret) return null;
  let s: any;
  try {
    const r = await (d.fetchFn ?? fetch)(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { authorization: `Bearer ${d.stripeKey}` } });
    if (!r.ok) return null;
    s = await r.json();
  } catch { return null; }
  if (!s || s.id !== sessionId || s.payment_status !== "paid" || s.metadata?.kind !== "digital" || s.livemode !== (d.mode === "live")) return null;
  const email = normaliseEmail(s.customer_details?.email ?? s.customer_email);
  const item = findItem(s.metadata?.slug, d.items);
  if (!email || !item) return null;
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : null;
  const held = pi ? await d.store.pendingRevocation(pi) : null;
  return d.store.createOrder({
    id: randomToken("dp", 12), sessionId, paymentIntent: pi, slug: item.slug, email, amountCents: Number(s.amount_total ?? 0), currency: String(s.currency ?? "aud"),
    livemode: s.livemode === true, tokenExpSec: Math.floor(d.now() / 1000) + TOKEN_TTL_SEC, maxDownloads: MAX_DOWNLOADS, now: d.now(), revokedReason: held ?? undefined,
  });
}
const SESSION_RE = /^cs_[A-Za-z0-9_]{8,200}$/;

export async function orderStatus(d: Deps, sessionId: string | null, requestOrigin: string): Promise<Response> {
  if (!sessionId || !SESSION_RE.test(sessionId)) throw new HttpError(400, "invalid_session");
  const o = await paidOrder(d, sessionId);
  if (!o) return json({ state: "pending" });
  const title = findItem(o.slug, d.items)?.title ?? null;
  if (o.status === "revoked") return json({ state: "revoked", title });
  const base = { state: o.emailed_at ? "sent" : "processing", title };
  if (!d.tokenSecret || !findItem(o.slug, d.items)) return json(base);
  const token = await mintToken({ o: o.id, s: o.slug, e: o.token_exp_sec }, d.tokenSecret);
  return json({ ...base, download_url: downloadUrl(d, requestOrigin, token) });
}

// ---- GET|HEAD /digital/get?s=<session id>: stable per-order link for emails; 302 to a fresh signed download link ----
export async function linkRedirect(d: Deps, sessionId: string | null, requestOrigin: string): Promise<Response> {
  if (!sessionId || !SESSION_RE.test(sessionId)) throw new HttpError(400, "invalid_session");
  if (!d.tokenSecret) throw new HttpError(503, "download_unavailable");
  const o = await d.store.orderBySession(sessionId);
  if (!o || !findItem(o.slug, d.items)) throw new HttpError(404, "no_such_order");
  if (o.status === "revoked") throw new HttpError(410, "link_revoked");
  if (o.token_exp_sec <= Math.floor(d.now() / 1000)) throw new HttpError(410, "link_expired");
  const token = await mintToken({ o: o.id, s: o.slug, e: o.token_exp_sec }, d.tokenSecret);
  return withSecurityHeaders(new Response(null, { status: 302, headers: { location: downloadUrl(d, requestOrigin, token), "cache-control": "no-store, private", "referrer-policy": "no-referrer" } }));
}
