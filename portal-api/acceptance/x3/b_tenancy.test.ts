// x3 B: IDOR across accounts and seats (C2, owner, market, agent) and tenant/SSO/partner escapes (C8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fullRig, blocked, finding } from "./lib.ts";
import { makeEnt, SSO_CFG } from "../../test/ent_harness.ts";

const j = async (r: Response) => (await r.json()) as any;
const CAN = "canary-a-x3";

test("B-01 BLOCKED: account B cannot read or change any of account A's domain, owner state, purchase, subscription, invoice, key, job", async () => {
  const r = fullRig(); const { h } = r;
  const A = await r.owner(`${CAN}@x3.test`, "canary-a-estate.com.au");
  const B = await r.owner("attacker-b@x3.test", "b-own-estate.com.au");
  const P1 = await r.pro("pro1@x3.test"), P2 = await r.pro("pro2@x3.test");
  await h.req("POST", "/checkout", { token: A.session, body: { product: "monitor_monthly", domain: A.domain } });
  await h.pay("monitor_monthly");
  await h.req("POST", "/checkout", { token: A.session, body: { product: "leads_starter" } });
  await h.pay("leads_starter");
  const purchase = [...h.store.purchases.values()].find((p) => p.productId === "leads_starter")!;
  const sub = [...h.store.subs.values()][0]; const inv = [...h.store.invoices.values()][0];
  const key = await j(await h.req("POST", "/keys", { token: A.session, body: { scopes: ["scan:read"] } }));
  const job = (await r.hire(A)).job; await r.claim(P1.session, job.id);
  const before = JSON.stringify({ purchases: [...h.store.purchases.values()], subs: [...h.store.subs.values()], keys: [...h.store.keys.values()], jobs: await r.store.allJobs() });

  const attacks: [string, string, string, unknown?][] = [
    ["GET", `/app/domains/${A.domainId}`, B.session], ["POST", `/app/domains/${A.domainId}/scan`, B.session], ["POST", `/app/domains/${A.domainId}/fix`, B.session, { check: "SPF" }],
    ["POST", `/app/domains/${A.domainId}/fixes/fix_1/undo`, B.session], ["GET", `/app/domains/${A.domainId}/report?format=md`, B.session],
    ["POST", `/domains/${A.domainId}/verify`, B.session], ["GET", `/invoices/${inv.id}`, B.session], ["POST", `/subscriptions/${sub.id}/cancel`, B.session],
    ["POST", "/refunds", B.session, { purchaseId: purchase.id }], ["DELETE", `/keys/${key.id}`, B.session],
    ["POST", "/market/jobs", B.session, { domainId: A.domainId, check: "SPF" }], ["POST", `/market/jobs/${job.id}/cancel`, B.session], ["POST", `/market/jobs/${job.id}/dispute`, B.session, { reason: "stealing this" }],
    ["POST", `/market/jobs/${job.id}/rescan`, B.session], ["POST", `/pro/jobs/${job.id}/deliver`, P2.session, { note: "not mine to deliver" }], ["POST", `/market/jobs/${job.id}/rescan`, P2.session],
    ["POST", `/market/jobs/${job.id}/dispute`, P2.session, { reason: "not my job either" }], ["POST", `/pro/jobs/${job.id}/claim`, B.session],
  ];
  for (const [m, p, tok, body] of attacks) {
    const res = await h.req(m, p, { token: tok, body }); const t = await res.text();
    assert.ok(res.status >= 400, `${m} ${p} -> ${res.status} ${t.slice(0, 80)}`);
    assert.ok(!t.includes(CAN) && !t.includes("canary-a-estate"), `${m} ${p} leaked a canary`);
  }
  // owner-seat routes need the owner's own verified domain; a non-pro cannot use pro routes and vice versa
  assert.equal((await h.req("GET", "/pro/board", { token: B.session })).status, 403);
  assert.equal((await h.req("GET", "/pro/payouts", { token: A.session })).status, 403);
  // read surfaces: B's own lists/exports/boards never contain A's canaries
  for (const p of ["/billing", "/invoices", "/domains", "/keys", "/account/export", "/market/jobs", "/agent/credits", "/app/domains", "/market/leaderboard"]) {
    const t = await (await h.req("GET", p, { token: B.session })).text(); assert.ok(!t.includes(CAN) && !t.includes("canary-a-estate"), `GET ${p}`);
  }
  const board = await (await h.req("GET", "/pro/board", { token: P2.session })).text();
  assert.ok(!board.includes("canary-a-estate"), "board masks the domain before claim");
  const after = JSON.stringify({ purchases: [...h.store.purchases.values()], subs: [...h.store.subs.values()], keys: [...h.store.keys.values()], jobs: await r.store.allJobs() });
  assert.equal(after, before, "no state changed by any of the attacks");
  blocked("B-01", `${attacks.length} cross-account attacks, 9 read surfaces, 0 state changes`);
});

