// f86: every Response portal-api can emit carries the five security headers. SYNTHETIC data only, mock adapters, no network.
// The route table is derived from the route source (every `path === "/x"` literal) plus the parameterised routes with real ids,
// then fired with every method and every credential state; every reply (2xx, 3xx, 4xx, 5xx, preflight) is checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker, { handle } from "../src/index.ts";
import { json, text, empty, withSecurityHeaders, SECURITY_HEADERS } from "../src/http.ts";
import { makeEnt, INTERNAL } from "./ent_harness.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore } from "../src/owner/engine.ts";
import { healthy } from "./owner_harness.ts";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const HDRS = Object.keys(SECURITY_HEADERS);

function check(res: Response, label: string) {
  for (const k of HDRS) assert.ok(res.headers.get(k), `${label}: missing ${k} (status ${res.status})`);
  assert.equal(res.headers.get("cache-control"), "no-store", `${label}: cache-control`);
  assert.equal(res.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains", `${label}: hsts`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff", `${label}: nosniff`);
  assert.equal(res.headers.get("referrer-policy"), "no-referrer", `${label}: referrer`);
  assert.equal(res.headers.get("x-frame-options"), "DENY", `${label}: xfo`);
}

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? sourceFiles(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []);
}

test("http.ts: json/text/empty/withSecurityHeaders set all five headers", async () => {
  check(json({ a: 1 }), "json"); check(json({ e: 1 }, 500), "json500"); check(text("x", "text/plain"), "text"); check(empty(204), "empty204"); check(empty(202), "empty202");
  check(withSecurityHeaders(new Response("bare")), "bare");
  assert.equal(json({ a: 1 }).headers.get("content-type"), "application/json");
  assert.equal(text("a,b", "text/csv", { "content-disposition": "attachment" }).headers.get("content-disposition"), "attachment");
  assert.equal(withSecurityHeaders(json({})).status, 200);
});

