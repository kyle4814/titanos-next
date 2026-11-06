// C8 kill test (plan ch.6 line 1495): 0 cross-tenant reads, adversarial. SYNTHETIC DATA ONLY, in-memory adapters, nothing live.
//
// What it does:
//   1. ROUTE TABLE: every route in portal-api/src/index.ts and portal-api/src/enterprise/routes.ts is declared in ROUTES below.
//      A mechanical drift check greps both sources: every `m === "VERB"` source line must be claimed by a table entry and
//      every table entry must still be found in the source. A new route nobody declared FAILS the matrix.
//   2. WORLD: six synthetic tenants (enterprise A and B, partner PA and PB, client sub-portals CA under PA and CB under PB),
//      each seeded with CANARY strings, a key, a domain, a purchase, a subscription, an invoice, a market job and an owner fix.
//   3. ATTACK: each tenant admin fires every route at every other tenant's ids (all-foreign and one-foreign-position-at-a-time),
//      with six credential vectors (own session, the victim's API key, the victim's other tokens, an unscoped key, an operator
//      header carrying a session/key, anonymous), poisoned bodies, a forged-OIDC battery and an MCP key battery.
//   4. ASSERT: 0 canary in any response body, 0 foreign 2xx on a scoped route, 0 changes to any row that mentions a victim,
//      foreign-existing and fabricated ids answer identically (status and body) within a documented timing tolerance.
// A route that cannot be exercised here is listed UNTESTED with its reason. Never skipped silently.
//
// Run: node scripts/xtenant_route_matrix.mjs [--json out.json]     (exit 1 on any leak, drift or oracle)
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PA_DIR = join(ROOT, "portal-api");
const imp = (p) => import(join(PA_DIR, p));
const { handle } = await imp("src/index.ts");
const { makeEnt, INTERNAL, SSO_CFG } = await imp("test/ent_harness.ts");
const { MemoryZone } = await imp("src/owner/dnsw.ts");
const { MemoryOwnerStore } = await imp("src/owner/engine.ts");
const { MemoryMarketStore } = await imp("src/market/store.ts");
const { MockPayments } = await imp("src/market/payments.ts");
const { healthy } = await imp("test/owner_harness.ts");
const { faulty, INTERNAL: MARKET_INTERNAL } = await imp("test/market_harness.ts");

export const TIMING_TOLERANCE_MS = 0.5; // documented: in-memory adapters, median of interleaved samples; real D1 timing is UNTESTED
const sha = (s) => createHash("sha256").update(s).digest("hex");

