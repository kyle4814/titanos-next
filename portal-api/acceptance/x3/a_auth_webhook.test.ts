// x3 A: auth bypass, login tokens, webhook forgery and replay, internal secret, input-type confusion on the money path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { make, SECRET } from "../../test/harness.ts";
import { signStripePayload, verifyStripeSignature } from "../../src/stripe.ts";
import { handle } from "../../src/index.ts";
import { fullRig, blocked, finding } from "./lib.ts";

const j = async (r: Response) => (await r.json()) as any;

test("A-01 BLOCKED: malformed or missing bearer never authenticates (every protected route)", async () => {
  const h = make();
  const u = await h.login("a01@x3.test");
  const ok = (t: string) => h.req("GET", "/me", { token: t });
  assert.equal((await ok(u.session)).status, 200);
  const routes: [string, string][] = [["GET", "/me"], ["GET", "/domains"], ["GET", "/billing"], ["GET", "/invoices"], ["GET", "/keys"], ["GET", "/account/export"], ["DELETE", "/account"], ["POST", "/checkout"], ["POST", "/refunds"], ["GET", "/agent/credits"], ["GET", "/tenants"], ["GET", "/market/jobs"], ["GET", "/pro/board"], ["GET", "/app/domains"]];
  const bad: (string | undefined)[] = [undefined, "", u.session.toUpperCase(), u.session + "x", u.session.slice(0, -1), "ss_", "ss_0", u.session.replace("ss_", "tk_"), "Bearer " + u.session];
  for (const [m, p] of routes) for (const t of bad) {
    const r = await h.req(m, p, { token: t });
    assert.ok([401, 404, 503].includes(r.status) && r.status !== 200, `${m} ${p} token=${String(t).slice(0, 12)} -> ${r.status}`);
  }
  for (const [name, val] of [["bearer lowercase", `bearer ${u.session}`], ["Basic", `Basic ${u.session}`], ["double space", `Bearer  ${u.session}`], ["token scheme", `Token ${u.session}`]]) {
    const r = await handle(new Request("https://api.test/me", { headers: { authorization: val } }), {}, h.deps);
    assert.equal(r.status, 401, name);
  }
  blocked("A-01", "bearer forms");
});

test("A-02 BLOCKED: login links are single use, expire at 15 minutes, are bound to their email, and a deleted account cannot be resurrected as the same id", async () => {
  const h = make();
  const first = await h.login("a02@x3.test");
  await h.req("POST", "/auth/request", { body: { email: "a02@x3.test" } });
  const tok = h.mailer.outbox.at(-1)!.text.match(/(ll_[0-9a-f]+)/)![1];
  assert.equal((await h.req("POST", "/auth/verify", { body: { token: first.loginToken } })).status, 401, "reuse");
  h.clock.t += 16 * 60_000;
  assert.equal((await h.req("POST", "/auth/verify", { body: { token: tok } })).status, 401, "expired");
  for (const t of [undefined, null, 5, {}, [], "ll_", "ll_" + "0".repeat(48), "ss_abc", tok + "0"]) assert.ok([400, 401].includes((await h.req("POST", "/auth/verify", { body: { token: t } })).status));
  // email case / whitespace / plus tricks resolve to the SAME account (no duplicate-account takeover of an existing email)
  const a = await h.login("  A02@X3.TEST ");
  assert.equal(a.account.id, first.account.id);
  const del = await h.req("DELETE", "/account", { token: a.session, body: { confirm: "DELETE" } });
  assert.equal(del.status, 200);
  assert.equal((await h.req("GET", "/me", { token: first.session })).status, 401, "sessions die with the account");
  const again = await h.login("a02@x3.test"); assert.notEqual(again.account.id, first.account.id);
  blocked("A-02", "login token lifecycle");
});