async function entWorld() {
  const h = makeEnt();
  const A = await h.provision("enterprise", "admin@enta.com.au", "EntA", "ent-a"), Bt = await h.provision("enterprise", "admin@entb.com.au", "EntB", "ent-b");
  for (const [t, d] of [[A, "enta.com.au"], [Bt, "entb.com.au"]] as const) await h.addVerifiedAsset(t.session, t.tenant.id, d);
  const cfgA = await h.configureSso(A.session, A.tenant.id, "enta.com.au", "A_SECRET_0123456789abcdef"), cfgB = await h.configureSso(Bt.session, Bt.tenant.id, "entb.com.au", "B_SECRET_0123456789abcdef");
  return { h, A, B: Bt, cfgA: SSO_CFG(cfgA.clientId, "A_SECRET_0123456789abcdef"), cfgB: SSO_CFG(cfgB.clientId, "B_SECRET_0123456789abcdef") };
}

test("B-02 BLOCKED: SSO cannot cross tenants, replay, downgrade, or mint admins", async () => {
  const { h, A, B, cfgA } = await entWorld();
  // tenant A's IdP (A's admin holds the secret) vouches for an address at tenant B's domain, and for an unverified domain
  assert.equal((await h.ssoLogin("ent-a", cfgA, "ceo@entb.com.au")).res.status, 403);
  assert.equal((await h.ssoLogin("ent-a", cfgA, "x@elsewhere.com.au")).res.status, 403);
  // state replay, alg none, wrong secret, expired, unverified email, aud/iss swaps, nonce mismatch
  const good = await h.ssoLogin("ent-a", cfgA, "ok@enta.com.au"); assert.equal(good.res.status, 200);
  const replay = await h.req("POST", "/sso/callback", { body: { state: good.st.state, nonce: good.st.nonce, id_token: good.id_token } }); assert.equal(replay.status, 401);
  for (const [name, tweak] of [["alg none", { header: { alg: "none", typ: "JWT" } }], ["RS256 header", { header: { alg: "RS256" } }], ["wrong secret", { secret: "WRONG_0123456789abcdef" }], ["expired", { exp: Math.floor(h.clock.t / 1000) - 5 }], ["unverified", { verified: false }], ["aud array", { aud: ["x", cfgA.clientId] }], ["iss swap", { iss: "https://evil.test" }], ["future iat", { iat: Math.floor(h.clock.t / 1000) + 3600 }]] as const) {
    const r = await h.ssoLogin("ent-a", cfgA, "ok2@enta.com.au", tweak as any); assert.equal(r.res.status, 401, name);
  }
  const st = await j(await h.req("POST", "/sso/ent-a/start")); const tok = await h.idToken(cfgA, { email: "n@enta.com.au", nonce: "other-nonce" });
  assert.equal((await h.req("POST", "/sso/callback", { body: { state: st.state, nonce: st.nonce, id_token: tok } })).status, 401, "nonce mismatch");
  // tenant B's state with tenant A's token and vice versa
  const stB = await j(await h.req("POST", "/sso/ent-b/start")); const tokA = await h.idToken(cfgA, { email: "n@enta.com.au", nonce: stB.nonce });
  assert.equal((await h.req("POST", "/sso/callback", { body: { state: stB.state, nonce: stB.nonce, id_token: tokA } })).status, 401);
  // an IdP can never mint admins: defaultRole admin refused, JIT member is viewer; the JIT user cannot reach tenant B
  assert.equal((await h.req("PUT", `/enterprise/${A.tenant.id}/sso`, { token: A.session, body: { issuer: "https://idp.mock.test", clientId: "client-xx", secret: "s".repeat(20), allowedDomains: ["enta.com.au"], defaultRole: "admin" } })).status, 400);
  assert.equal((await h.req("GET", `/enterprise/${B.tenant.id}`, { token: good.body.session })).status, 404);
  assert.equal((await h.req("POST", `/enterprise/${A.tenant.id}/members`, { token: good.body.session, body: { email: "z@enta.com.au", role: "admin" } })).status, 403);
  // secrets never come back
  const t = await (await h.req("GET", `/enterprise/${A.tenant.id}/sso`, { token: A.session })).text(); assert.ok(!t.includes("A_SECRET"));
  assert.ok(!(await (await h.req("GET", `/enterprise/${A.tenant.id}/audit`, { token: A.session })).text()).includes("A_SECRET"));
  blocked("B-02", "SSO cross-tenant, replay, alg, nonce, admin mint");
});

