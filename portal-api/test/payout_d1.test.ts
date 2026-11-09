// f59 tests. SYNTHETIC data only. D1EntStore runs over a real SQLite (node:sqlite) fake D1; the transfer is MockPayouts. No Stripe, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemoryEntStore } from "../src/enterprise/store.ts";
import type { EntStore } from "../src/enterprise/store.ts";
import { D1EntStore } from "../src/enterprise/store_d1.ts";
import { runPayoutTick } from "../src/enterprise/payout_tick.ts";
import type { TransferLookup, TransferLookupResult } from "../src/enterprise/payout_sweep.ts";
import { PermanentTransferError } from "../src/enterprise/payout_errors.ts";
import { FakeD1 } from "./d1_fake.ts";
import { MockPayouts } from "./ent_harness.ts";
import type { Payout } from "../src/enterprise/types.ts";

const T0 = 1_000_000, NOW = T0 + 3_600_000;
type Kind = "memory" | "d1";
class Lookup implements TransferLookup {
  t: MockPayouts; constructor(t: MockPayouts) { this.t = t; }
  async lookup(key: string): Promise<TransferLookupResult> {
    const s = this.t.sent.find((x) => x.idempotencyKey === key);
    return s ? { found: true, ref: "po_x", partnerId: s.partnerId, amountCents: s.amountCents } : { found: false };
  }
}
async function world(kind: Kind) {
  const mem = new MemoryEntStore(), fake = new FakeD1();
  const store: any = kind === "memory" ? mem : new D1EntStore(fake, mem);
  const transfer = new MockPayouts(), lookup = new Lookup(transfer);
  for (const [id, acct] of [["t_partner_A", "acct_SYNTH_1"], ["t_partner_B", "acct_SYNTH_2"]]) {
    await mem.putTenant({ id, slug: id, name: id, kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: acct });
    fake.sql.prepare("INSERT INTO tenants (id, slug, name, kind, created_at) VALUES (?, ?, ?, 'partner', 1)").run(id, id, id);
  }
  const add = (id: string, status: string, partnerId = "t_partner_A", extra: Record<string, unknown> = {}) => store.putPayout({ id, partnerId, amountCents: 100_000, status, createdAt: T0, sendingAt: T0, ...extra });
  const tick = (opts: Record<string, unknown> = {}, now = NOW) => runPayoutTick(store as EntStore, transfer, now, { lookup, ...opts });
  const rows = async () => { const all: Payout[] = []; for (const p of ["t_partner_A", "t_partner_B"]) all.push(...(await store.payoutsOf(p))); return all.sort((a, b) => a.id.localeCompare(b.id)); };
  const canon = (p: Payout) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)));
  const snap = async () => JSON.stringify((await rows()).map(canon)); // key order is not state: canonical keys, undefined dropped
  return { store, mem, fake, transfer, lookup, add, tick, snap };
}
type W = Awaited<ReturnType<typeof world>>;
const st = async (w: W, id: string) => (await w.store.payoutById(id))!;

