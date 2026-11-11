// F363 (C2/C9): CORS holds on EVERY path of the portal Worker edge, not just the one preflight in portal.test.ts.
// Drives handle() (and the createWorker entry) over the route table x every method x every response class.
import { test } from "node:test";
import assert from "node:assert/strict";
import { make, T0 } from "./harness.ts";
import { MockMailer, HttpError, RefundInFlight, RefundRecordPending, type Deps } from "../src/service.ts";
import { ThrottledError } from "../src/throttle.ts";
import { handle, createWorker } from "../src/index.ts";

const ORIGIN = "https://titanos.tech";
const METHODS = ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"] as const;
const SECRETS = ["whsec_test_fixture", "sk_live_", "sk_test_", "BOOM_SECRET_TOKEN_123"];
// The route table as written in src/index.ts route() + entRoute() prefixes, plus unknown paths.
const PATHS = [
  "/health", "/catalogue", "/agent/tools", "/.well-known/agent.json", "/agent/receipts/verify", "/mcp",
  "/auth/request", "/auth/verify", "/stripe/webhook", "/market/leaderboard", "/market/jobs", "/market/jobs/j1/cancel",
  "/pro/join", "/pro/board", "/pro/jobs/j1/claim", "/internal/keys/trace", "/internal/market/cards", "/internal/market/sweep",
  "/me", "/domains", "/domains/d1/verify", "/app/domains", "/app/domains/d1/scan", "/checkout", "/billing", "/invoices", "/invoices/i1",
  "/subscriptions/s1/cancel", "/refunds", "/keys", "/keys/k1", "/agent/credits", "/agent/credits/topup", "/account/export", "/account",
  "/enterprise/anything", "/partners/x", "/sso/x/start", "/savings", "/portal/acme", "/tenants/t1", "/invites/x", "/referrals/x", "/partner/book", "/api/partner/book", "/internal/tenants/x",
  "/nope", "/", "/a/b/c/d/e", "/%2e%2e/etc/passwd",
];
const HOSTILE = ["null", "https://titanos.tech.evil.example", "https://evil-titanos.tech", "https://titanos.tech/", "HTTPS://TITANOS.TECH", "https://TITANOS.tech", "*", "https://evil.example"];

type Mode = "ok" | { http: number } | "unexpected" | "throttled" | "inflight" | "pending";
function depsFor(mode: Mode): Deps {
  const h = make();
  const d = h.deps;
  const mailer = new MockMailer();
  mailer.send = async () => {
    if (mode === "unexpected") throw new Error("BOOM_SECRET_TOKEN_123 at /srv/secret/path.ts:1:1");
    if (mode === "throttled") throw new ThrottledError(7);
    if (mode === "inflight") throw new RefundInFlight("p1");
    if (mode === "pending") throw new RefundRecordPending("p1", "re_1", "k1");
    if (typeof mode === "object") throw new HttpError(mode.http, "forced_" + mode.http);
  };
  return { ...d, mailer };
}
const mk = (method: string, path: string, headers: Record<string, string> = {}, body?: string) =>
  new Request("https://api.test" + path, { method, headers, body: body !== undefined && method !== "GET" && method !== "OPTIONS" ? body : undefined });
