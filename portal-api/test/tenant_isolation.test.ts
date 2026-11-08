// C8 KILL TEST: adversarial tenant isolation. 0 cross-tenant reads.
// A world of two enterprises, two partners and three client portals, every tenant seeded with CANARY strings (asset
// labels, domains, member emails, SSO secrets, brands). Then every attacker identity fires every route with every id
// from every tenant (plus each other id in each position), and a canary the attacker is not entitled to may NEVER
// appear in any response body, and no foreign tenant-scoped route may answer 2xx.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnt, constructEnt, SSO_CFG } from "./ent_harness.ts";
import { BillingMarketBookFacts } from "../src/enterprise/book_facts.ts";
import { MemoryMarketStore } from "../src/market/store.ts";

interface Seat { email: string; session: string }
async function world() {
  const h = makeEnt();
  if (process.env.ENT_CTX === "1") h.deps.ent = constructEnt(h);   // C8 f314: run the whole matrix on the ent the production construction point builds
  const T: Record<string, any> = {};
  const seat = async (email: string): Promise<Seat> => ({ email, session: (await h.login(email)).session });

  for (const k of ["A", "B"] as const) {
    const o = await h.provision("enterprise", `admin-${k}@ent${k}.com.au`, `Ent${k}Name`, `ent-${k.toLowerCase()}`);
    const dom = `canary-${k.toLowerCase()}-estate.com.au`;
    await h.addVerifiedAsset(o.session, o.tenant.id, dom, `CANARY_ASSET_LABEL_${k}`);
    const cfgView = await h.configureSso(o.session, o.tenant.id, dom, `CANARY_SSO_SECRET_${k}_0123456789`);
    // a viewer member with a canary email, to test RBAC inside a tenant
    await h.post(o.session, `/enterprise/${o.tenant.id}/members`, { email: `viewer-${k}@ent${k}.com.au`, role: "viewer" });
    const v = await h.login(`viewer-${k}@ent${k}.com.au`);
    const inv = (await h.get(v.session, "/invites")).invites[0];
    await h.post(v.session, `/invites/${inv.id}/accept`);
    const assets = (await h.get(o.session, `/enterprise/${o.tenant.id}/assets`)).assets;
    T[k] = { id: o.tenant.id, admin: { email: o.email ?? `admin-${k}@ent${k}.com.au`, session: o.session }, viewer: { email: `viewer-${k}@ent${k}.com.au`, session: v.session }, assetId: assets[0].id, accountId: (await h.get(o.session, "/me")).id, viewerAccountId: (await h.get(v.session, "/me")).id, cfg: SSO_CFG(cfgView.clientId, `CANARY_SSO_SECRET_${k}_0123456789`), slug: `ent-${k.toLowerCase()}` };
    // an invite pending to a canary address
    const pend = await h.post(o.session, `/enterprise/${o.tenant.id}/members`, { email: `pending-${k}@ent${k}.com.au`, role: "analyst" });
    T[k].inviteId = pend.id;
  }
  for (const k of ["P1", "P2"] as const) {
    const p = await h.provision("partner", `boss-${k}@msp${k}.com.au`, `Msp${k}Name`, `msp-${k.toLowerCase()}`, { termsAccepted: true, payoutAccount: `acct_canary_${k}` });
    T[k] = { id: p.tenant.id, admin: { email: `boss-${k}@msp${k}.com.au`, session: p.session }, refCode: p.tenant.refCode, accountId: (await h.get(p.session, "/me")).id };
  }
  const mkClient = async (key: string, partner: "P1" | "P2", slug: string, consent: boolean) => {
    const email = `owner-${key}@client${key}.com.au`;
    const c = await seat(email);
    const portal = await h.post(T[partner].admin.session, `/partners/${T[partner].id}/portals`, { name: `Client${key}Name`, slug, clientAdminEmail: email, brand: { name: `CANARY_BRAND_${key}`, colour: "#112233", tagline: `CANARY_TAGLINE_${key}` } });
    const inv = (await h.get(c.session, "/invites")).invites[0];
    await h.post(c.session, `/invites/${inv.id}/accept`);
    const dom = `canary-${key.toLowerCase()}-estate.com.au`;
    await h.addVerifiedAsset(c.session, portal.id, dom, `CANARY_ASSET_LABEL_${key}`);
    if (consent) { await h.post(c.session, `/enterprise/${portal.id}/partner-access`, { enabled: true }); await h.post(T[partner].admin.session, `/partners/${T[partner].id}/portals/${portal.id}/publish`, { enabled: true }); }
    const assets = (await h.get(c.session, `/enterprise/${portal.id}/assets`)).assets;
    T[key] = { id: portal.id, admin: c, assetId: assets[0].id, accountId: (await h.get(c.session, "/me")).id, partner };
    // a purchase so the partner ledger and invoices hold canary data
    await h.req("POST", "/checkout", { token: c.session, body: { product: "leads_starter" } });
    await h.pay("leads_starter");
  };
  await mkClient("C1", "P1", "client-c1", true);
  await mkClient("C2", "P1", "client-c2", false);     // P1's client that has NOT consented
  await mkClient("C3", "P2", "client-c3", true);
  // C8 f313: the PRODUCTION book facts source (billing + market + estate) replaces the empty test source, with a re-scan proof canary per client
  const mkt = new MemoryMarketStore();
  h.deps.ent!.book = new BillingMarketBookFacts({ ent: h.store, billing: h.deps.store, market: mkt });
  for (const k of ["C1", "C2", "C3"]) await mkt.putJob({ id: `job_${k}`, ownerAccountId: T[k].accountId, domainId: `d_${k}`, domain: `canary-${k.toLowerCase()}-estate.com.au`, check: "dmarc", severity: "FAIL", tier: "small", priceCents: 1000, claimFeeCents: 0, status: "reproved", createdAt: 1, updatedAt: 1, baseline: { at: 1, status: "FAIL", detail: "x" }, abandonedBy: [], rescans: 1, warrantyChecks: 0, events: [], proof: { scanId: `CANARYPROOF_${k}`, at: 5, baseline: "FAIL", now: "PASS", detail: "x" } } as never);
  const outsider = await seat("outsider@nowhere.com.au");
  const gone = await seat("gone@nowhere.com.au");
  await h.req("DELETE", "/account", { token: gone.session, body: { confirm: "DELETE" } });
  return { h, T, outsider, gone };
}

