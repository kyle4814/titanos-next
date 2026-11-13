// Production path (2026-11-13): armed live billing, Resend mail adapter, /auth/logout, secret wiring, CORS allowlist.
// SYNTHETIC values only, assembled at runtime so secret scanners see no key-shaped literal. No network: every fetch is a stub.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeD1 } from "./fake_d1.ts";
import { make } from "./harness.ts";
import { MemoryStore } from "../src/store.ts";
import { throttleFor, buildDeps, billingFor, mailerFor, jobPaymentsFor, assertLiveArmed, BuildDepsError } from "../src/build_deps.ts";
import { StripeHttpBilling, MockBilling } from "../src/stripe.ts";
import { ResendMailer, RESEND_URL } from "../src/mail.ts";
import { createWorker, handle } from "../src/index.ts";

const ORIGIN = "https://titanos.tech";
const live = "sk" + "_live_" + "FAKE0000";
const fakeTest = "sk" + "_test_" + "FAKE0000";
const wh = "whsec" + "_FAKE0000";
const armedEnv = (extra: Record<string, unknown> = {}) => ({
  DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, STRIPE_MODE: "live", STRIPE_SECRET_KEY: live, STRIPE_WEBHOOK_SECRET: wh,
  MAIL_PROVIDER: "resend", RESEND_API_KEY: "re" + "_FAKE0000", MAIL_FROM: "login@mail.example.invalid", LIVE_BILLING_ARMED: "yes-2026-11-13", ...extra,
});
const factory = () => new MemoryStore();
const refused = (env: any, reason: string, binding?: string) =>
  assert.throws(() => buildDeps(env, { storeFactory: factory }), (e: any) => e instanceof BuildDepsError && e.reason === reason && (binding === undefined || e.binding === binding));

