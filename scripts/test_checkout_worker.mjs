// test_checkout_worker.mjs - the checkout Worker with Stripe MOCKED (no network, no real key).
// Run: node --no-warnings scripts/test_checkout_worker.mjs   (part of npm test)
import { handle, stripeModeOk, sessionParams } from "../worker/index.mjs";
import { CATALOG, quote } from "../lib/checkout/engine.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("FAIL:", m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

const ONE = CATALOG.find((o) => o.status === "READY" && o.cadence === "one-off" && o.priceAud > 0);
const MON = CATALOG.find((o) => o.status === "READY" && o.cadence === "month" && o.priceAud > 0);
const FAKE = "sk_test_" + "x".repeat(20);
let calls = [];
const stripe = (status = 200) => async (url, init) => {
  calls.push({ url, init, body: Object.fromEntries(new URLSearchParams(init.body)) });
  return new Response(JSON.stringify(status === 200 ? { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" } : { error: { message: "secret detail" } }), { status });
};
let ipn = 0;
const call = (path, method, body, env = {}) =>
  handle(new Request(`https://api.titanos.tech/negotiate${path}`, { method, headers: { "content-type": "application/json", origin: "https://titanos.tech", "cf-connecting-ip": `10.0.0.${++ipn % 250}` }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }), env);
const env = (extra = {}) => ({ STRIPE_SECRET_KEY: FAKE, STRIPE_MODE: "test", SITE_ORIGIN: "https://titanos.tech", STRIPE_FETCH: stripe(), ...extra });

// key/mode guard: a live key never runs in test mode and vice versa
ok(stripeModeOk({ STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_MODE: "test" }), "test key in test mode ok");
ok(stripeModeOk({ STRIPE_SECRET_KEY: "rk_test_abc" }), "restricted test key, default mode is test");
ok(!stripeModeOk({ STRIPE_SECRET_KEY: "sk_live_abc", STRIPE_MODE: "test" }), "live key refused in test mode");
ok(!stripeModeOk({ STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_MODE: "live" }), "test key refused in live mode");
ok(stripeModeOk({ STRIPE_SECRET_KEY: "rk_live_abc", STRIPE_MODE: "live" }), "live key ok in live mode");
ok(!stripeModeOk({}), "no key refused");

// quote route
let r = await call("/quote", "POST", { slug: ONE.slug, selection: { qty: 2 } }, env());
eq(r.status, 200, "quote 200");
let j = await r.json();
eq(j.selection.qty, 2, "quote echoes the clean selection");
eq(calls.length, 0, "quote never calls Stripe");
eq((await call("/quote", "POST", { slug: "nope" }, env())).status, 404, "unknown slug 404");
const blocked = CATALOG.find((o) => o.status !== "READY");
eq((await call("/quote", "POST", { slug: blocked.slug }, env())).status, 422, "non-READY offer 422");
eq((await call("/quote", "POST", "{not json", env())).status, 400, "bad json 400");
eq((await call("/quote", "POST", "x".repeat(5000), env())).status, 413, "oversize body 413");
eq((await call("/nothing", "GET", undefined, env())).status, 404, "unknown route 404");
eq((await call("/quote", "OPTIONS", undefined, env())).status, 204, "preflight 204");
eq(r.headers.get("access-control-allow-origin"), "https://titanos.tech", "CORS pinned to the site origin");

// checkout: one-off at a negotiated price
calls = [];
r = await call("/checkout", "POST", { slug: ONE.slug, selection: { caseStudy: true, counterAud: 1, needs: "4 sites please" }, email: "buyer@example.com.au" }, env());
j = await r.json();
eq(r.status, 200, "checkout 200"); ok(j.url.startsWith("https://checkout.stripe.com/"), "returns the Stripe URL"); eq(j.mode, "test", "reports test mode");
eq(calls.length, 1, "exactly one Stripe call");
let b = calls[0].body;
eq(calls[0].url, "https://api.stripe.com/v1/checkout/sessions", "Stripe sessions endpoint");
eq(b.mode, "payment", "one-off mode payment");
eq(b["line_items[0][price_data][currency]"], "aud", "AUD");
const qc = quote(ONE.slug, { caseStudy: true });
eq(Number(b["line_items[0][price_data][unit_amount]"]), qc.headlineCents, "Stripe amount = engine price (floor 95%), not what the client said");
ok(!("line_items[0][price_data][recurring][interval]" in b), "no recurring on a one-off");
eq(b.customer_email, "buyer@example.com.au", "email passed");
eq(b["metadata[slug]"], ONE.slug, "metadata slug"); eq(b["metadata[case_study_permission]"], "yes", "metadata case study");
eq(b["metadata[listed_headline_cents]"], String(ONE.priceAud * 100), "metadata keeps the listed price");
ok(b.success_url.includes("{CHECKOUT_SESSION_ID}") && b.success_url.startsWith("https://titanos.tech/checkout/success"), "success url");
ok(b.cancel_url === `https://titanos.tech/checkout/${ONE.slug}`, "cancel url returns to the customise page");
ok(/^Bearer sk_test_/.test(calls[0].init.headers.Authorization), "bearer key sent to Stripe only");
ok(!JSON.stringify(j).includes(FAKE), "the key is never in a response");
ok(calls[0].init.headers["Idempotency-Key"].length >= 20, "idempotency key set");

// tamper: client claims a price
calls = [];
r = await call("/checkout", "POST", { slug: ONE.slug, selection: { payNowCents: 100, headlineCents: 100, counterAud: 1 }, price: 1, amount: 1 }, env());
eq(Number(calls[0].body["line_items[0][price_data][unit_amount]"]), ONE.priceAud * 100, "tampered price ignored, listed price charged");

// checkout: monthly subscription + call, and prepaid term
calls = [];
await call("/checkout", "POST", { slug: MON.slug, selection: { termMonths: 6, call: true } }, env());
b = calls[0].body;
eq(b.mode, "subscription", "monthly = subscription");
eq(b["line_items[0][price_data][recurring][interval]"], "month", "recurring month");
eq(Number(b["line_items[0][price_data][unit_amount]"]), quote(MON.slug, { termMonths: 6 }).headlineCents, "monthly amount carries the 6 month concession");
eq(Number(b["line_items[1][price_data][unit_amount]"]), 15000, "call is a one-time second line");
ok(!("line_items[1][price_data][recurring][interval]" in b), "call line is not recurring");
eq(b["subscription_data[metadata][term_months]"], "6", "term recorded on the subscription");
calls = [];
await call("/checkout", "POST", { slug: MON.slug, selection: { termMonths: 12, prepay: true, caseStudy: true } }, env());
b = calls[0].body; const qp = quote(MON.slug, { termMonths: 12, prepay: true, caseStudy: true });
eq(b.mode, "payment", "prepaid term = one payment");
eq(Number(b["line_items[0][price_data][unit_amount]"]), qp.headlineCents * 12, "prepay amount = 12 x floor monthly");
ok(/12 months paid up front/.test(b["line_items[0][price_data][product_data][name]"]), "prepay named on the line");
ok("payment_intent_data[metadata][slug]" in b, "payment metadata mirrored to the intent");

// failure paths
calls = [];
r = await call("/checkout", "POST", { slug: ONE.slug }, env({ STRIPE_FETCH: stripe(402) }));
eq(r.status, 502, "stripe failure -> 502"); ok(!(await r.text()).includes("secret detail"), "Stripe's error body is not forwarded");
r = await call("/checkout", "POST", { slug: ONE.slug }, env({ STRIPE_FETCH: async () => { throw new Error("net"); } }));
eq(r.status, 502, "network failure -> 502");
calls = [];
r = await call("/checkout", "POST", { slug: ONE.slug }, env({ STRIPE_SECRET_KEY: "sk_live_" + "y".repeat(20) }));
eq(r.status, 503, "live key in test mode -> 503"); eq(calls.length, 0, "and Stripe is never called");
r = await call("/checkout", "POST", { slug: ONE.slug }, env({ STRIPE_SECRET_KEY: "" }));
eq(r.status, 503, "no key -> 503");
r = await call("/checkout", "POST", { slug: ONE.slug, email: "not-an-email" }, env());
j = await r.json(); eq(r.status, 200, "bad email is dropped, not fatal");
eq(sessionParams(quote(ONE.slug), { SITE_ORIGIN: "https://titanos.tech" }, "not-an-email").customer_email, "not-an-email", "(sessionParams trusts its caller; the route validates)");

// onboarding + offers routes
r = await call("/onboarding?slug=" + ONE.slug, "GET", undefined, env()); j = await r.json();
eq(r.status, 200, "onboarding 200"); eq(j.steps.length, 6, "six steps");
eq((await call("/onboarding?slug=nope", "GET", undefined, env())).status, 404, "onboarding unknown 404");
r = await call("/offers", "GET", undefined, env()); j = await r.json();
ok(j.length > 0 && j.every((o) => o.priceAud > 0), "offers route lists only sellable offers");
ok(!j.some((o) => o.slug === blocked.slug), "non-READY offers are not listed");

// rate limit
let last = 0;
for (let i = 0; i < 40; i++) {
  last = (await handle(new Request("https://api.titanos.tech/negotiate/offers", { headers: { "cf-connecting-ip": "9.9.9.9" } }), env())).status;
}
eq(last, 429, "rate limited after 30 a minute per IP");

console.log(`== test_checkout_worker: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