test("B-03 BLOCKED: partner reads only consented children; another partner, the client's own enterprise peers and non-members get 404; invites cannot be hijacked", async () => {
  const h = makeEnt();
  const P = await h.provision("partner", "boss@p1.com.au", "P1", "p-one", { termsAccepted: true, payoutAccount: "acct_p1" });
  const Q = await h.provision("partner", "boss@p2.com.au", "P2", "p-two", { termsAccepted: true, payoutAccount: "acct_p2" });
  const mk = await j(await h.req("POST", `/partners/${P.tenant.id}/portals`, { token: P.session, body: { name: "Client Co", slug: "client-co", clientAdminEmail: "cadmin@clientco.com.au" } }));
  assert.ok(mk.id);
  // invitee mismatch: another account cannot accept it, even knowing the id
  const evil = await h.login("evil@x3.test"); const cad = await h.login("cadmin@clientco.com.au");
  const inv = (await h.get(cad.session, "/invites")).invites[0];
  assert.equal((await h.req("POST", `/invites/${inv.id}/accept`, { token: evil.session })).status, 404);
  assert.equal((await h.req("POST", `/invites/${inv.id}/accept`, { token: cad.session })).status, 200);
  await h.addVerifiedAsset(cad.session, mk.id, "clientco.com.au");
  // no consent: partner P and partner Q both get 404; the partner cannot use the client's own routes
  for (const t of [P, Q]) assert.equal((await h.req("GET", `/partners/${t.tenant.id}/portals/${mk.id}/estate`, { token: t.session })).status, 404);
  assert.equal((await h.req("GET", `/partners/${Q.tenant.id}/portals/${mk.id}/estate`, { token: Q.session })).status, 404);
  assert.equal((await h.req("GET", `/enterprise/${mk.id}/assets`, { token: P.session })).status, 404, "partner is not a member of the client tenant");
  assert.equal((await h.req("POST", `/enterprise/${mk.id}/partner-access`, { token: P.session, body: { enabled: true } })).status, 404, "partner cannot grant itself consent");
  assert.equal((await h.req("POST", `/enterprise/${mk.id}/partner-access`, { token: cad.session, body: { enabled: true } })).status, 200);
  assert.equal((await h.req("GET", `/partners/${P.tenant.id}/portals/${mk.id}/estate`, { token: P.session })).status, 200);
  assert.equal((await h.req("GET", `/partners/${Q.tenant.id}/portals/${mk.id}/estate`, { token: Q.session })).status, 404, "other partner still nothing");
  assert.equal((await h.req("POST", `/partners/${Q.tenant.id}/portals/${mk.id}/publish`, { token: Q.session, body: { enabled: true } })).status, 404);
  await h.req("POST", `/enterprise/${mk.id}/partner-access`, { token: cad.session, body: { enabled: false } });
  assert.equal((await h.req("GET", `/partners/${P.tenant.id}/portals/${mk.id}/estate`, { token: P.session })).status, 404, "consent withdrawn");
  blocked("B-03", "partner consent and cross-partner");
});

test("B-04 FINDING F16 [P3]: a partner reads a client's estate with a plain session even when the CLIENT enforces SSO", async () => {
  const h = makeEnt();
  const P = await h.provision("partner", "boss@p3.com.au", "P3", "p-three", { termsAccepted: true, payoutAccount: "acct_p3" });
  const mk = await j(await h.req("POST", `/partners/${P.tenant.id}/portals`, { token: P.session, body: { name: "Locked Co", slug: "locked-co", clientAdminEmail: "cadmin@lockedco.com.au" } }));
  const cad = await h.login("cadmin@lockedco.com.au"); await h.req("POST", `/invites/${(await h.get(cad.session, "/invites")).invites[0].id}/accept`, { token: cad.session });
  await h.addVerifiedAsset(cad.session, mk.id, "lockedco.com.au");
  const cfgView = await h.configureSso(cad.session, mk.id, "lockedco.com.au"); const cfg = SSO_CFG(cfgView.clientId);
  const sso = await h.ssoLogin("locked-co", cfg, "cadmin@lockedco.com.au"); assert.equal(sso.res.status, 200);
  const S = sso.body.session as string;
  assert.equal((await h.req("POST", `/enterprise/${mk.id}/sso/enforce`, { token: S, body: { enabled: true } })).status, 200);
  await h.req("POST", `/enterprise/${mk.id}/partner-access`, { token: S, body: { enabled: true } });
  assert.equal((await h.req("GET", `/enterprise/${mk.id}`, { token: cad.session })).status, 401, "the client's own admin is held to SSO");
  const viaPartner = await h.req("GET", `/partners/${P.tenant.id}/portals/${mk.id}/estate`, { token: P.session });
  assert.equal(viaPartner.status, 200);
  finding("F16", "P3", "portalEstate() never consults the child tenant's ssoEnforced", "client SSO enforced: client admin plain session => 401; partner plain session => 200 estate");
});

