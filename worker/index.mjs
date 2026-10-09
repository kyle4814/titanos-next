// titanos-checkout Worker: live quote + negotiated Stripe Checkout Session. NOT DEPLOYED (Kyle's card; see wrangler.toml).
// Routes (api.titanos.tech/negotiate/*):  GET /offers   POST /quote   POST /checkout   GET /onboarding?slug=
// The price is always recomputed here from the raw selection with lib/checkout/engine.mjs; the browser's number is never
// trusted. Stripe is called with inline price_data, so no Stripe product/price has to exist per negotiated price.
// Secrets: STRIPE_SECRET_KEY (a restricted key with Checkout Sessions write is enough). Vars: SITE_ORIGIN, STRIPE_MODE.
import { CATALOG, quote, ineligible, formatCents } from "../lib/checkout/engine.mjs";
import { onboardingFor } from "../lib/checkout/onboarding.mjs";

const MAX_BODY = 4096;
const RATE_PER_MIN = 30;
const buckets = new Map(); // best effort, per isolate; the real limiter is Stripe's own plus Cloudflare WAF rules

function cors(env, req) {
  const origin = env.SITE_ORIGIN || "https://titanos.tech";
  const seen = req.headers.get("origin");
  const allow = seen && (seen === origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(seen) && env.STRIPE_MODE !== "live") ? seen : origin;
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}
const json = (env, req, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(env, req) } });

function limited(req) {
  const ip = req.headers.get("cf-connecting-ip") || "0.0.0.0";
  const minute = Math.floor(Date.now() / 60000);
  const k = `${ip}:${minute}`;
  const n = (buckets.get(k) || 0) + 1;
  buckets.set(k, n);
  if (buckets.size > 5000) for (const key of buckets.keys()) { if (!key.endsWith(`:${minute}`)) buckets.delete(key); }
  return n > RATE_PER_MIN;
}

export function stripeModeOk(env) {
  const key = String(env.STRIPE_SECRET_KEY || "");
  const mode = env.STRIPE_MODE === "live" ? "live" : "test";
  return mode === "live" ? /^(sk|rk)_live_/.test(key) : /^(sk|rk)_test_/.test(key);
}

function form(obj) {
  const p = new URLSearchParams();
  const walk = (prefix, v) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(`${prefix}[${i}]`, x));
    else if (typeof v === "object") for (const [k, x] of Object.entries(v)) walk(prefix ? `${prefix}[${k}]` : k, x);
    else p.append(prefix, String(v));
  };
  walk("", obj);
  return p;
}

export function sessionParams(q, env, email) {
  const origin = env.SITE_ORIGIN || "https://titanos.tech";
  const meta = {
    titanos_product: "negotiated",
    slug: q.slug,
    qty: q.selection.qty,
    term_months: q.termMonths,
    priority: q.selection.priority ? "yes" : "no",
    call: q.selection.call ? "yes" : "no",
    case_study_permission: q.selection.caseStudy ? "yes" : "no",
    prepay: q.mode === "payment" && q.cadence !== "one-off" ? "yes" : "no",
    status: q.status,
    listed_headline_cents: q.listedHeadlineCents,
    headline_cents: q.headlineCents,
    needs: q.needs.slice(0, 400),
  };
  const item = (name, cents, recurring) => ({
    quantity: 1,
    price_data: { currency: "aud", unit_amount: cents, product_data: { name: name.slice(0, 120) }, ...(recurring ? { recurring: { interval: "month" } } : {}) },
  });
  const items = [];
  const prepaid = q.cadence !== "one-off" && q.mode === "payment";
  if (q.mode === "subscription") items.push(item(q.name, q.headlineCents, true));
  else items.push(item(prepaid ? `${q.name} (${q.termMonths} months paid up front)` : q.name, prepaid ? q.headlineCents * q.termMonths : q.headlineCents, false));
  if (q.oneTimeCents) items.push(item("Walkthrough call (one time)", q.oneTimeCents, false));
  return {
    mode: q.mode,
    line_items: items,
    success_url: `${origin}/checkout/success?slug=${encodeURIComponent(q.slug)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/${encodeURIComponent(q.slug)}`,
    billing_address_collection: "auto",
    allow_promotion_codes: false,
    ...(email ? { customer_email: email } : {}),
    metadata: meta,
    ...(q.mode === "subscription" ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta } }),
  };
}

async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

async function readJson(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) return { error: "too_large" };
  try { const v = JSON.parse(text); return v && typeof v === "object" ? { v } : { error: "invalid_json" }; } catch { return { error: "invalid_json" }; }
}

export async function handle(req, env = {}) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/negotiate/, "").replace(/\/$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, req) });
  if (limited(req)) return json(env, req, { error: "rate_limited" }, 429);

  if (req.method === "GET" && path === "/offers") {
    return json(env, req, CATALOG.filter((o) => !ineligible(o)).map((o) => ({ slug: o.slug, name: o.name, group: o.group, priceAud: o.priceAud, cadence: o.cadence })));
  }
  if (req.method === "GET" && path === "/onboarding") {
    const ob = onboardingFor(url.searchParams.get("slug") || "");
    return ob ? json(env, req, ob) : json(env, req, { error: "unknown_offer" }, 404);
  }
  if (req.method === "POST" && (path === "/quote" || path === "/checkout")) {
    const body = await readJson(req);
    if (body.error) return json(env, req, { error: body.error }, body.error === "too_large" ? 413 : 400);
    const q = quote(String(body.v.slug || ""), body.v.selection || {});
    if (!q.ok) return json(env, req, { error: q.error }, q.error === "unknown_offer" ? 404 : 422);
    if (path === "/quote") return json(env, req, q);

    if (!env.STRIPE_SECRET_KEY || !stripeModeOk(env)) return json(env, req, { error: "payments_unavailable" }, 503);
    const email = typeof body.v.email === "string" && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(body.v.email) ? body.v.email : "";
    const params = sessionParams(q, env, email);
    const idem = await sha(JSON.stringify([q.slug, q.selection, q.payNowCents, Math.floor(Date.now() / 600000)]));
    const doFetch = env.STRIPE_FETCH || fetch;
    let res;
    try {
      res = await doFetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": idem, "Stripe-Version": "2025-02-24.acacia" },
        body: form(params).toString(),
      });
    } catch {
      return json(env, req, { error: "stripe_unreachable" }, 502);
    }
    if (!res.ok) return json(env, req, { error: "stripe_error" }, 502); // never forward Stripe's body (can echo request detail)
    const session = await res.json();
    if (!session.url) return json(env, req, { error: "stripe_error" }, 502);
    return json(env, req, { url: session.url, mode: env.STRIPE_MODE === "live" ? "live" : "test", payNow: formatCents(q.payNowCents), quote: q });
  }
  return json(env, req, { error: "not_found" }, 404);
}

export default { fetch: (req, env) => handle(req, env) };
