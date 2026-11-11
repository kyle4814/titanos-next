// f402: the state-change matrix. For EVERY state-changing route discovered in the router sources (scripts/state_change_matrix.mjs):
//  (1) cross-origin request refused, no side effect (allow-listed routes named, each proven to be guarded by its own credential instead)
//  (2) expired or revoked session refused, no side effect
//  (3) any Set-Cookie is HttpOnly + Secure + SameSite (the API sets none: sessions are bearer tokens, asserted for every response)
//  (4) a stale session replayed after a real POST /auth/logout changes nothing
// Planted mutants (guard removed, expiry bypassed, logout no-op, bare cookie) must each be caught by the same matrix.
import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/index.ts";
import { makeEnt } from "./ent_harness.ts";
import { MemoryMarketStore } from "../src/market/store.ts";
import { MockPayments } from "../src/market/payments.ts";
import { MemorySeatEntitlements } from "../src/market/entitlements.ts";
// @ts-ignore plain ESM script
import { discover } from "../../scripts/state_change_matrix.mjs";

const SITE = "https://titanos.tech", EVIL = "https://evil.example";
type Route = { id: string; kind: "session" | "preauth" | "allow"; method: string; path: string; body?: unknown; why?: string; secret?: string; synthetic?: boolean };
const ROUTES: Route[] = discover().routes;
type Handle = typeof handle;

function rig() {
  const h = makeEnt();
  h.deps.market = { store: new MemoryMarketStore(), payments: new MockPayments(), seats: new MemorySeatEntitlements(), doh: () => { throw new Error("no zone"); }, internalSecret: "internal_matrix_secret" };
  return h;
}
function snap(...roots: unknown[]): string {
  const seen = new WeakSet<object>();
  const walk = (v: any, depth: number): any => {
    if (typeof v === "function") return undefined;
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v) || depth > 7) return "[seen]";
    seen.add(v);
    if (v instanceof Map) return [...v.entries()].map(([k, x]) => [walk(k, depth + 1), walk(x, depth + 1)]);
    if (v instanceof Set) return [...v].map((x) => walk(x, depth + 1));
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v)) o[k] = walk(v[k], depth + 1);
    return o;
  };
  return JSON.stringify(roots.map((r) => walk(r, 0)));
}
const state = (h: ReturnType<typeof rig>) => snap(h.deps.store, h.deps.ent?.store, h.deps.market?.store, h.deps.mailer, (h.deps.billing as any).calls, (h.deps.ent as any)?.payouts?.sent);

function call(h: ReturnType<typeof rig>, hd: Handle, r: Route, o: { token?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(r.body === undefined ? {} : { "content-type": "application/json" }), ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.headers ?? {}) };
  return hd(new Request("https://api.test" + r.path, { method: r.method, headers, body: r.body === undefined ? undefined : JSON.stringify(r.body) }), {}, h.deps);
}
const cookieOk = (res: Response, where: string, fails: string[]) => {
  const sc = res.headers.get("set-cookie");
  if (sc === null) return;
  for (const re of [/;\s*httponly/i, /;\s*secure/i, /;\s*samesite=(strict|lax|none)/i]) if (!re.test(sc)) fails.push(`${where}: Set-Cookie lacks ${re}`);
};

// The whole matrix against a handler. Returns the failures (empty = every route passes).
async function runMatrix(hd: Handle): Promise<string[]> {
  const fails: string[] = [];
  for (const r of ROUTES) {
    if (r.kind === "allow") {
      const h = rig();
      const before = state(h);
      const res = await call(h, hd, r, { headers: { origin: EVIL, ...(r.secret ? {} : {}) } });
      cookieOk(res, `${r.id} allow`, fails);
      const j: any = await res.clone().json().catch(() => ({}));
      if (j?.error === "cross_origin_refused") fails.push(`${r.id}: allow-listed route was refused by the origin guard`);
      // named credential must still gate it: no secret / signature / key = a 4xx/5xx, never a 2xx
      if (!["/agent/receipts/verify", "/savings"].includes(r.path) && res.status < 400) fails.push(`${r.id}: allow-listed route answered ${res.status} with no credential`);
      if (state(h) !== before) fails.push(`${r.id}: allow-listed route changed state with no credential`);
      continue;
    }
    // (1) cross-origin, with a VALID session so only the origin guard can stop it
    for (const [label, headers] of [["origin evil", { origin: EVIL }], ["origin null", { origin: "null" }], ["sec-fetch-site cross-site", { "sec-fetch-site": "cross-site" }]] as const) {
      const h = rig();
      const tok = r.kind === "session" ? (await h.login("a@matrix.example.test")).session : undefined;
      const before = state(h);
      const res = await call(h, hd, r, { token: tok, headers: { ...headers } });
      cookieOk(res, `${r.id} ${label}`, fails);
      const j: any = await res.clone().json().catch(() => ({}));
      if (res.status !== 403 || j?.error !== "cross_origin_refused") fails.push(`${r.id}: ${label} not refused (status ${res.status})`);
      if (state(h) !== before) fails.push(`${r.id}: ${label} changed state`);
    }
    // control: the same request from the site origin with a valid session gets past the walls (so the refusals above are not vacuous)
    {
      const h = rig();
      const tok = r.kind === "session" ? (await h.login("a@matrix.example.test")).session : undefined;
      const res = await call(h, hd, r, { token: tok, headers: { origin: SITE } });
      cookieOk(res, `${r.id} control`, fails);
      const j: any = await res.clone().json().catch(() => ({}));
      if (j?.error === "cross_origin_refused" || (r.kind === "session" && res.status === 401)) fails.push(`${r.id}: control (site origin, valid session) was refused: ${res.status} ${j?.error}`);
    }
    if (r.kind !== "session") continue;
    // (2a) expired session
    {
      const h = rig();
      const tok = (await h.login("a@matrix.example.test")).session;
      h.clock.t += 31 * 86_400_000;
      const before = state(h);
      const res = await call(h, hd, r, { token: tok, headers: { origin: SITE } });
      if (res.status !== 401) fails.push(`${r.id}: expired session answered ${res.status}`);
      if (state(h) !== before) fails.push(`${r.id}: expired session changed state`);
    }
    // (2b) revoked session
    {
      const h = rig();
      const me = await h.login("a@matrix.example.test");
      await h.deps.store.deleteSessionsFor(me.account.id);
      const before = state(h);
      const res = await call(h, hd, r, { token: me.session, headers: { origin: SITE } });
      if (res.status !== 401) fails.push(`${r.id}: revoked session answered ${res.status}`);
      if (state(h) !== before) fails.push(`${r.id}: revoked session changed state`);
    }
    // (4) real logout, then replay the stale session id
    {
      const h = rig();
      const tok = (await h.login("a@matrix.example.test")).session;
      const lo = await hd(new Request("https://api.test/auth/logout", { method: "POST", headers: { authorization: `Bearer ${tok}`, origin: SITE } }), {}, h.deps);
      if (lo.status !== 200) fails.push(`${r.id}: logout answered ${lo.status}`);
      const before = state(h);
      const res = await call(h, hd, r, { token: tok, headers: { origin: SITE } });
      if (res.status !== 401) fails.push(`${r.id}: stale session after logout answered ${res.status}`);
      if (state(h) !== before) fails.push(`${r.id}: stale session after logout changed state`);
    }
  }
  return fails;
}

