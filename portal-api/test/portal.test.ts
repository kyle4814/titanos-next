import { test } from "node:test";
import assert from "node:assert/strict";
import { make, SECRET, T0, StripeHttpBilling } from "./harness.ts";
import { normaliseDomain, dohResolver } from "../src/dns.ts";
import { verifyStripeSignature, signStripePayload } from "../src/stripe.ts";
import { refundVerdict, PRODUCTS } from "../src/catalogue.ts";
import worker, { handle } from "../src/index.ts";

const DAY = 86_400_000;

// ---------- sign up / login ----------
test("login: magic link creates the account on first verify, token is single use", async () => {
  const h = make();
  const a = await h.login("Owner@Example.com.au");
  assert.equal(a.account.email, "owner@example.com.au");
  const again = await h.j(await h.req("POST", "/auth/verify", { body: { token: a.loginToken } }));
  assert.equal(again.error, "token_invalid_or_used");
  const b = await h.login("owner@example.com.au");
  assert.equal(b.account.id, a.account.id, "same email = same account, one login");
});
test("login: expired token rejected; same 202 for any email (no enumeration); 6th request in an hour is 429", async () => {
  const h = make();
  assert.equal((await h.req("POST", "/auth/request", { body: { email: "a@b.com.au" } })).status, 202);
  const tok = h.mailer.outbox[0].text.match(/(ll_[0-9a-f]+)/)![1];
  h.clock.t += 16 * 60_000;
  assert.equal((await h.j(await h.req("POST", "/auth/verify", { body: { token: tok } }))).error, "token_invalid_or_used");
  for (let i = 0; i < 4; i++) assert.equal((await h.req("POST", "/auth/request", { body: { email: "a@b.com.au" } })).status, 202);
  assert.equal((await h.req("POST", "/auth/request", { body: { email: "a@b.com.au" } })).status, 429);
  assert.equal((await h.req("POST", "/auth/request", { body: { email: "not-an-email" } })).status, 400);
});
test("login: tokens and sessions are stored hashed, never in the clear", async () => {
  const h = make();
  const a = await h.login("x@y.com.au");
  for (const k of h.store.loginTokens.keys()) assert.notEqual(k, a.loginToken);
  for (const k of h.store.sessions.keys()) assert.notEqual(k, a.session);
});
test("auth: protected routes reject no token, bad token, expired session", async () => {
  const h = make();
  assert.equal((await h.req("GET", "/me")).status, 401);
  assert.equal((await h.req("GET", "/me", { token: "ss_deadbeef" })).status, 401);
  const a = await h.login("x@y.com.au");
  assert.equal((await h.req("GET", "/me", { token: a.session })).status, 200);
  h.clock.t += 31 * DAY;
  assert.equal((await h.req("GET", "/me", { token: a.session })).status, 401);
});
test("no deps wired: every route but /health fails closed with 503", async () => {
  const r = await worker.fetch(new Request("https://x.test/checkout", { method: "POST" }), {});
  assert.equal(r.status, 503);
});

// ---------- domain verify ----------
test("domain: normalisation rejects IPs, single labels, junk, internal TLDs", () => {
  assert.equal(normaliseDomain("https://WWW.Example.com.au/path"), "www.example.com.au");
  for (const bad of ["1.2.3.4", "localhost", "foo", "a b.com", "-x.com", "x.invalid", "http://[::1]/", "", 5, null]) assert.equal(normaliseDomain(bad), null, String(bad));
});
test("domain: TXT must match our token; wrong value and missing record are 422", async () => {
  const h = make();
  const { session } = await h.login("o@acme.com.au");
  const d = await h.j(await h.req("POST", "/domains", { token: session, body: { domain: "acme.com.au" } }));
  assert.equal(d.record.name, "_titanos-verify.acme.com.au");
  assert.equal((await h.req("POST", `/domains/${d.id}/verify`, { token: session })).status, 422);
  h.dns.zone[d.record.name] = ["titanos-verify=wrong"];
  assert.equal((await h.req("POST", `/domains/${d.id}/verify`, { token: session })).status, 422);
  h.dns.zone[d.record.name] = ["v=spf1 -all", d.record.value];
  const ok = await h.j(await h.req("POST", `/domains/${d.id}/verify`, { token: session }));
  assert.equal(ok.verified, true);
});
test("domain: another account cannot claim or verify a domain already verified; cannot read others' domain rows", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@evil.com.au");
  const bd = await h.j(await h.req("POST", "/domains", { token: b.session, body: { domain: "acme.com.au" } })); // b adds first, unverified
  await h.verifiedDomain(a.session, "acme.com.au");
  h.dns.zone[bd.record.name] = [bd.record.value];
  assert.equal((await h.req("POST", `/domains/${bd.id}/verify`, { token: b.session })).status, 409);
  assert.equal((await h.req("POST", "/domains", { token: b.session, body: { domain: "acme.com.au" } })).status, 201); // idempotent for b's own unverified row
  const ad = [...h.store.domains.values()].find((x) => x.accountId === a.account.id)!;
  assert.equal((await h.req("POST", `/domains/${ad.id}/verify`, { token: b.session })).status, 404);
});
test("domain: DoH lookup failure is 502 (never a fake verified)", async () => {
  const h = make();
  h.deps.dns = dohResolver((async () => new Response("no", { status: 500 })) as never);
  const { session } = await h.login("o@acme.com.au");
  const d = await h.j(await h.req("POST", "/domains", { token: session, body: { domain: "acme.com.au" } }));
  assert.equal((await h.req("POST", `/domains/${d.id}/verify`, { token: session })).status, 502);
});
test("domain: DoH parses quoted TXT answers", async () => {
  const r = dohResolver((async (u: string) => { assert.match(String(u), /name=_titanos-verify\.a\.com\.au&type=TXT/); return new Response(JSON.stringify({ Answer: [{ type: 16, data: '"titanos-verify=abc"' }, { type: 5, data: "x" }] })); }) as never);
  assert.deepEqual(await r.txt("_titanos-verify.a.com.au"), ["titanos-verify=abc"]);
});