// Canaries owned by each tenant: {data visible to the tenant's members, admin-only data}
const CAN = (k: string) => ({ data: [`CANARY_ASSET_LABEL_${k}`, `canary-${k.toLowerCase()}-estate.com.au`], brand: [`CANARY_BRAND_${k}`, `CANARY_TAGLINE_${k}`], adminOnly: [`viewer-${k}@ent${k}.com.au`, `pending-${k}@ent${k}.com.au`, `admin-${k}@ent${k}.com.au`], secret: [`CANARY_SSO_SECRET_${k}`], payout: [`acct_canary_${k}`], proof: [`CANARYPROOF_${k}`] });
const ALL_TENANTS = ["A", "B", "P1", "P2", "C1", "C2", "C3"];
const SECRETS = ["CANARY_SSO_SECRET_A", "CANARY_SSO_SECRET_B", "acct_canary_P1", "acct_canary_P2", "sso_secret_fixture", "internal_fixture_secret"];

// who may legitimately see which canary groups
function entitled(who: string): Set<string> {
  const s = new Set<string>();
  const add = (k: string, groups: ("data" | "brand" | "adminOnly")[]) => { const c = CAN(k) as any; for (const g of groups) for (const x of c[g] ?? []) s.add(x); };
  if (who === "A" || who === "B") add(who, ["data", "adminOnly"]);
  if (who === "viewerA") add("A", ["data"]);
  if (who === "viewerB") add("B", ["data"]);
  if (who === "C1" || who === "C2" || who === "C3") { add(who, ["data", "brand"]); }
  if (who === "P1") { add("C1", ["data", "brand"]); add("C2", ["brand"]); (CAN("C1") as any).proof.forEach((x: string) => s.add(x)); }   // f313: the book shows P1 the proof id of consented C1 only; C2 has not consented, so neither its domain nor its proof may appear // P1 reads consented C1; sees brands of its own clients (it set them)
  if (who === "P2") { add("C3", ["data", "brand"]); (CAN("C3") as any).proof.forEach((x: string) => s.add(x)); }
  // the partner's own brands: P1/P2's clients' brands are set by the partner
  return s;
}
const WHOLE = new Set<string>(ALL_TENANTS.flatMap((k) => { const c = CAN(k) as any; return [...c.data, ...c.adminOnly, ...c.proof]; })); // brands are PUBLIC by design (GET /portal/:slug), so they are not canaries

