// f23: the signed-in Keys page controller (lib/keysPage.ts) driven against the REAL Worker handler (MemoryStore, synthetic data).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { make } from "./harness.ts";
import { SCOPES } from "../src/agent/tools.ts";
import { DEFAULT_KEY_CAP_DAILY, DEFAULT_KEY_CAP_TOTAL, MAX_KEY_CAP_DAILY, MAX_KEY_CAP_TOTAL } from "../src/agent/caps.ts";
import { handle } from "../src/index.ts";
import { KeysController, MemoryKeysCall, SCOPE_IDS, CAP_DEFAULTS, CAP_MAX, type CallFn } from "../../lib/keysPage.ts";

const CONTACT = "help@example.com.au"; // synthetic contact; the page passes SITE.KYLE_EMAIL
// The page's `call` (lib/portal.ts) as a fetch against the handler: same status/code semantics as ApiError.
function viaHandler(h: ReturnType<typeof make>, session: string | null): CallFn {
  return async (method, path, body) => {
    const r = await h.req(method, path, { token: session ?? undefined, body });
    const text = await r.text();
    let j: any = null; try { j = text ? JSON.parse(text) : null; } catch { /* */ }
    if (!r.ok) throw Object.assign(new Error(j?.error ?? "error"), { status: r.status, code: j?.error ?? "error" });
    return j;
  };
}
const ctlFor = (call: CallFn, signed = true) => new KeysController(call, CONTACT, () => signed);
const closedHandler: CallFn = async (method, path, body) => {
  const r = await handle(new Request("https://api.test" + path, { method, headers: { authorization: "Bearer ss_abc" }, body: body ? JSON.stringify(body) : undefined }), {}, undefined);
  const j: any = await r.json(); throw Object.assign(new Error(j.error), { status: r.status, code: j.error });
};

test("scope list, defaults and limits match the server (no drift)", () => {
  assert.deepEqual([...SCOPE_IDS].sort(), [...SCOPES].sort());
  assert.deepEqual([CAP_DEFAULTS.daily, CAP_DEFAULTS.total, CAP_MAX.daily, CAP_MAX.total], [DEFAULT_KEY_CAP_DAILY, DEFAULT_KEY_CAP_TOTAL, MAX_KEY_CAP_DAILY, MAX_KEY_CAP_TOTAL]);
});

test("list shows non-secret prefix id, scopes, caps and spend; empty account is ready with no keys", async () => {
  const h = make(); const s = await h.login("owner@example.com.au"); const c = ctlFor(viaHandler(h, s.session));
  await c.load(); assert.equal(c.state.status, "ready"); assert.deepEqual(c.state.keys, []);
  await c.create(["catalogue:read", "credits:read"], { capDaily: 40, capTotal: 90 });
  const k = c.state.keys[0];
  assert.match(k.prefix!, /^tk_[0-9a-f]{8}$/); assert.deepEqual(k.scopes, ["catalogue:read", "credits:read"]);
  assert.deepEqual([k.capDaily, k.capTotal, k.spentToday, k.spentTotal, k.revoked], [40, 90, 0, 0, false]);
});

test("secret: shown once after create, never in the list, gone after dismiss, reload or the next create", async () => {
  const h = make(); const s = await h.login("owner@example.com.au");
  const c = ctlFor(viaHandler(h, s.session));
  const snaps: string[] = []; c.subscribe(() => snaps.push(JSON.stringify(c.getState())));
  await c.create(["catalogue:read"]);
  const first = c.state.fresh!.secret; assert.match(first, /^tk_[0-9a-f]{48}$/);
  assert.ok(first.startsWith(c.state.keys[0].prefix!), "prefix is the secret's head");
  assert.ok(!JSON.stringify(c.state.keys).includes(first), "list rows never carry the secret");
  assert.ok(!(await (await h.req("GET", "/keys", { token: s.session })).text()).includes(first), "server list never carries it");
  c.dismissFresh(); assert.equal(c.state.fresh, null);
  const cut = snaps.length;
  await c.load(); assert.equal(c.state.fresh, null);
  assert.ok(snaps.slice(cut - 1).every((x) => !x.includes(first)), "no snapshot after dismiss contains it");
  assert.ok(!JSON.stringify(c.state).includes(first));
  await c.create(["catalogue:read"]); const second = c.state.fresh!.secret; assert.notEqual(second, first);
  assert.ok(!JSON.stringify(c.state).includes(first), "a new create replaces the old secret");
});

