// test_portal_refund_pending.mjs - f244: the billing page renders POST /refunds 503 refund_record_pending calmly, shows the
// refundId, retries by replaying the same request, and still shows the generic error for other 5xx.
// Run: node scripts/test_portal_refund_pending.mjs   (F244_MUTANTS=1 also runs the mutation suite)
// Run with: node --import ./scripts/alias_loader.mjs --experimental-strip-types (portal.ts imports the "@/" alias).
// F244_LIB / F244_CLIENT / F244_PORTAL point the suite at a mutant copy of lib/refund.ts / app/app/billing/client.tsx.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = process.env.F244_LIB || path.join(ROOT, "lib/refund.ts");
const CLIENT = process.env.F244_CLIENT || path.join(ROOT, "app/app/billing/client.tsx");
const PORTAL = process.env.F244_PORTAL || path.join(ROOT, "lib/portal.ts");
const lib = await import(pathToFileURL(LIB).href);
const client = readFileSync(CLIENT, "utf8");

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log("ok  ", name); };
// Same shape as ApiError in lib/portal.ts (status, code, body).
const apiErr = (status, code, body = null) => Object.assign(new Error(code), { status, code, body });
const PUR = "pur_synthetic_1", RF = "re_synthetic_9";

await t("503 refund_record_pending returns a pending outcome with the refundId and calm text", async () => {
  const o = await lib.submitRefund(async () => { throw apiErr(503, "refund_record_pending", { error: "refund_record_pending", refundId: RF, purchaseId: PUR }); }, PUR);
  assert.equal(o.kind, "pending"); assert.equal(o.refundId, RF); assert.equal(o.purchaseId, PUR);
  assert.match(o.text, /issued with Stripe/); assert.match(o.text, /recording/);
  assert.doesNotMatch(o.text, /503|refund_record_pending|error/i);
});
await t("the billing page renders the pending notice with the refundId and a retry button", () => {
  assert.match(client, /submitRefund/); assert.match(client, /o\.kind === "pending"/);
  assert.match(client, /data-testid="refund-pending"/); assert.match(client, /pending\.refundId && /); assert.match(client, /<code>\{pending\.refundId\}<\/code>/);
  assert.match(client, /refund\(pending\.purchaseId, true\)/); assert.match(client, /PENDING_RETRY_LABEL/);
});
await t("retry replays the same request and converges, clearing the notice", async () => {
  const sent = []; let recorded = false, stripeCalls = 0;
  // Fake server modelled on f240: Stripe is called once per purchase; the record lands on the second request.
  const send = async () => {
    sent.push(JSON.stringify({ purchaseId: PUR }));
    if (stripeCalls === 0) stripeCalls++;
    if (!recorded) { recorded = true; throw apiErr(503, "refund_record_pending", { refundId: RF, purchaseId: PUR }); }
    return { status: "refunded", purchaseId: PUR };
  };
  const first = await lib.submitRefund(send, PUR);
  assert.equal(first.kind, "pending");
  const second = await lib.submitRefund(send, first.purchaseId);
  assert.equal(second.kind, "refunded"); assert.match(second.text, /Refunded in full/);
  assert.equal(stripeCalls, 1, "no second Stripe call"); assert.equal(sent[0], sent[1], "identical request replayed");
  assert.match(client, /setPending\(null\)/, "page clears the notice once the retry lands");
});
await t("a retry that is still pending shows the still-recording text, not an error", async () => {
  const o = await lib.submitRefund(async () => { throw apiErr(503, "refund_record_pending", { refundId: RF, purchaseId: PUR }); }, PUR);
  assert.equal(o.kind, "pending"); assert.match(client, /PENDING_STILL_TEXT/); assert.match(lib.PENDING_STILL_TEXT, /Still recording/);
});
await t("pending without a body still falls back to the purchaseId we sent", async () => {
  const o = await lib.submitRefund(async () => { throw apiErr(503, "refund_record_pending"); }, PUR);
  assert.equal(o.kind, "pending"); assert.equal(o.purchaseId, PUR); assert.equal(o.refundId, "");
});
await t("other 5xx and a plain 503 stay generic errors (never pending)", async () => {
  for (const [s, c] of [[500, "error"], [502, "error"], [503, "error"], [503, "store_unavailable"], [504, "error"]]) {
    const o = await lib.submitRefund(async () => { throw apiErr(s, c, { error: c }); }, PUR);
    assert.equal(o.kind, "error", `${s} ${c}`);
  }
  assert.match(client, /errorText\(o\.error\)/);
  const net = await lib.submitRefund(async () => { throw new TypeError("fetch failed"); }, PUR);
  assert.equal(net.kind, "error");
});
await t("existing outcomes unchanged: refunded, review reasons, unknown reason", async () => {
  assert.equal((await lib.submitRefund(async () => ({ status: "refunded" }), PUR)).kind, "refunded");
  const r = await lib.submitRefund(async () => ({ status: "review", reason: "outside_14_days" }), PUR);
  assert.equal(r.kind, "review"); assert.match(r.text, /14-day/);
  assert.equal((await lib.submitRefund(async () => ({ status: "review", reason: "zzz" }), PUR)).text, "Sent for review.");
});
await t("ApiError.body: portal.ts call() puts the JSON response body on the thrown ApiError (real import via alias loader)", async () => {
  const portal = await import(pathToFileURL(PORTAL).href);
  const api = (status, text) => ({ base: "http://x", storage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetchFn: async () => ({ ok: status < 400, status, text: async () => text }) });
  const body = { error: "refund_record_pending", refundId: RF, purchaseId: PUR };
  let err; try { await portal.call(api(503, JSON.stringify(body)), "POST", "/refunds", { purchaseId: PUR }); } catch (e) { err = e; }
  assert.ok(err instanceof portal.ApiError); assert.equal(err.status, 503); assert.equal(err.code, "refund_record_pending");
  assert.deepEqual(err.body, body);
  // Real portal.ts error -> real submitRefund outcome, end to end (no hand-built apiErr).
  const o = await lib.submitRefund(() => portal.call(api(503, JSON.stringify(body)), "POST", "/refunds", { purchaseId: PUR }), PUR);
  assert.equal(o.kind, "pending"); assert.equal(o.refundId, RF); assert.equal(o.purchaseId, PUR);
  // Non-JSON body and a JSON non-object body leave body null and never become pending.
  for (const text of ["upstream down", "7", ""]) {
    let e2; try { await portal.call(api(503, text), "POST", "/refunds", {}); } catch (e) { e2 = e; }
    assert.equal(e2.body, null, JSON.stringify(text)); assert.equal(e2.code, "error");
  }
  assert.equal(typeof portal.errorText(err), "string");
});
await t("client copy: no em/en dashes, no AI-tell words", () => {
  const copy = [lib.PENDING_TEXT, lib.PENDING_STILL_TEXT, lib.PENDING_RETRY_LABEL, lib.REFUNDED_TEXT, ...Object.values(lib.REFUND_TEXT)].join("\n");
  assert.doesNotMatch(copy, /[–—]/);
  assert.doesNotMatch(copy, /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|ecosystem)\b/i);
  assert.doesNotMatch(client, /[–—]/);
});

