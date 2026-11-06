// f57 tests. SYNTHETIC data only. Transfer and lookup are in-memory fixtures over MockPayouts: no Stripe, no network, no money.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import { runPayoutTick } from "../src/enterprise/payout_tick.ts";
import type { TransferLookup, TransferLookupResult } from "../src/enterprise/payout_sweep.ts";
import { PermanentTransferError } from "../src/enterprise/payout_errors.ts";
import { scheduledTick } from "../src/index.ts";
import { MockPayouts } from "./ent_harness.ts";

const T0 = 1_000_000, NOW = T0 + 3_600_000;
class Lookup implements TransferLookup {
  calls: string[] = [];
  t: MockPayouts;
  constructor(t: MockPayouts) { this.t = t; }
  async lookup(key: string): Promise<TransferLookupResult> {
    this.calls.push(key);
    const s = this.t.sent.find((x) => x.idempotencyKey === key);
    return s ? { found: true, ref: "po_x", partnerId: s.partnerId, amountCents: s.amountCents } : { found: false };
  }
}
async function world() {
  const store = new MemoryEntStore(), transfer = new MockPayouts(), lookup = new Lookup(transfer);
  for (const [id, acct] of [["t_partner_A", "acct_SYNTH_1"], ["t_partner_B", "acct_SYNTH_2"]]) await store.putTenant({ id, slug: id, name: id, kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: acct });
  const add = (id: string, status: string, partnerId = "t_partner_A", extra: Record<string, unknown> = {}) => store.putPayout({ id, partnerId, amountCents: 100_000, status, createdAt: T0, sendingAt: T0, ...extra } as any);
  const tick = (opts: Record<string, unknown> = {}, now = NOW) => runPayoutTick(store, transfer, now, { lookup, ...opts });
  const snap = () => JSON.stringify([...store.payouts.values()].sort((a, b) => a.id.localeCompare(b.id)));
  return { store, transfer, lookup, add, tick, snap };
}
const st = async (w: Awaited<ReturnType<typeof world>>, id: string) => (await w.store.payoutById(id))!;