test("secret is never logged, and the controller source has no logging or persistence", async () => {
  const h = make(); const s = await h.login("owner@example.com.au"); const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  const out: string[] = []; for (const k of Object.keys(orig) as (keyof typeof orig)[]) (console as any)[k] = (...a: unknown[]) => out.push(a.join(" "));
  let secret = "";
  try { const c = ctlFor(viaHandler(h, s.session)); await c.create(["catalogue:read"]); secret = c.state.fresh!.secret; c.dismissFresh(); await c.load(); }
  finally { Object.assign(console, orig); }
  assert.ok(secret); assert.ok(!out.join("\n").includes(secret), "nothing logged");
  assert.doesNotMatch(readFileSync(new URL("../../lib/keysPage.ts", import.meta.url), "utf8"), /console\.|localStorage|sessionStorage|setItem/);
  assert.doesNotMatch(readFileSync(new URL("../../app/app/keys/client.tsx", import.meta.url), "utf8"), /console\.|localStorage\.setItem|sessionStorage|\.secret.*(href|searchParams|location)/);
});

test("revoke: UI state drops access at once, server confirms, the key stops working, others untouched", async () => {
  const h = make(); const s = await h.login("owner@example.com.au"); const c = ctlFor(viaHandler(h, s.session));
  await c.create(["catalogue:read"]); const a = c.state.fresh!; await c.create(["catalogue:read"]); const b = c.state.fresh!;
  const use = (key: string) => h.req("POST", "/mcp", { token: key, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
  assert.equal((await use(a.secret)).status, 200);
  await c.revoke(a.id);
  assert.equal(c.state.keys.find((k) => k.id === a.id)!.revoked, true); assert.equal(c.state.keys.find((k) => k.id === b.id)!.revoked, false);
  assert.equal((await use(a.secret)).status, 401, "revoked key refused by the server");
  assert.equal((await use(b.secret)).status, 200);
  await c.revoke(a.id); assert.equal(c.state.status, "ready", "revoking twice is harmless");
});

test("revoke flips the row before the reload lands (optimistic state), and clears an on-screen secret for that key", async () => {
  const m = new MemoryKeysCall(); const c = ctlFor(m.call); await c.create(["catalogue:read"]);
  const id = c.state.fresh!.id; let flipped = false; c.subscribe(() => { if (c.state.keys[0]?.revoked && m.calls.at(-1) === "DELETE /keys/" + id) flipped = true; });
  await c.revoke(id); assert.ok(flipped, "revoked row visible straight after DELETE, before the reload"); assert.equal(c.state.fresh, null);
});

test("caps: edit via PATCH, server validation text shown, defaults used when blank", async () => {
  const h = make(); const s = await h.login("owner@example.com.au"); const c = ctlFor(viaHandler(h, s.session));
  await c.create(["catalogue:read"]); assert.deepEqual([c.state.keys[0].capDaily, c.state.keys[0].capTotal], [500, 2000]);
  const id = c.state.keys[0].id;
  await c.setCaps(id, { capDaily: 25 }); assert.equal(c.state.keys[0].capDaily, 25); assert.equal(c.state.keys[0].capTotal, 2000);
  await c.setCaps(id, { capDaily: 999999999 }); assert.match(c.state.message, /daily cap must be/); assert.equal(c.state.keys[0].capDaily, 25);
  await c.setCaps(id, {}); assert.match(c.state.message, /Enter a cap/);
  await c.create(["catalogue:read"], { capTotal: -1 }); assert.match(c.state.message, /total cap must be/);
});

test("no permission chosen or unknown scope: nothing is sent", async () => {
  const m = new MemoryKeysCall(); const c = ctlFor(m.call); await c.load(); const before = m.calls.length;
  await c.create([]); assert.equal(m.calls.length, before); assert.match(c.state.message, /at least one permission/);
  await c.create(["not:a:scope"]); assert.equal(m.calls.length, before);
});

test("503 store_unavailable: closed state, contact line, no keys, and no create/revoke/cap call gets through", async () => {
  const c = ctlFor(closedHandler); await c.load();
  assert.equal(c.state.status, "closed"); assert.match(c.state.message, /not open yet/); assert.ok(c.state.message.includes(CONTACT)); assert.deepEqual(c.state.keys, []);
  let n = 0; const counting: CallFn = async (...a) => { n++; return closedHandler(...a); };
  const c2 = ctlFor(counting); await c2.load(); const after = n;
  await c2.create(["catalogue:read"]); await c2.revoke("key_x"); await c2.setCaps("key_x", { capDaily: 1 });
  assert.equal(n, after, "closed means no further API calls"); assert.equal(c2.state.fresh, null);
});

test("closed also when the store dies mid-session (secret dropped), on a bare 503 and on a 404 store_unavailable", async () => {
  const m = new MemoryKeysCall(); const c = ctlFor(m.call); await c.create(["catalogue:read"]); assert.ok(c.state.fresh);
  m.down = true; await c.load(); assert.equal(c.state.status, "closed"); assert.equal(c.state.fresh, null);
  const c3 = ctlFor(async () => { throw Object.assign(new Error("error"), { status: 503, code: "error" }); }); await c3.load(); assert.equal(c3.state.status, "closed");
  const c4 = ctlFor(async () => { throw Object.assign(new Error("x"), { status: 404, code: "store_unavailable" }); }); await c4.load(); assert.equal(c4.state.status, "closed");
});

test("signed out: no call is made; a 401 from the server returns the page to signed-out", async () => {
  const m = new MemoryKeysCall(); const c = ctlFor(m.call, false); await c.load(); assert.equal(c.state.status, "signedout"); assert.equal(m.calls.length, 0);
  const h = make(); const c2 = ctlFor(viaHandler(h, "ss_" + "0".repeat(48))); await c2.load(); assert.equal(c2.state.status, "signedout");
});

test("tenant isolation through the page: another account's key id cannot be revoked", async () => {
  const h = make(); const a = await h.login("a@example.com.au"), b = await h.login("b@example.com.au");
  const ca = ctlFor(viaHandler(h, a.session)), cb = ctlFor(viaHandler(h, b.session));
  await ca.create(["catalogue:read"]); const id = ca.state.keys[0].id; await cb.load(); assert.deepEqual(cb.state.keys, []);
  await cb.revoke(id); assert.match(cb.state.message, /not found/);
  await ca.load(); assert.equal(ca.state.keys[0].revoked, false);
});

test("an agent key cannot manage keys (the page's API is owner-session only)", async () => {
  const h = make(); const s = await h.login("owner@example.com.au"); const c = ctlFor(viaHandler(h, s.session)); await c.create(["catalogue:read"]);
  const agent = ctlFor(viaHandler(h, c.state.fresh!.secret)); await agent.load(); assert.equal(agent.state.status, "signedout");
});

test("ten active keys: the key_limit message is shown", async () => {
  const m = new MemoryKeysCall(); const c = ctlFor(m.call);
  for (let i = 0; i < 10; i++) await c.create(["catalogue:read"]);
  assert.ok(c.state.fresh, "10th key's secret is on screen");
  await c.create(["catalogue:read"]); assert.match(c.state.message, /10 active keys/);
  assert.equal(c.state.fresh, null, "a failed create does not leave the previous secret on screen");
});