// ---- 1 LIVE BILLING ----
test("live: fully armed starts, with real Stripe billing and the Resend mailer", () => {
  const d = buildDeps(armedEnv(), { storeFactory: factory });
  assert.ok(d.billing instanceof StripeHttpBilling); assert.ok(d.mailer instanceof ResendMailer);
  assert.equal(d.webhookSecret, wh);
});
for (const [name, patch, missing] of [
  ["no key", { STRIPE_SECRET_KEY: undefined }, "STRIPE_SECRET_KEY(live)"],
  ["test key in live mode", { STRIPE_SECRET_KEY: fakeTest }, "STRIPE_SECRET_KEY(live)"],
  ["no webhook secret", { STRIPE_WEBHOOK_SECRET: undefined }, "STRIPE_WEBHOOK_SECRET(whsec_...)"],
  ["empty webhook secret", { STRIPE_WEBHOOK_SECRET: "" }, "STRIPE_WEBHOOK_SECRET(whsec_...)"],
  ["space-only webhook secret", { STRIPE_WEBHOOK_SECRET: " " }, "STRIPE_WEBHOOK_SECRET(whsec_...)"],
  ["wrong-prefix webhook secret", { STRIPE_WEBHOOK_SECRET: "sk" + "_live_FAKE0000" }, "STRIPE_WEBHOOK_SECRET(whsec_...)"],
  ["bare whsec_ prefix", { STRIPE_WEBHOOK_SECRET: "whsec" + "_" }, "STRIPE_WEBHOOK_SECRET(whsec_...)"],
  ["no mail provider", { MAIL_PROVIDER: undefined }, "MAIL_PROVIDER"],
  ["no resend key", { RESEND_API_KEY: undefined }, "RESEND_API_KEY"],
  ["no mail from", { MAIL_FROM: undefined }, "MAIL_FROM"],
  ["no arming var", { LIVE_BILLING_ARMED: undefined }, "LIVE_BILLING_ARMED"],
  ["malformed arming var", { LIVE_BILLING_ARMED: "yes" }, "LIVE_BILLING_ARMED"],
  ["dev outbox still set", { DEV_OUTBOX: "1" }, "DEV_OUTBOX(must be unset)"],
] as const) {
  test(`live: refused and named when ${name}`, () => {
    try { buildDeps(armedEnv(patch), { storeFactory: factory }); assert.fail("started"); }
    catch (e: any) { assert.ok(e instanceof BuildDepsError); assert.equal(e.reason, "live_not_armed"); assert.ok(e.binding.split(",").includes(missing), e.binding); }
  });
}
test("live: the refusal lists every missing item at once and never a value", () => {
  try { buildDeps({ DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, STRIPE_MODE: "live" }, { storeFactory: factory }); assert.fail(); }
  catch (e: any) { assert.equal(e.binding, "STRIPE_SECRET_KEY(live),STRIPE_WEBHOOK_SECRET(whsec_...),MAIL_PROVIDER,LIVE_BILLING_ARMED"); }
});
test("live key without STRIPE_MODE=live is still refused exactly as before (test mode unchanged)", () => {
  assert.throws(() => billingFor({ STRIPE_SECRET_KEY: live }), (e: any) => e.reason === "live_key_refused");
  assert.throws(() => billingFor({ STRIPE_SECRET_KEY: fakeTest, STRIPE_MODE: "live" }), (e: any) => e.reason === "live_key_refused");
  refused({ DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, STRIPE_SECRET_KEY: live }, "live_key_refused");
  assert.ok(billingFor({}) instanceof MockBilling); assert.ok(billingFor({ STRIPE_SECRET_KEY: fakeTest }) instanceof StripeHttpBilling);
});
test("live: billingFor on its own re-checks arming (no arming var -> refused)", () => {
  assert.throws(() => billingFor(armedEnv({ LIVE_BILLING_ARMED: undefined }) as any), (e: any) => e.reason === "live_not_armed");
  assert.throws(() => assertLiveArmed(armedEnv({ LIVE_BILLING_ARMED: "yes-2026-11-1" }) as any));
  assert.doesNotThrow(() => assertLiveArmed(armedEnv() as any));
});
test("live: real Stripe Checkout request carries the live key and the same form fields as the test path", async () => {
  const calls: { url: string; auth: string; body: string }[] = [];
  const f = (async (url: string, init: any) => { calls.push({ url, auth: init.headers.authorization, body: String(init.body) }); return new Response(JSON.stringify({ id: "cs_live_x", url: "https://checkout.stripe.com/x" })); }) as any;
  const b = billingFor(armedEnv() as any, f);
  const out = await b.createCheckout({ email: "a@b.example", mode: "payment", name: "N", amountCents: 100, accountId: "acc", productId: "p", successUrl: "https://s", cancelUrl: "https://c", idempotencyKey: "k" });
  assert.equal(out.url, "https://checkout.stripe.com/x"); assert.equal(calls[0].url, "https://api.stripe.com/v1/checkout/sessions"); assert.equal(calls[0].auth, "Bearer " + live);
  assert.ok(calls[0].body.includes("line_items%5B0%5D%5Bquantity%5D=1"));
});
test("live: webhook signatures are verified by the SAME handler (bad signature 400, good one accepted)", async () => {
  const h = make();
  const bad = await handle(new Request("https://api.test/stripe/webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=00" }, body: "{}" }), { TITANOS_SITE_ORIGIN: ORIGIN, STRIPE_MODE: "live" }, h.deps);
  assert.equal(bad.status, 400);
  assert.equal((await h.webhook("checkout.session.completed", { id: "cs_unknown", payment_status: "paid" })).status, 200);
});
test("live: marketplace payments and payouts keep refusing", async () => {
  const jp = jobPaymentsFor(armedEnv() as any);
  await assert.rejects(jp.createJobCheckout({} as any), (e: any) => e.status === 503 && e.message === "payments_unavailable");
  const d = buildDeps(armedEnv(), { storeFactory: factory });
  await assert.rejects(d.ent!.payouts.transfer({ partnerId: "p", accountRef: "a", amountCents: 1, idempotencyKey: "k" }), (e: any) => e.status === 503 && e.message === "payouts_unavailable");
});
test("live: the Worker entry answers 503 deps_unavailable naming the missing item, /health stays up", async () => {
  const w = createWorker(); const e = armedEnv({ LIVE_BILLING_ARMED: undefined });
  const r = await w.fetch(new Request("https://api.test/catalogue"), e as any);
  assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: "deps_unavailable", reason: "live_not_armed:LIVE_BILLING_ARMED" });
  assert.equal((await w.fetch(new Request("https://api.test/health"), e as any)).status, 200);
});

