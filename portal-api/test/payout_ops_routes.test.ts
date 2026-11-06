// C8 f50 tests. SYNTHETIC data only. MockPayouts and an in-memory lookup: no Stripe, no network, no money, no scheduler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeEnt, INTERNAL } from "./ent_harness.ts";
import type { TransferLookup, TransferLookupResult } from "../src/enterprise/payout_sweep.ts";

const T0 = 1_000_000;
class Lookup implements TransferLookup {
  calls: string[] = [];
  result: TransferLookupResult = { found: false };
  async lookup(k: string) { this.calls.push(k); return this.result; }
}
async function world() {
  const e = makeEnt();
  const lookup = new Lookup();
  e.deps.ent!.payoutLookup = lookup;
  for (const [id, acct] of [["t_partner_A", "acct_SYNTH_1"], ["t_partner_B", "acct_SYNTH_2"]]) await e.store.putTenant({ id, slug: id, name: id, kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: acct });
  const add = (id: string, partnerId: string, status: string, extra: Record<string, unknown> = {}) => e.store.putPayout({ id, partnerId, amountCents: 250_000, status, createdAt: T0, ...extra } as any);
  const call = (method: string, path: string, body?: unknown, secret: string | null = INTERNAL) =>
    e.req(method, path, { body, headers: secret ? { "x-internal-secret": secret } : {} });
  return { ...e, lookup, add, call };
}
const H = "/internal/enterprise/payouts/held?tenantId=", R = "/internal/enterprise/payouts/retry", S = "/internal/enterprise/payouts/sweep";

test("no secret header = 401 on all three routes, and nothing is sent or read", async () => {
  const w = await world();
  await w.add("po_1", "t_partner_A", "approved_retry");
  for (const [m, p] of [["GET", H + "t_partner_A"], ["POST", R], ["POST", S]] as const) {
    const r = await w.call(m, p, m === "POST" ? {} : undefined, null);
    assert.equal(r.status, 401, p);
  }
  assert.equal(w.payouts.sent.length, 0);
  assert.equal(w.lookup.calls.length, 0);
  assert.equal((await w.store.payoutById("po_1"))!.status, "approved_retry");
});

test("wrong secret = 401 (same length, prefix, empty)", async () => {
  const w = await world();
  await w.add("po_1", "t_partner_A", "approved_retry");
  for (const bad of ["x".repeat(INTERNAL.length), INTERNAL.slice(0, -1), INTERNAL + "x", ""]) {
    for (const [m, p] of [["GET", H + "t_partner_A"], ["POST", R], ["POST", S]] as const) {
      const r = await w.req(m, p, { body: m === "POST" ? {} : undefined, headers: { "x-internal-secret": bad } });
      assert.equal(r.status, 401, `${p} with ${JSON.stringify(bad)}`);
    }
  }
  assert.equal(w.payouts.sent.length, 0);
});

test("no INTERNAL_API_SECRET configured = 503 fail closed, even if the caller sends a header", async () => {
  const w = await world();
  w.deps.ent!.internalSecret = undefined;
  await w.add("po_1", "t_partner_A", "approved_retry");
  for (const [m, p] of [["GET", H + "t_partner_A"], ["POST", R], ["POST", S]] as const) {
    assert.equal((await w.call(m, p, m === "POST" ? {} : undefined, "anything")).status, 503, p);
    assert.equal((await w.call(m, p, m === "POST" ? {} : undefined, null)).status, 503, p);
  }
  assert.equal(w.payouts.sent.length, 0);
});

test("held list is one tenant per call, tenant id on every row, never leaks across tenants, no secrets", async () => {
  const w = await world();
  await w.add("po_a1", "t_partner_A", "held", { reason: "retry_exhausted", attempts: 3, heldAt: T0 });
  await w.add("po_b1", "t_partner_B", "held", { reason: "provider_unknown", heldAt: T0 });
  await w.add("po_a2", "t_partner_A", "paid");
  const a = await w.j(await w.call("GET", H + "t_partner_A"));
  assert.deepEqual(a.held.map((r: any) => [r.payoutId, r.tenantId]), [["po_a1", "t_partner_A"]]);
  const b = await w.j(await w.call("GET", H + "t_partner_B"));
  assert.deepEqual(b.held.map((r: any) => [r.payoutId, r.tenantId]), [["po_b1", "t_partner_B"]]);
  const raw = JSON.stringify(a) + JSON.stringify(b);
  assert.ok(!JSON.stringify(a).includes("po_b1") && !JSON.stringify(b).includes("po_a1"));
  assert.ok(!raw.includes("acct_SYNTH") && !raw.includes(INTERNAL));
  // no tenant, bad tenant, unknown tenant: never a cross-tenant dump
  assert.equal((await w.call("GET", "/internal/enterprise/payouts/held")).status, 400);
  assert.equal((await w.call("GET", H + "t_partner_A%20OR%201")).status, 400);
  assert.deepEqual((await w.j(await w.call("GET", H + "t_nobody"))).held, []);
  assert.equal((await w.call("POST", "/internal/enterprise/payouts/held", {})).status, 404);
});