test("http.ts: never weakens a stricter caller value; raises a weaker one", () => {
  const strict = withSecurityHeaders(new Response("x", { headers: { "strict-transport-security": "max-age=63072000; includeSubDomains; preload", "cache-control": "no-store, private" } }));
  assert.equal(strict.headers.get("strict-transport-security"), "max-age=63072000; includeSubDomains; preload");
  assert.equal(strict.headers.get("cache-control"), "no-store, private");
  const weak = withSecurityHeaders(new Response("x", { headers: { "strict-transport-security": "max-age=60", "cache-control": "public, max-age=600", "x-frame-options": "SAMEORIGIN", "referrer-policy": "origin" } }));
  check(weak, "weak");
  const noSub = withSecurityHeaders(new Response("x", { headers: { "strict-transport-security": "max-age=99999999" } }));
  assert.equal(noSub.headers.get("strict-transport-security"), "max-age=99999999; includeSubDomains");
  // idempotent
  assert.equal(withSecurityHeaders(withSecurityHeaders(new Response("x"))).headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
});

test("http.ts: a Response with immutable headers is rebuilt, not thrown on", async () => {
  const frozen = new Response("body", { status: 418 });
  Object.defineProperty(frozen, "headers", { value: new Proxy(frozen.headers, { get: (t, p) => p === "set" ? () => { throw new TypeError("immutable"); } : (typeof (t as any)[p] === "function" ? (t as any)[p].bind(t) : (t as any)[p]) }) });
  const r = withSecurityHeaders(frozen);
  check(r, "immutable"); assert.equal(r.status, 418); assert.equal(await r.text(), "body");
});

test("static: no file but http.ts constructs a Response", () => {
  const offenders: string[] = [];
  for (const f of sourceFiles()) {
    if (f.endsWith("/http.ts")) continue;
    readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (/new\s+Response\s*\(|Response\.(json|redirect|error)\s*\(/.test(l)) offenders.push(`${f.replace(SRC, "src")}:${i + 1}`); });
  }
  assert.deepEqual(offenders, [], "raw Response outside http.ts");
});

// ---- the route table ----
async function rig() {
  const h = makeEnt();
  const zone = new MemoryZone(healthy("acme.com.au"));
  zone.world.txt!["acme.com.au"] = ["v=spf1 include:_spf.google.com ~all"];
  h.deps.owner = { store: new MemoryOwnerStore(), doh: () => zone.doh, zones: { zoneFor: (x: string) => (x === "acme.com.au" ? zone : undefined) } } as never;
  const me = await h.login("owner@acme.com.au");
  const { d } = await h.verifiedDomain(me.session, "acme.com.au");
  await h.req("POST", "/checkout", { token: me.session, body: { product: "leads_starter" } });
  await h.pay("leads_starter");
  const invId = (await h.j(await h.req("GET", "/invoices", { token: me.session }))).invoices[0].id as string;
  const ent = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  await h.addVerifiedAsset(ent.session, ent.tenant.id, "bigco.com.au", "HQ");
  const par = await h.provision("partner", "p@partner.com.au", "Partner", "partner");
  return { h, me, ent, par, domId: d.id as string, invId };
}

function literalPaths(): string[] {
  const out = new Set<string>();
  for (const f of sourceFiles()) for (const m of readFileSync(f, "utf8").matchAll(/path === "(\/[^"]*)"/g)) out.add(m[1]);
  return [...out];
}

test("route table: every route x method x credential state answers with all five headers", async () => {
  const { h, me, ent, par, domId, invId } = await rig();
  const e = `/enterprise/${ent.tenant.id}`, p = `/partners/${par.tenant.id}`;
  const templated = [
    `/app/domains`, `/app/domains/${domId}`, `/app/domains/${domId}/scan`, `/app/domains/${domId}/fix`, `/app/domains/${domId}/fixes`, `/app/domains/${domId}/fixes/fix_1/undo`,
    `/app/domains/${domId}/report`, `/app/domains/${domId}/report?format=md`, `/domains/${domId}/verify`, `/invoices/${invId}`, `/invoices/nope`, `/subscriptions/sub_x/cancel`, `/keys/key_x`,
    `/market/jobs/job_x/cancel`, `/market/jobs/job_x/dispute`, `/market/jobs/job_x/rescan`, `/pro/jobs/job_x/claim`, `/pro/jobs/job_x/deliver`,
    `/internal/market/cards`, `/internal/market/cards/c1/resolve`, `/internal/market/sweep`, `/internal/tenants/t1/sso-enforce`, `/internal/payouts/x/approve`, `/internal/payouts/x/reject`,
    e, `${e}/estate`, `${e}/estate.csv`, `${e}/assets`, `${e}/assets/a1/verify`, `${e}/members`, `${e}/members/m1`, `${e}/sso`, `${e}/sso/enforce`, `${e}/sso/start`, `${e}/invites/i1`, `${e}/audit`,
    p, `${p}/partner-access`, `${p}/portals`, `${p}/portals/x/estate`, `${p}/portals/x/publish`, `${p}/brand`, `${p}/ledger`, `${p}/statement?month=2026-11`, `${p}/statement?month=2026-13`, `${p}/payouts`,
    `/invites/i1/accept`, `/referrals/claim`, `/enterprise/tnt_missing/estate`, `/totally/unknown/path`, `/`,
  ];
  const paths = [...new Set([...literalPaths(), ...templated])].filter((x) => x !== "/account" && x !== "/auth/logout");   // both end the session: exercised last, below
  assert.ok(paths.length > 70, `route table too small: ${paths.length}`);
  const methods = ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS", "HEAD"];
  const auth: Array<[string, Record<string, string>]> = [
    ["anon", {}], ["session", { authorization: `Bearer ${me.session}` }], ["ent-admin", { authorization: `Bearer ${ent.session}` }],
    ["partner", { authorization: `Bearer ${par.session}` }], ["internal", { "x-internal-secret": INTERNAL }], ["badtoken", { authorization: "Bearer nope" }],
  ];
  const statuses = new Set<number>(); let n = 0;
  for (const path of paths) for (const m of methods) for (const [an, ah] of auth) {
    const body = m === "GET" || m === "HEAD" || m === "OPTIONS" ? undefined : "{}";
    const res = await handle(new Request("https://api.test" + path, { method: m, headers: ah, body }), { TITANOS_SITE_ORIGIN: "https://titanos.tech" }, h.deps);
    check(res, `${m} ${path} [${an}]`); statuses.add(res.status); n++;
  }
  // the success text sites, asserted explicitly so a skipped route cannot hide a raw Response
  for (const [path, token, type] of [[`/app/domains/${domId}/report?format=md`, me.session, "text/markdown"], [`/invoices/${invId}`, me.session, "text/plain"], [`${e}/estate.csv`, ent.session, "text/csv"], [`${p}/statement?month=2026-11`, par.session, "text/plain"]] as const) {
    const r = await h.req("GET", path, { token });
    assert.equal(r.status, 200, path); assert.ok(r.headers.get("content-type")!.startsWith(type), path); check(r, path);
  }
  assert.equal((await h.req("GET", `${e}/estate.csv`, { token: ent.session })).headers.get("content-disposition"), 'attachment; filename="estate.csv"');
  for (const s of [200, 204, 400, 401, 404, 405]) assert.ok(statuses.has(s), `table never produced ${s}: ${[...statuses]}`);
  assert.ok(n > 3000, `only ${n} requests`);
  // destructive route last
  check(await h.req("DELETE", "/account", { token: me.session }), "DELETE /account");
  for (const m of ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS", "HEAD"]) for (const t of [me.session, ent.session, "nope", undefined]) check(await h.req(m, "/auth/logout", { token: t }), `${m} /auth/logout`);
});

test("preflight: with and without a configured site origin, and an unknown path", async () => {
  const { h } = await rig();
  for (const origin of [{ TITANOS_SITE_ORIGIN: "https://titanos.tech" }, {}]) {
    for (const path of ["/keys", "/health", "/nope", "/mcp"]) {
      const res = await handle(new Request("https://api.test" + path, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } }), origin, path === "/health" ? undefined : h.deps);
      check(res, `OPTIONS ${path} ${JSON.stringify(origin)}`);
      assert.notEqual(res.headers.get("access-control-allow-origin"), "*");
    }
  }
  const pre = await handle(new Request("https://api.test/keys", { method: "OPTIONS" }), { TITANOS_SITE_ORIGIN: "https://titanos.tech" }, h.deps);
  assert.equal(pre.status, 204); assert.equal(pre.headers.get("access-control-allow-origin"), "https://titanos.tech");
});