const acHeaders = (r: Response) => [...r.headers.keys()].filter((k) => k.startsWith("access-control-"));
async function bodyText(r: Response) { return await r.clone().text(); }
function assertNoLeak(text: string, ctx: string) {
  for (const s of SECRETS) assert.ok(!text.includes(s), `${ctx}: body leaks ${s}`);
  assert.ok(!/\bat [^\n]*\.(ts|js|mjs):\d+/.test(text), `${ctx}: stack trace in body`);
  assert.ok(!/node_modules|\/home\/|\/srv\//.test(text), `${ctx}: path in body`);
}
function assertCors(r: Response, origin: string | undefined, ctx: string) {
  if (origin === undefined) { assert.deepEqual(acHeaders(r), [], `${ctx}: unset origin must send no access-control-* header`); return; }
  assert.equal(r.headers.get("access-control-allow-origin"), origin, `${ctx}: allow-origin`);
  assert.ok(/\borigin\b/i.test(r.headers.get("vary") ?? ""), `${ctx}: vary includes origin (got ${r.headers.get("vary")})`);
  assert.notEqual(r.headers.get("access-control-allow-origin"), "*", ctx);
  assert.equal(r.headers.get("access-control-allow-credentials"), null, `${ctx}: allow-credentials must never be sent`);
}

// ---- the response-class matrix: forced via the mailer on POST /auth/request, so every class passes through the same handle() ----
const CLASSES: { name: string; mode: Mode; status: number }[] = [
  { name: "HttpError 400", mode: { http: 400 }, status: 400 }, { name: "HttpError 401", mode: { http: 401 }, status: 401 },
  { name: "HttpError 403", mode: { http: 403 }, status: 403 }, { name: "HttpError 404", mode: { http: 404 }, status: 404 },
  { name: "HttpError 405", mode: { http: 405 }, status: 405 }, { name: "HttpError 413", mode: { http: 413 }, status: 413 },
  { name: "HttpError 429", mode: { http: 429 }, status: 429 }, { name: "HttpError 500", mode: { http: 500 }, status: 500 },
  { name: "HttpError 503", mode: { http: 503 }, status: 503 }, { name: "ThrottledError", mode: "throttled", status: 429 },
  { name: "RefundInFlight", mode: "inflight", status: 503 }, { name: "RefundRecordPending", mode: "pending", status: 503 },
];
for (const c of CLASSES) {
  test(`cors: thrown ${c.name} carries CORS, no leak`, async () => {
    for (const origin of [ORIGIN, undefined]) {
      const r = await handle(mk("POST", "/auth/request", { "content-type": "application/json", origin: "https://evil.example" }, JSON.stringify({ email: "a@b.com.au" })), origin ? { TITANOS_SITE_ORIGIN: origin } : {}, depsFor(c.mode));
      assert.equal(r.status, c.status);
      assertCors(r, origin, c.name);
      assertNoLeak(await bodyText(r), c.name);
    }
  });
}
test("cors: an unexpected throw inside a route rejects from handle() (pinned contract) and never leaks through the Worker entry", async () => {
  await assert.rejects(handle(mk("POST", "/auth/request", { "content-type": "application/json" }, JSON.stringify({ email: "a@b.com.au" })), { TITANOS_SITE_ORIGIN: ORIGIN }, depsFor("unexpected")));
  for (const origin of [ORIGIN, undefined]) {
    const w = createWorker({ buildDeps: () => depsFor("unexpected") });
    const r = await w.fetch(mk("POST", "/auth/request", { "content-type": "application/json" }, JSON.stringify({ email: "a@b.com.au" })), origin ? { TITANOS_SITE_ORIGIN: origin } : {});
    assert.equal(r.status, 500); assertCors(r, origin, "worker unexpected");
    assert.deepEqual(await r.json(), { error: "internal" });
  }
});
test("cors: createWorker entry: unexpected throw, deps_unavailable 503 and OPTIONS all carry CORS", async () => {
  const env = { TITANOS_SITE_ORIGIN: ORIGIN };
  const boom = createWorker({ buildDeps: () => { throw new Error("BOOM_SECRET_TOKEN_123"); } });
  const r1 = await boom.fetch(mk("GET", "/catalogue"), env);
  assert.equal(r1.status, 500); assertCors(r1, ORIGIN, "worker 500"); assertNoLeak(await bodyText(r1), "worker 500");
  const refused = createWorker();   // no DB binding: buildDeps refuses
  const r2 = await refused.fetch(mk("GET", "/catalogue"), env);
  assert.equal(r2.status, 503); assertCors(r2, ORIGIN, "worker deps_unavailable");
  const r3 = await refused.fetch(mk("GET", "/health"), env);
  assertCors(r3, ORIGIN, "worker health");
  const r4 = await refused.fetch(mk("OPTIONS", "/checkout"), env);
  assert.equal(r4.status, 204); assertCors(r4, ORIGIN, "worker preflight");
  const r5 = await refused.fetch(mk("GET", "/catalogue"), {});
  assert.deepEqual(acHeaders(r5), []);
});

// ---- every route x every method, with deps, with and without auth ----
test("cors: every path x every method (deps wired, origin set): allow-origin exact, vary, no credentials, hostile Origin never reflected", async () => {
  const h = make();
  const tok = (await h.login("c@d.com.au")).session;
  let n = 0;
  for (const p of PATHS) for (const m of METHODS) for (const auth of [false, true]) {
    const headers: Record<string, string> = { origin: HOSTILE[n % HOSTILE.length] };
    if (auth) headers.authorization = `Bearer ${tok}`;
    const r = await handle(mk(m, p, headers, "{}"), { TITANOS_SITE_ORIGIN: ORIGIN }, h.deps);
    assertCors(r, ORIGIN, `${m} ${p} auth=${auth} -> ${r.status}`);
    assertNoLeak(await bodyText(r), `${m} ${p}`);
    n++;
  }
  assert.ok(n >= PATHS.length * METHODS.length * 2);
});
test("cors: every path x every method with TITANOS_SITE_ORIGIN unset: no access-control-* header at all (deps wired and not wired)", async () => {
  const h = make();
  for (const p of PATHS) for (const m of METHODS) for (const deps of [h.deps, undefined]) {
    const r = await handle(mk(m, p, { origin: ORIGIN }, "{}"), {}, deps);
    assertCors(r, undefined, `${m} ${p} deps=${!!deps} -> ${r.status}`);
  }
});
test("cors: no-deps 503 and /health (200 and 405) carry CORS when the origin is set", async () => {
  const env = { TITANOS_SITE_ORIGIN: ORIGIN };
  const a = await handle(mk("POST", "/checkout"), env, undefined);
  assert.equal(a.status, 503); assertCors(a, ORIGIN, "no deps");
  const b = await handle(mk("GET", "/health"), env, undefined);
  assert.equal(b.status, 200); assertCors(b, ORIGIN, "health");
  const c = await handle(mk("POST", "/health"), env, undefined);
  assert.equal(c.status, 405); assertCors(c, ORIGIN, "health 405");
});
test("cors: response classes 2xx, 401, 404, 405 (/mcp GET), 413, 400 observed on real routes", async () => {
  const h = make();
  const env = { TITANOS_SITE_ORIGIN: ORIGIN };
  const seen = new Map<number, Response>();
  seen.set(200, await handle(mk("GET", "/catalogue"), env, h.deps));
  seen.set(401, await handle(mk("GET", "/me"), env, h.deps));
  seen.set(404, await handle(mk("GET", "/nope", { authorization: `Bearer ${(await h.login("n@o.com.au")).session}` }), env, h.deps));
  seen.set(405, await handle(mk("GET", "/mcp"), env, h.deps));
  seen.set(413, await handle(mk("POST", "/auth/request", {}, JSON.stringify({ email: "x".repeat(70_000) })), env, h.deps));
  seen.set(400, await handle(mk("POST", "/auth/request", {}, "{nope"), env, h.deps));
  for (const [s, r] of seen) { assert.equal(r.status, s); assertCors(r, ORIGIN, `class ${s}`); }
});

// ---- preflight ----
test("cors: preflight is 204, empty body, lists methods and headers, needs no auth, on every path", async () => {
  const h = make();
  for (const p of PATHS) for (const hostile of [undefined, ...HOSTILE]) {
    const headers: Record<string, string> = { "access-control-request-method": "DELETE", "access-control-request-headers": "authorization, content-type" };
    if (hostile) headers.origin = hostile;
    for (const deps of [h.deps, undefined]) {
      const r = await handle(mk("OPTIONS", p, headers), { TITANOS_SITE_ORIGIN: ORIGIN }, deps);
      if (p === "/health") continue;   // /health is not a CORS-preflight target: its own method guard answers (covered above)
      assert.equal(r.status, 204, `OPTIONS ${p}`);
      assert.equal(await r.text(), "", "preflight body must be empty");
      assertCors(r, ORIGIN, `preflight ${p}`);
      const ms = (r.headers.get("access-control-allow-methods") ?? "").split(/\s*,\s*/);
      for (const need of ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]) assert.ok(ms.includes(need), `${p}: allow-methods lacks ${need}`);
      const hs = (r.headers.get("access-control-allow-headers") ?? "").toLowerCase();
      assert.ok(hs.includes("authorization") && hs.includes("content-type"));
    }
  }
});
test("cors: preflight with origin unset sends no access-control-* header", async () => {
  const r = await handle(mk("OPTIONS", "/checkout", { origin: ORIGIN }), {}, make().deps);
  assert.equal(r.status, 204); assert.deepEqual(acHeaders(r), []);
});