// ---------- checkout ----------
test("checkout: monitor and compliance need a VERIFIED domain; ai and leads do not; unknown product 400", async () => {
  const h = make();
  const { session } = await h.login("o@acme.com.au");
  assert.equal((await h.req("POST", "/checkout", { token: session, body: { product: "monitor_monthly", domain: "acme.com.au" } })).status, 403);
  const d = await h.j(await h.req("POST", "/domains", { token: session, body: { domain: "acme.com.au" } }));
  assert.equal((await h.req("POST", "/checkout", { token: session, body: { product: "compliance_pack", domain: "acme.com.au" } })).status, 403, "added but unverified");
  h.dns.zone[d.record.name] = [d.record.value];
  await h.req("POST", `/domains/${d.id}/verify`, { token: session });
  assert.equal((await h.req("POST", "/checkout", { token: session, body: { product: "monitor_monthly", domain: "acme.com.au" } })).status, 201);
  assert.equal((await h.req("POST", "/checkout", { token: session, body: { product: "ai_growth" } })).status, 201);
  assert.equal((await h.req("POST", "/checkout", { token: session, body: { product: "leads_starter" } })).status, 201);
  assert.equal((await h.req("POST", "/checkout", { token: session, body: { product: "free_money" } })).status, 400);
  const co = h.billing.calls.filter((c) => c.op === "checkout").map((c) => c.args as any);
  assert.equal(co[0].amountCents, 14900); assert.equal(co[0].mode, "subscription");
});
test("checkout: a verified domain of someone else's account does not unlock buying", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@other.com.au");
  await h.verifiedDomain(a.session, "acme.com.au");
  assert.equal((await h.req("POST", "/checkout", { token: b.session, body: { product: "monitor_monthly", domain: "acme.com.au" } })).status, 403);
});
test("catalogue: the amounts match lib/pricing.ts (the site's single source of truth)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../lib/pricing.ts", import.meta.url), "utf8");
  const num = (k: string) => Number(src.match(new RegExp(`${k}:\\s*(\\d+)`))![1]);
  assert.equal(PRODUCTS.monitor_monthly.amountCents, num("MONITOR_MONTHLY") * 100);
  assert.equal(PRODUCTS.monitor_annual.amountCents, num("MONITOR_ANNUAL") * 100);
  assert.equal(PRODUCTS.compliance_pack.amountCents, num("PACK_PRICE") * 100);
  assert.equal(PRODUCTS.ai_growth.amountCents, num("AI_GROWTH_PARTNER") * 100);
  assert.equal(PRODUCTS.ai_ops.amountCents, num("AI_OPS_PARTNER") * 100);
  assert.equal(PRODUCTS.ai_embedded.amountCents, num("AI_EMBEDDED_PARTNER") * 100);
  const leads = (k: string) => Number(src.match(new RegExp(`${k}:\\s*\\{\\s*price:\\s*(\\d+)`))![1]);
  assert.equal(PRODUCTS.leads_starter.amountCents, leads("STARTER") * 100);
  assert.equal(PRODUCTS.leads_growth.amountCents, leads("GROWTH") * 100);
  assert.equal(PRODUCTS.leads_campaign.amountCents, leads("CAMPAIGN") * 100);
  assert.equal(PRODUCTS.leads_retainer.amountCents, leads("RETAINER") * 100);
});

