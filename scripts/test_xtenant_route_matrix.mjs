// Test for scripts/xtenant_route_matrix.mjs (C8 kill test). Two halves:
//  1. the clean tree: 0 findings, no drift, every route fired, control proves the routes really answer.
//  2. MUTANTS: a wrapper around the real handler injects one cross-tenant defect at a time; the matrix must flag each,
//     otherwise a green run means nothing (EV8: the detector is itself tested).
import assert from "node:assert/strict";
import { runMatrix, driftCheck, ROUTES, UNTESTED } from "./xtenant_route_matrix.mjs";
import { handle } from "../portal-api/src/index.ts";

let fails = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => console.log(`ok   ${name}`), (e) => { fails++; console.log(`FAIL ${name}\n     ${e.message}`); });

const clean = await runMatrix({ reps: 21 });
await ok("clean tree: 0 cross-tenant reads, 0 writes, 0 findings", () => { assert.deepEqual(clean.findings, []); assert.equal(clean.crossTenantReads, 0); assert.equal(clean.crossTenantWrites, 0); });
await ok("f358: a many-address SSO start flood no longer blocks a legitimate new address", () => { assert.equal(clean.observations.ssoStartCap.legitUserBlocked, false); assert.equal(clean.observations.ssoStartCap.attempts, 1100); });
await ok("route table has no drift against the two route sources", () => { assert.deepEqual(clean.drift.unclaimed, []); assert.deepEqual(clean.drift.stale, []); assert.ok(clean.sourceRouteLines >= 80); });
await ok("every table route was fired as an attack (none skipped silently)", () => assert.deepEqual(clean.notFired, []));
await ok("positive control: >= 55 routes answer 2xx for their own tenant (the matrix is not vacuous)", () => assert.ok(clean.controlRoutesAnswering2xx >= 55, String(clean.controlRoutesAnswering2xx)));
await ok("scale: > 20,000 probes, forged OIDC attacks and MCP key calls ran, 0 sessions minted", () => { assert.ok(clean.probes > 20000); assert.ok(clean.oidc.attacks >= 30); assert.equal(clean.oidc.sessionsMinted, 0); assert.ok(clean.mcp.calls >= 300); });
await ok("oracle: foreign-existing and fabricated ids answer alike; timing delta inside the documented tolerance", () => { assert.deepEqual(clean.oracle.mismatches, []); assert.ok(clean.oracle.pairs >= 40); assert.ok(clean.oracle.maxDeltaMs <= clean.oracle.toleranceMs); });
await ok("every UNTESTED item carries a reason and a reopen condition", () => { assert.ok(UNTESTED.length >= 3); for (const u of UNTESTED) { assert.ok(u.reason.length > 20); assert.ok(u.reopens.length > 5); } });
await ok("observation recorded: SSO start cap (availability), not a data leak", () => assert.ok(clean.observations.ssoStartCap.attempts >= 1000));
await ok("drift check bites: dropping a table entry is reported as unclaimed; a phantom entry as stale", () => {
  const d1 = driftCheck(ROUTES.filter((r) => r.pattern !== "/enterprise/:tid/estate"));
  assert.ok(d1.unclaimed.some((x) => x.includes('rest === "estate" && m === "GET"')), JSON.stringify(d1.unclaimed));
  const d2 = driftCheck([...ROUTES, { method: "GET", pattern: "/ghost", kind: "scoped", src: 'path === "/ghost-route-not-in-source"' }]);
  assert.deepEqual(d2.stale, ["GET /ghost"]);
});

