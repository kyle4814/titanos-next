import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnt, INTERNAL, SSO_CFG } from "./ent_harness.ts";
import { commissionCents, rateFor, HOLD_DAYS, APPROVAL_ABOVE_CENTS } from "../src/enterprise/share.ts";
import { csvCell } from "../src/enterprise/service.ts";
import { PRODUCTS } from "../src/catalogue.ts";

const DAY = 86_400_000;

// ---------- provisioning ----------
test("provision: needs the operator secret; wrong or missing secret looks like a 404", async () => {
  const h = await makeEnt();
  await h.login("boss@bigco.com.au");
  const body = { kind: "enterprise", name: "BigCo", slug: "bigco", adminEmail: "boss@bigco.com.au" };
  assert.equal((await h.ireq("/internal/tenants/provision", body, null)).status, 404);
  assert.equal((await h.ireq("/internal/tenants/provision", body, "wrong_secret_of_the_same_len")).status, 404);
  assert.equal((await h.ireq("/internal/tenants/provision", body, INTERNAL)).status, 201);
});
test("provision: admin must have signed in first; slug unique and not reserved; no HTML in names", async () => {
  const h = await makeEnt();
  const r = await h.ireq("/internal/tenants/provision", { kind: "enterprise", name: "X", slug: "xcorp", adminEmail: "ghost@x.com.au" });
  assert.equal((await h.j(r)).error, "admin_must_sign_in_first");
  await h.login("a@x.com.au");
  for (const slug of ["admin", "api", "A", "ab", "-bad-", "has space"]) assert.equal((await h.ireq("/internal/tenants/provision", { kind: "enterprise", name: "X", slug, adminEmail: "a@x.com.au" })).status, 400, slug);
  assert.equal((await h.ireq("/internal/tenants/provision", { kind: "enterprise", name: "<b>X</b>", slug: "xcorp", adminEmail: "a@x.com.au" })).status, 400);
  assert.equal((await h.ireq("/internal/tenants/provision", { kind: "client", name: "X", slug: "xcorp", adminEmail: "a@x.com.au" })).status, 400, "clients are made by partners, never by the operator route");
  assert.equal((await h.ireq("/internal/tenants/provision", { kind: "enterprise", name: "X", slug: "xcorp", adminEmail: "a@x.com.au" })).status, 201);
  assert.equal((await h.ireq("/internal/tenants/provision", { kind: "enterprise", name: "Y", slug: "xcorp", adminEmail: "a@x.com.au" })).status, 409);
});
test("enterprise routes fail closed (503) when the Worker has no enterprise context", async () => {
  const h = await makeEnt();
  delete (h.deps as any).ent;
  const u = await h.login("a@b.com.au");
  assert.equal((await h.req("GET", "/tenants", { token: u.session })).status, 503);
});

// ---------- estate ----------
test("estate: assets need TXT proof; only verified assets are assessed; data is labelled SYNTHETIC", async () => {
  const h = await makeEnt();
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  const tid = o.tenant.id;
  const a1 = await h.addVerifiedAsset(o.session, tid, "bigco.com.au", "HQ site");
  assert.equal(a1.v.verified, true);
  await h.post(o.session, `/enterprise/${tid}/assets`, { domain: "unproven.bigco.net" });
  const est = await h.get(o.session, `/enterprise/${tid}/estate`);
  assert.equal(est.totals.assets, 2);
  assert.equal(est.totals.verified, 1);
  assert.equal(est.totals.unverified, 1);
  assert.match(est.dataSource, /SYNTHETIC/);
  const un = est.assets.find((x: any) => x.domain === "unproven.bigco.net");
  assert.equal(un.grade, null, "an unverified domain is never scanned");
  const ver = est.assets.find((x: any) => x.verified);
  assert.match(ver.grade, /^[A-F]$/);
  assert.equal(est.totals.averageScore, ver.score);
});
test("estate: a domain verified by one tenant cannot be claimed by another or by a personal account", async () => {
  const h = await makeEnt();
  const a = await h.provision("enterprise", "a@one.com.au", "One", "one");
  const b = await h.provision("enterprise", "b@two.com.au", "Two", "two");
  await h.addVerifiedAsset(a.session, a.tenant.id, "shared.com.au");
  const r = await h.j(await h.req("POST", `/enterprise/${b.tenant.id}/assets`, { token: b.session, body: { domain: "shared.com.au" } }));
  assert.equal(r.error, "domain_already_verified_by_another_account");
  const p = await h.login("solo@x.com.au");
  const pv = await h.verifiedDomain(p.session, "personal.com.au");
  assert.equal(pv.v.verified, true);
  const r2 = await h.j(await h.req("POST", `/enterprise/${b.tenant.id}/assets`, { token: b.session, body: { domain: "personal.com.au" } }));
  assert.equal(r2.error, "domain_already_verified_by_another_account");
});
test("estate: TXT value must match; another tenant's token does not verify my asset", async () => {
  const h = await makeEnt();
  const a = await h.provision("enterprise", "a@one.com.au", "One", "one");
  const asset = await h.j(await h.req("POST", `/enterprise/${a.tenant.id}/assets`, { token: a.session, body: { domain: "mine.com.au" } }));
  h.dns.zone[asset.record.name] = ["titanos-verify=not_the_token"];
  assert.equal((await h.j(await h.req("POST", `/enterprise/${a.tenant.id}/assets/${asset.id}/verify`, { token: a.session }))).error, "txt_record_not_found");
});
test("estate CSV: analyst and up only; formula injection is neutralised", async () => {
  const h = await makeEnt();
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  const tid = o.tenant.id;
  await h.j(await h.req("POST", `/enterprise/${tid}/assets`, { token: o.session, body: { domain: "evil.bigco.com.au", label: "=HYPERLINK(1)" } }));
  const csv = await (await h.req("GET", `/enterprise/${tid}/estate.csv`, { token: o.session })).text();
  assert.match(csv, /,'=HYPERLINK\(1\),/);
  for (const raw of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) assert.ok(csvCell(raw).startsWith("'") || csvCell(raw).startsWith('"\''), raw);
  // viewer cannot export
  const v = await h.login("viewer@bigco.com.au");
  await h.post(o.session, `/enterprise/${tid}/members`, { email: "viewer@bigco.com.au", role: "viewer" });
  const inv = (await h.get(v.session, "/invites")).invites[0];
  await h.post(v.session, `/invites/${inv.id}/accept`);
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate.csv`, { token: v.session })).status, 403);
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate`, { token: v.session })).status, 200);
});