// ---- 2 MAIL ----
const stub = (res: () => Response | Promise<Response>, seen: any[] = []) => (async (url: string, init: any) => { seen.push({ url, init }); return res(); }) as any;
test("resend: success posts the documented shape and sends only from/to/subject/text", async () => {
  const seen: any[] = [];
  await new ResendMailer("re_k", "login@mail.example.invalid", stub(() => new Response('{"id":"x"}'), seen)).send("u@x.example", "Subj", "link text");
  assert.ok(seen[0].init.signal instanceof AbortSignal, "every send carries a timeout signal");
  assert.equal(seen[0].url, RESEND_URL); assert.equal(seen[0].init.method, "POST"); assert.equal(seen[0].init.headers.authorization, "Bearer re_k");
  assert.deepEqual(JSON.parse(seen[0].init.body), { from: "login@mail.example.invalid", to: ["u@x.example"], subject: "Subj", text: "link text" });
});
test("resend: 4xx -> 502 mail_rejected, 429 and 5xx -> 503 mail_unavailable, network error and timeout -> 503", async () => {
  const send = (f: any, t = 8000) => new ResendMailer("k", "f@x.example", f, t).send("u@x.example", "s", "t");
  await assert.rejects(send(stub(() => new Response("{}", { status: 403 }))), (e: any) => e.status === 502 && e.code === "mail_rejected");
  await assert.rejects(send(stub(() => new Response("{}", { status: 422 }))), (e: any) => e.status === 502);
  await assert.rejects(send(stub(() => new Response("{}", { status: 429 }))), (e: any) => e.status === 503 && e.code === "mail_unavailable");
  await assert.rejects(send(stub(() => new Response("{}", { status: 500 }))), (e: any) => e.status === 503);
  await assert.rejects(send((async () => { throw new TypeError("net"); }) as any), (e: any) => e.status === 503);
  // AbortSignal.timeout is unref'd in Node, so the stub holds a ref'd timer to keep the loop alive until the abort fires.
  const hang = (async (_u: string, init: any) => new Promise((_r, rej) => { const k = setTimeout(() => {}, 5000); init.signal.addEventListener("abort", () => { clearTimeout(k); rej(new Error("aborted")); }); })) as any;
  await assert.rejects(send(hang, 20), (e: any) => e.status === 503 && e.code === "mail_unavailable");
});
test("mailerFor: provider unset keeps the old behaviour; set builds Resend; missing parts are named", () => {
  const db = new FakeD1();
  const base = { DB: db as never, TITANOS_SITE_ORIGIN: ORIGIN };
  assert.equal(mailerFor(base, Date.now).send.name, "send");
  assert.ok(mailerFor({ ...base, MAIL_PROVIDER: "resend", RESEND_API_KEY: "k", MAIL_FROM: "f@x.example" }, Date.now) instanceof ResendMailer);
  assert.throws(() => mailerFor({ ...base, MAIL_PROVIDER: "resend", MAIL_FROM: "f" }, Date.now), (e: any) => e.reason === "missing_binding" && e.binding === "RESEND_API_KEY");
  assert.throws(() => mailerFor({ ...base, MAIL_PROVIDER: "resend", RESEND_API_KEY: "k" }, Date.now), (e: any) => e.binding === "MAIL_FROM");
  assert.throws(() => mailerFor({ ...base, MAIL_PROVIDER: "smtp" }, Date.now), (e: any) => e.reason === "mail_config_invalid");
});
test("login request through the Worker: provider failure is a retryable 503, success is 202 and the mail carries only the link", async () => {
  const seen: any[] = []; let status = 200;
  const w = createWorker({ buildDeps: (e) => buildDeps(e, { storeFactory: factory, fetchFn: stub(() => new Response("{}", { status }), seen) }) });
  const env = { DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, MAIL_PROVIDER: "resend", RESEND_API_KEY: "k", MAIL_FROM: "f@x.example" };
  const post = () => w.fetch(new Request("https://api.test/auth/request", { method: "POST", body: JSON.stringify({ email: "u@x.example" }) }), env as any);
  assert.equal((await post()).status, 202);
  assert.match(JSON.parse(seen[0].init.body).text, /^Open this link within 15 minutes to sign in:\nhttps:\/\/titanos\.tech\/app\/login#token=ll_[0-9a-f]+\nIf you did not ask for this, ignore it\.$/);
  status = 503; const r = await post(); assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: "mail_unavailable" });
});