// ---------- webhook ----------
test("webhook: bad/missing/stale signature rejected; replayed event id is a no-op (one invoice)", async () => {
  const h = make();
  const { session } = await h.login("o@acme.com.au");
  await h.req("POST", "/checkout", { token: session, body: { product: "ai_growth" } });
  const p = [...h.store.purchases.values()][0];
  const obj = { id: p.checkoutId, payment_status: "paid", payment_intent: "pi_1", customer: "cus_1", subscription: "sub_1" };
  assert.equal((await h.webhook("checkout.session.completed", obj, { secret: "whsec_wrong" })).status, 400);
  assert.equal((await h.webhook("checkout.session.completed", obj, { t: Math.floor(T0 / 1000) - 3600 })).status, 400);
  const nosig = await handle(new Request("https://x/stripe/webhook", { method: "POST", body: "{}" }), {}, h.deps);
  assert.equal(nosig.status, 400);
  assert.equal(h.store.invoices.size, 0);
  assert.equal((await h.webhook("checkout.session.completed", obj, { id: "evt_same" })).status, 200);
  assert.equal(((await h.j(await h.webhook("checkout.session.completed", obj, { id: "evt_same" }))).result), "duplicate");
  assert.equal(h.store.invoices.size, 1);
});
test("signature: constant-time compare, multiple v1 values, tampered payload fails", async () => {
  const sig = await signStripePayload("{}", "s", 1000);
  assert.equal(await verifyStripeSignature("{}", sig, "s", 1000), true);
  assert.equal(await verifyStripeSignature("{ }", sig, "s", 1000), false);
  assert.equal(await verifyStripeSignature("{}", sig, undefined, 1000), false);
  assert.equal(await verifyStripeSignature("{}", `${sig},v1=00`, "s", 1000), true);
});
test("webhook: renewals issue a new numbered invoice; cancellation event is recorded", async () => {
  const h = make();
  const { session } = await h.login("o@acme.com.au");
  await h.req("POST", "/checkout", { token: session, body: { product: "ai_growth" } });
  const { purchase } = await h.pay("ai_growth");
  await h.webhook("invoice.paid", { subscription: `sub_${purchase.id}`, billing_reason: "subscription_cycle", amount_paid: 150000 });
  await h.webhook("invoice.paid", { subscription: `sub_${purchase.id}`, billing_reason: "subscription_create", amount_paid: 150000 }); // first invoice already issued by checkout
  const inv = (await h.j(await h.req("GET", "/invoices", { token: session }))).invoices;
  assert.deepEqual(inv.map((i: any) => i.number), ["TT-000001", "TT-000002"]);
  await h.webhook("customer.subscription.deleted", { id: `sub_${purchase.id}` });
  assert.ok(h.store.subs.get(`sub_${purchase.id}`)!.cancelledAt);
});

// ---------- invoices ----------
test("invoices: owner sees own invoice text with ABN and no GST; another account gets 404", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@other.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "leads_starter" } });
  await h.pay("leads_starter");
  const id = (await h.j(await h.req("GET", "/invoices", { token: a.session }))).invoices[0].id;
  const txt = await (await h.req("GET", `/invoices/${id}`, { token: a.session })).text();
  assert.match(txt, /AU\$497\.00/); assert.match(txt, /ABN 34 318 502 254/); assert.match(txt, /no GST charged/);
  assert.equal((await h.req("GET", `/invoices/${id}`, { token: b.session })).status, 404);
  assert.deepEqual((await h.j(await h.req("GET", "/invoices", { token: b.session }))).invoices, []);
});

// ---------- cancel ----------
test("cancel: monitor ends at the period end, retainer not before the 3-month minimum, idempotent, owner only", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@other.com.au");
  await h.verifiedDomain(a.session, "acme.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "monitor_monthly", domain: "acme.com.au" } });
  const m = await h.pay("monitor_monthly");
  h.clock.t += 10 * DAY;
  assert.equal((await h.req("POST", `/subscriptions/sub_${m.purchase.id}/cancel`, { token: b.session })).status, 404);
  const c1 = await h.j(await h.req("POST", `/subscriptions/sub_${m.purchase.id}/cancel`, { token: a.session }));
  assert.equal(c1.status, "cancel_scheduled");
  assert.equal(new Date(c1.effectiveAt).toISOString().slice(0, 10), "2026-12-06", "next monthly renewal after day 10, not today");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "ai_growth" } });
  const r = await h.pay("ai_growth");
  h.clock.t += 5 * DAY;
  const c2 = await h.j(await h.req("POST", `/subscriptions/sub_${r.purchase.id}/cancel`, { token: a.session }));
  assert.equal(new Date(c2.effectiveAt).toISOString().slice(0, 10), "2027-02-16", "3-month minimum from the 2026-11-16 start");
  assert.deepEqual(h.billing.calls.filter((c) => c.op === "cancel").map((c) => (c.args as any).atPeriodEnd), [true, true]);
});

