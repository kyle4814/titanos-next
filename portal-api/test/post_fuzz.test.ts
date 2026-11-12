// C2 naive-user residual (f182): seeded fuzz over every mutating route of the portal-api worker. Synthetic data only.
// Replay: FUZZ_SEED=<n> npm test -- or FUZZ_ONLY="POST /keys" to run one route.
import { MemorySubscriberStore } from "../src/subscribe.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/index.ts";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { MockIdp } from "../src/enterprise/sso.ts";
import { SyntheticScan } from "../src/enterprise/estate.ts";
import { RATE_V1 } from "../src/enterprise/share.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore } from "../src/owner/engine.ts";
import { MemoryMarketStore } from "../src/market/store.ts";
import { MockPayments } from "../src/market/payments.ts";
import { D1Store } from "../src/d1store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { make, SECRET, RECEIPT_SECRET } from "./harness.ts";
import { makeEntDeps, INTERNAL as ENT_INTERNAL } from "./ent_harness.ts";
import { healthy } from "./owner_harness.ts";
import { faulty } from "./market_harness.ts";
import { ownerRejectedPaths } from "./post_fuzz_lib.ts";
import { buildOwnerRejectRig } from "./owner_reject_rig.ts";
import { enumerateRoutes, prng, structuralBodies, fieldBodies, fieldNames, snapshot, judge, WEIRD_IDS, CANARY, CANARY2, CAP, MUTATING, type Route, type BodyCase, type Observed } from "./post_fuzz_lib.ts";

export const SEED = Number(process.env.FUZZ_SEED ?? 0x5eedf182) >>> 0;
const FIELD_CASES = Number(process.env.FUZZ_FIELD_CASES ?? 28);
const MKT_INTERNAL = "market_fuzz_internal_secret";
console.log(`FUZZ SEED=${SEED} (replay: FUZZ_SEED=${SEED}; FUZZ_ONLY="POST /keys" limits to one route)`);

// ---------------- rig: every optional dep wired so no route stops at a 503 ----------------
// FUZZ_STORE=d1 (f188): the Worker Store is D1Store over FakeD1 (node:sqlite, real migrations, foreign keys ON). owner/market/enterprise
// stores stay in memory (no D1 adapter on any branch, f212 receipt) and are labelled so in the totals line.
export const STORE_KIND = process.env.FUZZ_STORE === "d1" ? "d1" : "memory";
export const fakeD1 = STORE_KIND === "d1" ? new FakeD1() : undefined;
// Full-database dump (every table, rows ordered by their JSON) so a D1 write is visible to the snapshot exactly as a Map change is.
function dumpD1(d: FakeD1): unknown {
  const tabs = d.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  return Object.fromEntries(tabs.map((t) => [t.name, (d.db.prepare(`SELECT * FROM "${t.name}"`).all() as unknown[]).map((r) => JSON.stringify(r)).sort()]));
}
async function buildRig() {
  const h = fakeD1 ? make(new D1Store(fakeD1)) : make();
  const domain = "fuzz-a.com.au";
  const world = faulty(domain), zone = new MemoryZone(world);
  const marketStore = new MemoryMarketStore(), payments = new MockPayments(), ownerStore = new MemoryOwnerStore();
  const ed = makeEntDeps(RATE_V1, "memory"), entStore = ed.store, payouts = ed.payouts;   // f367: full ent deps from ent_harness (store, approvals, book, seal keys)
  h.deps.market = { store: marketStore, payments, doh: (d) => { if (d !== domain) throw new Error("no zone " + d); return zone.doh; }, internalSecret: MKT_INTERNAL };
  h.deps.subscribers = new MemorySubscriberStore();   // release 2026-11-13: /v1/subscribe returns 503 without its store, which the fuzz judge rightly flags
  h.deps.owner = { store: ownerStore, doh: () => zone.doh, zones: { zoneFor: (x) => (x === domain ? zone : undefined) } };
  h.deps.ent = { ...ed.ent, payoutLookup: { async lookup() { return { found: false as const }; } } };   // f367: sweep route needs the provider lookup, else 503
  const a = await h.login("fuzz.a@example.com"), b = await h.login("fuzz.b@example.com"), p = await h.login("fuzz.p@example.com");
  const { d } = await h.verifiedDomain(a.session, domain);
  const ids: Record<string, string> = { domains: d.id, fixes: "fix_1", cards: "card_1", payouts: "po_1", sso: "slug-ent", portal: "slug-ent" };
  const prov = (body: unknown) => h.req("POST", "/internal/tenants/provision", { body, headers: { "x-internal-secret": ENT_INTERNAL } });
  const ent = await h.j(await prov({ kind: "enterprise", name: "Fuzz Ent", slug: "slug-ent", adminEmail: "fuzz.a@example.com" }));
  const par = await h.j(await prov({ kind: "partner", name: "Fuzz Partner", slug: "slug-par", adminEmail: "fuzz.p@example.com" }));
  ids.enterprise = ent.id; ids.tenants = ent.id; ids.partners = par.id;
  const asset = await h.j(await h.req("POST", `/enterprise/${ent.id}/assets`, { token: a.session, body: { domain: "asset.fuzz-a.com.au", label: "x" } }));
  if (asset?.id) ids.assets = asset.id;
  ids.members = a.account.id;
  const inv = await h.j(await h.req("POST", `/enterprise/${ent.id}/members`, { token: a.session, body: { email: "fuzz.invitee@example.com", role: "viewer" } }));
  if (inv?.id) ids.invites = inv.id;
  const por = await h.j(await h.req("POST", `/partners/${par.id}/portals`, { token: p.session, body: { name: "Fuzz Portal" } }));
  if (por?.id) ids.portals = por.id;
  const key = await h.j(await h.req("POST", "/keys", { token: a.session, body: { scopes: ["scan:read"] } }));
  if (key?.id) ids.keys = key.id;
  const job = await h.j(await h.req("POST", "/market/jobs", { token: a.session, body: { domainId: d.id, check: "SPF" } }));
  if (job?.job?.id) ids.jobs = job.job.id;
  const mk = await h.j(await h.req("POST", "/keys", { token: a.session, body: { scopes: ["scan:read", "account:read", "credits:read", "catalogue:read"] } }));
  const tk: string = mk.key;
  ids.subscriptions = "sub_x"; ids.invoices = "inv_x";
  return { h, a, b, p, tk, ids, domain, stores: [...(fakeD1 ? [] : [h.store]), entStore, marketStore, ownerStore, h.mailer, h.billing, payments, payouts, h.model] as unknown[] };
}
const rig = await buildRig();
const { h } = rig;