// ---- 3 LOGOUT / SECRETS / CORS ----
test("logout: invalidates the session server-side, is idempotent, clears the cookie, leaves other sessions alone", async () => {
  const h = make(); const a = await h.login("a@x.example"); h.mailer.outbox.length = 0;
  const second = await h.login("a@x.example");
  assert.equal((await h.req("GET", "/me", { token: a.session })).status, 200);
  const r = await h.req("POST", "/auth/logout", { token: a.session });
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true }); assert.match(r.headers.get("set-cookie")!, /^ss=; .*Max-Age=0/);
  assert.equal((await h.req("GET", "/me", { token: a.session })).status, 401);
  assert.equal((await h.req("GET", "/me", { token: second.session })).status, 200);
  assert.equal((await h.req("POST", "/auth/logout", { token: a.session })).status, 200);       // again
  assert.equal((await h.req("POST", "/auth/logout")).status, 200);                              // no token
  assert.equal((await h.req("POST", "/auth/logout", { token: "ss_deadbeef" })).status, 200);    // unknown token
  assert.equal((await h.req("GET", "/auth/logout")).status, 401);                               // GET is not the logout route
});
test("secrets: INTERNAL_API_SECRET and RECEIPT_SECRET reach Deps; unset stays undefined", () => {
  const base = { DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN };
  const d = buildDeps({ ...base, INTERNAL_API_SECRET: "int_FAKE", RECEIPT_SECRET: "rc_FAKE" }, { storeFactory: factory });
  assert.equal(d.operatorSecret, "int_FAKE"); assert.equal(d.receiptSecret, "rc_FAKE"); assert.equal(d.market!.internalSecret, "int_FAKE");
  const n = buildDeps(base, { storeFactory: factory }); assert.equal(n.operatorSecret, undefined); assert.equal(n.receiptSecret, undefined);
});
test("secrets: /internal/keys/trace works through the real entry when set, 401 when not or wrong", async () => {
  const w = createWorker({ buildDeps: (e) => buildDeps(e, { storeFactory: factory }) });
  const mk = (extra: object) => ({ DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, ...extra });
  const call = (env: any, hdr?: string) => w.fetch(new Request("https://api.test/internal/keys/trace?prefix=tk_abcdefgh", { headers: hdr ? { "x-operator-secret": hdr } : {} }), env);
  assert.equal((await call(mk({ INTERNAL_API_SECRET: "int_FAKE" }), "int_FAKE")).status, 200);
  assert.equal((await call(mk({ INTERNAL_API_SECRET: "int_FAKE" }), "wrong")).status, 401);
  assert.equal((await call(mk({}), "int_FAKE")).status, 401);
  assert.equal((await call(mk({ INTERNAL_API_SECRET: "int_FAKE" }))).status, 401);
});
test("cors: apex stays default; www is echoed only when allowlisted; hostile and lookalike origins never are", async () => {
  const h = make();
  const hit = async (origin: string | undefined, env: Record<string, string>, method = "GET", path = "/catalogue") =>
    (await handle(new Request("https://api.test" + path, { method, headers: origin ? { origin } : {} }), { TITANOS_SITE_ORIGIN: ORIGIN, ...env }, h.deps)).headers;
  const www = "https://www.titanos.tech", env = { TITANOS_EXTRA_ORIGINS: www + ", https://other.example" };
  assert.equal((await hit(ORIGIN, env)).get("access-control-allow-origin"), ORIGIN);
  assert.equal((await hit(www, env)).get("access-control-allow-origin"), www);
  assert.equal((await hit(www, env, "OPTIONS")).get("access-control-allow-origin"), www);
  assert.match((await hit(www, env)).get("vary")!, /origin/i);
  for (const bad of ["https://evil.example", "null", "*", "https://www.titanos.tech.evil.example", "http://www.titanos.tech", "https://WWW.titanos.tech"]) {
    assert.equal((await hit(bad, env)).get("access-control-allow-origin"), ORIGIN, bad);
  }
  assert.equal((await hit(www, {})).get("access-control-allow-origin"), ORIGIN, "no allowlist = unchanged");
  assert.equal((await hit(www, { TITANOS_EXTRA_ORIGINS: "*, http://www.titanos.tech, https://a.b/path" })).get("access-control-allow-origin"), ORIGIN, "malformed entries ignored");
  assert.equal((await hit(www, { ...env, TITANOS_SITE_ORIGIN: "*" })).get("access-control-allow-origin"), null, "misconfigured primary still fails closed");
});