test("B-05 FINDING F17 [P3]: SSO issuer is any https host (internal addresses included) and the public /sso/:slug/start hands the redirect to every visitor", async () => {
  const { h, A } = await entWorld();
  for (const iss of ["https://169.254.169.254", "https://localhost", "https://10.0.0.5/metadata", "https://login.evil-phish.example"]) {
    const put = await h.req("PUT", `/enterprise/${A.tenant.id}/sso`, { token: A.session, body: { issuer: iss, clientId: "client-abc", secret: "s".repeat(20), allowedDomains: ["enta.com.au"] } });
    assert.equal(put.status, 200, iss);
  }
  const start = await j(await h.req("POST", "/sso/ent-a/start"));
  assert.match(start.authorizeUrl, /^https:\/\/login\.evil-phish\.example\/authorize\?/);
  finding("F17", "P3", "putSso issuer regex accepts private/loopback/link-local hosts and any look-alike host; start is unauthenticated", `authorizeUrl=${start.authorizeUrl.slice(0, 60)}...; latent SSRF the day the RS256/JWKS verifier fetches the issuer`);
});

test("B-06 BLOCKED: RBAC inside a tenant (viewer/analyst cannot administer, CSV needs analyst, last admin cannot be removed, formulas are neutralised)", async () => {
  const { h, A } = await entWorld();
  const tid = A.tenant.id;
  for (const [email, role] of [["v@enta.com.au", "viewer"], ["an@enta.com.au", "analyst"]]) {
    await h.post(A.session, `/enterprise/${tid}/members`, { email, role }); const u = await h.login(email);
    await h.post(u.session, `/invites/${(await h.get(u.session, "/invites")).invites[0].id}/accept`);
    (A as any)[role] = u;
  }
  const V = (A as any).viewer.session, AN = (A as any).analyst.session;
  for (const [m, p, b] of [["POST", `/enterprise/${tid}/assets`, { domain: "evil.com.au" }], ["POST", `/enterprise/${tid}/members`, { email: "q@enta.com.au", role: "admin" }], ["GET", `/enterprise/${tid}/members`], ["GET", `/enterprise/${tid}/audit`], ["PUT", `/enterprise/${tid}/sso`, {}], ["GET", `/enterprise/${tid}/sso`], ["POST", `/enterprise/${tid}/sso/enforce`, { enabled: false }]] as const) {
    for (const s of [V, AN]) assert.equal((await h.req(m, p, { token: s, body: b })).status, 403, `${m} ${p}`);
  }
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate.csv`, { token: V })).status, 403);
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate.csv`, { token: AN })).status, 200);
  assert.equal((await h.req("GET", `/enterprise/${tid}/estate`, { token: V })).status, 200);
  const me = (await h.get(A.session, "/me")).id;
  assert.equal((await h.req("DELETE", `/enterprise/${tid}/members/${me}`, { token: A.session })).status, 409, "last admin");
  assert.equal((await h.req("PATCH", `/enterprise/${tid}/members/${me}`, { token: A.session, body: { role: "viewer" } })).status, 409);
  const lab = await h.post(A.session, `/enterprise/${tid}/assets`, { domain: "sheet.enta.com.au", label: "=1+1|cmd" });
  const lab2 = await h.post(A.session, `/enterprise/${tid}/assets`, { domain: "sheet2.enta.com.au", label: "@SUM(1+1)" });
  assert.ok(lab.id && lab2.id);
  const csv = await (await h.req("GET", `/enterprise/${tid}/estate.csv`, { token: A.session })).text();
  assert.ok(csv.includes("'=1+1|cmd") && csv.includes("'@SUM(1+1)"), csv);
  assert.ok(!csv.split("\n").some((l) => l.split(",").some((c) => /^[=@+]/.test(c))), "no cell starts with a formula character");
  blocked("B-06", "RBAC, last admin, csv formula");
});