test("retry sends once; a repeat call sends nothing twice (adapter call count asserted)", async () => {
  const w = await world();
  let calls = 0;
  const orig = w.payouts.transfer.bind(w.payouts);
  w.payouts.transfer = async (p) => { calls++; return orig(p); };
  await w.add("po_1", "t_partner_A", "approved_retry");
  await w.add("po_2", "t_partner_B", "approved_retry");
  const r1 = await w.j(await w.call("POST", R, {}));
  assert.equal(r1.paid, 2); assert.equal(r1.examined, 2); assert.equal(calls, 2);
  const r2 = await w.j(await w.call("POST", R, {}));
  const r3 = await w.j(await w.call("POST", R, {}));
  assert.equal(r2.examined, 0); assert.equal(r3.paid, 0);
  assert.equal(calls, 2); assert.equal(w.payouts.sent.length, 2);
  assert.equal((await w.store.payoutById("po_1"))!.status, "paid");
});

test("retry and sweep are tenant-scoped when tenantId is given", async () => {
  const w = await world();
  await w.add("po_1", "t_partner_A", "approved_retry");
  await w.add("po_2", "t_partner_B", "approved_retry");
  const r = await w.j(await w.call("POST", R, { tenantId: "t_partner_A" }));
  assert.equal(r.paid, 1);
  assert.deepEqual(w.payouts.sent.map((s) => s.partnerId), ["t_partner_A"]);
  assert.equal((await w.store.payoutById("po_2"))!.status, "approved_retry");
});

test("held rows are never re-sent by retry or sweep", async () => {
  const w = await world();
  await w.add("po_h", "t_partner_A", "held", { reason: "retry_exhausted", attempts: 3, heldAt: T0 });
  for (let i = 0; i < 3; i++) {
    await w.call("POST", R, {});
    await w.call("POST", S, { maxAgeMs: 0 });
  }
  assert.equal(w.payouts.sent.length, 0);
  assert.equal(w.lookup.calls.length, 0);
  assert.equal((await w.store.payoutById("po_h"))!.status, "held");
});

test("a failing provider exhausts to held via the route; a further call does not re-send", async () => {
  const w = await world();
  await w.add("po_1", "t_partner_A", "approved_retry");
  w.payouts.fail = true;
  let calls = 0;
  const orig = w.payouts.transfer.bind(w.payouts);
  w.payouts.transfer = async (p) => { calls++; return orig(p); };
  await w.call("POST", R, { maxAttempts: 2 });
  const r = await w.j(await w.call("POST", R, { maxAttempts: 2 }));
  assert.equal(r.held, 1);
  const before = calls;
  await w.call("POST", R, { maxAttempts: 2 });
  assert.equal(calls, before);
  const held = await w.j(await w.call("GET", H + "t_partner_A"));
  assert.equal(held.held[0].reason, "retry_exhausted");
});

test("sweep: a stuck row is resolved by lookup, never by a transfer; repeat is a no-op", async () => {
  const w = await world();
  await w.add("po_s", "t_partner_A", "sending", { sendingAt: T0 - 3_600_000 });
  const r1 = await w.j(await w.call("POST", S, {}));
  assert.equal(r1.examined, 1); assert.equal(r1.retrying, 1);
  assert.equal(w.payouts.sent.length, 0);
  const r2 = await w.j(await w.call("POST", S, {}));
  assert.equal(r2.examined, 0);
  assert.equal(w.lookup.calls.length, 1);
  assert.equal(w.payouts.sent.length, 0);
});

test("unconfigured transfer adapter = 503 on retry, no send; unconfigured lookup = 503 on sweep", async () => {
  const w = await world();
  await w.add("po_1", "t_partner_A", "approved_retry");
  await w.add("po_s", "t_partner_A", "sending", { sendingAt: T0 - 3_600_000 });
  (w.deps.ent as any).payouts = undefined;
  assert.equal((await w.call("POST", R, {})).status, 503);
  assert.equal((await w.store.payoutById("po_1"))!.status, "approved_retry");
  assert.equal(w.payouts.sent.length, 0);
  (w.deps.ent as any).payoutLookup = undefined;
  assert.equal((await w.call("POST", S, {})).status, 503);
  assert.equal((await w.store.payoutById("po_s"))!.status, "sending");
});

test("bad bodies are 400 and send nothing", async () => {
  const w = await world();
  await w.add("po_1", "t_partner_A", "approved_retry");
  assert.equal((await w.call("POST", R, { maxAttempts: 0 })).status, 400);
  assert.equal((await w.call("POST", R, { maxAttempts: "3" })).status, 400);
  assert.equal((await w.call("POST", R, { tenantId: "a b" })).status, 400);
  assert.equal((await w.call("POST", S, { maxAgeMs: -1 })).status, 400);
  assert.equal(w.payouts.sent.length, 0);
});

test("source check: no stripe, fetch, timers or cron in the new routes; no em or en dashes", () => {
  for (const f of ["../src/enterprise/routes.ts", "../src/enterprise/service.ts"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(!/[–—]/.test(src), f);
    assert.ok(!/setInterval|setTimeout|\bcron\b|scheduled\(/i.test(src.replace(/\/\/.*$/gm, "")), f);
  }
  const svc = readFileSync(new URL("../src/enterprise/service.ts", import.meta.url), "utf8");
  const block = svc.slice(svc.indexOf("C8 f50: payout operator routes"), svc.indexOf("export async function provisionTenant"));
  assert.ok(!/stripe|fetch\(/i.test(block));
});