// ---- restricted keys (rk_) and Stripe refusals ----
test("key shapes: sk_/rk_ x test/live are each accepted in their own mode and fail closed in the other", () => {
  const sk = (m: string) => "sk" + "_" + m + "_FAKE0000", rk = (m: string) => "rk" + "_" + m + "_FAKE0000";
  for (const k of [sk("test"), rk("test")]) {
    assert.ok(billingFor({ STRIPE_SECRET_KEY: k }) instanceof StripeHttpBilling, k.slice(0, 7));
    assert.throws(() => billingFor({ STRIPE_SECRET_KEY: k, STRIPE_MODE: "live" }), (e: any) => e.reason === "live_key_refused");
    assert.throws(() => buildDeps(armedEnv({ STRIPE_SECRET_KEY: k }), { storeFactory: factory }), (e: any) => e.reason === "live_not_armed");
  }
  for (const k of [sk("live"), rk("live")]) {
    assert.ok(billingFor(armedEnv({ STRIPE_SECRET_KEY: k }) as any) instanceof StripeHttpBilling, k.slice(0, 7));
    assert.ok(buildDeps(armedEnv({ STRIPE_SECRET_KEY: k }), { storeFactory: factory }).billing instanceof StripeHttpBilling);
    assert.throws(() => billingFor({ STRIPE_SECRET_KEY: k }), (e: any) => e.reason === "live_key_refused");
    assert.throws(() => billingFor({ STRIPE_SECRET_KEY: k, STRIPE_MODE: "test" }), (e: any) => e.reason === "live_key_refused");
  }
  assert.throws(() => new StripeHttpBilling(rk("test"), "live"), /stripe_key_mode_mismatch/);
  assert.throws(() => new StripeHttpBilling(sk("live"), "test"), /stripe_key_mode_mismatch/);
});
test("checkout: a Stripe 403 (restricted key lacks a permission) is logged and shown as a retryable 503, never a mock link or success", async () => {
  const h = make(); const a = await h.login("p@x.example");
  const logs: string[] = [];
  h.deps.log = (l) => logs.push(l);
  h.deps.billing = new StripeHttpBilling("rk" + "_live_FAKE0000", "live", (async () => new Response('{"error":{"message":"permission"}}', { status: 403 })) as any);
  const r = await h.req("POST", "/checkout", { token: a.session, body: { product: "ai_growth" } });
  assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: "billing_unavailable" });
  assert.equal(logs.length, 1); assert.match(logs[0], /stripe returned 403.*permissions/); assert.ok(!logs[0].includes("FAKE0000"));
  assert.equal((await h.store.purchasesFor(a.account.id)).length, 0, "no pending purchase is left behind");
  h.deps.billing = new StripeHttpBilling("rk" + "_live_FAKE0000", "live", (async () => new Response("x", { status: 500 })) as any);
  assert.equal((await h.req("POST", "/checkout", { token: a.session, body: { product: "ai_growth" } })).status, 503);
});

// ---- hardening round (security review of ad383a68): webhook secret shape, login mail abuse, strict email ----
test("webhook secret: a padded well-formed secret arms and the verifier gets the TRIMMED value", () => {
  const d = buildDeps(armedEnv({ STRIPE_WEBHOOK_SECRET: "  " + wh + "\n" }), { storeFactory: factory });
  assert.equal(d.webhookSecret, wh);
});
test("webhook secret: a whitespace-only secret never reaches the verifier, even in test mode", () => {
  const d = buildDeps({ DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, STRIPE_WEBHOOK_SECRET: "   " }, { storeFactory: factory });
  assert.equal(d.webhookSecret, undefined);
});
import { normaliseEmail, EMAIL_RE } from "../src/util.ts";
test("email: display-name tricks, separators, quotes and control shapes are refused; ordinary addresses still pass", () => {
  for (const bad of ["x<a@evil.example>", "<a@evil.example>", "a@evil.example>", "a,b@evil.example", "a@evil.example,b@other.example", 'a"b@evil.example', "a;b@evil.example", "a b@evil.example", "a@evil", "a@-evil.example", "a@evil..example", "a@evil.example.", "a@ev'il.example", "a@evil.e", "a@@evil.example", "@evil.example", "a\r\nbcc:b@evil.example", "o'brien@evil.example", "a(b)@evil.example"]) {
    assert.equal(normaliseEmail(bad), null, JSON.stringify(bad)); 
  }
  for (const good of ["a@b.example", "First.Last+tag@Sub.Example.com.au", "u_1%x@example.co", "x@xn--bcher-kva.example"]) assert.ok(normaliseEmail(good), good);
  assert.equal(normaliseEmail(" A@B.Example "), "a@b.example");
  assert.ok(EMAIL_RE.test("a@b.example"));
});