test("A-03 BLOCKED: webhook forgery matrix (no/old/future/tampered/wrong-secret/duplicated headers) never changes state", async () => {
  const h = make();
  const u = await h.login("a03@x3.test");
  await h.req("POST", "/checkout", { token: u.session, body: { product: "leads_starter" } });
  const pur = [...h.store.purchases.values()][0];
  const payload = JSON.stringify({ id: "evt_a03", type: "checkout.session.completed", data: { object: { id: pur.checkoutId, payment_status: "paid", payment_intent: "pi_a03" } } });
  const now = Math.floor(h.clock.t / 1000);
  const good = await signStripePayload(payload, SECRET, now);
  const v1 = good.split("v1=")[1];
  const attempts: [string, string | null][] = [
    ["none", null], ["empty", ""], ["wrong secret", await signStripePayload(payload, "whsec_other", now)],
    ["stale", await signStripePayload(payload, SECRET, now - 301)], ["future", await signStripePayload(payload, SECRET, now + 301)],
    ["tampered payload", await signStripePayload(payload.replace("pi_a03", "pi_x"), SECRET, now)],
    ["no v1", `t=${now}`], ["v0 only", `t=${now},v0=${v1}`], ["v1 empty", `t=${now},v1=`], ["t=NaN", `t=abc,v1=${v1}`],
    ["t mismatch", `t=${now + 1},v1=${v1}`], ["short sig", `t=${now},v1=${v1.slice(0, 32)}`], ["upper sig", `t=${now},v1=${v1.toUpperCase()}`],
  ];
  for (const [name, sig] of attempts) {
    const r = await handle(new Request("https://api.test/stripe/webhook", { method: "POST", headers: sig === null ? {} : { "stripe-signature": sig }, body: payload }), {}, h.deps);
    assert.equal(r.status, 400, name);
    assert.equal([...h.store.purchases.values()][0].status, "pending", name);
  }
  // secret not configured: every signature is refused, including one made with the empty string
  const noSecret = { ...h.deps, webhookSecret: undefined };
  for (const s of [good, "t=" + now + ",v1=" + "0".repeat(64)]) assert.equal((await handle(new Request("https://api.test/stripe/webhook", { method: "POST", headers: { "stripe-signature": s }, body: payload }), {}, noSecret)).status, 400);
  assert.equal(await verifyStripeSignature(payload, good, "", now), false);
  // control: the real one works exactly once; a replay is a no-op
  const okRes = await handle(new Request("https://api.test/stripe/webhook", { method: "POST", headers: { "stripe-signature": good }, body: payload }), {}, h.deps);
  assert.equal((await j(okRes)).result, "handled");
  const replay = await handle(new Request("https://api.test/stripe/webhook", { method: "POST", headers: { "stripe-signature": good }, body: payload }), {}, h.deps);
  assert.equal((await j(replay)).result, "duplicate");
  assert.equal(h.store.invoices.size, 1);
  blocked("A-03", "webhook forgery matrix");
});

test("A-04 BLOCKED: credit top-up cannot be forged or double-granted", async () => {
  const h = make();
  const u = await h.login("a04@x3.test");
  await h.req("POST", "/agent/credits/topup", { token: u.session, body: { pack: "credits_2000" } });
  const order = [...h.store.creditOrders.values()][0];
  const unsigned = await handle(new Request("https://api.test/stripe/webhook", { method: "POST", body: JSON.stringify({ id: "evt_c", type: "checkout.session.completed", data: { object: { id: order.checkoutId, payment_status: "paid" } } }) }), {}, h.deps);
  assert.equal(unsigned.status, 400); assert.equal(await h.store.creditBalance(u.account.id), 0);
  await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "unpaid" });
  assert.equal(await h.store.creditBalance(u.account.id), 0, "unpaid grants nothing");
  await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" }, { id: "e1" });
  await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" }, { id: "e2" });
  await h.webhook("checkout.session.async_payment_succeeded", { id: order.checkoutId, payment_status: "paid" }, { id: "e3" });
  assert.equal(await h.store.creditBalance(u.account.id), 2000, "three distinct events for one order grant once");
  blocked("A-04", "credit order idempotency");
});

test("A-05 FINDING F11 [P3]: the internal secret door has no throttle: unlimited wrong guesses, same public hostname as customers", async () => {
  const r = fullRig();
  let wrong = 0;
  for (let i = 0; i < 300; i++) { const s = await r.internal("GET", "/internal/market/cards", undefined, "guess_" + i); if (s.status === 401) wrong++; }
  assert.equal(wrong, 300);
  assert.equal((await r.internal("GET", "/internal/market/cards")).status, 200, "the right secret still works after 300 failures: no lockout, no alarm");
  finding("F11", "P3", "x-internal-secret endpoints (market cards/sweep/resolve, tenants provision, payouts approve) are on the public host with no attempt limit", "300 wrong guesses all processed, then the correct secret accepted");
});