if (process.env.F244_MUTANTS === "1" && !process.env.F244_LIB) {
  const dir = mkdtempSync(path.join(tmpdir(), "f244-"));
  const libSrc = readFileSync(path.join(ROOT, "lib/refund.ts"), "utf8");
  const cliSrc = readFileSync(CLIENT, "utf8");
  const portalSrc = readFileSync(PORTAL, "utf8");
  const SRC = { lib: libSrc, cli: cliSrc, portal: portalSrc }, FILE = { lib: "refund.ts", cli: "client.tsx", portal: "portal.ts" };
  const M = [
    ["M1 lib drops the pending handler", "lib", (s) => s.replace("if (isPending(e)) {", "if (false) {")],
    ["M2 lib drops refundId", "lib", (s) => s.replace("const refundId = typeof e.body?.refundId === \"string\" ? e.body.refundId : \"\";", "const refundId = \"\";")],
    ["M3 lib treats every 503 as pending", "lib", (s) => s.replace("e.status === 503 && e.code === \"refund_record_pending\"", "e.status >= 500")],
    ["M4 lib exposes the raw code in the text", "lib", (s) => s.replace("Your refund has been issued with Stripe", "refund_record_pending: Your refund has been issued with Stripe")],
    ["M5 page drops the pending branch", "cli", (s) => s.replace('o.kind === "pending"', "false")],
    ["M6 page never clears the notice", "cli", (s) => s.replace("setPending(null);", "")],
    ["M7 page drops the refundId line", "cli", (s) => s.replaceAll("pending.refundId", "false")],
    ["M9 portal drops the response body from ApiError", "portal", (s) => s.replace("j && typeof j === \"object\" ? j : null", "null")],
    ["M8 retry sends a different request", "cli", (s) => s.replace("refund(pending.purchaseId, true)", "refund('other', true)")],
  ];
  let killed = 0;
  for (const [name, which, fn] of M) {
    const out = fn(SRC[which]);
    assert.notEqual(out, SRC[which], `mutant did not apply: ${name}`);
    const f = path.join(dir, FILE[which]); writeFileSync(f, out);
    const env = { ...process.env, F244_MUTANTS: "0" };
    env[{ lib: "F244_LIB", cli: "F244_CLIENT", portal: "F244_PORTAL" }[which]] = f;
    const r = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url)], { env, encoding: "utf8" });
    if (r.status !== 0) { killed++; console.log("kill", name); } else console.log("SURVIVED", name);
  }
  rmSync(dir, { recursive: true });
  assert.equal(killed, M.length, `F244_MUTANTS ${killed}/${M.length} killed`);
  console.log(`F244_MUTANTS ${killed}/${M.length} killed`);
}
console.log(`\n${passed} passed`);