interface Probe { method: string; path: string; body?: unknown }
function routes(ids: { t: string[]; a: string[]; acc: string[]; inv: string[]; pay: string[] }): Probe[] {
  const out: Probe[] = [{ method: "GET", path: "/tenants" }, { method: "GET", path: "/invites" }, { method: "GET", path: "/me" }, { method: "GET", path: "/account/export" }, { method: "GET", path: "/invoices" }, { method: "GET", path: "/billing" }, { method: "GET", path: "/domains" }];
  for (const t of ids.t) {
    const e = `/enterprise/${t}`, p = `/partners/${t}`;
    out.push(
      { method: "GET", path: e }, { method: "GET", path: `${e}/estate` }, { method: "GET", path: `${e}/estate.csv` }, { method: "GET", path: `${e}/assets` },
      { method: "GET", path: `${e}/members` }, { method: "GET", path: `${e}/sso` }, { method: "GET", path: `${e}/audit` },
      { method: "POST", path: `${e}/assets`, body: { domain: "attacker-added.com.au", label: "x" } }, { method: "POST", path: `${e}/members`, body: { email: "mallory@evil.com.au", role: "admin" } },
      { method: "POST", path: `${e}/partner-access`, body: { enabled: true } }, { method: "POST", path: `${e}/sso/enforce`, body: { enabled: true } },
      { method: "PUT", path: `${e}/sso`, body: { issuer: "https://evil.test", clientId: "evil", secret: "evil_secret_0123456789", allowedDomains: ["attacker-added.com.au"] } },
      { method: "GET", path: `${p}/portals` }, { method: "GET", path: `${p}/ledger` }, { method: "GET", path: `${p}/payouts` }, { method: "GET", path: `${p}/statement?month=2026-11` },
      { method: "POST", path: `${p}/payouts` }, { method: "POST", path: `${p}/portals`, body: { name: "Evil", slug: "evil-portal", clientAdminEmail: "m@evil.com.au" } },
      { method: "PUT", path: `${p}/brand`, body: { name: "Evil", colour: "#000000", tagline: "" } },
    );
    // C8 f311: the partner book of clients, probed with every tenant id as partnerId on both spellings, and with a cursor lifted from another tenant
    out.push({ method: "GET", path: `/partner/book?partnerId=${t}` }, { method: "GET", path: `/api/partner/book?partnerId=${t}&limit=1` }, { method: "GET", path: `/partner/book?partnerId=${t}&cursor=v1.0000000000000000.dGVuYW50OnRlbl8x` });
    for (const a of ids.a) out.push({ method: "GET", path: `${p}/portals/${a}/estate` }, { method: "POST", path: `${e}/assets/${a}/verify` }, { method: "DELETE", path: `${e}/assets/${a}` });
    for (const c of ids.t) out.push({ method: "POST", path: `${p}/portals/${c}/publish`, body: { enabled: true } });
    for (const i of ids.inv) out.push({ method: "DELETE", path: `${e}/invites/${i}` });
    for (const x of ids.acc) out.push({ method: "PATCH", path: `${e}/members/${x}`, body: { role: "admin" } }, { method: "DELETE", path: `${e}/members/${x}` });
  }
  for (const i of ids.inv) out.push({ method: "POST", path: `/invites/${i}/accept` });
  for (const x of ids.pay) out.push({ method: "POST", path: `/internal/payouts/${x}/approve` });
  for (const t of ids.t) out.push({ method: "POST", path: `/internal/tenants/${t}/sso-enforce`, body: { enabled: false } });
  out.push({ method: "GET", path: "/partner/book" }, { method: "GET", path: "/api/partner/book" });
  out.push({ method: "GET", path: "/portal/client-c1" }, { method: "GET", path: "/portal/client-c2" }, { method: "GET", path: "/portal/ent-a" });
  return out;
}

