// test_portal_signout.mjs - f404: lib/portal.ts signOut revokes the session on the server (POST /auth/logout with the Bearer
// token), then clears local state even when the POST fails; a second sign-out is a no-op. Mock backend only, no live calls.
// Run: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_portal_signout.mjs
// F404_MUTANTS=1 also plants 2 mutants (POST dropped; local clear skipped on error) and requires both to be caught.
// F404_PORTAL points the suite at a mutant copy of lib/portal.ts.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORTAL_FILE = process.env.F404_PORTAL || path.join(ROOT, "lib/portal.ts");
const portal = await import(pathToFileURL(PORTAL_FILE).href);
const KEY = "titanos.session";

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log("ok  ", name); };
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), _m: m }; };
// Mock backend modelled on portal-api: /auth/logout needs a live Bearer token and deletes it; any later use of it is 401.
function backend({ down = false } = {}) {
  const live = new Set(["ll_tok_synthetic_a"]); const log = [];
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url); const auth = init.headers?.authorization ?? null; log.push({ method: init.method, path: u.pathname, auth });
    if (down) throw new TypeError("network down");
    const tok = auth?.replace(/^Bearer /, "");
    if (!tok || !live.has(tok)) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    if (u.pathname === "/auth/logout" && init.method === "POST") { live.delete(tok); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  return { fetchFn, live, log };
}
const mk = (b, tok = "ll_tok_synthetic_a") => ({ fetchFn: b.fetchFn, base: "https://api.invalid", storage: mem(tok ? { [KEY]: tok } : {}) });

await t("sends POST /auth/logout with the session token as Bearer", async () => {
  const b = backend(), api = mk(b); await portal.signOut(api);
  assert.equal(b.log.length, 1); assert.equal(b.log[0].method, "POST"); assert.equal(b.log[0].path, "/auth/logout");
  assert.equal(b.log[0].auth, "Bearer ll_tok_synthetic_a");
});
await t("the token is rejected by the backend afterwards, and local state is cleared", async () => {
  const b = backend(), api = mk(b); await portal.signOut(api);
  assert.equal(b.live.has("ll_tok_synthetic_a"), false);
  const r = await b.fetchFn(api.base + "/domains", { method: "GET", headers: { authorization: "Bearer ll_tok_synthetic_a" } });
  assert.equal(r.status, 401); assert.equal(api.storage.getItem(KEY), null); assert.equal(portal.signedIn(api), false);
});
await t("network failure: signOut resolves and local state is still cleared", async () => {
  const b = backend({ down: true }), api = mk(b);
  await assert.doesNotReject(portal.signOut(api)); assert.equal(api.storage.getItem(KEY), null); assert.equal(b.log.length, 1);
});
await t("server error (500) and already-revoked token (401): still cleared, no throw", async () => {
  for (const status of [500, 401]) {
    const api = { fetchFn: async () => new Response("{}", { status }), base: "https://api.invalid", storage: mem({ [KEY]: "ll_tok_synthetic_a" }) };
    await assert.doesNotReject(portal.signOut(api)); assert.equal(api.storage.getItem(KEY), null);
  }
});
await t("double sign-out is idempotent: second call sends nothing and does not throw", async () => {
  const b = backend(), api = mk(b); await portal.signOut(api); await portal.signOut(api);
  assert.equal(b.log.length, 1); assert.equal(api.storage.getItem(KEY), null);
});
await t("signed-out browser (no token) makes no request", async () => {
  const b = backend(), api = mk(b, null); await portal.signOut(api); assert.equal(b.log.length, 0);
});
await t("the billing page awaits signOut after account deletion", () => {
  assert.match(readFileSync(path.join(ROOT, "app/app/billing/client.tsx"), "utf8"), /await signOut\(browserApi\(\)\)/);
});

if (process.env.F404_MUTANTS === "1" && !process.env.F404_PORTAL) {
  const dir = mkdtempSync(path.join(tmpdir(), "f404-")); const src = readFileSync(PORTAL_FILE, "utf8");
  const M = [
    ["M1 POST dropped", (s) => s.replace('await call(api, "POST", "/auth/logout")', "void 0")],
    ["M2 local clear skipped on error", (s) => s.replace(/finally \{ api\.storage\.removeItem\(PORTAL\.SESSION_KEY\); \}/, "").replace("catch { /* the server could not be told; the local clear below still signs this browser out */ }", "catch { return; } api.storage.removeItem(PORTAL.SESSION_KEY);")],
  ];
  let killed = 0;
  for (const [name, fn] of M) {
    const out = fn(src); assert.notEqual(out, src, `mutant did not apply: ${name}`);
    const f = path.join(dir, "portal.ts"); writeFileSync(f, out);
    const r = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url)], { env: { ...process.env, F404_MUTANTS: "0", F404_PORTAL: f }, encoding: "utf8" });
    if (r.status !== 0) { killed++; console.log("kill", name); } else console.log("SURVIVED", name);
  }
  rmSync(dir, { recursive: true });
  assert.equal(killed, M.length, `F404_MUTANTS ${killed}/${M.length} killed`);
  console.log(`F404_MUTANTS ${killed}/${M.length} killed`);
}
console.log(`\n${passed} passed`);