test("A-06 FINDING F12 [P3]: login throttle is per target email, so anyone can lock a victim out of requesting links and mail-bomb them (5/h)", async () => {
  const h = make();
  const victim = await h.login("victim@x3.test");
  const before = h.mailer.outbox.length;
  for (let i = 0; i < 5; i++) await h.req("POST", "/auth/request", { body: { email: "victim@x3.test" } });   // attacker, no account, no session
  assert.equal(h.mailer.outbox.length - before, 4, "mails to the victim (earlier login used 1 of the 5)");
  const legit = await h.req("POST", "/auth/request", { body: { email: "victim@x3.test" } });
  assert.equal(legit.status, 429, "the real owner is now refused");
  assert.ok(victim.session);
  finding("F12", "P3", "no per-IP limit; the per-email limit is attacker-spendable", "5 unauthenticated POSTs => victim receives 4 more mails and their own request returns 429 for an hour");
});

test("A-07 FINDING F13 [P3]: plain-object lookups on user input: product and pack ids named after Object.prototype members pass as products", async () => {
  const h = make();
  const u = await h.login("a07@x3.test");
  const out: string[] = [];
  for (const id of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    const r = await h.req("POST", "/checkout", { token: u.session, body: { product: id } });
    out.push(`${id}:${r.status}`);
  }
  assert.ok(out.every((x) => x.endsWith(":201")), out.join(","));
  const t = await h.req("POST", "/agent/credits/topup", { token: u.session, body: { pack: "constructor" } });
  assert.equal(t.status, 201);
  const row = [...h.store.purchases.values()][0];
  assert.ok(row.productId === undefined && row.amountCents === undefined, "pending row with no product id and no amount");
  finding("F13", "P3", "PRODUCTS[productId] / CREDIT_PACKS[packId] without own-property check", `${out.join(",")}; topup pack=constructor => 201. Real Stripe rejects the undefined amount (500), the mock accepts; a pending row with undefined productId/amount exists`);
});

test("A-08 FINDING F14 [P3]: a webhook that throws after the event id is claimed is lost for good (Stripe retry returns duplicate)", async () => {
  const h = make();
  const u = await h.login("a08@x3.test");
  await h.req("POST", "/checkout", { token: u.session, body: { product: "leads_starter" } });
  const pur = [...h.store.purchases.values()][0];
  const real = h.store.putInvoice.bind(h.store); let boom = true;
  h.store.putInvoice = async (i) => { if (boom) { boom = false; throw new Error("d1_unavailable"); } return real(i); };
  await assert.rejects(h.webhook("checkout.session.completed", { id: pur.checkoutId, payment_status: "paid", payment_intent: "pi_a08" }, { id: "evt_a08" }));
  const retry = await j(await h.webhook("checkout.session.completed", { id: pur.checkoutId, payment_status: "paid", payment_intent: "pi_a08" }, { id: "evt_a08" }));
  assert.equal(retry.result, "duplicate");
  assert.equal(h.store.invoices.size, 0, "purchase is marked paid, no tax invoice and no partner commission will ever be issued");
  assert.equal([...h.store.purchases.values()][0].status, "paid");
  finding("F14", "P3", "claimEvent runs before the side effects and is never released on failure", "putInvoice threw once; Stripe's retry got result=duplicate; purchase paid with 0 invoices");
});

test("A-09 FINDING F15 [P3]: no way to revoke a session (no logout route, 30-day TTL, token kept in localStorage)", async () => {
  const h = make();
  const u = await h.login("a09@x3.test");
  for (const [m, p] of [["POST", "/auth/logout"], ["DELETE", "/auth/session"], ["POST", "/sessions/revoke"], ["DELETE", "/sessions"]]) assert.ok([401, 404].includes((await h.req(m, p, { token: u.session })).status));
  h.clock.t += 29 * 86_400_000;
  assert.equal((await h.req("GET", "/me", { token: u.session })).status, 200, "a token stolen 29 days ago still works");
  finding("F15", "P3", "sessions can only end by TTL or account deletion", "no logout/revoke route; /me still 200 at day 29; lib/portal.ts keeps the token in window.localStorage and the site CSP meta allows 'unsafe-inline' scripts");
});