const loginWorker = (limits: object = {}, now = () => Date.now()) => {
  const db = new FakeD1();
  const w = createWorker({ buildDeps: (e) => buildDeps(e, { now }), makeThrottle: (e) => throttleFor(e, now) });
  const env = { DB: db as never, TITANOS_SITE_ORIGIN: ORIGIN, DEV_OUTBOX: "1", ...limits };
  const post = (email: string, ip?: string) => w.fetch(new Request("https://api.test/auth/request", { method: "POST", headers: ip ? { "cf-connecting-ip": ip } : {}, body: JSON.stringify({ email }) }), env as any);
  return { post, db };
};
test("login abuse: many distinct addresses from one IP are throttled (429, nothing leaked); other IPs are independent", async () => {
  const { post } = loginWorker({ LOGIN_IP_LIMIT: "3", LOGIN_GLOBAL_LIMIT: "1000" });
  for (let i = 0; i < 3; i++) assert.equal((await post(`u${i}@x.example`, "203.0.113.7")).status, 202);
  const r = await post("u9@x.example", "203.0.113.7");
  assert.equal(r.status, 429); assert.deepEqual(await r.json(), { error: "too_many_attempts" }); assert.ok(Number(r.headers.get("retry-after")) >= 1);
  const text = JSON.stringify([...r.headers]) + JSON.stringify({ error: "too_many_attempts" });
  assert.ok(!text.includes("203.0.113.7") && !text.includes("u9@x.example"));
  assert.equal((await post("v1@x.example", "203.0.113.8")).status, 202, "a different IP is independent");
  assert.equal((await post("w1@x.example", "203.0.113.7")).status, 429, "still locked");
});
test("login abuse: the global hourly cap trips across different IPs", async () => {
  const { post } = loginWorker({ LOGIN_IP_LIMIT: "50", LOGIN_GLOBAL_LIMIT: "4" });
  for (let i = 0; i < 4; i++) assert.equal((await post(`g${i}@x.example`, `198.51.100.${i + 1}`)).status, 202);
  assert.equal((await post("g9@x.example", "198.51.100.99")).status, 429);
});
test("login abuse: the window expires after an hour", async () => {
  let t = Date.UTC(2026, 10, 13);
  const { post } = loginWorker({ LOGIN_IP_LIMIT: "1" }, () => t);
  assert.equal((await post("a1@x.example", "203.0.113.1")).status, 202);
  assert.equal((await post("a2@x.example", "203.0.113.1")).status, 429);
  t += 3_600_001;
  assert.equal((await post("a3@x.example", "203.0.113.1")).status, 202);
});
test("login abuse: defaults, and bad env values fall back to the defaults", async () => {
  const { loginLimitsFor, LOGIN_REQUEST_LIMITS } = await import("../src/build_deps.ts");
  assert.deepEqual(loginLimitsFor({}), LOGIN_REQUEST_LIMITS);
  for (const bad of ["0", "-1", "abc", "1.5", "99999999999"]) assert.deepEqual(loginLimitsFor({ LOGIN_IP_LIMIT: bad, LOGIN_GLOBAL_LIMIT: bad }), LOGIN_REQUEST_LIMITS, bad);
  assert.deepEqual(loginLimitsFor({ LOGIN_IP_LIMIT: "5", LOGIN_GLOBAL_LIMIT: "9" }), { perIpPerHour: 5, globalPerHour: 9 });
});
test("login abuse: test-mode dev_outbox flow is unchanged (mail parked, 202) and a bad email still 400s before any mail", async () => {
  const { post, db } = loginWorker();
  assert.equal((await post("dev@x.example", "203.0.113.50")).status, 202);
  const row = await (db as any).prepare("SELECT to_addr FROM dev_outbox").first();
  assert.equal(row.to_addr, "dev@x.example");
  assert.equal((await post("x<a@evil.example>", "203.0.113.51")).status, 400);
});