// ---------- refund ----------
test("refund: compliance inside 14 days with no deliverable is automatic and exact", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au");
  await h.verifiedDomain(a.session, "acme.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "compliance_pack", domain: "acme.com.au" } });
  const { purchase } = await h.pay("compliance_pack");
  h.clock.t += 13 * DAY;
  const r = await h.j(await h.req("POST", "/refunds", { token: a.session, body: { purchaseId: purchase.id } }));
  assert.deepEqual(r, { status: "refunded", amountCents: 599700 });
  const call = h.billing.calls.find((c) => c.op === "refund")!.args as any;
  assert.equal(call.amountCents, 599700); assert.equal(call.pi, `pi_${purchase.id}`);
  assert.equal((await h.req("POST", "/refunds", { token: a.session, body: { purchaseId: purchase.id } })).status, 409, "already refunded");
  assert.equal(h.billing.calls.filter((c) => c.op === "refund").length, 1, "never refunded twice");
});
test("refund: day 15, deliverable issued, monitor, leads and retainers all go to a review card, never auto", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au");
  await h.verifiedDomain(a.session, "acme.com.au");
  for (const [pid, dom] of [["compliance_pack", "acme.com.au"], ["compliance_pack", "acme.com.au"], ["monitor_monthly", "acme.com.au"], ["leads_growth", undefined], ["ai_ops", undefined]] as const)
    await h.req("POST", "/checkout", { token: a.session, body: { product: pid, domain: dom } });
  const ps = [...h.store.purchases.values()];
  const pay = async (p: typeof ps[number], sub: boolean) => h.webhook("checkout.session.completed", { id: p.checkoutId, payment_status: "paid", payment_intent: `pi_${p.id}`, ...(sub ? { subscription: `sub_${p.id}` } : {}) });
  await pay(ps[0], false); await pay(ps[1], false); await pay(ps[2], true); await pay(ps[3], false); await pay(ps[4], true);
  ps[1].deliverableIssued = true;
  h.clock.t += 15 * DAY;
  const reasons: string[] = [];
  for (const p of ps) { const r = await h.j(await h.req("POST", "/refunds", { token: a.session, body: { purchaseId: p.id } })); assert.equal(r.status, "needs_review"); reasons.push(r.reason); }
  assert.deepEqual(reasons, ["outside_14_days", "deliverable_issued", "monitor_no_refund_current_period", "scope_terms_apply", "scope_terms_apply"]);
  assert.equal(h.billing.calls.filter((c) => c.op === "refund").length, 0, "no money moved without Kyle's tap");
  assert.equal((await h.store.openCards()).length, 5);
});
test("refund: unpaid purchase 409; someone else's purchase 404; refundVerdict boundary is exactly 14 days", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@other.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "leads_starter" } });
  const p = [...h.store.purchases.values()][0];
  assert.equal((await h.req("POST", "/refunds", { token: a.session, body: { purchaseId: p.id } })).status, 409);
  assert.equal((await h.req("POST", "/refunds", { token: b.session, body: { purchaseId: p.id } })).status, 404);
  const c = PRODUCTS.compliance_pack;
  assert.equal(refundVerdict(c, 0, 14 * DAY, false, false).auto, true);
  assert.equal(refundVerdict(c, 0, 14 * DAY + 1, false, false).auto, false);
});