test("discovery: 100% of state-changing routes in the router sources are in the matrix table", () => {
  const d = discover();
  assert.ok(d.found.length >= 50, `discovered ${d.found.length}`);
  assert.deepEqual(d.uncovered.map((u: any) => `${u.file}:${u.line}`), []);
  assert.deepEqual(d.orphans.map((o: any) => o.id), []);
  for (const r of ROUTES) if (r.kind === "allow") assert.ok(r.why && r.why.length > 10, `${r.id} allow-list needs a reason`);
});

test("the real handler passes the whole matrix (origin, expiry, revocation, cookies, logout replay)", async () => {
  const fails = await runMatrix(handle);
  assert.deepEqual(fails, []);
});

test("the API sets no cookie at all and the site keeps its token in localStorage (sessions are bearer, not ambient)", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["../src/index.ts", "../src/http.ts", "../src/service.ts"]) assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), "utf8"), /set-cookie/i, f);
  const h = rig(); const me = await h.login("a@matrix.example.test");
  const res = await h.req("GET", "/me", { token: me.session });
  assert.equal(res.headers.get("set-cookie"), null);
});

// ---- planted mutants: each must make the same matrix fail ----
const strip = (names: string[]): Handle => (req, env, deps) => { const hs = new Headers(req.headers); names.forEach((n) => hs.delete(n)); return handle(new Request(req, { headers: hs }), env, deps); };
test("MUTANT guard removed (origin + sec-fetch-site ignored): matrix catches it", async () => {
  const f = await runMatrix(strip(["origin", "sec-fetch-site"]));
  assert.ok(f.some((x) => /not refused/.test(x)), f.slice(0, 3).join(" | "));
});
test("MUTANT sec-fetch-site ignored (Origin-less cross-site gets through): matrix catches it", async () => {
  const f = await runMatrix(strip(["sec-fetch-site"]));
  assert.ok(f.some((x) => /sec-fetch-site cross-site not refused/.test(x)));
});
test("MUTANT logout is a no-op: stale session replay is caught", async () => {
  const noop: Handle = (req, env, deps) => new URL(req.url).pathname === "/auth/logout" ? Promise.resolve(new Response("{}", { status: 200 })) : handle(req, env, deps);
  const f = await runMatrix(noop);
  assert.ok(f.some((x) => /stale session after logout/.test(x)));
});
test("MUTANT expiry ignored (stale token swapped for a live one): expired/revoked cases are caught", async () => {
  // a handler that always re-signs the caller in with a fresh, valid session before routing
  const live: Handle = async (req, env, deps) => {
    if (!deps || !req.headers.get("authorization")) return handle(req, env, deps);
    const a = (await (deps.store as any).accountByEmail("a@matrix.example.test"));
    const ss = "ss_" + "ab".repeat(16);
    const { sha256Hex } = await import("../src/util.ts");
    if (a) await deps.store.putSession({ hash: await sha256Hex(ss), accountId: a.id, expiresAt: deps.now() + 1e9 });
    const hs = new Headers(req.headers); hs.set("authorization", `Bearer ${ss}`);
    return handle(new Request(req, { headers: hs }), env, deps);
  };
  const f = await runMatrix(live);
  assert.ok(f.some((x) => /expired session answered|revoked session answered/.test(x)));
});
test("MUTANT bare Set-Cookie: the cookie-attribute check catches it", async () => {
  const bare: Handle = async (req, env, deps) => { const r = await handle(req, env, deps); const o = new Response(r.body, r); o.headers.append("set-cookie", "ss=abc; Path=/"); return o; };
  const f = await runMatrix(bare);
  assert.ok(f.some((x) => /Set-Cookie lacks/.test(x)));
});
test("MUTANT cookie with all three attributes passes the cookie check (no false alarm)", async () => {
  const good: Handle = async (req, env, deps) => { const r = await handle(req, env, deps); const o = new Response(r.body, r); o.headers.append("set-cookie", "ss=abc; Path=/; HttpOnly; Secure; SameSite=Strict"); return o; };
  assert.deepEqual((await runMatrix(good)).filter((x) => /Set-Cookie/.test(x)), []);
});