async function ensureSessions() {   // a fuzz case may legitimately end a session (e.g. a real DELETE /account); keep the rig usable
  for (const who of [rig.a, rig.b, rig.p]) {
    const r = await h.req("GET", "/me", { token: who.session });
    if (r.status === 401) { h.clock.t += 2 * 3_600_000; const e = who.account.email; const u = await h.login(e); who.session = u.session; who.account = u.account; }
  }
}

// ---------------- one request, one verdict ----------------
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | "HANG"> => new Promise((res, rej) => { const t = setTimeout(() => res("HANG"), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });
const fill = (tpl: string, pick: (prev: string) => string) => { const seg = tpl.split("/").filter(Boolean); return "/" + seg.map((s, i) => (s === ":id" ? pick(seg[i - 1] ?? "") : s)).join("/"); };
let cases = 0;
const perRoute = new Map<string, number>();
export interface Defect { route: string; auth: string; body: string; why: string[]; n: number }
const defects: Defect[] = [];
const hist = new Map<number | string, number>();
const reached = new Set<string>();   // routes where at least one case got past auth and routing into a handler (not 401, not the unmatched-path 404)

async function fire(key: string, method: string, path: string, auth: string, body: BodyCase | null, wrongMethod = false) {
  const headers: Record<string, string> = {};
  if (auth === "owner") headers.authorization = `Bearer ${rig.a.session}`;
  if (auth === "outsider") headers.authorization = `Bearer ${rig.b.session}`;
  if (auth === "partner") headers.authorization = `Bearer ${rig.p.session}`;
  if (auth === "internal") { headers.authorization = `Bearer ${rig.a.session}`; headers["x-internal-secret"] = path.startsWith("/internal/market") ? MKT_INTERNAL : ENT_INTERNAL; }
  if (auth === "apikey") headers.authorization = `Bearer ${rig.tk}`;
  if (auth === "garbage") headers.authorization = `Bearer ${CANARY}`;
  if (path.startsWith("/stripe/webhook") || path === "/mcp") headers["content-type"] = "application/json";
  const before = snapshot(...rig.stores, fakeD1 ? dumpD1(fakeD1) : null);
  const n = ++cases; perRoute.set(key, (perRoute.get(key) ?? 0) + 1);
  const o: Observed = { status: null, ctype: "", text: "", stateChanged: false, wrongMethod, rpc: path === "/mcp" };
  try {
    const init: RequestInit = { method, headers };
    if (body && body.raw !== undefined && method !== "GET" && method !== "HEAD") init.body = body.raw as BodyInit;
    const req = new Request("https://api.test" + path, init);
    const r = await withTimeout(handle(req, { TITANOS_SITE_ORIGIN: "https://titanos.tech" }, h.deps), 8000);
    if (r === "HANG") o.hung = true;
    else { o.status = r.status; o.ctype = r.headers.get("content-type") ?? ""; o.text = await r.text(); }
  } catch (e) { o.threw = String((e as Error)?.stack ?? e).split("\n").slice(0, 2).join(" | "); }
  hist.set(o.status ?? "none", (hist.get(o.status ?? "none") ?? 0) + 1);
  if (!wrongMethod && o.status !== null && o.status !== 401 && o.status !== 503 && !/"path":/.test(o.text) && o.status !== 405) reached.add(key);
  o.stateChanged = snapshot(...rig.stores, fakeD1 ? dumpD1(fakeD1) : null) !== before;
  const why = judge(o, { canaries: [CANARY, CANARY2], secrets: [SECRET, RECEIPT_SECRET, ENT_INTERNAL, MKT_INTERNAL, "sso_secret_fixture"] });
  if (process.env.FUZZ_DEBUG && why.length && defects.length < 2) console.log("DBG", method, path, o.status, o.text.slice(0, 200));
  if (why.length) defects.push({ route: `${method} ${path}`, auth, body: body ? body.label : "(none)", why, n });
  return o;
}

// ---------------- enumeration ----------------
const en = enumerateRoutes(false);
const all = enumerateRoutes(true);
const only = process.env.FUZZ_ONLY;
const routes: Route[] = en.routes.filter((r) => !only || `${r.method} ${r.template}` === only);

test("route enumeration: every mutating-method line in the router source became a route (no silent skips)", () => {
  assert.deepEqual(en.unparsed, [], "a mutating route the enumerator could not turn into a path");
  assert.ok(en.mutatingLines >= 50, `expected at least 50 mutating lines, found ${en.mutatingLines}`);
  assert.ok(en.routes.length >= en.mutatingLines, "every mutating line yields at least one route");
  for (const m of MUTATING) assert.ok(en.routes.some((r) => r.method === m), `no ${m} route found: enumerator broken?`);
  console.log(`ENUMERATED mutating lines=${en.mutatingLines} routes=${en.routes.length} (GET included: ${all.routes.length}) from index.ts + enterprise/routes.ts`);
});

const bodies = structuralBodies();
const fields = fieldNames();
for (const rt of routes) {
  const key = `${rt.method} ${rt.template}`;
  test(`fuzz ${key}`, async () => {
    await ensureSessions();
    const r = prng((SEED ^ [...key].reduce((x, c) => (Math.imul(x, 31) + c.charCodeAt(0)) >>> 0, 7)) >>> 0);
    const real = (prev: string) => rig.ids[prev] ?? "x1";
    const realPath = fill(rt.template, real);
    const auths = ["owner", "none", "garbage", "outsider", rt.template.startsWith("/partners") ? "partner" : "internal", ...(rt.template === "/mcp" ? ["apikey"] : [])];
    const bs = [...bodies, ...fieldBodies(r, fields, FIELD_CASES)];
    for (const auth of auths) for (const b of bs) await fire(key, rt.method, realPath, auth, b);
    // hostile ids in each :id position
    if (rt.template.includes(":id")) for (const w of WEIRD_IDS) for (const auth of ["owner", "internal"]) {
      const path = fill(rt.template, () => encodeURIComponent(w));
      for (const b of [bodies[0], bodies[9], fieldBodies(r, fields, 1)[0]]) await fire(key, rt.method, path, auth, b);
    }
    // wrong method on the same path: every method not declared for this template must be a 4xx
    const declared = new Set(all.routes.filter((x) => x.template === rt.template).map((x) => x.method));
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) if (!declared.has(m)) for (const auth of ["owner", "none"]) await fire(key, m, realPath, auth, bodies[9], true);
    const mine = defects.filter((d) => d.route.endsWith(realPath) || d.route.includes(rt.template.split(":id")[0]));
    assert.equal(mine.length, 0, `${mine.length} defects, first: ${JSON.stringify(mine.slice(0, 3), null, 1)}\nreplay: FUZZ_SEED=${SEED} FUZZ_ONLY=${JSON.stringify(key)}`);
  });
}