test("error paths: 404, 405, 401, 413, 400, 503 (no store), 500 (store throws) all carry the headers", async () => {
  const { h, me } = await rig();
  const env = { TITANOS_SITE_ORIGIN: "https://titanos.tech" };
  const big = "x".repeat(70 * 1024);
  const cases: Array<[string, Request, number]> = [
    ["404 unknown", new Request("https://api.test/zzz", { headers: { authorization: `Bearer ${me.session}` } }), 404],
    ["401 anon", new Request("https://api.test/me"), 401],
    ["405 mcp get", new Request("https://api.test/mcp"), 405],
    ["413 body", new Request("https://api.test/auth/request", { method: "POST", body: JSON.stringify({ email: big }) }), 413],
    ["400 json", new Request("https://api.test/auth/request", { method: "POST", body: "{nope" }), 400],
  ];
  for (const [label, req, want] of cases) { const r = await handle(req, env, h.deps); assert.equal(r.status, want, label); check(r, label); }
  const noStore = await handle(new Request("https://api.test/me"), env); assert.equal(noStore.status, 503); check(noStore, "503 no deps");
  const health405 = await handle(new Request("https://api.test/health", { method: "POST" }), env); assert.equal(health405.status, 405); check(health405, "health 405");
  const dbErr = await worker.fetch(new Request("https://api.test/health"), { DB: { prepare: () => { throw new Error("boom"); } } as never }); assert.equal(dbErr.status, 503); check(dbErr, "health 503");
  const okHealth = await worker.fetch(new Request("https://api.test/health"), {}); assert.equal(okHealth.status, 200); check(okHealth, "health 200");
  // an unexpected throw inside a route reaches the Worker's last-resort handler, which must also use the helper
  const boom = { ...h.deps, store: new Proxy(h.deps.store, { get: () => () => { throw new Error("store exploded"); } }) };
  await assert.rejects(handle(new Request("https://api.test/me", { headers: { authorization: `Bearer ${me.session}` } }), env, boom as never));
  const origHandle = await worker.fetch(new Request("https://api.test/health"), { get STRIPE_MODE(): string { throw new Error("env exploded"); } } as never);
  assert.equal(origHandle.status, 500); check(origHandle, "worker 500");
});