// ---------------------------------------------------------------- the route table
// kind: scoped (needs an entitlement over an id), account (needs a session, acts on the caller's own account but takes ids),
//       public (no auth by design), operator (INTERNAL secret), webhook (signature), key (API key), auth (login door)
// src: a substring of the source line that implements it (drift check). b: static body. refs: body fields filled from the victim bundle.
const R = (method, pattern, kind, src, o = {}) => ({ method, pattern, kind, src, ...o });
export const ROUTES = [
  // ---- index.ts: public / auth / agent door
  R("GET", "/catalogue", "public", 'path === "/catalogue"'),
  R("GET", "/agent/tools", "public", 'path === "/agent/tools"'),
  R("GET", "/.well-known/agent.json", "public", 'path === "/.well-known/agent.json"'),
  R("POST", "/agent/receipts/verify", "public", 'path === "/agent/receipts/verify"', { b: { receipt: { id: "x" } } }),
  R("GET", "/mcp", "public", 'if (m === "GET") return json({ error: "use_post"'),
  R("POST", "/mcp", "key", "const auth = await authenticateKey", { b: { jsonrpc: "2.0", id: 1, method: "tools/list" } }),
  R("POST", "/auth/request", "auth", 'path === "/auth/request"', { refs: { email: "email" } }),
  R("POST", "/auth/verify", "auth", 'path === "/auth/verify"', { refs: { token: "loginToken" } }),
  R("POST", "/stripe/webhook", "webhook", 'path === "/stripe/webhook"', { b: { id: "evt_forged", type: "checkout.session.completed", data: { object: {} } } }),
  // ---- index.ts: marketplace
  R("GET", "/market/leaderboard", "public", 'path === "/market/leaderboard"'),
  R("GET", "/internal/market/cards", "operator", 'seg[2] === "cards" && seg.length === 3'),
  R("POST", "/internal/market/cards/:card/resolve", "operator", 'seg[2] === "cards" && seg[4] === "resolve"', { b: { outcome: "pay" } }),
  R("POST", "/internal/market/sweep", "operator", 'seg[2] === "sweep"'),
  R("POST", "/market/jobs", "account", 'path === "/market/jobs" && m === "POST"', { refs: { domainId: "dom" }, b: { check: "SPF" } }),
  R("GET", "/market/jobs", "account", 'path === "/market/jobs" && m === "GET"'),
  R("POST", "/market/jobs/:job/cancel", "scoped", 'seg[3] === "cancel"'),
  R("POST", "/market/jobs/:job/dispute", "scoped", 'seg[3] === "dispute"', { b: { reason: "x" } }),
  R("POST", "/market/jobs/:job/rescan", "scoped", 'seg[3] === "rescan"'),
  R("POST", "/pro/join", "account", 'path === "/pro/join"', { b: { acceptTerms: true } }),
  R("POST", "/pro/onboarding", "account", 'path === "/pro/onboarding" &&'),
  R("POST", "/pro/onboarding/refresh", "account", 'path === "/pro/onboarding/refresh"'),
  R("GET", "/pro/board", "account", 'path === "/pro/board"'),
  R("GET", "/pro/rank", "account", 'path === "/pro/rank"'),
  R("GET", "/pro/payouts", "account", 'path === "/pro/payouts"'),
  R("POST", "/pro/jobs/:job/claim", "scoped", 'seg[3] === "claim"', { oracleExempt: "open job ids are published to every pro on GET /pro/board, so the existence of an OPEN job id is not secret; a closed job id is an unguessable token, so its 403/409 vs 404 needs an id the caller was never shown (OBSERVED, low; see receipt)" }),
  R("POST", "/pro/jobs/:job/deliver", "scoped", 'seg[3] === "deliver"', { b: { note: "x" } }),
  // ---- index.ts: account (C2) and owner seat (C3)
  R("GET", "/me", "account", 'path === "/me"'),
  R("POST", "/domains", "account", 'path === "/domains" && m === "POST"', { refs: { domain: "domainName" } }),
  R("GET", "/domains", "account", 'path === "/domains" && m === "GET"'),
  R("POST", "/domains/:dom/verify", "scoped", 'seg[0] === "domains" && seg[2] === "verify"'),
  R("GET", "/app/domains", "account", 'seg.length === 2 && m === "GET"'),
  R("GET", "/app/domains/:dom", "scoped", 'seg.length === 3 && m === "GET"'),
  R("POST", "/app/domains/:dom/scan", "scoped", 'seg[3] === "scan"'),
  R("POST", "/app/domains/:dom/fix", "scoped", 'seg[3] === "fix" &&', { b: { check: "SPF" } }),
  R("POST", "/app/domains/:dom/fixes/:fix/undo", "scoped", 'seg[3] === "fixes" && seg[5] === "undo"'),
  R("GET", "/app/domains/:dom/report", "scoped", 'seg[3] === "report"'),
  R("POST", "/checkout", "account", 'path === "/checkout"', { b: { product: "monitor_monthly" }, refs: { domain: "domainName" } }),
  R("GET", "/billing", "account", 'path === "/billing"'),
  R("GET", "/invoices", "account", 'path === "/invoices" && m === "GET"'),
  R("GET", "/invoices/:inv", "scoped", 'seg[0] === "invoices" && seg.length === 2'),
  R("POST", "/subscriptions/:sub/cancel", "scoped", 'seg[0] === "subscriptions" && seg[2] === "cancel"'),
  R("POST", "/refunds", "account", 'path === "/refunds"', { refs: { purchaseId: "pur" } }),
  R("POST", "/keys", "account", 'path === "/keys" && m === "POST"', { b: { scopes: [] } }),
  R("GET", "/keys", "account", 'path === "/keys" && m === "GET"'),
  R("DELETE", "/keys/:key", "scoped", 'seg[0] === "keys" && seg.length === 2'),
  R("GET", "/agent/credits", "account", 'path === "/agent/credits" && m === "GET"'),
  R("POST", "/agent/credits/topup", "account", 'path === "/agent/credits/topup"', { b: { pack: "nope" } }),
  R("GET", "/account/export", "account", 'path === "/account/export"'),
  R("DELETE", "/account", "account", 'path === "/account" && m === "DELETE"', { b: { confirm: "NOT-THE-WORD" } }), // never the real word: the attacker's own account must survive the run
  // ---- enterprise/routes.ts: public
  R("POST", "/savings", "public", 'path === "/savings"', { b: {} }),
  R("GET", "/portal/:slug", "public", 'top === "portal" && seg.length === 2', { oracleExempt: "a published client brand is public by design; unpublished/enterprise slugs are asserted equal to a fabricated slug in the oracle pass" }),
  R("POST", "/sso/:slug/start", "public", 'seg[2] === "start" && seg.length === 3', { oracleExempt: "tenant slug + SSO configured is public by design (the login page needs it); response carries no tenant data besides the IdP authorize URL" }),
  R("POST", "/sso/callback", "public", 'path === "/sso/callback"', { b: { state: "st_x", id_token: "a.b.c", nonce: "nn_x" } }),
  // ---- enterprise/routes.ts: operator
  R("GET", "/internal/enterprise/payouts/held", "operator", 'path === "/internal/enterprise/payouts/held"'),
  R("POST", "/internal/enterprise/payouts/retry", "operator", 'path === "/internal/enterprise/payouts/retry"', { b: {} }),
  R("POST", "/internal/enterprise/payouts/sweep", "operator", 'path === "/internal/enterprise/payouts/sweep"', { b: {} }),
  R("POST", "/internal/enterprise/payouts/:pay/release", "operator", 'seg[4] === "release" || seg[4] === "refund"', { refs: { tenantId: "tid" }, b: {} }),
  R("POST", "/internal/enterprise/payouts/:pay/refund", "operator", 'seg[4] === "release" || seg[4] === "refund"', { refs: { tenantId: "tid" }, b: {} }),
  R("POST", "/internal/tenants/provision", "operator", 'path === "/internal/tenants/provision"', { b: { kind: "enterprise", name: "Evil", slug: "evil-ent", adminEmail: "mallory@evil.com.au" } }),
  R("POST", "/internal/tenants/:tid/sso-enforce", "operator", 'seg[3] === "sso-enforce"', { b: { enabled: false } }),
  R("POST", "/internal/payouts/:pay/approve", "operator", 'seg[1] === "payouts" && seg.length === 4'),
  R("POST", "/internal/payouts/:pay/reject", "operator", 'seg[1] === "payouts" && seg.length === 4'),
  // ---- enterprise/routes.ts: any signed-in account
  R("GET", "/tenants", "account", 'path === "/tenants"'),
  R("GET", "/invites", "account", 'path === "/invites"'),
  R("POST", "/invites/:iid/accept", "scoped", 'top === "invites" && seg[2] === "accept"'),
  R("POST", "/referrals/claim", "account", 'path === "/referrals/claim"', { refs: { code: "refCode" } }),
  // ---- enterprise/routes.ts: enterprise / estate / client portal (tenant-scoped)
  R("GET", "/enterprise/:tid", "scoped", 'rest === "" && m === "GET"'),
  R("GET", "/enterprise/:tid/estate", "scoped", 'rest === "estate" && m === "GET"'),
  R("GET", "/enterprise/:tid/estate.csv", "scoped", 'rest === "estate.csv"'),
  R("GET", "/enterprise/:tid/assets", "scoped", 'rest === "assets" && m === "GET"'),
  R("POST", "/enterprise/:tid/assets", "scoped", 'rest === "assets" && m === "POST"', { b: { domain: "attacker-added.com.au", label: "x" } }),
  R("POST", "/enterprise/:tid/assets/:aid/verify", "scoped", 'seg[2] === "assets" && seg[4] === "verify"'),
  R("DELETE", "/enterprise/:tid/assets/:aid", "scoped", 'seg[2] === "assets" && seg.length === 4 && m === "DELETE"'),
  R("GET", "/enterprise/:tid/members", "scoped", 'rest === "members" && m === "GET"'),
  R("POST", "/enterprise/:tid/members", "scoped", 'rest === "members" && m === "POST"', { b: { email: "mallory@evil.com.au", role: "admin" } }),
  R("PATCH", "/enterprise/:tid/members/:uid", "scoped", 'seg[2] === "members" && seg.length === 4 && m === "PATCH"', { b: { role: "admin" } }),
  R("DELETE", "/enterprise/:tid/members/:uid", "scoped", 'seg[2] === "members" && seg.length === 4 && m === "DELETE"'),
  R("GET", "/enterprise/:tid/sso", "scoped", 'rest === "sso" && m === "GET"'),
  R("PUT", "/enterprise/:tid/sso", "scoped", 'rest === "sso" && m === "PUT"', { b: { issuer: "https://evil.test", clientId: "evil", secret: "evil_secret_0123456789", allowedDomains: ["attacker-added.com.au"] } }),
  R("POST", "/enterprise/:tid/sso/enforce", "scoped", 'rest === "sso/enforce"', { b: { enabled: true } }),
  R("DELETE", "/enterprise/:tid/invites/:iid", "scoped", 'seg[2] === "invites" && seg.length === 4'),
  R("GET", "/enterprise/:tid/audit", "scoped", 'rest === "audit"'),
  R("POST", "/enterprise/:tid/partner-access", "scoped", 'rest === "partner-access"', { b: { enabled: true } }),
  // ---- enterprise/routes.ts: partner / sub-portal / payout
  R("GET", "/partners/:pid/portals", "scoped", 'rest === "portals" && m === "GET"'),
  R("POST", "/partners/:pid/portals", "scoped", 'rest === "portals" && m === "POST"', { b: { name: "Evil", slug: "evil-portal", clientAdminEmail: "m@evil.com.au" } }),
  R("GET", "/partners/:pid/portals/:portal/estate", "scoped", 'seg[4] === "estate" && seg.length === 5'),
  R("POST", "/partners/:pid/portals/:portal/publish", "scoped", 'seg[4] === "publish"', { b: { enabled: true } }),
  R("PUT", "/partners/:pid/brand", "scoped", 'rest === "brand"', { b: { name: "Evil", colour: "#000000", tagline: "" } }),
  R("GET", "/partners/:pid/ledger", "scoped", 'rest === "ledger"'),
  R("GET", "/partners/:pid/statement", "scoped", 'rest === "statement"'),
  R("GET", "/partners/:pid/payouts", "scoped", 'rest === "payouts" && m === "GET"'),
  R("POST", "/partners/:pid/payouts", "scoped", 'rest === "payouts" && m === "POST"'),
];
export const NOT_ROUTES_BUT_LISTED = [
  { id: "GET /health", note: "src/index.ts handle(): liveness + booleans, no tenant data; method guard returns 405 (asserted in portal-api/test/health.test.ts)" },
  { id: "OPTIONS *", note: "src/index.ts handle(): CORS preflight 204 with no body (asserted below: no tenant data in the body for any path)" },
  { id: "scheduled() payout tick", note: "not an HTTP surface: cron entry, runs the f42/f46 sweep over rows; UNTESTED here (no request identity to attack). Covered by portal-api/test/payout_tick.test.ts tenant-scoped assertions" },
];
export const UNTESTED = [
  { id: "RS256/JWKS OIDC verifier", reason: "lives on branch web/f25_c8_oidc_rs256 (not in this stack); this stack has the HS256 MockIdp only. The forged-OIDC battery below pins the mock's alg/iss/aud/exp/nonce/state/domain rules; re-run this matrix after f25 merges", reopens: "merge f25 into the stack, add RS256 forged-key cases" },
  { id: "real D1 timing and semantics", reason: "all stores are MemoryStore/MemoryEntStore/MemoryMarketStore; D1 round-trip variance cannot be measured locally (D1 adapters are tested for parity in payout_d1.test.ts and market_d1_service.test.ts but not timed)", reopens: "a staging Worker + D1 (GATE5 deploy)" },
  { id: "live Stripe webhook and Connect transfer", reason: "MockBilling/MockPayments/MockPayouts only (GATE2: no live Stripe). Webhook signature rejection is asserted; a signed live event is not", reopens: "owner card for Stripe test keys" },
  { id: "Cloudflare edge identity (cf-connecting-ip, Access, rate limits)", reason: "no edge in the local harness; SSO start client key falls back to 'unknown'", reopens: "staging Worker behind Cloudflare" },
];