// ---- mutants: each wraps the real handler and breaks isolation in exactly one way
const tidOf = (p, root) => p.match(new RegExp(`^/${root}/([^/]+)`))?.[1];
const mutants = [
  ["M1 read: an unauthorised GET /enterprise/:tid/assets answers 200 with the tenant's assets", "BODY_LEAK", async (req, env, deps) => {
    const res = await handle(req, env, deps); const p = new URL(req.url).pathname, tid = tidOf(p, "enterprise");
    if (req.method === "GET" && p.endsWith("/assets") && res.status === 404 && tid) return new Response(JSON.stringify({ assets: [...deps.ent.store.assets.values()].filter((a) => a.tenantId === tid) }), { status: 200 });
    return res; }],
  ["M2 write: a foreign DELETE of an asset succeeds", "VICTIM_WRITE", async (req, env, deps) => {
    const res = await handle(req, env, deps); const m = new URL(req.url).pathname.match(/^\/enterprise\/[^/]+\/assets\/([^/]+)$/);
    if (req.method === "DELETE" && m && res.status === 404) { deps.ent.store.assets.delete(m[1]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
    return res; }],
  ["M3 oracle: an existing foreign tenant answers 403 where a missing one answers 404", "ORACLE", async (req, env, deps) => {
    const res = await handle(req, env, deps); const p = new URL(req.url).pathname, tid = tidOf(p, "enterprise");
    if (req.method === "GET" && p.endsWith("/audit") && res.status === 404 && tid && deps.ent.store.tenants.has(tid)) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    return res; }],
  ["M4 operator: any non-empty x-internal-secret opens the operator routes", "OPERATOR_OPEN", async (req, env, deps) => {
    const h = req.headers.get("x-internal-secret");
    if (h && h.length > 0 && new URL(req.url).pathname.startsWith("/internal/enterprise/")) { const r2 = new Request(req, { headers: new Headers([...req.headers, ["x-internal-secret", "internal_fixture_secret"]].reduce((a, [k, v]) => (a.set(k, v), a), new Headers())) }); return handle(r2, env, deps); }
    return handle(req, env, deps); }],
  ["M5 oidc: an alg:none id token mints a session", "OIDC_FORGERY", async (req, env, deps) => {
    if (new URL(req.url).pathname === "/sso/callback") { const t = JSON.parse(await req.clone().text()).id_token ?? ""; try { if (JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString()).alg === "none") return new Response(JSON.stringify({ session: "ss_forged" }), { status: 200 }); } catch { /* not a jwt */ } }
    return handle(req, env, deps); }],
  ["M6 secret in an error body: 404s echo the tenant's SSO secret", "SECRET_LEAK", async (req, env, deps) => {
    const res = await handle(req, env, deps); const tid = tidOf(new URL(req.url).pathname, "partners");
    if (res.status === 404 && tid) { const s = [...deps.ent.store.sso.values()][0]; /* f286 seals the stored secret, so the simulated leak is the plaintext canary the harness configured */ return new Response(JSON.stringify({ error: "not_found", detail: s?.secret, plain: "CANARY_SSO_SECRET_ZZ_0123456789" }), { status: 404 }); }
    return res; }],
  ["M7 key: an empty-scope MCP key is served my_domains", "UNSCOPED_KEY_USED", async (req, env, deps) => {
    const copy = req.clone(); const res = await handle(req, env, deps);
    if (new URL(req.url).pathname === "/mcp" && req.method === "POST") { const b = JSON.parse(await copy.text()); if (b.method === "tools/call" && b.params?.name === "my_domains") { const j = await res.clone().json().catch(() => ({})); if (j.error || j.result?.isError) return new Response(JSON.stringify({ jsonrpc: "2.0", id: b.id, result: { content: [{ type: "text", text: "[]" }] } }), { status: 200 }); } }
    return res; }],
];
for (const [name, type, handler] of mutants) {
  const r = await runMatrix({ handler, reps: 7 });
  await ok(`mutant caught: ${name}`, () => { assert.ok(r.findings.some((f) => f.type === type), `expected a ${type} finding, got types ${[...new Set(r.findings.map((f) => f.type))].join(",") || "none"}`); assert.equal(r.ok, false); });
}
console.log(fails === 0 ? `XTENANT TEST OK (${10 + mutants.length} checks)` : `XTENANT TEST FAILED (${fails})`);
process.exit(fails === 0 ? 0 : 1);