// the body cap: just under passes the cap check, just over is 413 (never 5xx, never silently truncated)
test("body cap: 65536 chars is not 413, 65537 chars is 413 on the JSON routes", async () => {
  const wrap = (len: number) => '{"a":"' + "a".repeat(len - 8) + '"}';
  for (const path of ["/auth/request", "/agent/receipts/verify", "/savings"]) {
    const under = await h.req("POST", path, { headers: { "content-type": "application/json" } });
    void under;
    const ok = await handle(new Request("https://api.test" + path, { method: "POST", body: wrap(CAP) }), {}, h.deps);
    const over = await handle(new Request("https://api.test" + path, { method: "POST", body: wrap(CAP + 1) }), {}, h.deps);
    assert.notEqual(ok.status, 413, `${path} at the cap`);
    assert.ok(ok.status < 500, `${path} at the cap`);
    assert.equal(over.status, 413, `${path} one over the cap`);
  }
});

test("coverage: every enumerated mutating route was fuzzed and the totals are reported", () => {
  if (only) return;
  const missing = en.routes.filter((r) => !perRoute.get(`${r.method} ${r.template}`));
  assert.deepEqual(missing.map((r) => `${r.method} ${r.template}`), [], "routes with zero fuzz cases");
  assert.equal(defects.length, 0, JSON.stringify(defects.slice(0, 5), null, 1));
  const unreached = en.routes.map((r) => `${r.method} ${r.template}`).filter((k) => !reached.has(k));
  assert.deepEqual(unreached, [], "routes where no case got past auth/routing into a handler: the fuzz would be testing the 401 wall only");
  const mutated = en.routes.filter((r) => (perRoute.get(`${r.method} ${r.template}`) ?? 0) >= 100).length;
  assert.equal(mutated, en.routes.length, "every route got at least 100 cases");
  console.log(`FUZZ SEED=${SEED} CASES=${cases} ROUTES=${en.routes.length} METHODS=${[...new Set(en.routes.map((r) => r.method))].join(",")} STORE=${STORE_KIND}${STORE_KIND === "d1" ? "(D1Store/FakeD1; owner,market,ent in memory)" : ""} FIELDS=${fields.length} DEFECTS=${defects.length} STATUS=${JSON.stringify(Object.fromEntries([...hist].sort()))}`);
});