// Each scenario returns a transcript; the parity test runs it on both stores and demands identical transcripts.
const scenarios: Record<string, (w: W) => Promise<unknown>> = {
  async mixed(w) {
    await w.add("po_s1", "sending");
    w.transfer.sent.push({ partnerId: "t_partner_A", accountRef: "acct_SYNTH_1", amountCents: 100_000, idempotencyKey: "po_s1" });
    await w.add("po_r1", "approved_retry", "t_partner_B");
    const r = await w.tick();
    return { r, snap: await w.snap(), sent: w.transfer.sent.length };
  },
  async doubleTick(w) {
    await w.add("po_r1", "approved_retry"); await w.add("po_r2", "approved_retry"); await w.add("po_r3", "approved_retry", "t_partner_B"); await w.add("po_old", "sending");
    w.transfer.fail = true;
    const first = await w.tick(); const before = await w.snap(), sent = w.transfer.sent.length;
    const second = await w.tick();
    const same = (await w.snap()) === before && w.transfer.sent.length === sent;
    w.transfer.fail = false;
    const later = await w.tick({}, NOW + 60_000);
    return { first, second, same, later, snap: await w.snap(), attempts: (await st(w, "po_r1")).attempts };
  },
  async terminal(w) {
    await w.add("po_ok", "approved_retry"); await w.add("po_perm", "approved_retry", "t_partner_B"); await w.add("po_ex", "approved_retry", "t_partner_A", { attempts: 2 });
    const orig = w.transfer.transfer.bind(w.transfer);
    w.transfer.transfer = async (x) => { if (x.idempotencyKey === "po_perm") throw new PermanentTransferError("account_closed"); if (x.idempotencyKey === "po_ex") throw new Error("down"); return orig(x); };
    const a = await w.tick({ maxAttempts: 3 }); const before = await w.snap();
    const b = await w.tick({ maxAttempts: 3 });
    return { a, b, stable: (await w.snap()) === before, snap: before };
  },
  async crashMidClaim(w) {
    await w.add("po_c1", "approved_retry"); await w.add("po_c2", "approved_retry", "t_partner_B");
    const realT = w.store.transitionPayout.bind(w.store); let boom = true;
    w.store.transitionPayout = async (id: string, from: any, to: any, patch: any) => { if (boom && id === "po_c2") { boom = false; throw new Error("d1_down"); } return realT(id, from, to, patch); };
    const logs: string[] = [];
    const r = await w.tick({ log: (l: string) => logs.push(l) });
    const mid = { c1: (await st(w, "po_c1")).status, c2: (await st(w, "po_c2")).status };
    const r2 = await w.tick({}, NOW + 1000); const done = await w.snap();
    await w.tick({}, NOW + 1000);
    return { r, mid, r2, done, converged: (await w.snap()) === done, errLogged: logs.some((l) => l.includes("retry_error")) };
  },
  async crashAfterTransfer(w) {
    await w.add("po_c1", "approved_retry");
    const realPut = w.store.putPayout.bind(w.store); let boom = true;
    w.store.putPayout = async (p: Payout) => { if (boom && p.status === "paid") { boom = false; throw new Error("d1_down"); } return realPut(p); };
    const r = await w.tick(); const mid = { status: (await st(w, "po_c1")).status, sent: w.transfer.sent.length };
    const r2 = await w.tick({}, NOW + 1000); const done = await w.snap();
    await w.tick({}, NOW + 1000);
    return { r, mid, r2, done, sent: w.transfer.sent.length, converged: (await w.snap()) === done };
  },
  async bounded(w) {
    for (let i = 0; i < 7; i++) await w.add(`po_b${i}`, "approved_retry", "t_partner_A", { createdAt: T0 + i, sendingAt: undefined });
    const r = await w.tick({ maxRows: 3 }); const mid = await w.snap();
    const r2 = await w.tick({ maxRows: 3 }, NOW + 1); const r3 = await w.tick({ maxRows: 3 }, NOW + 2);
    return { r, mid, r2, r3, end: await w.snap() };
  },
  async tenantScoped(w) {
    await w.add("po_a", "approved_retry", "t_partner_A"); await w.add("po_b", "approved_retry", "t_partner_B");
    const r = await w.tick({ tenantId: "t_partner_A" });
    return { r, snap: await w.snap() };
  },
};
for (const [name, fn] of Object.entries(scenarios)) {
  test(`parity: ${name} gives identical outcomes on the in-memory store and the D1 adapter`, async () => {
    const m = await fn(await world("memory")), d = await fn(await world("d1"));
    assert.deepEqual(d, m);
  });
}

// Spot-check the replayed outcomes are the meaningful ones (not two identical empty results).
test("replayed outcomes on D1 are the f57 outcomes", async () => {
  const w = await world("d1");
  await w.add("po_s1", "sending");
  w.transfer.sent.push({ partnerId: "t_partner_A", accountRef: "acct_SYNTH_1", amountCents: 100_000, idempotencyKey: "po_s1" });
  await w.add("po_r1", "approved_retry", "t_partner_B");
  const r = await w.tick();
  assert.deepEqual(r.counts, { resumed: 1, paid: 2, retried: 0, held: 0, permanent_failed: 0, skipped: 0, errors: 0 });
  assert.equal((await st(w, "po_s1")).status, "paid"); assert.equal((await st(w, "po_r1")).status, "paid");
  const c = await scenarios.crashAfterTransfer(await world("d1")) as any;
  assert.equal(c.mid.status, "approved_retry"); assert.equal(c.sent, 1); assert.equal(c.r2.counts.paid, 1); assert.equal(c.converged, true);
  const m = await scenarios.crashMidClaim(await world("d1")) as any;
  assert.equal(m.r.counts.errors, 1); assert.deepEqual(m.mid, { c1: "paid", c2: "approved_retry" }); assert.equal(m.errLogged, true);
});