// ---------- members and roles ----------
test("members: invite is bound to the email; another account cannot accept it; single use; expiry", async () => {
  const h = await makeEnt();
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  const tid = o.tenant.id;
  const inv = await h.post(o.session, `/enterprise/${tid}/members`, { email: "new@bigco.com.au", role: "analyst" });
  const thief = await h.login("thief@evil.com.au");
  assert.equal((await h.req("POST", `/invites/${inv.id}/accept`, { token: thief.session })).status, 404);
  assert.deepEqual((await h.get(thief.session, "/tenants")).tenants, []);
  const n = await h.login("new@bigco.com.au");
  assert.equal((await h.req("POST", `/invites/${inv.id}/accept`, { token: n.session })).status, 200);
  assert.equal((await h.req("POST", `/invites/${inv.id}/accept`, { token: n.session })).status, 404, "single use");
  const inv2 = await h.post(o.session, `/enterprise/${tid}/members`, { email: "late@bigco.com.au", role: "viewer" });
  const l = await h.login("late@bigco.com.au");
  h.clock.t += 8 * DAY;
  assert.equal((await h.req("POST", `/invites/${inv2.id}/accept`, { token: l.session })).status, 404, "expired");
});
test("members: the last admin cannot be demoted or removed; an analyst cannot change roles", async () => {
  const h = await makeEnt();
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  const tid = o.tenant.id;
  const me = o.tenant;
  const acc = (await h.get(o.session, "/me")).id;
  assert.equal((await h.j(await h.req("PATCH", `/enterprise/${tid}/members/${acc}`, { token: o.session, body: { role: "viewer" } }))).error, "last_admin");
  assert.equal((await h.j(await h.req("DELETE", `/enterprise/${tid}/members/${acc}`, { token: o.session }))).error, "last_admin");
  const inv = await h.post(o.session, `/enterprise/${tid}/members`, { email: "an@bigco.com.au", role: "analyst" });
  const an = await h.login("an@bigco.com.au");
  await h.post(an.session, `/invites/${inv.id}/accept`);
  assert.equal((await h.req("PATCH", `/enterprise/${tid}/members/${acc}`, { token: an.session, body: { role: "viewer" } })).status, 403);
  assert.equal((await h.req("POST", `/enterprise/${tid}/members`, { token: an.session, body: { email: "x@y.com.au", role: "admin" } })).status, 403);
  assert.ok(me);
  const audit = await h.get(o.session, `/enterprise/${tid}/audit`);
  assert.ok(audit.entries.some((e: any) => e.action === "member.invite"));
});