// ---------------------------------------------------------------- drift check (mechanical)
export function driftCheck(routes = ROUTES) {
  const files = ["src/index.ts", "src/enterprise/routes.ts"].map((f) => ({ f, lines: readFileSync(join(PA_DIR, f), "utf8").split("\n") }));
  const all = files.flatMap(({ f, lines }) => lines.map((l, i) => ({ f, n: i + 1, l })));
  const routeLines = all.filter(({ l }) => /\bm === "(GET|POST|PUT|PATCH|DELETE)"/.test(l) && !/^\s*\/\//.test(l));
  const unclaimed = routeLines.filter(({ l }) => !routes.some((r) => l.includes(r.src)));
  const stale = routes.filter((r) => !all.some(({ l }) => l.includes(r.src)));
  return { sourceRouteLines: routeLines.length, tableEntries: routes.length, unclaimed: unclaimed.map((x) => `${x.f}:${x.n} ${x.l.trim().slice(0, 110)}`), stale: stale.map((r) => `${r.method} ${r.pattern}`) };
}

// ---------------------------------------------------------------- the world
export async function buildWorld({ handler = handle } = {}) {
  const e = makeEnt();
  const h = e;
  const zones = new Map();
  const mstore = new MemoryMarketStore(), payments = new MockPayments();
  h.deps.market = { store: mstore, payments, doh: (dom) => zones.get(dom).doh, internalSecret: MARKET_INTERNAL };
  h.deps.owner = { store: new MemoryOwnerStore(), doh: (dom) => zones.get(dom).doh, zones: { zoneFor: (dom) => zones.get(dom) } };
  const TL = ["A", "B", "PA", "PB", "CA", "CB"];
  const T = {};
  const kindOf = { A: "enterprise", B: "enterprise", PA: "partner", PB: "partner" };
  for (const k of ["A", "B"]) {
    const email = `admin-${k}@ent${k}.com.au`;
    const o = await e.provision("enterprise", email, `Ent${k}Name`, `ent-${k.toLowerCase()}`);
    T[k] = { k, kind: "enterprise", tid: o.tenant.id, slug: `ent-${k.toLowerCase()}`, email, session: o.session, loginToken: o.loginToken, estateDomain: `canary-${k.toLowerCase()}-estate.com.au` };
    await e.addVerifiedAsset(o.session, T[k].tid, T[k].estateDomain, `CANARY_ASSET_LABEL_${k}`);
    const cfgView = await e.configureSso(o.session, T[k].tid, T[k].estateDomain, `CANARY_SSO_SECRET_${k}_0123456789`);
    T[k].cfg = SSO_CFG(cfgView.clientId, `CANARY_SSO_SECRET_${k}_0123456789`);
    const vEmail = `viewer-${k}@ent${k}.com.au`;
    await e.post(o.session, `/enterprise/${T[k].tid}/members`, { email: vEmail, role: "viewer" });
    const v = await e.login(vEmail);
    const inv = (await e.get(v.session, "/invites")).invites[0];
    await e.post(v.session, `/invites/${inv.id}/accept`);
    T[k].memberAcc = (await e.get(v.session, "/me")).id;
    T[k].assetId = (await e.get(o.session, `/enterprise/${T[k].tid}/assets`)).assets[0].id;
    T[k].inviteId = (await e.post(o.session, `/enterprise/${T[k].tid}/members`, { email: `pending-${k}@ent${k}.com.au`, role: "analyst" })).id;
  }
  for (const k of ["PA", "PB"]) {
    const email = `boss-${k}@msp${k}.com.au`;
    const p = await e.provision("partner", email, `Msp${k}Name`, `msp-${k.toLowerCase()}`, { termsAccepted: true, payoutAccount: `acct_canary_${k}` });
    T[k] = { k, kind: "partner", tid: p.tenant.id, slug: `msp-${k.toLowerCase()}`, email, session: p.session, loginToken: p.loginToken, refCode: p.tenant.refCode };
  }
  for (const [k, pk] of [["CA", "PA"], ["CB", "PB"]]) {
    const email = `owner-${k}@client${k}.com.au`;
    const c = await e.login(email);
    const portal = await e.post(T[pk].session, `/partners/${T[pk].tid}/portals`, { name: `Client${k}Name`, slug: `client-${k.toLowerCase()}`, clientAdminEmail: email, brand: { name: `CANARY_BRAND_${k}`, colour: "#112233", tagline: `CANARY_TAGLINE_${k}` } });
    const inv = (await e.get(c.session, "/invites")).invites[0];
    await e.post(c.session, `/invites/${inv.id}/accept`);
    T[k] = { k, kind: "client", parent: pk, tid: portal.id, slug: `client-${k.toLowerCase()}`, email, session: c.session, loginToken: c.loginToken, estateDomain: `canary-${k.toLowerCase()}-estate.com.au` };
    await e.addVerifiedAsset(c.session, portal.id, T[k].estateDomain, `CANARY_ASSET_LABEL_${k}`);
    await e.post(c.session, `/enterprise/${portal.id}/partner-access`, { enabled: true });
    await e.post(T[pk].session, `/partners/${T[pk].tid}/portals/${portal.id}/publish`, { enabled: true });
    T[k].assetId = (await e.get(c.session, `/enterprise/${portal.id}/assets`)).assets[0].id;
    T[pk].child = k;
  }
  // per-account objects for every admin: account id, a C2 domain (verified, with a faulty zone), a key, a purchase+subscription, invoice, job, fix
  for (const k of TL) {
    const t = T[k];
    t.accountId = (await e.get(t.session, "/me")).id;
    t.domainName = `acct-${k.toLowerCase()}.com.au`;
    zones.set(t.domainName, new MemoryZone(faulty(t.domainName)));
    const { d } = await h.verifiedDomain(t.session, t.domainName);
    t.dom = d.id;
    t.key = await h.j(await h.req("POST", "/keys", { token: t.session, body: { scopes: ["catalogue:read", "scan:read", "account:read", "credits:read"] } }));
    t.keyId = t.key.id; t.keyToken = t.key.key;
    t.unscoped = (await h.j(await h.req("POST", "/keys", { token: t.session, body: { scopes: [] } }))).key;
    await h.req("POST", "/checkout", { token: t.session, body: { product: "monitor_monthly", domain: t.domainName } });
    await h.pay("monitor_monthly");
    const bill = await h.j(await h.req("GET", "/billing", { token: t.session }));
    t.pur = bill.purchases[0]?.id; t.sub = bill.subscriptions[0]?.id;
    t.inv = (await h.j(await h.req("GET", "/invoices", { token: t.session }))).invoices[0]?.id;
    const job = await h.j(await h.req("POST", "/market/jobs", { token: t.session, body: { domainId: t.dom, check: "SPF" } }));
    t.job = job.job?.id;
    const fx = await h.j(await h.req("POST", `/app/domains/${t.dom}/fix`, { token: t.session, body: { check: "SPF" } }));
    t.fix = fx.fixId;
    // an unconsumed login link and an open SSO state, as tokens an attacker might steal
    await h.req("POST", "/auth/request", { body: { email: t.email } });
    t.loginToken = h.mailer.outbox.filter((m) => m.to === t.email.toLowerCase()).at(-1).text.match(/token=(ll_[0-9a-f]+)/)[1];
    if (t.kind !== "partner") { const st = await h.j(await h.req("POST", `/sso/${t.slug}/start`)); t.ssoState = st.state; t.ssoNonce = st.nonce; }
  }
  // partners: a payout each (clock past the 30-day hold), so payout ids exist
  for (const pk of ["PA", "PB"]) {
    const c = T[pk].child;
    await h.req("POST", "/checkout", { token: T[c].session, body: { product: "leads_starter" } }); await h.pay("leads_starter");
  }
  h.clock.t += 31 * 86_400_000;
  for (const pk of ["PA", "PB"]) {
    const s = (await h.login(T[pk].email)).session; T[pk].session = s;
    const r = await h.req("POST", `/partners/${T[pk].tid}/payouts`, { token: s });
    const lst = await h.j(await h.req("GET", `/partners/${T[pk].tid}/payouts`, { token: s }));
    T[pk].pay = lst.payouts?.[0]?.id ?? lst.items?.[0]?.id ?? [...h.store.payouts.values()].find((p) => p.partnerId === T[pk].tid)?.id;
    void r;
  }
  for (const k of TL) { // fresh sessions after the clock jump; every id a probe may need has a value
    if (!["PA", "PB"].includes(k)) T[k].session = (await h.login(T[k].email)).session;
    for (const f of ["memberAcc", "inviteId", "assetId", "refCode", "pay", "ssoState"]) T[k][f] ??= `none_${k}_${f}`;
    T[k].card = `card_${k}`;
  }
  const fire = (method, path, { headers = {}, body } = {}) =>
    handler(new Request("https://api.test" + path, { method, headers: { ...headers, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }), { TITANOS_SITE_ORIGIN: "https://titanos.tech" }, h.deps);
  return { e, h, T, TL, fire, zones, mstore };
}

// ---------------------------------------------------------------- canaries, snapshot, param filling
const SECRET_STRINGS = ["CANARY_SSO_SECRET_", "acct_canary_", "sso_secret_fixture", "internal_fixture_secret", "internal_test_secret", "whsec_test_fixture", "rcpt_test_fixture_secret"];
function canariesOf(t) { // strings that must NEVER reach someone who is not entitled to t. Brand strings are public by design (GET /portal/:slug).
  const k = t.k;
  const c = [t.email, t.loginToken, t.keyToken, t.unscoped, t.session, `CANARY_ASSET_LABEL_${k}`, `viewer-${k}@ent${k}.com.au`, `pending-${k}@ent${k}.com.au`, t.estateDomain, t.domainName, `CANARY_SSO_SECRET_${k}`, `acct_canary_${k}`, t.ssoState, t.ssoNonce].filter(Boolean);
  return [...new Set(c)];
}
function victimRowFilter(victims) { // rows mentioning a victim tenant id or victim account id
  const ids = victims.flatMap((t) => [t.tid, t.accountId, t.memberAcc]).filter((x) => x && !x.startsWith("none_"));
  return (json) => ids.some((id) => json.includes(id));
}
function snapshot(w, victims) {
  const keep = victimRowFilter(victims), out = [];
  const stores = [["c2", w.h.deps.store], ["ent", w.h.deps.ent.store], ["mkt", w.mstore], ["owner", w.h.deps.owner.store], ["pay", w.h.deps.ent.approvals]];
  for (const [sn, s] of stores) {
    if (!s) continue;
    for (const name of Object.keys(s).sort()) {
      if (sn === "ent" && name === "states") continue; // DOCUMENTED EXEMPTION: POST /sso/:slug/start is public by design and writes one capped, 10-minute, data-free state row per call (see observations.ssoStartCap)
      const v = s[name];
      let rows = v instanceof Map ? [...v.values()] : v instanceof Set ? [...v] : Array.isArray(v) ? v : (v && typeof v === "object" && !(v instanceof Date) && typeof v !== "function") ? [v] : [];
      if (v && typeof v === "object" && !(v instanceof Map) && !(v instanceof Set) && !Array.isArray(v)) rows = v instanceof Map ? rows : (v.constructor === Object ? Object.values(v).flat?.() ?? [] : []);
      for (const r of rows) { let j; try { j = JSON.stringify(r); } catch { continue; } if (j && keep(j)) out.push(`${sn}.${name}:${j}`); }
    }
  }
  return out.sort().join("\n");
}
const PTYPE = { pid: "tid", tid: "tid", portal: "tid", aid: "assetId", uid: "memberAcc", iid: "inviteId", slug: "slug", pay: "pay", inv: "inv", sub: "sub", key: "keyId", dom: "dom", job: "job", fix: "fix", card: "card" };
function fill(route, own, foreignBy) { // foreignBy: {paramName: bundle} overrides, default own
  const used = {};
  const path = route.pattern.replace(/:(\w+)/g, (_, p) => { const b = foreignBy[p] ?? own; used[p] = b; return encodeURIComponent(b[PTYPE[p]] ?? `none_${p}`); });
  return { path, used };
}
const bodyFor = (route, bundle, poison) => {
  if (route.b === undefined && !route.refs) return poison ? { tenantId: poison.tid, accountId: poison.accountId, parentId: poison.tid, ownerId: poison.accountId, partnerId: poison.tid, id: poison.tid } : undefined;
  const b = { ...(route.b ?? {}) };
  for (const [f, src] of Object.entries(route.refs ?? {})) b[f] = src === "email" ? bundle.email : src === "domainName" ? bundle.domainName : src === "tid" ? bundle.tid : bundle[src];
  if (poison) Object.assign(b, { tenantId: poison.tid, accountId: poison.accountId, parentId: poison.tid, ownerId: poison.accountId, partnerId: poison.tid, id: poison.tid });
  return b;
};

// ---------------------------------------------------------------- the matrix
export async function runMatrix({ handler = handle, reps = 41, verbose = false } = {}) {
  const w = await buildWorld({ handler });
  const { T, TL, fire, h } = w;
  const drift = driftCheck();
  const findings = []; // each: {type, probe, detail}
  let probes = 0;
  const byRoute = new Map(ROUTES.map((r) => [`${r.method} ${r.pattern}`, { probes: 0, foreign: 0, ok2xx: 0 }]));
  const entitled = (x) => new Set([x.k, ...(x.child ? [x.child] : [])]);

  // ---- positive control: each tenant fires every route at ITS OWN ids. Proves the matrix is not vacuous (routes really answer).
  const control = { routesAnswering2xx: new Set(), probes: 0 };
  { // runs in a second world so that its writes never disturb the attack world
    const cw = await buildWorld({ handler });
    for (const k of ["A", "PA", "CA"]) {
      for (const r of ROUTES) {
        if (r.kind === "operator" || r.pattern === "/account" || r.pattern === "/stripe/webhook") continue;
        const { path } = fill(r, cw.T[k], {});
        const res = await cw.fire(r.method, path, { headers: { authorization: `Bearer ${cw.T[k].session}` }, body: bodyFor(r, cw.T[k]) });
        control.probes++;
        if (res.status < 300) control.routesAnswering2xx.add(`${r.method} ${r.pattern}`);
        await res.text();
      }
    }
  }

  async function probe({ route, attacker, victim, mode, headers, foreignBy, poison, label, credValid = false }) {
    const { path, used } = fill(route, attacker, foreignBy);
    const body = bodyFor(route, foreignBy.refs ?? attacker, poison);
    const reqText = path + JSON.stringify(body ?? "");
    const res = await fire(route.method, path, { headers, body });
    const text = await res.text();
    probes++;
    const st = byRoute.get(`${route.method} ${route.pattern}`); st.probes++;
    const tag = `${attacker.k}->${victim.k} ${label} ${route.method} ${path}`;
    // 1. canary leak: any victim canary in the body, unless the attacker supplied it in the request itself (an echo) or is entitled
    for (const c of canariesOf(victim)) if (text.includes(c) && !reqText.includes(c) && !entitled(attacker).has(victim.k)) findings.push({ type: "BODY_LEAK", probe: tag, detail: `status ${res.status} leaked ${c.slice(0, 40)}` });
    for (const s of SECRET_STRINGS) if (text.includes(s) && !(attacker.k && text.includes(s + attacker.k) && s.endsWith("_") && !text.includes(s + victim.k))) findings.push({ type: "SECRET_LEAK", probe: tag, detail: `status ${res.status} contains ${s}` });
    // 2. foreign 2xx on a route that is not public
    if (res.status < 300 && route.kind !== "public" && route.kind !== "auth" && route.kind !== "webhook") {
      const foreignParam = Object.values(used).some((b) => b !== attacker && !entitled(attacker).has(b.k));
      // own-session vectors may legitimately succeed on routes with no foreign id; any other credential must never authenticate
      if (foreignParam || !credValid) st.foreign++, findings.push({ type: "FOREIGN_2XX", probe: tag, detail: `status ${res.status} for credential vector ${label}` });
    }
    if (res.status >= 500) findings.push({ type: "SERVER_ERROR", probe: tag, detail: `status ${res.status} (an unhandled exception is an information channel)` });
    return { status: res.status, text };
  }

  for (const attacker of TL.map((k) => T[k])) {
    const victims = TL.map((k) => T[k]).filter((v) => !entitled(attacker).has(v.k));
    const before = snapshot(w, victims);
    const own = attacker;
    for (const victim of victims) {
      for (const route of ROUTES) {
        if (route.kind === "operator") continue; // operator vectors below
        const params = [...route.pattern.matchAll(/:(\w+)/g)].map((m) => m[1]);
        const sess = { authorization: `Bearer ${attacker.session}` };
        // V1 own session, every param foreign; V1b one foreign position at a time; V1c poisoned body
        await probe({ route, attacker, victim, mode: "foreign", headers: sess, foreignBy: Object.fromEntries(params.map((p) => [p, victim])), label: "session/all-foreign", credValid: true });
        if (params.length > 1) for (const p of params) await probe({ route, attacker, victim, mode: "foreign", headers: sess, foreignBy: { [p]: victim }, label: `session/foreign:${p}`, credValid: true });
        if (["POST", "PUT", "PATCH", "DELETE"].includes(route.method) && route.pattern !== "/account") await probe({ route, attacker, victim, mode: "foreign", headers: sess, foreignBy: { ...Object.fromEntries(params.map((p) => [p, victim])), refs: victim }, poison: victim, label: "session/poisoned-body", credValid: true });
        // V2..V7 credentials the attacker should not be able to use
        const vecs = [
          ["victim-api-key", { authorization: `Bearer ${victim.keyToken}` }],
          ["unscoped-key", { authorization: `Bearer ${attacker.unscoped}` }],
          ["victim-login-token", { authorization: `Bearer ${victim.loginToken}` }],
          ["victim-invite-id", { authorization: `Bearer ${victim.inviteId}` }],
          ["victim-session-hash", { authorization: `Bearer ss_${sha(victim.session).slice(0, 48)}` }],
          ["victim-session-as-internal", { "x-internal-secret": victim.session, authorization: `Bearer ${attacker.session}` }],
          ["anonymous", {}],
        ];
        for (const [label, headers] of vecs) {
          if (route.kind === "key" && (label === "victim-api-key" || label === "unscoped-key")) continue; // MCP: a key authenticates as ITS OWNER; handled in the MCP battery
          await probe({ route, attacker, victim, mode: "foreign", headers, foreignBy: Object.fromEntries(params.map((p) => [p, victim])), label, credValid: label === "victim-session-as-internal" });
        }
      }
      // operator routes: the attacker holds no operator secret. Every credential he does hold, presented as the secret.
      for (const route of ROUTES.filter((r) => r.kind === "operator")) {
        const params = [...route.pattern.matchAll(/:(\w+)/g)].map((m) => m[1]);
        for (const [label, sec] of [["none", null], ["own-session", attacker.session], ["own-key", attacker.keyToken], ["victim-key", victim.keyToken], ["victim-session", victim.session], ["unscoped-key", attacker.unscoped], ["empty", ""], ["guess", "internal"]]) {
          const headers = sec === null ? { authorization: `Bearer ${attacker.session}` } : { "x-internal-secret": sec, authorization: `Bearer ${attacker.session}` };
          const r = await probe({ route, attacker, victim, mode: "foreign", headers, foreignBy: Object.fromEntries(params.map((p) => [p, victim])), poison: undefined, label: `operator-header:${label}` });
          if (r.status < 300) findings.push({ type: "OPERATOR_OPEN", probe: `${attacker.k} ${route.method} ${route.pattern}`, detail: `status ${r.status} with ${label}` });
        }
      }
      // OPTIONS preflight never carries tenant data
      for (const p of [`/enterprise/${victim.tid}/estate`, `/partners/${victim.tid}/ledger`]) { const r = await fire("OPTIONS", p, {}); const t = await r.text(); probes++; if (t.length) findings.push({ type: "BODY_LEAK", probe: `OPTIONS ${p}`, detail: "non-empty preflight body" }); }
    }
    const after = snapshot(w, victims);
    if (before !== after) {
      const b = new Set(before.split("\n")), a = new Set(after.split("\n"));
      const changed = [...a].filter((x) => !b.has(x)).concat([...b].filter((x) => !a.has(x))).slice(0, 4).map((x) => x.slice(0, 160));
      findings.push({ type: "VICTIM_WRITE", probe: `attacker ${attacker.k}`, detail: `a row mentioning a victim changed: ${changed.join(" | ")}` });
    }
  }

  // ---- MCP key battery: the victim's key, an unscoped key, tool arguments naming the victim
  const mcp = { calls: 0 };
  for (const attacker of TL.map((k) => T[k])) for (const victim of TL.map((k) => T[k]).filter((v) => !entitled(attacker).has(v.k))) {
    const calls = [
      { method: "tools/list" },
      ...["my_domains", "credits_balance", "catalogue_list"].map((n) => ({ method: "tools/call", params: { name: n, arguments: {} } })),
      { method: "tools/call", params: { name: "explain_finding", arguments: { findingId: victim.dom, accountId: victim.accountId } } },
      { method: "tools/call", params: { name: "domain_check", arguments: { domain: victim.domainName, accountId: victim.accountId } } },
    ];
    for (const [label, tok] of [["own-key", attacker.keyToken], ["unscoped-key", attacker.unscoped]]) for (const c of calls) {
      const body = { jsonrpc: "2.0", id: 1, ...c };
      const res = await fire("POST", "/mcp", { headers: { authorization: `Bearer ${tok}` }, body });
      const text = await res.text(); mcp.calls++; probes++;
      const req = JSON.stringify(body);
      for (const cn of canariesOf(victim)) if (text.includes(cn) && !req.includes(cn)) findings.push({ type: "BODY_LEAK", probe: `MCP ${attacker.k}->${victim.k} ${label} ${c.method} ${c.params?.name ?? ""}`, detail: `leaked ${cn.slice(0, 40)}` });
      if (label === "unscoped-key" && c.params?.name && ["my_domains", "credits_balance", "domain_check", "explain_finding"].includes(c.params.name)) {
        let j; try { j = JSON.parse(text); } catch { j = {}; }
        if (j.result && !j.result.isError && !j.error) findings.push({ type: "UNSCOPED_KEY_USED", probe: `MCP ${attacker.k} ${c.params.name}`, detail: "an empty-scope key was served a scoped tool" });
      }
    }
  }

  // ---- forged OIDC battery (HS256 mock IdP): tenant A's IdP and client CA's IdP against B and CB
  const oidc = { attacks: 0, sessionsMinted: 0 };
  async function oidcBattery(aK, bK) {
    const a = T[aK], b = T[bK];
    const cfgA = a.cfg ?? (await w.e.configureSso(a.session, a.tid, a.estateDomain, `CANARY_SSO_SECRET_${aK}_0123456789`).then((v) => SSO_CFG(v.clientId, `CANARY_SSO_SECRET_${aK}_0123456789`)));
    const cfgB = b.cfg ?? (await w.e.configureSso(b.session, b.tid, b.estateDomain, `CANARY_SSO_SECRET_${bK}_0123456789`).then((v) => SSO_CFG(v.clientId, `CANARY_SSO_SECRET_${bK}_0123456789`)));
    a.cfg = cfgA; b.cfg = cfgB;
    const victims = [b];
    const before = snapshot(w, victims);
    const start = async (slug) => (await h.j(await h.req("POST", `/sso/${slug}/start`)));
    const tok = (cfg, o, header) => w.e.idToken(cfg, { email: `joe@${a.estateDomain}`, ...o, ...(header ? { header } : {}) });
    const b64u = (s) => Buffer.from(s).toString("base64url");
    const cases = [
      ["B-secret-signed token on A state", async (st) => tok(cfgB, { nonce: st.nonce })],
      ["B-secret-signed token with B's client id", async (st) => tok({ ...cfgB, issuer: cfgA.issuer }, { nonce: st.nonce, aud: cfgB.clientId })],
      ["alg:none, no signature", async (st) => `${b64u('{"alg":"none","typ":"JWT"}')}.${b64u(JSON.stringify({ iss: cfgA.issuer, aud: cfgA.clientId, sub: "x", email: `joe@${a.estateDomain}`, email_verified: true, nonce: st.nonce, iat: Math.floor(h.clock.t / 1000), exp: Math.floor(h.clock.t / 1000) + 300 }))}.`],
      ["HS256 header, empty signature", async (st) => { const t = await tok(cfgA, { nonce: st.nonce }); return t.split(".").slice(0, 2).join(".") + "."; }],
      ["HS256 header, signature of another payload", async (st) => { const t = await tok(cfgA, { nonce: st.nonce }); const o = await tok(cfgA, { nonce: st.nonce, email: `ceo@${a.estateDomain}` }); return t.split(".").slice(0, 2).join(".") + "." + o.split(".")[2]; }],
      ["A-signed, email at B's verified domain", async (st) => tok(cfgA, { nonce: st.nonce, email: `ceo@${b.estateDomain}` })],
      ["A-signed, B's admin email", async (st) => tok(cfgA, { nonce: st.nonce, email: b.email })],
      ["A-signed, email on B's domain, uppercase + dots", async (st) => tok(cfgA, { nonce: st.nonce, email: `CEO@${b.estateDomain.toUpperCase()}.` })],
      ["A-signed, issuer = B's issuer path", async (st) => tok(cfgA, { nonce: st.nonce, iss: cfgA.issuer + "/b" })],
      ["A-signed, audience array [A, B]", async (st) => tok(cfgA, { nonce: st.nonce, aud: [cfgA.clientId, cfgB.clientId] })],
      ["A-signed, email_verified as string", async (st) => tok(cfgA, { nonce: st.nonce, verified: "true" })],
      ["A-signed, expired", async (st) => tok(cfgA, { nonce: st.nonce, exp: Math.floor(h.clock.t / 1000) - 5 })],
      ["A-signed, wrong nonce", async () => tok(cfgA, { nonce: "nn_wrong" })],
    ];
    for (const [name, mk] of cases) {
      const st = await start(a.slug);
      const id_token = await mk(st);
      const res = await fire("POST", "/sso/callback", { body: { state: st.state, nonce: st.nonce, id_token, tenantId: b.tid, slug: b.slug, tenant: b.tid } });
      const text = await res.text(); oidc.attacks++; probes++;
      if (res.status < 400) { oidc.sessionsMinted++; findings.push({ type: "OIDC_FORGERY", probe: `${aK}->${bK} ${name}`, detail: `status ${res.status}: a session was issued` }); }
      for (const cn of canariesOf(b)) if (text.includes(cn)) findings.push({ type: "BODY_LEAK", probe: `OIDC ${name}`, detail: `leaked ${cn.slice(0, 40)}` });
    }
    { // state replay + cross-tenant state: B's state with an A-signed token; a used A state a second time
      h.clock.t += 11 * 60_000; // past SSO_STATE_TTL_MS (10 min): the battery above used up the per-client open-state cap on purpose
      const sb = await start(b.slug), sa = await start(a.slug);
      const crossTok = await tok(cfgA, { nonce: sb.nonce });
      const r1 = await fire("POST", "/sso/callback", { body: { state: sb.state, nonce: sb.nonce, id_token: crossTok } }); await r1.text();
      const good = await tok(cfgA, { nonce: sa.nonce });
      const ok1 = await fire("POST", "/sso/callback", { body: { state: sa.state, nonce: sa.nonce, id_token: good } }); const okBody = await ok1.json();
      const replay = await fire("POST", "/sso/callback", { body: { state: sa.state, nonce: sa.nonce, id_token: good } }); await replay.text();
      oidc.attacks += 3; probes += 3;
      if (r1.status < 400) findings.push({ type: "OIDC_FORGERY", probe: `${aK}->${bK} A-signed token on B's state`, detail: `status ${r1.status}` });
      if (replay.status < 400) findings.push({ type: "OIDC_FORGERY", probe: `${aK} state replay`, detail: `status ${replay.status}: a used state was accepted twice` });
      // the legitimate A session must be fenced to A
      if (ok1.status === 200) {
        const mine = await h.j(await h.req("GET", "/tenants", { token: okBody.session }));
        if (mine.tenants.length !== 1 || mine.tenants[0].id !== a.tid) findings.push({ type: "OIDC_SCOPE", probe: `${aK} legit SSO session`, detail: `memberships ${JSON.stringify(mine.tenants.map((x) => x.slug))}` });
        for (const path of [`/enterprise/${b.tid}/estate`, `/enterprise/${b.tid}/assets`]) { const x = await h.req("GET", path, { token: okBody.session }); if (x.status < 400) findings.push({ type: "FOREIGN_2XX", probe: `A SSO session ${path}`, detail: `status ${x.status}` }); await x.text(); }
      } else findings.push({ type: "CONTROL_FAILED", probe: `${aK} legit SSO login`, detail: `status ${ok1.status}` });
    }
    // an IdP config naming B's domain as allowed, and an asset-squat on B's domain
    const put = await fire("PUT", `/enterprise/${a.tid}/sso`, { headers: { authorization: `Bearer ${a.session}` }, body: { issuer: cfgA.issuer, clientId: cfgA.clientId, secret: cfgA.secret, allowedDomains: [b.estateDomain] } });
    await put.text(); oidc.attacks++; probes++;
    if (put.status < 400) findings.push({ type: "OIDC_FORGERY", probe: `${aK} PUT sso allowedDomains=[B's domain]`, detail: `status ${put.status}` });
    const squat = await fire("POST", `/enterprise/${a.tid}/assets`, { headers: { authorization: `Bearer ${a.session}` }, body: { domain: b.estateDomain, label: "squat" } });
    const sq = await squat.json().catch(() => ({})); probes++;
    if (squat.status < 300 && sq.id) {
      const v = await fire("POST", `/enterprise/${a.tid}/assets/${sq.id}/verify`, { headers: { authorization: `Bearer ${a.session}` } });
      const vj = await v.json().catch(() => ({})); probes++;
      if (v.status < 300 && vj.verified) findings.push({ type: "DOMAIN_SQUAT", probe: `${aK} verify squat of B's domain`, detail: "verified without B's DNS record" });
    }
    const after = snapshot(w, victims);
    if (before !== after) findings.push({ type: "VICTIM_WRITE", probe: `OIDC battery ${aK}->${bK}`, detail: "a row mentioning the victim changed" });
  }
  await oidcBattery("A", "B");
  await oidcBattery("CA", "CB");

  // ---- existence oracle: a foreign-existing id and a fabricated id of the same shape must answer the same (status + body shape) and within the timing tolerance
  const oracle = { pairs: 0, maxDeltaMs: 0, exempt: [], mismatches: [] };
  const fabricate = (id) => (id.slice(0, -4) === "" ? id : id.slice(0, -4) + (id.endsWith("0000") ? "ffff" : "0000"));
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const shapeOf = (s) => { try { const j = JSON.parse(s); return JSON.stringify(Object.fromEntries(Object.entries(j).filter(([k]) => k !== "path").map(([k, v]) => [k, typeof v === "object" ? "*" : v]))); } catch { return s.length ? "text" : ""; } };
  const A = T.A, victimB = T.B;
  for (const route of ROUTES) {
    const params = [...route.pattern.matchAll(/:(\w+)/g)].map((m) => m[1]);
    if (!params.length || route.kind === "operator") continue;
    if (route.oracleExempt) oracle.exempt.push(`${route.method} ${route.pattern}: ${route.oracleExempt}`);
    const att = ["PA", "PB"].includes(route.pattern.split("/")[1] === "partners" ? "PA" : "") ? T.PA : A;
    for (const victim of [route.pattern.startsWith("/partners") ? T.PB : victimB]) {
      const real = fill(route, att, Object.fromEntries(params.map((p) => [p, victim]))).path;
      const fakeB = { ...victim }; for (const f of Object.values(PTYPE)) if (typeof fakeB[f] === "string") fakeB[f] = fabricate(fakeB[f]);
      fakeB.slug = victim.slug + "-zzz";
      const fake = fill(route, att, Object.fromEntries(params.map((p) => [p, fakeB]))).path;
      const hdr = { authorization: `Bearer ${att.session}` };
      const body = bodyFor(route, att);
      if (route.method !== "GET" && route.method !== "POST" && route.method !== "DELETE" && route.method !== "PUT" && route.method !== "PATCH") continue;
      const r1 = await fire(route.method, real, { headers: hdr, body }), r2 = await fire(route.method, fake, { headers: hdr, body });
      const t1 = await r1.text(), t2 = await r2.text(); oracle.pairs++; probes += 2;
      if (!route.oracleExempt && (r1.status !== r2.status || shapeOf(t1) !== shapeOf(t2))) oracle.mismatches.push(`${route.method} ${route.pattern}: foreign-existing ${r1.status} ${shapeOf(t1).slice(0, 60)} vs fabricated ${r2.status} ${shapeOf(t2).slice(0, 60)}`);
      if (route.oracleExempt) continue;
      const s1 = [], s2 = [];
      for (let i = 0; i < reps; i++) { // interleaved, so drift hits both sides equally
        let t = performance.now(); await (await fire(route.method, real, { headers: hdr, body })).arrayBuffer(); s1.push(performance.now() - t);
        t = performance.now(); await (await fire(route.method, fake, { headers: hdr, body })).arrayBuffer(); s2.push(performance.now() - t);
      }
      const dMs = Math.abs(med(s1) - med(s2));
      oracle.maxDeltaMs = Math.max(oracle.maxDeltaMs, dMs);
      if (dMs > TIMING_TOLERANCE_MS) oracle.mismatches.push(`${route.method} ${route.pattern}: median timing delta ${dMs.toFixed(3)} ms > ${TIMING_TOLERANCE_MS} ms`);
    }
  }
  for (const m of oracle.mismatches) findings.push({ type: "ORACLE", probe: m.split(":")[0], detail: m });

  // ---- a public-route sweep: an anonymous caller asking for B's slugs gets no tenant data except the documented brand
  for (const k of TL) { const r = await fire("GET", `/portal/${T[k].slug}`, {}); const t = await r.text(); probes++; for (const cn of canariesOf(T[k])) if (t.includes(cn)) findings.push({ type: "BODY_LEAK", probe: `GET /portal/${T[k].slug}`, detail: `leaked ${cn.slice(0, 40)}` }); }

  // ---- availability observation (not a read or write of victim data): can anyone with many source addresses fill a tenant's open SSO-state cap?
  const observations = { ssoStartCap: { attempts: 0, accepted: 0, legitUserBlocked: false } };
  {
    h.clock.t += 11 * 60_000;
    const slug = T.B.slug;
    for (let i = 0; i < 1100; i++) {
      const r = await fire("POST", `/sso/${slug}/start`, { headers: { "cf-connecting-ip": `203.0.${Math.floor(i / 20) % 256}.${(Math.floor(i / 20) >> 8) + 1}` } });
      observations.ssoStartCap.attempts++; if (r.status === 200) observations.ssoStartCap.accepted++; await r.text();
    }
    const legit = await fire("POST", `/sso/${slug}/start`, { headers: { "cf-connecting-ip": "198.51.100.77" } }); observations.ssoStartCap.legitUserBlocked = legit.status === 429; await legit.text();
    h.clock.t += 11 * 60_000;
  }

  // ---- coverage: every table route must have been fired at least once as an attack; none silently skipped
  const notFired = ROUTES.filter((r) => (byRoute.get(`${r.method} ${r.pattern}`).probes === 0) && r.kind !== "operator").map((r) => `${r.method} ${r.pattern}`);
  const opNotFired = ROUTES.filter((r) => r.kind === "operator" && byRoute.get(`${r.method} ${r.pattern}`).probes === 0).map((r) => `${r.method} ${r.pattern}`);
  const counts = {};
  for (const r of ROUTES) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  const c8Scope = ROUTES.filter((r) => /^\/(enterprise|partners|sso|portal|tenants|invites|referrals|savings|internal\/(enterprise|tenants|payouts))/.test(r.pattern) || /payouts/.test(r.pattern));
  const report = {
    routeTableEntries: ROUTES.length, byKind: counts, c8ScopeRoutes: c8Scope.length, sourceRouteLines: drift.sourceRouteLines, drift,
    tenants: TL, probes, controlProbes: control.probes, controlRoutesAnswering2xx: control.routesAnswering2xx.size,
    oidc, mcp, observations, oracle: { pairs: oracle.pairs, maxDeltaMs: Number(oracle.maxDeltaMs.toFixed(4)), toleranceMs: TIMING_TOLERANCE_MS, exempt: oracle.exempt, mismatches: oracle.mismatches },
    notFired: [...notFired, ...opNotFired], untested: UNTESTED, notRoutes: NOT_ROUTES_BUT_LISTED,
    findings: findings.slice(0, 200), findingCount: findings.length,
    crossTenantReads: findings.filter((f) => ["BODY_LEAK", "SECRET_LEAK", "FOREIGN_2XX", "OIDC_FORGERY", "OIDC_SCOPE", "UNSCOPED_KEY_USED", "OPERATOR_OPEN", "DOMAIN_SQUAT"].includes(f.type)).length,
    crossTenantWrites: findings.filter((f) => f.type === "VICTIM_WRITE").length,
  };
  report.ok = report.findingCount === 0 && drift.unclaimed.length === 0 && drift.stale.length === 0 && report.notFired.length === 0 && report.controlRoutesAnswering2xx >= 30;
  if (verbose) console.log(JSON.stringify(report, null, 1));
  return report;
}

// ---------------------------------------------------------------- CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await runMatrix();
  const jp = process.argv.indexOf("--json");
  if (jp > 0) writeFileSync(process.argv[jp + 1], JSON.stringify(r, null, 2));
  console.log(`routes in table: ${r.routeTableEntries} (source route lines ${r.sourceRouteLines}; C8-scope ${r.c8ScopeRoutes}); kinds ${JSON.stringify(r.byKind)}`);
  console.log(`drift: unclaimed ${r.drift.unclaimed.length}, stale ${r.drift.stale.length}; not fired ${r.notFired.length}`);
  console.log(`probes ${r.probes} (control ${r.controlProbes}, routes answering 2xx in control ${r.controlRoutesAnswering2xx}); oidc attacks ${r.oidc.attacks}, sessions minted ${r.oidc.sessionsMinted}; mcp calls ${r.mcp.calls}`);
  console.log(`oracle pairs ${r.oracle.pairs}, max timing delta ${r.oracle.maxDeltaMs} ms (tolerance ${r.oracle.toleranceMs} ms), mismatches ${r.oracle.mismatches.length}`);
  console.log(`cross-tenant reads ${r.crossTenantReads}, writes ${r.crossTenantWrites}, findings ${r.findingCount}`);
  for (const f of r.findings.slice(0, 30)) console.log(`  ${f.type} ${f.probe} :: ${f.detail}`);
  for (const u of r.untested) console.log(`UNTESTED ${u.id}: ${u.reason}`);
  console.log(r.ok ? "XTENANT MATRIX OK" : "XTENANT MATRIX FAILED");
  process.exit(r.ok ? 0 : 1);
}