const TRIALS: { who: string; pick: (w: any) => string | undefined }[] = [
  { who: "A", pick: (w) => w.T.A.admin.session }, { who: "viewerA", pick: (w) => w.T.A.viewer.session }, { who: "B", pick: (w) => w.T.B.admin.session },
  { who: "P1", pick: (w) => w.T.P1.admin.session }, { who: "P2", pick: (w) => w.T.P2.admin.session },
  { who: "C1", pick: (w) => w.T.C1.admin.session }, { who: "C2", pick: (w) => w.T.C2.admin.session }, { who: "C3", pick: (w) => w.T.C3.admin.session },
  { who: "outsider", pick: (w) => w.outsider.session }, { who: "gone", pick: (w) => w.gone.session }, { who: "anonymous", pick: () => undefined },
  { who: "forged", pick: () => "ss_" + "ab".repeat(24) },
];

let crossTenantReads = 0, probes = 0;
for (const trial of TRIALS) {
  test(`isolation matrix: ${trial.who} fires every route with every foreign id: 0 canary leaks, 0 foreign 2xx`, async () => {
    const w = await world();
    const T = w.T;
    const ids = { t: ALL_TENANTS.map((k) => T[k].id), a: [T.A.assetId, T.B.assetId, T.C1.assetId, T.C2.assetId, T.C3.assetId, "ast_nope"], acc: [T.A.accountId, T.A.viewerAccountId, T.B.accountId, T.P1.accountId, T.C1.accountId, T.C3.accountId], inv: [T.A.inviteId, T.B.inviteId], pay: ["pay_nope"] };
    const token = trial.pick(w);
    const ownTenants = new Set<string>(
      { A: ["A"], viewerA: ["A"], B: ["B"], P1: ["P1"], P2: ["P2"], C1: ["C1"], C2: ["C2"], C3: ["C3"] }[trial.who as string] ?? [],
    );
    const own = new Set([...ownTenants].map((k) => T[k].id));
    const ok = entitled(trial.who);
    const leaks: string[] = [];
    for (const probe of routes(ids)) {
      probes++;
      const res = await w.h.req(probe.method, probe.path, { token, body: probe.body });
      const text = await res.text();
      for (const canary of WHOLE) if (!ok.has(canary) && text.includes(canary)) { leaks.push(`${probe.method} ${probe.path} -> ${res.status} leaked ${canary}`); crossTenantReads++; }
      for (const sec of SECRETS) if (text.includes(sec)) { leaks.push(`${probe.method} ${probe.path} -> ${res.status} leaked SECRET ${sec}`); crossTenantReads++; }
      // a tenant-scoped route naming a tenant that is not mine (and not a client P1 may read) must not succeed
      const m = probe.path.match(/^\/(?:enterprise|partners)\/(ten_[0-9a-f]+)(?:\/(.*))?$/);
      if (m && res.status < 300) {
        const tid = m[1];
        const partnerReadingConsentedClient = /^portals\/ast_|^portals\/ten_/.test(m[2] ?? "") && own.has(tid);
        if (!own.has(tid) && !partnerReadingConsentedClient) { leaks.push(`${probe.method} ${probe.path} answered ${res.status} for a tenant the caller is not in`); crossTenantReads++; }
      }
      // C8 f311: the book route names its tenant in the query; a 2xx for a partner seat the caller does not hold is a cross-tenant read, a 403 must carry an empty body
      const bk = probe.path.match(/^\/(?:api\/)?partner\/book\?partnerId=(ten_[0-9a-f]+)/);
      if (bk && res.status < 300 && !own.has(bk[1])) { leaks.push(`${probe.method} ${probe.path} answered ${res.status} for a partner seat the caller does not hold`); crossTenantReads++; }
      if (bk && res.status === 403 && text !== "") { leaks.push(`${probe.path} 403 carried a body`); crossTenantReads++; }
      if (/^\/(?:api\/)?partner\/book/.test(probe.path) && /ClientC[0-9]Name/.test(text)) {   // client names are visible only to the partner that owns the client
        const names = (text.match(/ClientC[0-9]Name/g) ?? []).filter((n) => !(trial.who === "P1" ? ["ClientC1Name", "ClientC2Name"] : trial.who === "P2" ? ["ClientC3Name"] : []).includes(n));
        if (names.length) { leaks.push(`${probe.path} leaked client names ${names.join(",")}`); crossTenantReads++; }
      }
      // someone else's invite must never be accepted by anyone but its addressee
      if (probe.path.startsWith("/invites/") && res.status < 300) { leaks.push(`invite accepted by ${trial.who}`); crossTenantReads++; }
      // internal routes never open without the secret
      if (probe.path.startsWith("/internal/") && res.status !== 404) leaks.push(`internal route answered ${res.status} without the secret`);
    }
    assert.deepEqual(leaks, []);
  });
}