test("one tick: stuck sending is resumed to paid, approved_retry is sent, counts add up", async () => {
  const w = await world();
  await w.add("po_s1", "sending");
  w.transfer.sent.push({ partnerId: "t_partner_A", accountRef: "acct_SYNTH_1", amountCents: 100_000, idempotencyKey: "po_s1" });
  await w.add("po_r1", "approved_retry", "t_partner_B");
  const r = await w.tick();
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { resumed: 1, paid: 2, retried: 0, held: 0, permanent_failed: 0, skipped: 0, errors: 0 });
  assert.equal((await st(w, "po_s1")).status, "paid"); assert.equal((await st(w, "po_r1")).status, "paid");
});
test("double tick at the same now is idempotent, including a row still failing transiently", async () => {
  const w = await world();
  await w.add("po_r1", "approved_retry"); await w.add("po_r2", "approved_retry"); await w.add("po_r3", "approved_retry", "t_partner_B");
  await w.add("po_old", "sending");
  w.transfer.fail = true;
  const first = await w.tick();
  assert.equal(first.counts.retried, 4, "3 approved_retry plus the stale sending row the sweep returned to retry");
  const before = w.snap(), sent = w.transfer.sent.length;
  const second = await w.tick();
  assert.equal(w.snap(), before, "no row changed");
  assert.equal(w.transfer.sent.length, sent);
  assert.equal(second.counts.retried, 0); assert.equal(second.counts.paid, 0);
  assert.equal((await st(w, "po_r1")).attempts, 1, "attempts not double counted");
  // a LATER now retries again (the guard is per tick, not forever)
  w.transfer.fail = false;
  const later = await w.tick({}, NOW + 60_000);
  assert.equal(later.counts.paid, 4);
});
test("terminal outcomes are idempotent too: paid, held (permanent, exhausted) stay put on a second tick", async () => {
  const w = await world();
  await w.add("po_ok", "approved_retry"); await w.add("po_perm", "approved_retry", "t_partner_B"); await w.add("po_ex", "approved_retry", "t_partner_A", { attempts: 2 });
  const orig = w.transfer.transfer.bind(w.transfer);
  w.transfer.transfer = async (x) => { if (x.idempotencyKey === "po_perm") throw new PermanentTransferError("account_closed"); if (x.idempotencyKey === "po_ex") throw new Error("down"); return orig(x); };
  const a = await w.tick({ maxAttempts: 3 });
  assert.deepEqual([a.counts.paid, a.counts.permanent_failed, a.counts.held], [1, 1, 1]);
  assert.equal((await st(w, "po_perm")).reason, "permanent_account_closed"); assert.equal((await st(w, "po_ex")).reason, "retry_exhausted");
  const before = w.snap();
  const b = await w.tick({ maxAttempts: 3 });
  assert.equal(w.snap(), before);
  assert.deepEqual(b.counts, { resumed: 0, paid: 0, retried: 0, held: 0, permanent_failed: 0, skipped: 0, errors: 0 });
});
test("crash mid-tick (store claim throws): tick does not throw, counts the error, next tick converges", async () => {
  const w = await world();
  await w.add("po_c1", "approved_retry"); await w.add("po_c2", "approved_retry", "t_partner_B");
  const realT = w.store.transitionPayout.bind(w.store); let boom = true;
  w.store.transitionPayout = async (id, from, to, patch) => { if (boom && id === "po_c2") { boom = false; throw new Error("d1_down"); } return realT(id, from, to, patch); };
  const logs: string[] = [];
  const r = await w.tick({ log: (l: string) => logs.push(l) });
  assert.equal(r.ok, false); assert.equal(r.counts.errors, 1);
  assert.equal((await st(w, "po_c1")).status, "paid", "the row done before the crash stays done (counts of an aborted pass are lost, state is the truth)");
  assert.ok(logs.some((l) => l.includes("retry_error")));
  assert.equal((await st(w, "po_c2")).status, "approved_retry", "unclaimed row untouched");
  const r2 = await w.tick({}, NOW + 1000);
  assert.equal(r2.ok, true);
  for (const id of ["po_c1", "po_c2"]) assert.equal((await st(w, id)).status, "paid", id);
  const before = w.snap();
  await w.tick({}, NOW + 1000);
  assert.equal(w.snap(), before, "converged");
});
test("crash after the transfer went out (the paid write fails): re-tick re-sends with the SAME key, provider sees one logical transfer, converges", async () => {
  const w = await world(); await w.add("po_c1", "approved_retry");
  const realPut = w.store.putPayout.bind(w.store); let boom = true;
  w.store.putPayout = async (p) => { if (boom && p.status === "paid") { boom = false; throw new Error("d1_down"); } return realPut(p); };
  const r = await w.tick();
  assert.equal(r.ok, true, "f46 treats the failed write as a transient attempt; the row stays retryable");
  assert.equal((await st(w, "po_c1")).status, "approved_retry");
  assert.equal(w.transfer.sent.length, 1);
  const r2 = await w.tick({}, NOW + 1000);
  assert.equal(r2.counts.paid, 1); assert.equal((await st(w, "po_c1")).status, "paid");
  assert.equal(w.transfer.sent.length, 1, "same idempotency key: one logical transfer");
  const before = w.snap(); await w.tick({}, NOW + 1000); assert.equal(w.snap(), before);
});
test("a throwing lookup or logger never throws out of the tick", async () => {
  const w = await world(); await w.add("po_s1", "sending"); await w.add("po_r1", "approved_retry");
  const bad: TransferLookup = { lookup: async () => { throw new Error("x"); } };
  const r = await runPayoutTick(w.store, w.transfer, NOW, { lookup: bad, log: () => { throw new Error("logger"); } });
  assert.equal((await st(w, "po_s1")).reason, "provider_error"); assert.equal((await st(w, "po_s1")).status, "held");
  assert.equal(r.counts.held, 1); assert.equal(r.counts.paid, 1);
  const broken = new Proxy(w.store, { get: (t, p) => (p === "payoutsByStatus" ? async () => { throw new Error("db"); } : (t as any)[p]?.bind?.(t) ?? (t as any)[p]) }) as any;
  const r2 = await runPayoutTick(broken, w.transfer, NOW, { lookup: w.lookup });
  assert.equal(r2.ok, false); assert.equal(r2.counts.errors, 2);
});
test("max-rows bound is respected across both passes, oldest first; the rest wait for the next tick", async () => {
  const w = await world();
  for (let i = 0; i < 7; i++) await w.add(`po_b${i}`, "approved_retry", "t_partner_A", { createdAt: T0 + i, sendingAt: undefined });
  const r = await w.tick({ maxRows: 3 });
  assert.equal(r.rowsRead, 3); assert.equal(r.bounded, true); assert.equal(r.counts.paid, 3);
  assert.deepEqual([0, 1, 2].map((i) => w.store.payouts.get(`po_b${i}`)!.status), ["paid", "paid", "paid"]);
  assert.equal(w.store.payouts.get("po_b3")!.status, "approved_retry");
  const r2 = await w.tick({ maxRows: 3 }, NOW + 1); assert.equal(r2.counts.paid, 3);
  const r3 = await w.tick({ maxRows: 3 }, NOW + 2); assert.equal(r3.counts.paid, 1); assert.equal(r3.bounded, false);
  assert.equal((await w.tick({ maxRows: 0 }, NOW + 3)).rowsRead, 0);
  const huge = await w.tick({ maxRows: 10_000_000 }, NOW + 4); assert.equal(huge.rowsRead, 0);
  await w.add("po_cap", "approved_retry"); const neg = await w.tick({ maxRows: -5 }, NOW + 5); assert.equal(neg.counts.paid, 1, "bad bound falls back to the default, not unbounded");
});
test("tenant_id preserved: every store read carries the tenant filter, writes keep partnerId, other tenant untouched", async () => {
  const w = await world();
  await w.add("po_a", "approved_retry", "t_partner_A"); await w.add("po_b", "approved_retry", "t_partner_B"); await w.add("po_sa", "sending", "t_partner_A"); await w.add("po_sb", "sending", "t_partner_B");
  const reads: [string, string | undefined][] = []; const writes: string[] = [];
  const rb = w.store.payoutsByStatus.bind(w.store), rp = w.store.putPayout.bind(w.store);
  const owner = new Map([...w.store.payouts.values()].map((p) => [p.id, p.partnerId]));
  // a store that IGNORES the filter must still not widen the scope
  w.store.payoutsByStatus = async (s, t) => { reads.push([s, t]); return rb(s, undefined); };
  w.store.putPayout = async (p) => { writes.push(`${p.id}:${p.partnerId}`); assert.equal(p.partnerId, owner.get(p.id)); return rp(p); };
  await w.tick({ tenantId: "t_partner_A" });
  assert.ok(reads.length >= 2 && reads.every(([, t]) => t === "t_partner_A"), JSON.stringify(reads));
  assert.equal((await st(w, "po_b")).status, "approved_retry"); assert.equal((await st(w, "po_sb")).status, "sending");
  assert.equal((await st(w, "po_a")).status, "paid");
  assert.ok(writes.every((x) => x.endsWith(x.startsWith("po_b") || x.startsWith("po_sb") ? "x" : "t_partner_A")));
  assert.equal(w.transfer.sent.every((x) => x.partnerId === "t_partner_A"), true);
  // no tenant filter = all tenants, partnerId preserved on each
  await w.tick({}, NOW + 1);
  assert.equal((await st(w, "po_b")).partnerId, "t_partner_B"); assert.equal((await st(w, "po_b")).status, "paid");
});
test("no lookup: sweep is skipped (stuck rows wait, nothing sent for them), retry still runs", async () => {
  const w = await world(); await w.add("po_s1", "sending"); await w.add("po_r1", "approved_retry");
  const r = await runPayoutTick(w.store, w.transfer, NOW, {});
  assert.equal(r.sweepRan, false); assert.equal((await st(w, "po_s1")).status, "sending"); assert.equal((await st(w, "po_r1")).status, "paid");
});
test("Worker scheduled: no adapter = labelled no-op; with adapter it runs one tick; default export has scheduled and fetch", async () => {
  const noop = await scheduledTick({} as any);
  assert.deepEqual(noop, { ran: false, label: "payout_tick_noop_no_adapter" });
  const w = await world(); await w.add("po_r1", "approved_retry");
  const out = await scheduledTick({ payouts: { store: w.store, transfer: w.transfer, lookup: w.lookup, maxRows: 10 } } as any, NOW);
  assert.equal(out.ran, true); assert.equal((out as any).counts.paid, 1);
  const mod = (await import("../src/index.ts")).default as any;
  assert.equal(typeof mod.scheduled, "function"); assert.equal(typeof mod.fetch, "function");
  // handler through ctx.waitUntil, no adapter: does not throw, registers one promise
  const ps: Promise<unknown>[] = [];
  assert.doesNotThrow(() => mod.scheduled({ scheduledTime: NOW }, {}, { waitUntil: (p: Promise<unknown>) => ps.push(p) }));
  assert.equal(ps.length, 1); await ps[0];
  // fetch with no adapter still behaves as before (health, no 503 crash from the tick wiring)
  const h = await mod.fetch(new Request("https://x.test/health"), {});
  assert.equal(h.status, 200);
});
test("source check: no stripe/fetch/timers/cron in the tick, no cron trigger in wrangler.toml, no em or en dashes", () => {
  const src = readFileSync(new URL("../src/enterprise/payout_tick.ts", import.meta.url), "utf8");
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/stripe|fetch\(|setInterval|setTimeout|node:|XMLHttp/i.test(code));
  assert.ok(!/[–—]/.test(src));
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.ok(!/^\s*\[triggers\]/m.test(toml) && !/^\s*crons\s*=/m.test(toml));
});
test("bound is SHARED by the sweep and the retry pass; oldest-first by age then id; hard cap holds on a huge maxRows", async () => {
  const w = await world();
  await w.add("po_s_old", "sending", "t_partner_A", { sendingAt: T0 }); await w.add("po_s_old2", "sending", "t_partner_A", { sendingAt: T0 + 1 });
  await w.add("po_r_z", "approved_retry", "t_partner_A", { createdAt: T0 + 5, sendingAt: undefined }); await w.add("po_r_a", "approved_retry", "t_partner_A", { createdAt: T0 + 5, sendingAt: undefined });
  const r = await w.tick({ maxRows: 2 });
  assert.equal(r.rowsRead, 2, "the sweep used the whole budget, the retry pass got nothing");
  assert.equal((await st(w, "po_r_z")).status, "approved_retry"); assert.equal((await st(w, "po_r_a")).status, "approved_retry");
  assert.ok((await st(w, "po_s_old")).status !== "sending" && (await st(w, "po_s_old2")).status !== "sending");
  const w2 = await world();
  await w2.add("po_z", "approved_retry", "t_partner_A", { createdAt: T0, sendingAt: undefined }); await w2.add("po_a", "approved_retry", "t_partner_A", { createdAt: T0, sendingAt: undefined }); await w2.add("po_young", "approved_retry", "t_partner_A", { createdAt: T0 - 10, sendingAt: undefined });
  await w2.tick({ maxRows: 2 });
  assert.equal((await st(w2, "po_young")).status, "paid"); assert.equal((await st(w2, "po_a")).status, "paid"); assert.equal((await st(w2, "po_z")).status, "approved_retry", "ties broken by id, oldest createdAt first");
  const w3 = await world();
  for (let i = 0; i < 520; i++) await w3.add(`po_h${i}`, "approved_retry", "t_partner_A", { createdAt: T0 + i, sendingAt: undefined });
  const big = await w3.tick({ maxRows: 1_000_000 });
  assert.equal(big.rowsRead, 500); assert.equal(big.counts.paid, 500); assert.equal(big.bounded, true);
});