// ---- the configured value itself ----
test("cors: a misconfigured TITANOS_SITE_ORIGIN of * or null is never echoed (fail closed: no header)", async () => {
  const h = make();
  for (const bad of ["*", "null", "", " * "]) for (const [m, p] of [["GET", "/catalogue"], ["OPTIONS", "/me"], ["GET", "/health"]] as const) {
    const r = await handle(mk(m, p), { TITANOS_SITE_ORIGIN: bad }, h.deps);
    assert.deepEqual(acHeaders(r), [], `origin=${JSON.stringify(bad)} ${m} ${p}`);
  }
});
test("cors: vary keeps pre-existing values (invoice vary: accept) and adds origin", async () => {
  const h = make();
  const me = await h.login("v@w.com.au");
  const r = await handle(mk("GET", "/invoices/none", { authorization: `Bearer ${me.session}` }), { TITANOS_SITE_ORIGIN: ORIGIN }, h.deps);
  assert.ok(/\borigin\b/i.test(r.headers.get("vary") ?? ""));
  const direct = await import("../src/http.ts");
  assert.ok(direct.text("x", "text/plain", { vary: "accept" }).headers.get("vary") === "accept");
});
test("cors: the reflected-origin mutant is detectable (self-check of the assertions)", async () => {
  // A response that echoes the request Origin must FAIL assertCors for a hostile origin.
  const evil = new Response("{}", { headers: { "access-control-allow-origin": "https://evil.example", vary: "origin" } });
  assert.throws(() => assertCors(evil, ORIGIN, "mutant"));
});
void T0;