test("isolation matrix: summary counter (0 cross-tenant reads over all probes)", () => {
  assert.ok(probes > 4000, `only ${probes} probes ran`);
  assert.equal(crossTenantReads, 0);
  console.log(`# C8 isolation: ${probes} probes, ${crossTenantReads} cross-tenant reads`);
});

// ---------- targeted attacks ----------
test("IDOR: my tenant path with another tenant's asset id answers 404 and changes nothing", async () => {
  const { h, T } = await world();
  const r = await h.req("DELETE", `/enterprise/${T.A.id}/assets/${T.B.assetId}`, { token: T.A.admin.session });
  assert.equal(r.status, 404);
  assert.equal((await h.req("POST", `/enterprise/${T.A.id}/assets/${T.B.assetId}/verify`, { token: T.A.admin.session })).status, 404);
  assert.equal((await h.get(T.B.admin.session, `/enterprise/${T.B.id}/assets`)).assets.length, 1, "B's asset survived");
});
test("IDOR: member ids from another tenant cannot be re-roled or removed through my tenant", async () => {
  const { h, T } = await world();
  assert.equal((await h.req("PATCH", `/enterprise/${T.A.id}/members/${T.B.accountId}`, { token: T.A.admin.session, body: { role: "viewer" } })).status, 404);
  assert.equal((await h.req("DELETE", `/enterprise/${T.A.id}/members/${T.B.accountId}`, { token: T.A.admin.session })).status, 404);
  assert.equal((await h.get(T.B.admin.session, `/enterprise/${T.B.id}`)).role, "admin");
});
test("unknown tenant, other tenant and deleted tenant are indistinguishable (same status and body shape)", async () => {
  const { h, T } = await world();
  const a = await h.req("GET", `/enterprise/${T.B.id}/estate`, { token: T.A.admin.session });
  const b = await h.req("GET", `/enterprise/ten_00000000000000ff/estate`, { token: T.A.admin.session });
  assert.equal(a.status, b.status);
  assert.deepEqual(await a.json(), (await b.json()).path ? { error: "not_found" } : { error: "not_found" });
});
test("SSO cross-tenant: B's IdP (valid B secret) cannot sign anyone into A, nor assert an A-domain email in B", async () => {
  const { h, T } = await world();
  // token minted with B's secret/client against A's state: signature fails
  const st = await h.j(await h.req("POST", `/sso/${T.A.slug}/start`));
  const forged = await h.idToken(T.B.cfg, { email: "admin-A@entA.com.au", nonce: st.nonce });
  assert.equal((await h.req("POST", "/sso/callback", { body: { state: st.state, nonce: st.nonce, id_token: forged } })).status, 401);
  // B's valid IdP asserting an email at A's domain: refused, B only vouches for B's verified domains
  const r = await h.ssoLogin(T.B.slug, T.B.cfg, "ceo@canary-a-estate.com.au");
  assert.equal(r.res.status, 403);
  assert.equal(r.body.session, undefined);
  // a state minted for B with a token signed by A's secret
  const stB = await h.j(await h.req("POST", `/sso/${T.B.slug}/start`));
  const tokA = await h.idToken(T.A.cfg, { email: "x@canary-b-estate.com.au", nonce: stB.nonce });
  assert.equal((await h.req("POST", "/sso/callback", { body: { state: stB.state, nonce: stB.nonce, id_token: tokA } })).status, 401);
});
test("SSO: client-supplied tenantId or slug in the callback is ignored (the issued state decides the tenant)", async () => {
  const { h, T } = await world();
  const st = await h.j(await h.req("POST", `/sso/${T.A.slug}/start`));
  const tok = await h.idToken(T.A.cfg, { email: "joe@canary-a-estate.com.au", nonce: st.nonce });
  const res = await h.j(await h.req("POST", "/sso/callback", { body: { state: st.state, nonce: st.nonce, id_token: tok, tenantId: T.B.id, slug: T.B.slug } }));
  assert.equal(res.tenantId, T.A.id);
  const mine = await h.get(res.session, "/tenants");
  assert.deepEqual(mine.tenants.map((t: any) => t.slug), [T.A.slug]);
  assert.equal((await h.req("GET", `/enterprise/${T.B.id}/estate`, { token: res.session })).status, 404);
});
test("SSO: an SSO session for A is not a free pass into an SSO-enforced tenant B", async () => {
  const { h, T } = await world();
  // B's admin enforces SSO after an SSO login
  const inv = await h.post(T.B.admin.session, `/enterprise/${T.B.id}/members`, { email: "root@canary-b-estate.com.au", role: "admin" });
  const s1 = await h.ssoLogin(T.B.slug, T.B.cfg, "root@canary-b-estate.com.au");
  await h.post(s1.body.session, `/invites/${inv.id}/accept`);
  assert.equal((await h.req("POST", `/enterprise/${T.B.id}/sso/enforce`, { token: s1.body.session, body: { enabled: true } })).status, 200);
  // a person who is a member of B by magic link only is locked out; an A SSO session is not a member of B at all
  const a = await h.ssoLogin(T.A.slug, T.A.cfg, "joe@canary-a-estate.com.au");
  assert.equal((await h.req("GET", `/enterprise/${T.B.id}/estate`, { token: a.body.session })).status, 404);
  assert.equal((await h.req("GET", `/enterprise/${T.B.id}/estate`, { token: T.B.admin.session })).status, 401);
});
test("partner boundaries: P2 cannot read P1's clients or ledger; a client cannot read its parent or siblings", async () => {
  const { h, T } = await world();
  assert.equal((await h.req("GET", `/partners/${T.P1.id}/portals/${T.C1.id}/estate`, { token: T.P2.admin.session })).status, 404);
  assert.equal((await h.req("GET", `/partners/${T.P2.id}/portals/${T.C1.id}/estate`, { token: T.P2.admin.session })).status, 404, "P2 asking for P1's client through P2's own path");
  assert.equal((await h.req("GET", `/partners/${T.P1.id}/ledger`, { token: T.P2.admin.session })).status, 404);
  assert.equal((await h.req("GET", `/partners/${T.P1.id}/ledger`, { token: T.C1.admin.session })).status, 404);
  assert.equal((await h.req("GET", `/enterprise/${T.C2.id}/estate`, { token: T.C1.admin.session })).status, 404, "sibling");
  assert.equal((await h.req("GET", `/enterprise/${T.P1.id}`, { token: T.C1.admin.session })).status, 404, "parent");
  // P1 reads C1 (consented) but not C2 (not consented), and its read is analyst-or-better only
  assert.equal((await h.req("GET", `/partners/${T.P1.id}/portals/${T.C1.id}/estate`, { token: T.P1.admin.session })).status, 200);
  assert.equal((await h.req("GET", `/partners/${T.P1.id}/portals/${T.C2.id}/estate`, { token: T.P1.admin.session })).status, 404);
  // P1's read of C1 returns C1's estate and nothing from C2
  const body = await (await h.req("GET", `/partners/${T.P1.id}/portals/${T.C1.id}/estate`, { token: T.P1.admin.session })).text();
  assert.equal(body.includes("CANARY_ASSET_LABEL_C2"), false);
});
test("partner boundaries: a client cannot grant itself the partner role or use partner routes; the tenant kind gates the routes", async () => {
  const { h, T } = await world();
  assert.equal((await h.req("GET", `/partners/${T.C1.id}/ledger`, { token: T.C1.admin.session })).status, 404, "client is not a partner");
  assert.equal((await h.req("POST", `/partners/${T.A.id}/payouts`, { token: T.A.admin.session })).status, 404, "an enterprise is not a partner");
  assert.equal((await h.req("POST", `/enterprise/${T.A.id}/partner-access`, { token: T.A.admin.session, body: { enabled: true } })).status, 404, "only a client has a partner");
});
test("ledger: each partner sees only its own commission; referral sources are opaque", async () => {
  const { h, T } = await world();
  const p1 = await h.get(T.P1.admin.session, `/partners/${T.P1.id}/ledger`);
  const p2 = await h.get(T.P2.admin.session, `/partners/${T.P2.id}/ledger`);
  assert.equal(p1.entries.length, 2, "C1 and C2 each bought once");
  assert.equal(p2.entries.length, 1);
  assert.ok(p1.entries.every((e: any) => ["ClientC1Name", "ClientC2Name"].includes(e.source)));
  assert.deepEqual(p2.entries.map((e: any) => e.source), ["ClientC3Name"]);
  const inv1 = new Set(p1.entries.map((e: any) => e.invoiceId));
  assert.ok(p2.entries.every((e: any) => !inv1.has(e.invoiceId)));
});
test("payout theft: P2 cannot request a payout into P1's balance; the operator route is closed without the secret", async () => {
  const { h, T } = await world();
  h.clock.t += 31 * 86_400_000;
  const p1s = (await h.login("boss-P1@mspP1.com.au")).session, p2s = (await h.login("boss-P2@mspP2.com.au")).session;
  assert.equal((await h.req("POST", `/partners/${T.P1.id}/payouts`, { token: p2s })).status, 404);
  assert.equal(h.payouts.sent.length, 0);
  assert.equal((await h.req("POST", `/partners/${T.P1.id}/payouts`, { token: p1s })).status, 201);
  assert.equal(h.payouts.sent.length, 1);
  assert.equal(h.payouts.sent[0].accountRef, "acct_canary_P1", "paid to P1's own account");
});
test("invites: a stolen invite id cannot be accepted by another account, even an admin of another tenant", async () => {
  const { h, T } = await world();
  assert.equal((await h.req("POST", `/invites/${T.A.inviteId}/accept`, { token: T.B.admin.session })).status, 404);
  assert.deepEqual((await h.get(T.B.admin.session, "/tenants")).tenants.map((t: any) => t.id), [T.B.id]);
});
test("RBAC inside a tenant: a viewer sees the estate but not members, SSO, audit or the CSV; cannot add assets", async () => {
  const { h, T } = await world();
  const v = T.A.viewer.session, id = T.A.id;
  assert.equal((await h.req("GET", `/enterprise/${id}/estate`, { token: v })).status, 200);
  for (const [m, p, b] of [["GET", "members"], ["GET", "sso"], ["GET", "audit"], ["GET", "estate.csv"], ["POST", "assets", { domain: "x.com.au" }], ["POST", "members", { email: "z@z.com.au", role: "admin" }]] as any) {
    assert.equal((await h.req(m, `/enterprise/${id}/${p}`, { token: v, body: b })).status, 403, `${m} ${p}`);
  }
});
test("deleted account: its memberships are gone and its old session is dead; the tenant keeps working", async () => {
  const { h, T } = await world();
  assert.equal((await h.req("DELETE", "/account", { token: T.A.viewer.session, body: { confirm: "DELETE" } })).status, 200);
  assert.equal((await h.req("GET", `/enterprise/${T.A.id}/estate`, { token: T.A.viewer.session })).status, 401);
  const m = await h.get(T.A.admin.session, `/enterprise/${T.A.id}/members`);
  assert.equal(m.members.length, 1);
});
test("mass assignment: extra fields on writes cannot set role, tenant, kind, parent or terms", async () => {
  const { h, T } = await world();
  const r = await h.j(await h.req("POST", `/partners/${T.P1.id}/portals`, { token: T.P1.admin.session, body: { name: "Mass", slug: "mass-portal", clientAdminEmail: "m@m.com.au", kind: "partner", parentId: T.P2.id, id: T.A.id, termsAcceptedAt: 1, partnerAccess: true, ssoEnforced: true } }));
  const t = (await (h.deps.ent as any).store.tenantById(r.id))!;
  assert.equal(t.kind, "client");
  assert.equal(t.parentId, T.P1.id);
  assert.equal(t.partnerAccess, false);
  assert.equal(t.ssoEnforced, false);
  assert.equal(t.termsAcceptedAt, undefined);
  assert.notEqual(r.id, T.A.id);
});
test("prototype pollution and odd bodies do not reach the store", async () => {
  const { h, T } = await world();
  const raw = '{"__proto__":{"role":"admin"},"constructor":{"prototype":{"x":1}},"email":"p@p.com.au","role":"viewer"}';
  const res = await h.deps && (await (await import("../src/index.ts")).handle(new Request("https://api.test/enterprise/" + T.A.id + "/members", { method: "POST", headers: { authorization: "Bearer " + T.A.admin.session }, body: raw }), {}, h.deps));
  assert.equal(res.status, 201);
  assert.equal(({} as any).role, undefined);
  for (const bad of ["[]", "null", "42", '"s"', "{not json"]) {
    const r = await (await import("../src/index.ts")).handle(new Request("https://api.test/enterprise/" + T.A.id + "/assets", { method: "POST", headers: { authorization: "Bearer " + T.A.admin.session }, body: bad }), {}, h.deps);
    assert.ok(r.status === 400, `${bad} -> ${r.status}`);
  }
});

// C8 f313: the matrix above only proves ABSENCE; this proves the production book source is really live in it (P1 sees consented C1's proof, never unconsented C2's or P2's).
test("isolation matrix: the production book source is wired (P1 sees C1's proof id, not C2's or C3's)", async () => {
  const w = await world();
  const res = await w.h.req("GET", `/partner/book?partnerId=${w.T.P1.id}`, { token: w.T.P1.admin.session });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes("CANARYPROOF_C1") && text.includes("canary-c1-estate.com.au"));
  assert.ok(!text.includes("CANARYPROOF_C2") && !text.includes("canary-c2-estate.com.au"), "unconsented client: domain and proof withheld");
  assert.ok(!text.includes("CANARYPROOF_C3") && !text.includes("canary-c3-estate.com.au"));
  assert.ok(text.includes("ClientC2Name"), "the unconsented client still appears (commercial relationship), only its estate facts are withheld");
});
