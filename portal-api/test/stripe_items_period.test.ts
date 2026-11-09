import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, cpSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { MemoryStore } from "../src/store.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, handleStripeEvent, stripePeriodOf, type Deps } from "../src/service.ts";

// C2 item-level period (f177). SYNTHETIC fixtures only (example.invalid, sub_syn, cs_syn): no network, no Stripe key.
// Shape A = classic: current_period_* on the subscription. Shape B = newer API versions: current_period_* on items.data[].
// Both are MOCKS of the documented fields (seconds on the wire), not captured Stripe payloads.
const HERE = dirname(fileURLToPath(import.meta.url)), SRC = join(HERE, "..", "src");
const sec = (y: number, m: number, d: number, h = 0) => Math.floor(Date.UTC(y, m - 1, d, h) / 1000);
const T0 = Date.UTC(2026, 10, 6);
type Ev = { id: string; type: string; data: { object: Record<string, any> } };
function fresh() {
  const store = new MemoryStore(), log: string[] = [];
  const deps: Deps = { store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", log: (l) => log.push(l) };
  void store.putAccount({ id: "acc_syn", email: "synthetic@example.invalid", seat: "owner", createdAt: T0 });
  void store.putPurchase({ id: "pur_syn", accountId: "acc_syn", productId: "ai_growth", checkoutId: "cs_syn", amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "pending" });
  return { store, deps, log };
}
const checkout = (id: string, sub: unknown): Ev => ({ id, type: "checkout.session.completed", data: { object: { id: "cs_syn", payment_status: "paid", payment_intent: "pi_syn", customer: "cus_syn", subscription: sub } } });
const S = sec(2026, 11, 17, 3), E = sec(2026, 12, 17, 3);
const shapeA = { id: "sub_syn", current_period_start: S, current_period_end: E, billing_cycle_anchor: S };
const shapeB = { id: "sub_syn", billing_cycle_anchor: S, items: { data: [{ id: "si_syn", current_period_start: S, current_period_end: E }] } };

test("I1 shape A (top-level) and shape B (one item) seed the identical plan", async () => {
  const a = fresh(), b = fresh();
  await handleStripeEvent(a.deps, checkout("e1", shapeA)); await handleStripeEvent(b.deps, checkout("e1", shapeB));
  const pa = (await a.store.subscriptionById("sub_syn"))!, pb = (await b.store.subscriptionById("sub_syn"))!;
  assert.equal(pb.startedAt, S * 1000); assert.notEqual(pb.startedAt, T0);
  assert.deepEqual(pb.plan, pa.plan); assert.equal(pb.startedAt, pa.startedAt);
  assert.deepEqual(b.log, []);
});
test("I2 several items: min start and max end across items", () => {
  const sub = { id: "sub_syn", items: { data: [
    { current_period_start: S + 86400, current_period_end: E - 86400 },
    { current_period_start: S, current_period_end: E - 3600 },
    { current_period_start: S + 3600, current_period_end: E } ] } };
  const p = stripePeriodOf(sub)!;
  assert.equal(p.start, S * 1000); assert.equal(p.end, E * 1000);
});
test("I3 top-level wins over items when both are valid", () => {
  const p = stripePeriodOf({ ...shapeA, items: { data: [{ current_period_start: S - 1000, current_period_end: E + 1000 }] } })!;
  assert.equal(p.start, S * 1000); assert.equal(p.end, E * 1000);
});
test("I4 malformed item among good ones is skipped, good ones still count", () => {
  const p = stripePeriodOf({ id: "sub_syn", items: { data: [null, { current_period_start: "x", current_period_end: E }, { current_period_start: S, current_period_end: E }] } })!;
  assert.equal(p.start, S * 1000); assert.equal(p.end, E * 1000);
});
test("I5 malformed or missing fields fall back safely (undefined, no throw) and log", async () => {
  const bads: unknown[] = [
    { id: "sub_syn", items: { data: [] } },
    { id: "sub_syn", items: { data: [{ current_period_start: E, current_period_end: S }] } }, // reversed
    { id: "sub_syn", items: { data: [{ current_period_start: 1.5, current_period_end: 9.5 }] } }, // fractional
    { id: "sub_syn", items: { data: "nope" } },
    { id: "sub_syn", items: null },
    { id: "sub_syn", current_period_start: "17", current_period_end: E, items: { data: [{}] } },
    { id: "sub_syn" },
  ];
  for (const sub of bads) {
    const log: string[] = [];
    assert.equal(stripePeriodOf(sub, (m) => log.push(m)), undefined, JSON.stringify(sub));
    assert.equal(log.length, 1, `one log line for ${JSON.stringify(sub)}`); assert.match(log[0], /calendar months apply/);
    const h = fresh();
    assert.equal(await handleStripeEvent(h.deps, checkout("eb", sub)), "handled");
    const s = (await h.store.subscriptionById("sub_syn"))!;
    assert.equal(s.plan, undefined, "no plan seeded: calendar months keep applying");
    assert.ok(h.log.some((l) => /calendar months apply/.test(l)));
  }
  for (const nonObj of [undefined, null, "sub_syn", 7]) assert.equal(stripePeriodOf(nonObj), undefined);
});

// ---- mutation check (hand-rolled text edits on a scratch copy, as in f96/f101) ----
function mutate(name: string, file: string, from: string, to: string) {
  const dir = mkdtempSync(join(tmpdir(), "f177-"));
  try {
    const src = join(dir, "portal-api"); mkdirSync(join(src, "src"), { recursive: true }); mkdirSync(join(src, "test"), { recursive: true });
    cpSync(SRC, join(src, "src"), { recursive: true });
    symlinkSync(join(SRC, "../../lib"), join(dir, "lib"));
    cpSync(join(HERE, "stripe_items_period.test.ts"), join(src, "test", "x.test.ts"));
    const p = join(src, "src", file), t = readFileSync(p, "utf8");
    assert.equal(t.split(from).length - 1, 1, `${name}: anchor must be unique`);
    writeFileSync(p, t.replace(from, to));
    const r = spawnSync(process.execPath, ["--test", "--experimental-strip-types", "-t", "^I[1-5] ", join(src, "test", "x.test.ts")], { encoding: "utf8", env: { ...process.env, F177_NO_MUT: "1" } });
    assert.notEqual(r.status, 0, `${name} survived`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
if (!process.env.F177_NO_MUT) {
  test("M1 min start becomes max start: killed", () => mutate("M1", "service.ts", "start = Math.min(start, p.start)", "start = Math.max(start === Infinity ? 0 : start, p.start)"));
  test("M2 max end becomes min end: killed", () => mutate("M2", "service.ts", "end = Math.max(end, p.end)", "end = Math.min(end === -Infinity ? Infinity : end, p.end)"));
  test("M3 items ignored: killed", () => mutate("M3", "service.ts", "const items: unknown[] = Array.isArray(x.items?.data) ? x.items.data : [];", "const items: unknown[] = [];"));
  test("M4 top-level ignored: killed", () => mutate("M4", "service.ts", "if (top) return top;", ""));
  test("M5 log dropped: killed", () => mutate("M5", "service.ts", "if (hinted) log?.(", "if (hinted) void ("));
  test("M6 bad item aborts instead of skipping: killed", () => mutate("M6", "service.ts", "if (!p) { bad++; continue; }", "if (!p) { bad++; return undefined; }"));
}