// ---------------- the judge itself must be able to fail (in-suite mutants) ----------------
const base: Observed = { status: 400, ctype: "application/json", text: '{"error":"invalid_json"}', stateChanged: false };
const ctx = { canaries: [CANARY], secrets: [SECRET] };
test("judge: a clean 4xx JSON error passes", () => assert.deepEqual(judge(base, ctx), []));
test("judge mutants: 5xx, throw, hang, HTML error, no error field, state change, stack, path, echo, secret-shape, wrong-method 200 are all flagged", () => {
  const bad = (o: Partial<Observed>, re: RegExp) => assert.match(judge({ ...base, ...o }, ctx).join(";"), re);
  bad({ status: 500, text: '{"error":"internal"}' }, /5xx/);
  bad({ threw: "TypeError: x" }, /THREW/);
  bad({ hung: true, status: null }, /HANG/);
  bad({ ctype: "text/html", text: "<h1>Error</h1>" }, /not JSON/);
  bad({ text: '{"message":"x"}' }, /no string error/);
  bad({ stateChanged: true }, /STATE CHANGED/);
  bad({ text: '{"error":"x","stack":"TypeError: boom\\n    at run (file:///srv/a.ts:1:2)"}' }, /LEAK/);
  bad({ text: '{"error":"/home/tech2/x/index.ts:12"}' }, /LEAK/);
  bad({ text: `{"error":"bad ${CANARY}"}` }, /ECHO/);
  bad({ status: 200, ctype: "application/json", text: `{"ok":"${SECRET}"}` }, /ECHO/);
  bad({ text: `{"error":"${["sk", "live", "abcdefgh12345"].join("_")}"}` }, /secret-shaped/);
  bad({ status: 200, ctype: "application/json", text: "{}", wrongMethod: true }, /wrong method/);
});
// f367: JSON-RPC id exemption (POST /mcp). A real secret in ANY field other than the top-level id must still fail; widening the exemption must turn this suite red.
const rpcEcho = (body: unknown): Observed => ({ status: 200, ctype: "application/json", text: JSON.stringify(body), stateChanged: false, rpc: true });
test("rpc id exemption: the request id may be echoed at the top level of a JSON-RPC response (method_not_found, invalid_request)", () => {
  assert.deepEqual(judge(rpcEcho({ jsonrpc: "2.0", id: CANARY2, error: { code: -32601, message: "method_not_found" } }), ctx), []);
  assert.deepEqual(judge(rpcEcho({ jsonrpc: "2.0", id: CANARY, error: { code: -32600, message: "invalid_request" } }), ctx), []);
});
test("rpc id exemption: a real secret echoed in a non-id field still fails the check", () => {
  for (const body of [
    { jsonrpc: "2.0", id: 1, error: { code: -32601, message: `method_not_found ${CANARY}` } },
    { jsonrpc: "2.0", id: 1, error: { code: -32602, message: "x", data: { id: CANARY } } },          // nested id is NOT the exempt member
    { jsonrpc: "2.0", id: 1, result: { id: CANARY } },
    { jsonrpc: "2.0", id: CANARY, result: { token: CANARY } },                                          // exempt id present, but the secret is also elsewhere
    { jsonrpc: "2.0", id: 1, ID: CANARY },
  ]) assert.match(judge(rpcEcho(body), ctx).join(";"), /ECHO/, JSON.stringify(body).slice(0, 80));
  assert.match(judge({ ...rpcEcho({ x: 1 }), text: `{"id":"${CANARY}"` }, ctx).join(";"), /ECHO/, "unparseable text is checked whole");
  assert.match(judge({ ...rpcEcho({ jsonrpc: "1.0", id: CANARY }) }, ctx).join(";"), /ECHO/, "not a JSON-RPC 2.0 object: no exemption");
  assert.match(judge({ ...rpcEcho({ jsonrpc: "2.0", id: CANARY }), rpc: false }, ctx).join(";"), /ECHO/, "non-/mcp routes get no exemption");
});
test("rpc id exemption MUTATION: a widened exemption (strip every id at any depth) lets a nested secret through, so the check above would go red", () => {
  const widened = (t: string) => t.replace(/"id":"[^"]*"/g, '"id":null');
  const nested = rpcEcho({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "x", data: { id: CANARY } } });
  assert.match(judge(nested, ctx).join(";"), /ECHO/, "real exemption flags it");
  assert.deepEqual(judge(nested, ctx, widened), [], "the widened mutant MISSES it: that is the red the real test would show");
  const wholeBody = (_t: string) => "{}";   // second mutant: exempt the whole /mcp body
  assert.deepEqual(judge(rpcEcho({ jsonrpc: "2.0", id: 1, result: { t: CANARY } }), ctx, wholeBody), []);
  assert.match(judge(rpcEcho({ jsonrpc: "2.0", id: 1, result: { t: CANARY } }), ctx).join(";"), /ECHO/);
});
test("snapshot: detects Map, Set, array and nested changes and ignores nothing observable", () => {
  const o = { m: new Map([["a", { x: 1 }]]), s: new Set([1]), arr: [1, { y: [2] }] };
  const s0 = snapshot(o);
  assert.equal(snapshot(o), s0);
  o.m.get("a")!.x = 2; assert.notEqual(snapshot(o), s0);
  o.m.get("a")!.x = 1; assert.equal(snapshot(o), s0);
  o.s.add(2); assert.notEqual(snapshot(o), s0); o.s.delete(2);
  (o.arr[1] as any).y.push(3); assert.notEqual(snapshot(o), s0);
});
test("enumerator mutant: a planted router line is picked up, so a new route can never be skipped", async () => {
  const { enumerateRoutes: en2 } = await import("./post_fuzz_lib.ts");
  assert.ok(en2().routes.some((r) => r.template === "/keys/:id" && r.method === "DELETE"));
  assert.ok(en2().routes.some((r) => r.template === "/internal/payouts/:id/approve") && en2().routes.some((r) => r.template === "/internal/payouts/:id/reject"), "|| alternatives expand");
});

// f368: the STATE CHANGED check for the owner rejections the route fuzz cannot reach on its own (they need an applied fix and a tampered zone first).
test("owner rejected paths (f368 four + f375 scan_too_soon, fix invalid_check, undo no_such_fix, fix no_zone, undo no_zone): no state change, synthetic data", async () => {
  const R = await buildOwnerRejectRig(STORE_KIND);
  const cs = await ownerRejectedPaths(R);
  assert.equal(cs.length, 9, "all nine owner rejections were reached");
  assert.deepEqual(cs.filter((c) => c.changed).map((c) => c.path), [], "STATE CHANGED on a rejected request");
});