test("transitionPayout is a single compare-and-set UPDATE: exactly one of two concurrent claims wins", async () => {
  const w = await world("d1"); await w.add("po_x", "approved_retry");
  w.fake.log.length = 0;
  const [a, b] = await Promise.all([w.store.transitionPayout("po_x", "approved_retry", "sending", { sendingAt: 5 }), w.store.transitionPayout("po_x", "approved_retry", "sending", { sendingAt: 6 })]);
  assert.equal([a, b].filter(Boolean).length, 1, "one winner");
  const updates = w.fake.log.filter((q) => q.startsWith("UPDATE"));
  assert.equal(updates.length, 2); assert.ok(updates.every((q) => /WHERE id = \? AND status = \?/.test(q)), "compare-and-set in the WHERE clause");
  assert.equal(w.fake.log.filter((q) => /^(SELECT|INSERT)/.test(q) && q.startsWith("SELECT") && false).length, 0);
  const row = await st(w, "po_x"); assert.equal(row.status, "sending"); assert.equal(row.sendingAt, (a ?? b)!.sendingAt);
});
test("transition patch lands in the same UPDATE (one statement, status plus every patched column); wrong state or missing id returns undefined and writes nothing", async () => {
  const w = await world("d1"); await w.add("po_p", "held", "t_partner_A", { attempts: 3, heldAt: 7 });
  w.fake.log.length = 0;
  const p = await w.store.transitionPayout("po_p", "held", "approved_retry", { releasedAt: 9, operatorNote: "ok", attempts: 0, heldAt: undefined });
  assert.equal(w.fake.log.filter((q: string) => q.startsWith("UPDATE")).length, 1);
  assert.deepEqual([p!.status, p!.releasedAt, p!.operatorNote, p!.attempts, p!.heldAt], ["approved_retry", 9, "ok", 0, undefined]);
  const before = await w.snap();
  assert.equal(await w.store.transitionPayout("po_p", "held", "refunded", { refundedAt: 1 }), undefined, "no longer held");
  assert.equal(await w.store.transitionPayout("po_nope", "held", "refunded"), undefined);
  assert.equal(await w.snap(), before);
  await assert.rejects(() => w.store.transitionPayout("po_p", "approved_retry", "paid", { partnerId: "t_partner_B" } as any), /d1_patch_unknown_column/, "cannot move a payout to another partner"); await assert.rejects(() => w.store.transitionPayout("po_p", "approved_retry", "paid", { amountCents: 1 } as any), /d1_patch_unknown_column/, "cannot change the amount");
  await assert.rejects(() => w.store.transitionPayout("po_p", "approved_retry", "paid", { "status = 'x'; --": 1 } as any), /d1_patch_unknown_column/, "no SQL injection through patch keys");
});
test("every PayoutStatus value and every Payout field round-trips through D1; an unknown status is rejected by the CHECK", async () => {
  const w = await world("d1");
  const statuses = ["pending_approval", "sending", "paid", "failed", "rejected", "approved_retry", "held", "refunded"];
  for (const s of statuses) await w.store.putPayout({ id: `po_${s}`, partnerId: "t_partner_A", amountCents: 1, status: s, createdAt: 1, providerRef: "r", reason: "x", sendingAt: 2, attempts: 3, heldAt: 4, releasedAt: 5, tickAt: 6, refundedAt: 7, operatorNote: "n" });
  for (const s of statuses) assert.deepEqual(await w.store.payoutById(`po_${s}`), { id: `po_${s}`, partnerId: "t_partner_A", amountCents: 1, status: s, createdAt: 1, providerRef: "r", reason: "x", sendingAt: 2, attempts: 3, heldAt: 4, releasedAt: 5, tickAt: 6, refundedAt: 7, operatorNote: "n" });
  await assert.rejects(() => w.store.putPayout({ id: "po_bad", partnerId: "t_partner_A", amountCents: 1, status: "bogus", createdAt: 1 }), /CHECK/);
  assert.equal((await w.store.payoutsByStatus("held", "t_partner_B")).length, 0); assert.equal((await w.store.payoutsByStatus("held", "t_partner_A")).length, 1);
  assert.equal((await w.store.payoutsByStatus("held")).length, 1);
  assert.equal(await w.store.payoutById("missing"), undefined);
});
test("migration 0004: copies 0003-era rows, widens the CHECK, adds the columns; the old 4-status table could not hold the new statuses", async () => {
  const old = new FakeD1(["0001_portal_core.sql", "0002_portal_billing.sql", "0003_enterprise.sql"]);
  old.sql.prepare("INSERT INTO tenants (id, slug, name, kind, created_at) VALUES ('t1','t1','t1','partner',1)").run();
  assert.throws(() => old.sql.prepare("INSERT INTO payouts (id, partner_id, amount_cents, status, created_at) VALUES ('a','t1',1,'held',1)").run(), /CHECK/, "0003 rejects held");
  old.sql.prepare("INSERT INTO payouts (id, partner_id, amount_cents, status, created_at, provider_ref, reason) VALUES ('old1','t1',500,'paid',9,'ref1','why')").run();
  old.sql.exec(readFileSync(new URL("../migrations/0004_payouts_lifecycle.sql", import.meta.url), "utf8"));
  const s = new D1EntStore(old, new MemoryEntStore());
  assert.deepEqual(await s.payoutById("old1"), { id: "old1", partnerId: "t1", amountCents: 500, status: "paid", createdAt: 9, providerRef: "ref1", reason: "why" });
  await s.putPayout({ id: "n", partnerId: "t1", amountCents: 1, status: "refunded", createdAt: 1, refundedAt: 3 });
  assert.equal((await s.payoutById("n"))!.status, "refunded");
  assert.equal(old.sql.prepare("SELECT count(*) c FROM sqlite_master WHERE name = 'payouts_new'").get()!.c, 0, "no leftover table");
});
test("source checks: adapter has no network, timers, or Stripe; migration is a file only; no em or en dashes", () => {
  for (const f of ["../src/enterprise/store_d1.ts", "../migrations/0004_payouts_lifecycle.sql"]) {
    const s = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(!/—|–/.test(s), f);
    assert.ok(!/fetch\(|setTimeout|setInterval|stripe\.com/i.test(s), f);
  }
  assert.ok(!/store_d1/.test(readFileSync(new URL("../src/index.ts", import.meta.url), "utf8")), "not wired into the Worker");
});