// ---------- SSO ----------
async function ssoWorld() {
  const h = await makeEnt();
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  const tid = o.tenant.id;
  await h.addVerifiedAsset(o.session, tid, "bigco.com.au");
  const cfgView = await h.configureSso(o.session, tid, "bigco.com.au");
  const cfg = SSO_CFG(cfgView.clientId);
  return { h, o, tid, cfg };
}
test("sso: config never returns the secret; allowed email domains must be TXT-verified by the tenant", async () => {
  const { h, o, tid } = await ssoWorld();
  const v = await h.get(o.session, `/enterprise/${tid}/sso`);
  assert.equal(JSON.stringify(v).includes("sso_secret_fixture"), false);
  assert.equal(v.hasSecret, true);
  const r = await h.configureSso(o.session, tid, "gmail.com");
  assert.equal(r.error, "allowed_domain_not_verified", "a tenant cannot vouch for a domain it does not own");
  assert.equal((await h.configureSso(o.session, tid, "bigco.com.au", "short")).error, "invalid_sso_config");
  assert.equal((await h.configureSso(o.session, tid, "bigco.com.au", undefined, { defaultRole: "admin" })).error, "invalid_default_role");
  assert.equal((await h.configureSso(o.session, tid, "bigco.com.au", undefined, { issuer: "http://idp.mock.test" })).error, "invalid_sso_config");
});
test("sso: full flow signs in, creates the account just in time as the default role, never admin", async () => {
  const { h, cfg } = await ssoWorld();
  const r = await h.ssoLogin("bigco", cfg, "Staff@BigCo.com.au");
  assert.equal(r.res.status, 200);
  const me = await h.get(r.body.session, "/tenants");
  assert.equal(me.tenants[0].role, "viewer");
  assert.equal(me.tenants[0].slug, "bigco");
});
test("sso: the id token must be right on every claim (alg none, wrong secret, issuer, audience, expiry, iat, nonce, unverified email)", async () => {
  const { h, cfg } = await ssoWorld();
  const bad: [string, any][] = [
    ["alg none", { header: { alg: "none", typ: "JWT" } }], ["alg RS256 claimed", { header: { alg: "RS256" } }], ["wrong secret", { secret: "another_secret_0123456789ab" }],
    ["wrong issuer", { iss: "https://idp.evil.test" }], ["wrong audience", { aud: "someone-else" }], ["array audience", { aud: [cfg.clientId, "x"] }],
    ["expired", { exp: Math.floor(h.clock.t / 1000) - 5 }], ["future iat", { iat: Math.floor(h.clock.t / 1000) + 3600 }], ["email unverified", { verified: false }], ["verified as string", { verified: "true" }],
  ];
  for (const [name, tweak] of bad) {
    const r = await h.ssoLogin("bigco", cfg, "a@bigco.com.au", tweak);
    assert.equal(r.res.status, 401, name);
    assert.equal(r.body.session, undefined, name);
  }
  // nonce mismatch: token minted for a different nonce
  const st = await h.j(await h.req("POST", "/sso/bigco/start"));
  const tok = await h.idToken(cfg, { email: "a@bigco.com.au", nonce: "nn_other" });
  assert.equal((await h.req("POST", "/sso/callback", { body: { state: st.state, nonce: st.nonce, id_token: tok } })).status, 401);
  const tok2 = await h.idToken(cfg, { email: "a@bigco.com.au", nonce: st.nonce });
  assert.equal((await h.req("POST", "/sso/callback", { body: { state: "st_unknown", nonce: st.nonce, id_token: tok2 } })).status, 401);
});
test("sso: state is single use, expires, and the email domain must be an allowed one (lookalikes refused)", async () => {
  const { h, cfg } = await ssoWorld();
  const ok = await h.ssoLogin("bigco", cfg, "a@bigco.com.au");
  assert.equal(ok.res.status, 200);
  const replay = await h.req("POST", "/sso/callback", { body: { state: ok.st.state, nonce: ok.st.nonce, id_token: ok.id_token } });
  assert.equal(replay.status, 401, "replayed state");
  for (const email of ["a@evilbigco.com.au", "a@bigco.com.au.evil.net", "a@sub.bigco.com.au", "a@gmail.com"]) {
    const r = await h.ssoLogin("bigco", cfg, email);
    assert.equal(r.res.status, 403, email);
  }
  const st = await h.j(await h.req("POST", "/sso/bigco/start"));
  const tok = await h.idToken(cfg, { email: "a@bigco.com.au", nonce: st.nonce });
  h.clock.t += 11 * 60_000;
  assert.equal((await h.req("POST", "/sso/callback", { body: { state: st.state, nonce: st.nonce, id_token: tok } })).status, 401, "expired state");
});
test("sso: unknown slug and unconfigured tenant look the same; an open-state cap stops a flood", async () => {
  const h = await makeEnt();
  await h.provision("enterprise", "a@x.com.au", "X", "xcorp");
  assert.equal((await h.req("POST", "/sso/nope/start")).status, 404);
  assert.equal((await h.req("POST", "/sso/xcorp/start")).status, 404);
  const { h: h2 } = await ssoWorld();
  let last = 0;
  for (let i = 0; i < 205; i++) last = (await h2.req("POST", "/sso/bigco/start")).status;
  assert.equal(last, 429);
});
test("sso: enforcement needs a proven SSO login first, then locks out non-SSO sessions of that tenant", async () => {
  const { h, o, tid, cfg } = await ssoWorld();
  assert.equal((await h.j(await h.req("POST", `/enterprise/${tid}/sso/enforce`, { token: o.session, body: { enabled: true } }))).error, "sso_not_proven");
  // an admin signs in with SSO (give them admin via invite) then enforces
  const inv = await h.post(o.session, `/enterprise/${tid}/members`, { email: "sso.admin@bigco.com.au", role: "admin" });
  const s1 = await h.ssoLogin("bigco", cfg, "sso.admin@bigco.com.au");
  await h.post(s1.body.session, `/invites/${inv.id}/accept`);
  // magic-link session of the same admin cannot enforce (sign_in_with_sso_first)
  const ml = await h.login("sso.admin@bigco.com.au");
  assert.equal((await h.j(await h.req("POST", `/enterprise/${tid}/sso/enforce`, { token: ml.session, body: { enabled: true } }))).error, "sign_in_with_sso_first");
  assert.equal((await h.req("POST", `/enterprise/${tid}/sso/enforce`, { token: s1.body.session, body: { enabled: true } })).status, 200);
  // the original magic-link admin is now locked out of this tenant, the SSO session is not
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate`, { token: o.session })).status, 401);
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate`, { token: s1.body.session })).status, 200);
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate`, { token: ml.session })).status, 401);
  // changing the IdP resets enforcement
  await h.configureSso(s1.body.session, tid, "bigco.com.au", "another_secret_0123456789ab");
  assert.equal((await h.get(s1.body.session, `/enterprise/${tid}`)).ssoEnforced, false);
});
test("sso: SSO sessions last 8 hours, not 30 days", async () => {
  const { h, cfg } = await ssoWorld();
  const r = await h.ssoLogin("bigco", cfg, "a@bigco.com.au");
  assert.equal((await h.req("GET", "/me", { token: r.body.session })).status, 200);
  h.clock.t += 9 * 3_600_000;
  assert.equal((await h.req("GET", "/me", { token: r.body.session })).status, 401);
});

// ---------- partner: sub-portals, brand, consent ----------
async function partnerWorld() {
  const h = await makeEnt();
  const p = await h.provision("partner", "boss@msp.com.au", "Acme MSP", "acme-msp", { termsAccepted: true, payoutAccount: "acct_fixture_1" });
  const c = await h.login("owner@client.com.au");
  const portal = await h.post(p.session, `/partners/${p.tenant.id}/portals`, { name: "Client Pty", slug: "client-pty", clientAdminEmail: "owner@client.com.au", brand: { name: "Acme Secure", colour: "#112233", tagline: "Protected by Acme" } });
  const inv = (await h.get(c.session, "/invites")).invites[0];
  await h.post(c.session, `/invites/${inv.id}/accept`);
  return { h, p, c, portal };
}
test("partner: sub-portal is its own tenant, the partner sees metadata only until the client consents, and consent is revocable", async () => {
  const { h, p, c, portal } = await partnerWorld();
  const pid = p.tenant.id, cid = portal.id;
  await h.addVerifiedAsset(c.session, cid, "client.com.au", "Client HQ");
  assert.equal((await h.req("GET", `/enterprise/${cid}/estate`, { token: p.session })).status, 404, "partner is not a member of the client");
  assert.equal((await h.req("GET", `/partners/${pid}/portals/${cid}/estate`, { token: p.session })).status, 404, "no consent yet");
  const list = await h.get(p.session, `/partners/${pid}/portals`);
  assert.deepEqual(Object.keys(list.portals[0]).sort(), ["id", "name", "sharing", "slug"]);
  assert.equal((await h.post(c.session, `/enterprise/${cid}/partner-access`, { enabled: true })).partnerAccess, true);
  const est = await h.get(p.session, `/partners/${pid}/portals/${cid}/estate`);
  assert.equal(est.totals.assets, 1);
  await h.post(c.session, `/enterprise/${cid}/partner-access`, { enabled: false });
  assert.equal((await h.req("GET", `/partners/${pid}/portals/${cid}/estate`, { token: p.session })).status, 404);
});
test("partner: a sub-portal needs accepted partner terms; clients cannot create portals (single level)", async () => {
  const h = await makeEnt();
  const p = await h.provision("partner", "boss@msp.com.au", "No Terms MSP", "no-terms");
  const r = await h.j(await h.req("POST", `/partners/${p.tenant.id}/portals`, { token: p.session, body: { name: "C", slug: "ccc", clientAdminEmail: "c@c.com.au" } }));
  assert.equal(r.error, "partner_terms_not_accepted");
  const w = await partnerWorld();
  assert.equal((await w.h.req("POST", `/partners/${w.portal.id}/portals`, { token: w.c.session, body: { name: "Sub", slug: "subsub", clientAdminEmail: "z@z.com.au" } })).status, 404, "a client is not a partner");
});
test("partner: brand is validated (no HTML, hex colour only) and the public portal page serves the brand and nothing else", async () => {
  const { h, p, portal } = await partnerWorld();
  const pid = p.tenant.id;
  for (const brand of [{ name: "<script>", colour: "#000000", tagline: "" }, { name: "Ok", colour: "red", tagline: "" }, { name: "Ok", colour: "#12345", tagline: "" }, { name: "Ok", colour: "#123456", tagline: "x\"onload=" }, { name: "", colour: "#123456", tagline: "" }]) {
    assert.equal((await h.req("PUT", `/partners/${pid}/brand`, { token: p.session, body: brand })).status, 400, JSON.stringify(brand));
  }
  assert.equal((await h.req("PUT", `/partners/${pid}/brand`, { token: p.session, body: { name: "Acme Secure", colour: "#ABCDEF", tagline: "Hello" } })).status, 200);
  assert.equal((await h.req("GET", "/portal/client-pty")).status, 404, "a client brand is private until its partner publishes it");
  assert.equal((await h.req("POST", `/partners/${pid}/portals/${portal.id}/publish`, { token: p.session, body: { enabled: true } })).status, 200);
  const pubView = await h.j(await h.req("GET", "/portal/client-pty"));
  assert.deepEqual(Object.keys(pubView).sort(), ["brand", "slug", "sso", "whiteLabel"]);
  assert.equal(pubView.brand.name, "Acme Secure");
  assert.equal((await h.req("GET", "/portal/nonexistent")).status, 404);
  assert.ok(portal);
});

// ---------- revenue share ----------
async function paidWorld(rates?: any) {
  const w = await partnerWorld();
  if (rates) { (w.h.deps.ent as any).rates = rates; }
  const payInvoice = async (session: string, product: string, domain?: string) => {
    const c = await w.h.j(await w.h.req("POST", "/checkout", { token: session, body: { product, ...(domain ? { domain } : {}) } }));
    const { purchase } = await w.h.pay(product);
    return { purchase, c };
  };
  return { ...w, payInvoice };
}
test("share: a paid invoice by a sub-portal member earns the partner the rate, as a held ledger entry with the rate version", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  await payInvoice(c.session, "ai_growth");
  const led = await h.get(p.session, `/partners/${p.tenant.id}/ledger`);
  assert.equal(led.entries.length, 1);
  assert.equal(led.entries[0].amountCents, commissionCents(PRODUCTS.ai_growth.amountCents, 3000));
  assert.equal(led.entries[0].amountCents, 45_000, "30% of AU$1,500");
  assert.match(led.entries[0].rateVersion, /EXAMPLE/);
  assert.equal(led.availableCents, 0, "held for the refund window");
  assert.equal(led.entries[0].source, "Client Pty");
  h.clock.t += (HOLD_DAYS + 1) * DAY; p.session = (await h.login("boss@msp.com.au")).session;
  assert.equal((await h.get(p.session, `/partners/${p.tenant.id}/ledger`)).availableCents, 45_000);
});
test("share: replaying the same Stripe event does not pay twice; a paying stranger earns nothing", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  const { purchase } = await payInvoice(c.session, "ai_growth");
  const again = await h.webhook("checkout.session.completed", { id: purchase.checkoutId, payment_status: "paid", subscription: `sub_${purchase.id}` }, { id: "evt_dup" });
  const dup = await h.webhook("checkout.session.completed", { id: purchase.checkoutId, payment_status: "paid", subscription: `sub_${purchase.id}` }, { id: "evt_dup" });
  assert.ok(again.status === 200 && dup.status === 200);
  const stranger = await h.login("stranger@random.com.au");
  await h.req("POST", "/checkout", { token: stranger.session, body: { product: "leads_starter" } });
  await h.pay("leads_starter");
  const led = await h.get(p.session, `/partners/${p.tenant.id}/ledger`);
  assert.equal(led.entries.filter((e: any) => e.kind === "commission").length, 2, "one for the original, one for the duplicate-id different event on the same purchase is an extra invoice by design");
  assert.ok(led.entries.every((e: any) => e.source === "Client Pty"));
});
test("share: monthly renewals keep earning; cancel stops them; a refund claws the commission back in full", async () => {
  const { h, p, c, payInvoice } = await paidWorld();
  const { purchase } = await payInvoice(c.session, "ai_growth");
  await h.webhook("invoice.paid", { subscription: `sub_${purchase.id}`, billing_reason: "subscription_cycle", amount_paid: 150000 });
  let led = await h.get(p.session, `/partners/${p.tenant.id}/ledger`);
  assert.equal(led.entries.filter((e: any) => e.kind === "commission").length, 2);
  // compliance refund (auto) claws back
  await h.login("owner@client.com.au");
  const dom = await h.verifiedDomain(c.session, "client.com.au");
  assert.ok(dom.v.verified);
  const cp = await payInvoice(c.session, "compliance_pack", "client.com.au");
  const before = (await h.get(p.session, `/partners/${p.tenant.id}/ledger`)).entries.filter((e: any) => e.kind === "commission").length;
  const r = await h.j(await h.req("POST", "/refunds", { token: c.session, body: { purchaseId: cp.purchase.id } }));
  assert.equal(r.status, "refunded");
  led = await h.get(p.session, `/partners/${p.tenant.id}/ledger`);
  const comm = led.entries.find((e: any) => e.kind === "commission" && e.amountCents === Math.floor(PRODUCTS.compliance_pack.amountCents * 0.3));
  const claw = led.entries.find((e: any) => e.kind === "clawback");
  assert.ok(comm && claw);
  assert.equal(claw.amountCents, -comm.amountCents);
  assert.equal(before, 3);
  // replaying the refund request does not claw twice
  await h.req("POST", "/refunds", { token: c.session, body: { purchaseId: cp.purchase.id } });
  assert.equal((await h.get(p.session, `/partners/${p.tenant.id}/ledger`)).entries.filter((e: any) => e.kind === "clawback").length, 1);
});
test("share: a partner's own member earns nothing for the partner (no self-dealing); referral rules", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  // the partner admin is also made a member of the client portal, then buys: still no commission to their own partner
  const inv = await h.post(c.session, `/enterprise/${(await h.get(c.session, "/tenants")).tenants[0].id}/members`, { email: "boss@msp.com.au", role: "viewer" });
  await h.post(p.session, `/invites/${inv.id}/accept`);
  await h.req("POST", "/checkout", { token: p.session, body: { product: "leads_starter" } });
  await h.pay("leads_starter");
  assert.equal((await h.get(p.session, `/partners/${p.tenant.id}/ledger`)).entries.length, 0);
  // referral: code works once, not for the partner's own staff, not after a purchase
  const code = p.tenant.refCode;
  assert.match(code, /^pr_/);
  assert.equal((await h.req("POST", "/referrals/claim", { token: p.session, body: { code } })).status, 409, "self referral");
  const nu = await h.login("new.customer@shop.com.au");
  assert.equal((await h.req("POST", "/referrals/claim", { token: nu.session, body: { code: "pr_bogus" } })).status, 404);
  assert.equal((await h.req("POST", "/referrals/claim", { token: nu.session, body: { code } })).status, 200);
  assert.equal((await h.req("POST", "/referrals/claim", { token: nu.session, body: { code } })).status, 409, "already referred");
  await h.req("POST", "/checkout", { token: nu.session, body: { product: "leads_growth" } });
  await h.pay("leads_growth");
  const led = await h.get(p.session, `/partners/${p.tenant.id}/ledger`);
  assert.equal(led.entries.length, 1);
  assert.equal(led.entries[0].source, "Referral", "no email or name of the referred customer");
  assert.equal(JSON.stringify(led).includes("shop.com.au"), false);
  const late = await h.login("late@shop.com.au");
  await h.req("POST", "/checkout", { token: late.session, body: { product: "leads_starter" } });
  await h.pay("leads_starter");
  assert.equal((await h.req("POST", "/referrals/claim", { token: late.session, body: { code } })).status, 409, "referral after a purchase");
});
test("share (EntD1 backfill): a referred customer who later joins the partner's own staff earns the partner nothing (referral path self-dealing)", async () => {
  const { h, p } = await paidWorld();
  const nu = await h.login("later.staff@shop.com.au");
  assert.equal((await h.req("POST", "/referrals/claim", { token: nu.session, body: { code: p.tenant.refCode } })).status, 200);
  const inv = await h.post(p.session, `/enterprise/${p.tenant.id}/members`, { email: "later.staff@shop.com.au", role: "viewer" });
  assert.equal((await h.req("POST", `/invites/${inv.id}/accept`, { token: nu.session })).status, 200);
  await h.req("POST", "/checkout", { token: nu.session, body: { product: "leads_growth" } });
  await h.pay("leads_growth");
  assert.equal((await h.get(p.session, `/partners/${p.tenant.id}/ledger`)).entries.length, 0, "own staff never earn the partner a commission, even via an earlier referral");
});
test("share: tiers raise the rate for later invoices only, and the rate table is versioned on every entry", async () => {
  const rates = { version: "v2-test", baseBps: 3000, tiers: [{ minActive: 2, bps: 4000 }] };
  assert.deepEqual(rateFor(rates, 1), { bps: 3000, version: "v2-test" });
  assert.deepEqual(rateFor(rates, 2), { bps: 4000, version: "v2-test" });
  const { h, p } = await paidWorld(rates);
  for (const email of ["r1@a.com.au", "r2@a.com.au", "r3@a.com.au"]) {
    const u = await h.login(email);
    await h.req("POST", "/referrals/claim", { token: u.session, body: { code: p.tenant.refCode } });
    await h.req("POST", "/checkout", { token: u.session, body: { product: "leads_starter" } });
    await h.pay("leads_starter");
  }
  const led = (await h.get(p.session, `/partners/${p.tenant.id}/ledger`)).entries;
  assert.deepEqual(led.map((e: any) => e.rateBps), [3000, 3000, 4000]);
  assert.ok(led.every((e: any) => e.rateVersion === "v2-test"));
});
test("payout: only the available balance, only an admin, below the minimum refused, a small one pays at once", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  const pid = p.tenant.id;
  await payInvoice(c.session, "leads_starter");   // AU$497 -> AU$149.10
  assert.equal((await h.j(await h.req("POST", `/partners/${pid}/payouts`, { token: p.session }))).error, "below_minimum", "still held");
  h.clock.t += (HOLD_DAYS + 1) * DAY; p.session = (await h.login("boss@msp.com.au")).session;
  const pay = await h.j(await h.req("POST", `/partners/${pid}/payouts`, { token: p.session }));
  assert.equal(pay.status, "paid");
  assert.equal(pay.amountCents, Math.floor(PRODUCTS.leads_starter.amountCents * 0.3));
  assert.equal(h.payouts.sent.length, 1);
  assert.equal(h.payouts.sent[0].accountRef, "acct_fixture_1");
  assert.equal((await h.get(p.session, `/partners/${pid}/ledger`)).availableCents, 0);
  assert.equal((await h.j(await h.req("POST", `/partners/${pid}/payouts`, { token: p.session }))).error, "below_minimum");
});
test("payout: concurrent requests pay out once (no double spend)", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  await payInvoice(c.session, "leads_starter");
  h.clock.t += (HOLD_DAYS + 1) * DAY; p.session = (await h.login("boss@msp.com.au")).session;
  const rs = await Promise.all(Array.from({ length: 20 }, () => h.req("POST", `/partners/${p.tenant.id}/payouts`, { token: p.session })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(h.payouts.sent.length, 1);
});
test("payout: a provider failure reverses the reservation so the money is not lost", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  await payInvoice(c.session, "leads_starter");
  h.clock.t += (HOLD_DAYS + 1) * DAY; p.session = (await h.login("boss@msp.com.au")).session;
  h.payouts.fail = true;
  const r = await h.j(await h.req("POST", `/partners/${p.tenant.id}/payouts`, { token: p.session }));
  assert.equal(r.status, "failed");
  assert.equal((await h.get(p.session, `/partners/${p.tenant.id}/ledger`)).availableCents, Math.floor(PRODUCTS.leads_starter.amountCents * 0.3));
});
test("payout: above the threshold waits for Kyle (GATE1); approve pays once; reject returns the balance; needs the operator secret", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  const pid = p.tenant.id;
  // four AU$5,000 retainers' worth of commission pushes the balance over the threshold
  for (let i = 0; i < 3; i++) await payInvoice(c.session, "ai_embedded");   // 3 x AU$1,500 = AU$4,500
  h.clock.t += (HOLD_DAYS + 1) * DAY; p.session = (await h.login("boss@msp.com.au")).session;
  const bal = (await h.get(p.session, `/partners/${pid}/ledger`)).availableCents;
  assert.ok(bal > APPROVAL_ABOVE_CENTS);
  const r = await h.j(await h.req("POST", `/partners/${pid}/payouts`, { token: p.session }));
  assert.equal(r.status, "pending_approval");
  assert.equal(h.payouts.sent.length, 0, "nothing moves without the tap");
  assert.equal((await h.ireq(`/internal/payouts/${r.id}/approve`, {}, null)).status, 404);
  assert.equal((await h.get(p.session, `/partners/${pid}/ledger`)).availableCents, 0, "reserved");
  assert.equal((await h.j(await h.ireq(`/internal/payouts/${r.id}/approve`, {}))).status, "paid");
  assert.equal((await h.j(await h.ireq(`/internal/payouts/${r.id}/approve`, {}))).error, "not_pending", "second approve is a no-op");
  assert.equal(h.payouts.sent.length, 1);
  // reject path
  c.session = (await h.login("owner@client.com.au")).session;
  for (let i = 0; i < 3; i++) await payInvoice(c.session, "ai_embedded");
  h.clock.t += (HOLD_DAYS + 1) * DAY; p.session = (await h.login("boss@msp.com.au")).session;
  const r2 = await h.j(await h.req("POST", `/partners/${pid}/payouts`, { token: p.session }));
  assert.equal(r2.status, "pending_approval");
  assert.equal((await h.j(await h.ireq(`/internal/payouts/${r2.id}/reject`, {}))).status, "rejected");
  assert.ok((await h.get(p.session, `/partners/${pid}/ledger`)).availableCents > 0, "balance restored");
});
test("payout: needs accepted terms and a payout account set by the operator; statements say they are not tax invoices", async () => {
  const h = await makeEnt();
  const p = await h.provision("partner", "boss@msp.com.au", "NoAcct MSP", "noacct", { termsAccepted: true });
  assert.equal((await h.j(await h.req("POST", `/partners/${p.tenant.id}/payouts`, { token: p.session }))).error, "payout_account_missing");
  const st = await (await h.req("GET", `/partners/${p.tenant.id}/statement?month=2026-11`, { token: p.session })).text();
  assert.match(st, /NOT a tax invoice/);
  assert.equal((await h.req("GET", `/partners/${p.tenant.id}/statement?month=2026-13`, { token: p.session })).status, 400);
});
test("share: a commission failure is recorded for the operator and does not break the invoice", async () => {
  const { h, c } = await paidWorld();
  (h.deps.ent as any).store.addLedger = async () => { throw new Error("db_down"); };
  await h.req("POST", "/checkout", { token: c.session, body: { product: "leads_starter" } });
  const { res } = await h.pay("leads_starter");
  assert.equal(res.status, 200);
  assert.equal((await h.get(c.session, "/invoices")).invoices.length, 1);
  assert.equal((await (h.deps.ent as any).store.failures()).length, 1);
});

// ---------- account lifecycle ----------
test("account deletion drops memberships and the referral; export lists the tenants; the last admin cannot delete themselves", async () => {
  const { h, c, portal } = await paidWorld();
  const exp = await h.get(c.session, "/account/export");
  assert.equal(exp.enterprise.tenants[0].tenant, "Client Pty");
  assert.equal((await h.j(await h.req("DELETE", "/account", { token: c.session, body: { confirm: "DELETE" } }))).error, "last_admin_of_tenant");
  const inv = await h.post(c.session, `/enterprise/${portal.id}/members`, { email: "staff@client.com.au", role: "viewer" });
  const st = await h.login("staff@client.com.au");
  await h.post(st.session, `/invites/${inv.id}/accept`);
  assert.equal((await h.req("DELETE", "/account", { token: st.session, body: { confirm: "DELETE" } })).status, 200);
  assert.equal((await (h.deps.ent as any).store.membersOf(portal.id)).length, 1);
});

// ---------- savings calculator ----------
test("savings: arithmetic on the visitor's own inputs, labelled MODELLED, rejects out-of-range inputs", async () => {
  const h = await makeEnt();
  const ok = await h.j(await h.req("POST", "/savings", { body: { manualHoursPerWeek: 20, hourlyRateAud: 80, automatedSharePct: 50, incidentsPerYear: 2, avgIncidentCostAud: 10000, incidentReductionPct: 25 } }));
  assert.equal(ok.hoursGivenBackPerYear, 520);
  assert.equal(ok.labourValueAud, 41_600);
  assert.equal(ok.incidentCostAvoidedAud, 5000);
  assert.match(ok.label, /MODELLED/);
  assert.equal((await h.req("POST", "/savings", { body: { manualHoursPerWeek: -1 } })).status, 400);
  assert.equal((await h.req("POST", "/savings", { body: { manualHoursPerWeek: 20, hourlyRateAud: 80, automatedSharePct: 150, incidentsPerYear: 2, avgIncidentCostAud: 1, incidentReductionPct: 1 } })).status, 400);
});

// ---------- hygiene ----------
test("hygiene: no em or en dashes in the enterprise source; no secrets echoed by any response in the happy paths", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  for (const f of readdirSync(new URL("../src/enterprise/", import.meta.url))) {
    const t = readFileSync(new URL("../src/enterprise/" + f, import.meta.url), "utf8");
    assert.equal(/[\u2013\u2014]/.test(t), false, f);
  }
});

// ---------- regressions from the security-adversary pass (each was DEMONSTRATED before the fix) ----------
test("F1: SSO trust cannot outlive the domain proof (asset removed, then verified by another tenant)", async () => {
  const { h, o, tid, cfg } = await ssoWorld();
  const assetId = (await h.get(o.session, `/enterprise/${tid}/assets`)).assets[0].id;
  await h.req("DELETE", `/enterprise/${tid}/assets/${assetId}`, { token: o.session });
  assert.deepEqual((await h.get(o.session, `/enterprise/${tid}/sso`)).allowedDomains, [], "the domain left the SSO allow-list with the asset");
  const victim = await h.login("ceo@bigco.com.au");
  const rival = await h.provision("enterprise", "r@rival.com.au", "Rival", "rival");
  await h.addVerifiedAsset(rival.session, rival.tenant.id, "bigco.com.au");
  const r = await h.ssoLogin("bigco", cfg, "ceo@bigco.com.au");
  assert.equal(r.res.status, 403);
  assert.equal((await h.req("GET", "/me", { token: victim.session })).status, 200);
});
test("F1b: even with a stale allow-list entry, a login needs a currently verified asset for the email domain", async () => {
  const { h, tid, cfg } = await ssoWorld();
  const st = (h.deps.ent as any).store;
  for (const a of await st.assetsOf(tid)) await st.putAsset({ ...a, verifiedAt: undefined });   // proof lost behind the service's back
  assert.equal((await h.ssoLogin("bigco", cfg, "a@bigco.com.au")).res.status, 403);
});
test("F2: a removed or demoted admin's pending invites die with them; invites can be revoked; an invite from a no-longer-admin inviter is refused", async () => {
  const h = await makeEnt();
  const boss = await h.provision("enterprise", "boss@bigco.com.au", "BigCo", "bigco");
  const tid = boss.tenant.id;
  const evilInv = await h.post(boss.session, `/enterprise/${tid}/members`, { email: "evil@bigco.com.au", role: "admin" });
  const evil = await h.login("evil@bigco.com.au");
  await h.post(evil.session, `/invites/${evilInv.id}/accept`);
  const sock = await h.post(evil.session, `/enterprise/${tid}/members`, { email: "sock@bigco.com.au", role: "admin" });
  const evilId = (await h.get(evil.session, "/me")).id;
  await h.req("DELETE", `/enterprise/${tid}/members/${evilId}`, { token: boss.session });
  const s = await h.login("sock@bigco.com.au");
  assert.equal((await h.req("POST", `/invites/${sock.id}/accept`, { token: s.session })).status, 404, "backdoor invite died with its author");
  // revoke
  const inv = await h.post(boss.session, `/enterprise/${tid}/members`, { email: "later@bigco.com.au", role: "viewer" });
  assert.equal((await h.req("DELETE", `/enterprise/${tid}/invites/${inv.id}`, { token: boss.session })).status, 200);
  const l = await h.login("later@bigco.com.au");
  assert.equal((await h.req("POST", `/invites/${inv.id}/accept`, { token: l.session })).status, 404);
  assert.equal((await h.req("DELETE", `/enterprise/ten_00000000000000ff/invites/${inv.id}`, { token: boss.session })).status, 404);
});
test("F2b: a second admin's invite stops working if that admin is demoted before it is accepted", async () => {
  const h = await makeEnt();
  const boss = await h.provision("enterprise", "boss@bigco.com.au", "BigCo", "bigco");
  const tid = boss.tenant.id;
  const i1 = await h.post(boss.session, `/enterprise/${tid}/members`, { email: "two@bigco.com.au", role: "admin" });
  const two = await h.login("two@bigco.com.au");
  await h.post(two.session, `/invites/${i1.id}/accept`);
  const twoId = (await h.get(two.session, "/me")).id;
  const pend = await h.post(two.session, `/enterprise/${tid}/members`, { email: "p@bigco.com.au", role: "analyst" });
  await h.req("PATCH", `/enterprise/${tid}/members/${twoId}`, { token: boss.session, body: { role: "viewer" } });
  const p = await h.login("p@bigco.com.au");
  assert.equal((await h.req("POST", `/invites/${pend.id}/accept`, { token: p.session })).status, 404);
});
test("F3: concurrent approve and reject: exactly one wins, no payment-and-restore, a double approve sends once", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  const pid = p.tenant.id;
  for (let i = 0; i < 3; i++) await payInvoice(c.session, "ai_embedded");
  h.clock.t += (HOLD_DAYS + 1) * DAY; p.session = (await h.login("boss@msp.com.au")).session;
  const r = await h.j(await h.req("POST", `/partners/${pid}/payouts`, { token: p.session }));
  const [a, b] = await Promise.all([h.ireq(`/internal/payouts/${r.id}/approve`, {}), h.ireq(`/internal/payouts/${r.id}/reject`, {})]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const final = (await h.get(p.session, `/partners/${pid}/payouts`)).payouts[0].status;
  const bal = (await h.get(p.session, `/partners/${pid}/ledger`)).availableCents;
  if (final === "paid") { assert.equal(h.payouts.sent.length, 1); assert.equal(bal, 0, "paid means the balance stays spent"); }
  else { assert.equal(final, "rejected"); assert.equal(h.payouts.sent.length, 0); assert.ok(bal > 0); }
  const r2 = await h.j(await h.req("POST", `/partners/${pid}/payouts`, { token: p.session }));
  if (r2.id) { await Promise.all([h.ireq(`/internal/payouts/${r2.id}/approve`, {}), h.ireq(`/internal/payouts/${r2.id}/approve`, {})]); }
});
test("F3b: a small payout is 'sending' until the provider answers, never 'paid' before", async () => {
  const { h, p, payInvoice, c } = await paidWorld();
  await payInvoice(c.session, "leads_starter");
  h.clock.t += (HOLD_DAYS + 1) * DAY; p.session = (await h.login("boss@msp.com.au")).session;
  let seenStatus = "";
  const orig = h.payouts.transfer.bind(h.payouts);
  h.payouts.transfer = async (x: any) => { seenStatus = ((await (h.deps.ent as any).store.payoutById(x.idempotencyKey)) as any).status; return orig(x); };
  const r = await h.j(await h.req("POST", `/partners/${p.tenant.id}/payouts`, { token: p.session }));
  assert.equal(seenStatus, "sending");
  assert.equal(r.status, "paid");
});
test("F4: one client cannot exhaust the SSO start budget for everyone; expired states are purged; the operator can release an enforced tenant", async () => {
  const { h, o, tid, cfg } = await ssoWorld();
  const start = (ip: string) => h.deps && (async () => (await (await import("../src/index.ts")).handle(new Request("https://api.test/sso/bigco/start", { method: "POST", headers: { "cf-connecting-ip": ip } }), {}, h.deps)).status)();
  let last = 0;
  for (let i = 0; i < 25; i++) last = await start("203.0.113.9");
  assert.equal(last, 429, "the noisy client is capped");
  assert.equal(await start("198.51.100.4"), 200, "everyone else still gets in");
  h.clock.t += 11 * 60_000;
  assert.equal(await start("203.0.113.9"), 200, "expired states no longer count");
  assert.ok((await (h.deps.ent as any).store.openSsoStates(tid, h.clock.t)) <= 2, "expired states were purged");
  // break-glass
  const inv = await h.post(o.session, `/enterprise/${tid}/members`, { email: "root@bigco.com.au", role: "admin" });
  const s1 = await h.ssoLogin("bigco", cfg, "root@bigco.com.au");
  await h.post(s1.body.session, `/invites/${inv.id}/accept`);
  await h.req("POST", `/enterprise/${tid}/sso/enforce`, { token: s1.body.session, body: { enabled: true } });
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate`, { token: o.session })).status, 401);
  assert.equal((await h.ireq(`/internal/tenants/${tid}/sso-enforce`, { enabled: false }, null)).status, 404);
  assert.equal((await h.ireq(`/internal/tenants/${tid}/sso-enforce`, { enabled: false })).status, 200);
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate`, { token: o.session })).status, 200);
});
test("F6: pending invites per tenant are capped", async () => {
  const h = await makeEnt();
  const o = await h.provision("enterprise", "boss@bigco.com.au", "BigCo", "bigco");
  let last = 0;
  for (let i = 0; i < 101; i++) last = (await h.req("POST", `/enterprise/${o.tenant.id}/members`, { token: o.session, body: { email: `u${i}@x.com.au`, role: "viewer" } })).status;
  assert.equal(last, 429);
});
test("attribution does not move when an unrelated role changes (earliest join wins)", async () => {
  const w = await partnerWorld();
  const { h, p } = w;
  h.clock.t += 1000; // joins are ordered by time; same-instant joins fall back to the tenant id
  const second = await h.post(p.session, `/partners/${p.tenant.id}/portals`, { name: "Second Pty", slug: "second-pty", clientAdminEmail: "owner@client.com.au" });
  const inv = (await h.get(w.c.session, "/invites")).invites[0];
  await h.post(w.c.session, `/invites/${inv.id}/accept`);
  const share = await import("../src/enterprise/share.ts");
  const first = await share.attribute((h.deps.ent as any).store, (await h.get(w.c.session, "/me")).id);
  assert.equal(first!.sourceLabel, "Client Pty");
  const accId = (await h.get(w.c.session, "/me")).id;
  await h.req("PATCH", `/enterprise/${w.portal.id}/members/${accId}`, { token: w.c.session, body: { role: "admin" } });
  const again = await share.attribute((h.deps.ent as any).store, accId);
  assert.equal(again!.sourceLabel, "Client Pty");
  assert.ok(second);
});