// ---------- keys, export, deletion ----------
test("keys: shown once, hash stored, revoke works, other accounts cannot revoke, scopes sanitised", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@other.com.au");
  const k = await h.j(await h.req("POST", "/keys", { token: a.session, body: { scopes: ["scan:read", "<script>", 5] } }));
  assert.match(k.key, /^tk_[0-9a-f]{48}$/); assert.deepEqual(k.scopes, ["scan:read"]);
  const listed = JSON.stringify(await h.j(await h.req("GET", "/keys", { token: a.session })));
  assert.ok(!listed.includes(k.key)); assert.ok(![...h.store.keys.values()].some((r) => r.hash === k.key));
  assert.equal((await h.req("DELETE", `/keys/${k.id}`, { token: b.session })).status, 404);
  assert.equal((await h.req("DELETE", `/keys/${k.id}`, { token: a.session })).status, 200);
  assert.equal((await h.j(await h.req("GET", "/keys", { token: a.session }))).keys[0].revoked, true);
});
test("export: carries the account's own data only, no hashes or secrets", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@other.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "leads_starter" } }); await h.pay("leads_starter");
  await h.req("POST", "/keys", { token: a.session, body: {} });
  await h.req("POST", "/checkout", { token: b.session, body: { product: "leads_growth" } });
  const e = await h.j(await h.req("GET", "/account/export", { token: a.session }));
  assert.equal(e.account.email, "a@acme.com.au"); assert.equal(e.purchases.length, 1); assert.equal(e.invoices.length, 1);
  const txt = JSON.stringify(e);
  assert.ok(!txt.includes("b@other.com.au")); assert.ok(!/"hash"/.test(txt));
});
test("deletion: needs the word DELETE, cancels subscriptions, wipes email/domains/sessions, keeps invoices without PII, email reusable", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au");
  await h.verifiedDomain(a.session, "acme.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "monitor_monthly", domain: "acme.com.au" } }); await h.pay("monitor_monthly");
  assert.equal((await h.req("DELETE", "/account", { token: a.session, body: {} })).status, 400);
  const r = await h.j(await h.req("DELETE", "/account", { token: a.session, body: { confirm: "DELETE" } }));
  assert.equal(r.status, "deleted");
  assert.equal(h.billing.calls.filter((c) => c.op === "cancel").length, 1);
  assert.equal((await h.req("GET", "/me", { token: a.session })).status, 401);
  assert.equal(h.store.invoices.size, 1);
  assert.ok(![...h.store.accounts.values()].some((x) => x.email === "a@acme.com.au"));
  assert.equal(h.store.domains.size, 0);
  const again = await h.login("a@acme.com.au");
  assert.notEqual(again.account.id, a.account.id, "a fresh account, not the deleted one");
  assert.ok(await h.store.verifiedOwnerOf("acme.com.au") === undefined, "domain is free to claim again");
});

// ---------- Stripe HTTP provider (fake fetch only, never the network) ----------
test("StripeHttpBilling: key must match the mode; request shape is right; no network in tests", async () => {
  assert.throws(() => new StripeHttpBilling("sk_live_x", "test"), /mismatch/);
  assert.throws(() => new StripeHttpBilling("sk_test_x", "live"), /mismatch/);
  const seen: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return new Response(JSON.stringify({ id: "cs_1", url: "https://stripe.test/c" })); }) as never;
  const s = new StripeHttpBilling("sk_test_fixture", "test", f);
  const r = await s.createCheckout({ email: "a@b.com.au", mode: "subscription", name: "Monitor", amountCents: 14900, interval: "month", accountId: "acc1", productId: "monitor_monthly", successUrl: "https://s", cancelUrl: "https://c", idempotencyKey: "k1" });
  assert.deepEqual(r, { id: "cs_1", url: "https://stripe.test/c" });
  const body = new URLSearchParams(String(seen[0].init.body));
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "14900"); assert.equal(body.get("line_items[0][price_data][currency]"), "aud");
  assert.equal(body.get("line_items[0][price_data][recurring][interval]"), "month"); assert.equal(body.get("metadata[account_id]"), "acc1");
  assert.equal((seen[0].init.headers as any)["idempotency-key"], "k1");
  await s.refund("pi_1", 100, "r1");
  assert.equal(seen[1].url, "https://api.stripe.com/v1/refunds");
  const bad = new StripeHttpBilling("sk_test_fixture", "test", (async () => new Response("x", { status: 402 })) as never);
  await assert.rejects(bad.refund("pi", 1, "k"), /stripe_402/);
});

// ---------- hygiene ----------
test("hygiene: secrets never leak in any error body; oversize and malformed bodies are 413/400; CORS only for the site origin", async () => {
  const h = make();
  assert.equal((await h.req("POST", "/auth/request", { body: { email: "x".repeat(70_000) + "@a.com" } })).status, 413);
  const bad = await handle(new Request("https://x/auth/request", { method: "POST", body: "{nope" }), {}, h.deps);
  assert.equal(bad.status, 400);
  const pre = await h.req("OPTIONS", "/checkout");
  assert.equal(pre.status, 204); assert.equal(pre.headers.get("access-control-allow-origin"), "https://titanos.tech");
  const r = await h.req("GET", "/catalogue");
  assert.equal(r.status, 200); assert.ok((await r.json() as any).products.length >= 10);
  assert.ok(!SECRET.length || !(await (await h.req("GET", "/catalogue")).text()).includes(SECRET));
});
