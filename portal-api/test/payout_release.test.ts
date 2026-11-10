// C8 f54 tests. SYNTHETIC data only. MockPayouts: release and refund must never call the adapter. No Stripe, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeEnt, INTERNAL } from "./ent_harness.ts";
import { availableCents } from "../src/enterprise/store.ts";
import { retryApprovedPayouts } from "../src/enterprise/payout_retry.ts";

const T0 = 1_000_000;
async function world() {
  const e = makeEnt();
  for (const [id, acct] of [["t_partner_A", "acct_SYNTH_1"], ["t_partner_B", "acct_SYNTH_2"]]) await e.store.putTenant({ id, slug: id, name: id, kind: "partner", createdAt: 1, ssoEnforced: false, partnerAccess: false, payoutAccount: acct });
  // a reserved payout: commission +250000, payout entry -250000 (what reservePayout writes), then held
  const hold = async (id: string, partnerId: string, extra: Record<string, unknown> = {}) => {
    await e.store.addLedger({ id: "c_" + id, uniq: "commission:" + id, partnerId, kind: "commission", amountCents: 250_000, at: 1, availableAt: 1 });
    await e.store.addLedger({ id: "l_" + id, uniq: "payout:" + id, partnerId, kind: "payout", amountCents: -250_000, at: T0, availableAt: T0, payoutId: id });
    await e.store.putPayout({ id, partnerId, amountCents: 250_000, status: "held", createdAt: T0, reason: "retry_exhausted", attempts: 3, heldAt: T0 + 10 } as any);
    if (Object.keys(extra).length) await e.store.putPayout({ ...(await e.store.payoutById(id))!, ...extra } as any);
  };
  const call = (path: string, body?: unknown, secret: string | null = INTERNAL, method = "POST") => e.req(method, path, { body, headers: secret ? { "x-internal-secret": secret } : {} });
  const rel = (id: string, tenantId?: string, note?: string, secret: string | null = INTERNAL) => call(`/internal/enterprise/payouts/${id}/release`, { tenantId, note }, secret);
  const ref = (id: string, tenantId?: string, note?: string, secret: string | null = INTERNAL) => call(`/internal/enterprise/payouts/${id}/refund`, { tenantId, note }, secret);
  const sum = async (pid: string) => (await e.store.ledgerOf(pid)).reduce((n, x) => n + x.amountCents, 0);
  return { ...e, hold, call, rel, ref, sum };
}

test("auth: no header 401, wrong secret 401, no configured secret 503; nothing moves, adapter untouched", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  for (const f of [w.rel, w.ref]) {
    assert.equal((await f("po_1", "t_partner_A", undefined, null)).status, 401);
    for (const bad of ["x".repeat(INTERNAL.length), INTERNAL.slice(0, -1), INTERNAL + "x", ""]) assert.equal((await f("po_1", "t_partner_A", undefined, bad)).status, 401);
  }
  w.deps.ent!.internalSecret = undefined;
  for (const f of [w.rel, w.ref]) { assert.equal((await f("po_1", "t_partner_A")).status, 503); assert.equal((await f("po_1", "t_partner_A", undefined, null)).status, 503); }
  assert.equal((await w.store.payoutById("po_1"))!.status, "held");
  assert.equal(w.payouts.sent.length, 0);
});

test("release: held -> approved_retry, attempts reset, reason and note kept, audit row, adapter never called", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  const r = await w.rel("po_1", "t_partner_A", "Bank details fixed by phone");
  assert.equal(r.status, 200);
  const j = await w.j(r);
  assert.equal(j.outcome, "applied");
  assert.equal(j.payout.status, "approved_retry");
  assert.equal(j.payout.attempts, 0);
  assert.equal(j.payout.reason, "retry_exhausted");
  assert.equal(j.payout.operatorNote, "Bank details fixed by phone");
  const p = (await w.store.payoutById("po_1"))!;
  assert.equal(p.status, "approved_retry"); assert.equal(p.attempts, 0); assert.ok(p.releasedAt !== undefined);
  const aud = await w.store.auditOf("t_partner_A", 10);
  assert.deepEqual(aud.map((a) => [a.action, a.target, a.actor]), [["payout_release", "po_1", "operator"]]);
  assert.equal(w.payouts.sent.length, 0);
  assert.equal(await w.sum("t_partner_A"), 0); // ledger untouched by a release
});

test("release then the existing retry executor picks it up with a full attempt budget", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  await w.rel("po_1", "t_partner_A");
  const r = await retryApprovedPayouts(w.store, w.payouts, T0 + 1000, 3, "t_partner_A");
  assert.deepEqual(r.items.map((i) => [i.action, i.attempts]), [["paid", 1]]);
  assert.equal(w.payouts.sent.length, 1);
});

test("double release is idempotent: second call is replayed, one audit row, state unchanged, also after it was paid", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  assert.equal((await w.j(await w.rel("po_1", "t_partner_A", "first"))).outcome, "applied");
  const again = await w.j(await w.rel("po_1", "t_partner_A", "second"));
  assert.equal(again.outcome, "replayed");
  assert.equal(again.payout.operatorNote, "first");
  await retryApprovedPayouts(w.store, w.payouts, T0 + 1000, 3, "t_partner_A");
  assert.equal((await w.j(await w.rel("po_1", "t_partner_A"))).outcome, "replayed");
  assert.equal((await w.store.payoutById("po_1"))!.status, "paid");
  assert.equal((await w.store.auditOf("t_partner_A", 10)).length, 1);
  assert.equal(w.payouts.sent.length, 1);
});

test("concurrent double release: one applied, one replayed, one audit row", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  const [a, b] = await Promise.all([w.rel("po_1", "t_partner_A"), w.rel("po_1", "t_partner_A")]);
  const outs = [(await w.j(a)).outcome, (await w.j(b)).outcome].sort();
  assert.deepEqual(outs, ["applied", "replayed"]);
  assert.equal((await w.store.auditOf("t_partner_A", 10)).length, 1);
});

test("a row held AGAIN after a release can be released again (fresh hold)", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  await w.rel("po_1", "t_partner_A");
  w.payouts.fail = true;
  await retryApprovedPayouts(w.store, w.payouts, T0 + 500, 1, "t_partner_A"); // exhausts to held again
  assert.equal((await w.store.payoutById("po_1"))!.status, "held");
  const r = await w.j(await w.rel("po_1", "t_partner_A"));
  assert.equal(r.outcome, "applied");
  assert.equal((await w.store.auditOf("t_partner_A", 10)).length, 2);
});

test("refund: held -> refunded, one positive reversal entry, ledger nets to zero, available balance restored, adapter never called", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  const before = availableCents(await w.store.ledgerOf("t_partner_A"), T0 + 1);
  assert.equal(before, 0);
  const r = await w.j(await w.ref("po_1", "t_partner_A", "Account closed"));
  assert.equal(r.outcome, "applied");
  assert.equal(r.payout.status, "refunded");
  const led = await w.store.ledgerOf("t_partner_A");
  const rev = led.filter((x) => x.kind === "payout_reversal");
  assert.equal(rev.length, 1);
  assert.equal(rev[0].amountCents, 250_000); assert.equal(rev[0].payoutId, "po_1"); assert.equal(rev[0].uniq, "payout_reversal:po_1");
  assert.equal(await w.sum("t_partner_A"), 250_000); // commission +250000, payout -250000, reversal +250000: the payout is cancelled out
  assert.equal(availableCents(led, Number.MAX_SAFE_INTEGER), 250_000); // the reversal is spendable once its availableAt has passed
  assert.deepEqual((await w.store.auditOf("t_partner_A", 10)).map((a) => a.action), ["payout_refund"]);
  assert.equal(w.payouts.sent.length, 0);
});

test("double refund is idempotent: one reversal entry only, one audit row; concurrent refunds too", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A"); await w.hold("po_2", "t_partner_A");
  assert.equal((await w.j(await w.ref("po_1", "t_partner_A"))).outcome, "applied");
  assert.equal((await w.j(await w.ref("po_1", "t_partner_A"))).outcome, "replayed");
  const [a, b] = await Promise.all([w.ref("po_2", "t_partner_A"), w.ref("po_2", "t_partner_A")]);
  assert.deepEqual([(await w.j(a)).outcome, (await w.j(b)).outcome].sort(), ["applied", "replayed"]);
  const rev = (await w.store.ledgerOf("t_partner_A")).filter((x) => x.kind === "payout_reversal");
  assert.equal(rev.length, 2);
  assert.equal((await w.store.auditOf("t_partner_A", 10)).length, 2);
});

test("refund then release is refused (409 already_refunded), nothing moves; release then refund is refused (wrong_state)", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A"); await w.hold("po_2", "t_partner_A");
  await w.ref("po_1", "t_partner_A");
  const r = await w.rel("po_1", "t_partner_A");
  assert.equal(r.status, 409); assert.equal((await w.j(r)).error, "already_refunded");
  assert.equal((await w.store.payoutById("po_1"))!.status, "refunded");
  await w.rel("po_2", "t_partner_A");
  const r2 = await w.ref("po_2", "t_partner_A");
  assert.equal(r2.status, 409); assert.equal((await w.j(r2)).error, "wrong_state");
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((x) => x.kind === "payout_reversal").length, 1);
});

test("race: release and refund together, exactly one wins and the ledger agrees with the winner", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  const [a, b] = await Promise.all([w.rel("po_1", "t_partner_A"), w.ref("po_1", "t_partner_A")]);
  const st = (await w.store.payoutById("po_1"))!.status;
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 409]);
  const rev = (await w.store.ledgerOf("t_partner_A")).filter((x) => x.kind === "payout_reversal").length;
  assert.equal(rev, st === "refunded" ? 1 : 0);
});

test("race with a D1-like store (payoutById returns a snapshot copy): the loser of the CAS is refused or replayed, never double-applied", async () => {
  const w = await world();
  const real = w.store.payoutById.bind(w.store);
  (w.store as any).payoutById = async (id: string) => { const p = await real(id); return p ? { ...p } : p; }; // a snapshot, like a D1 row
  await w.hold("po_1", "t_partner_A"); await w.hold("po_2", "t_partner_A");
  const [a, b] = await Promise.all([w.rel("po_1", "t_partner_A"), w.ref("po_1", "t_partner_A")]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const st = (await real("po_1"))!.status;
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((x) => x.payoutId === "po_1" && x.kind === "payout_reversal").length, st === "refunded" ? 1 : 0);
  const [c, d] = await Promise.all([w.ref("po_2", "t_partner_A"), w.ref("po_2", "t_partner_A")]);
  assert.deepEqual([(await w.j(c)).outcome, (await w.j(d)).outcome].sort(), ["applied", "replayed"]);
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((x) => x.payoutId === "po_2" && x.kind === "payout_reversal").length, 1);
});

test("only a held row moves: every other status is refused and untouched", async () => {
  const w = await world();
  for (const s of ["pending_approval", "sending", "paid", "failed", "rejected", "approved_retry"]) {
    const id = "po_" + s;
    await w.hold(id, "t_partner_A", { status: s });
    for (const f of [w.rel, w.ref]) { const r = await f(id, "t_partner_A"); assert.equal(r.status, 409, `${s}`); }
    assert.equal((await w.store.payoutById(id))!.status, s);
  }
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((x) => x.kind === "payout_reversal").length, 0);
  assert.equal((await w.store.auditOf("t_partner_A", 10)).length, 0);
});

test("tenant scope: wrong or missing tenant = 404/400, other tenant's row never moves or leaks, ledger of B untouched", async () => {
  const w = await world();
  await w.hold("po_a", "t_partner_A"); await w.hold("po_b", "t_partner_B");
  for (const f of [w.rel, w.ref]) {
    assert.equal((await f("po_a", "t_partner_B")).status, 404);   // A's payout under B's tenant
    assert.equal((await f("po_b", "t_partner_A")).status, 404);
    assert.equal((await f("po_a", undefined)).status, 400);
    assert.equal((await f("po_a", "t_partner_A OR 1")).status, 400);
    assert.equal((await f("po_missing", "t_partner_A")).status, 404);
  }
  assert.equal((await w.store.payoutById("po_a"))!.status, "held");
  assert.equal((await w.store.payoutById("po_b"))!.status, "held");
  await w.ref("po_a", "t_partner_A");
  assert.equal((await w.store.ledgerOf("t_partner_B")).filter((x) => x.kind === "payout_reversal").length, 0);
  assert.equal((await w.store.auditOf("t_partner_B", 10)).length, 0);
  const body = JSON.stringify(await w.j(await w.rel("po_b", "t_partner_A")));
  assert.ok(!body.includes("po_b") || body.includes("not_found")); assert.ok(!body.includes("acct_SYNTH"));
});

test("refund with no original payout ledger entry fails closed: row stays held, no ledger write", async () => {
  const w = await world();
  await w.store.putPayout({ id: "po_x", partnerId: "t_partner_A", amountCents: 100, status: "held", createdAt: T0, reason: "x" } as any);
  const r = await w.ref("po_x", "t_partner_A");
  assert.equal(r.status, 409); assert.equal((await w.j(r)).error, "ledger_entry_missing");
  assert.equal((await w.store.payoutById("po_x"))!.status, "held");
  assert.equal((await w.store.ledgerOf("t_partner_A")).length, 0);
});

test("refund replay heals a crash between the status write and the ledger write", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  await w.store.putPayout({ ...(await w.store.payoutById("po_1"))!, status: "refunded", refundedAt: T0 } as any); // crashed before the reversal
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((x) => x.kind === "payout_reversal").length, 0);
  assert.equal((await w.j(await w.ref("po_1", "t_partner_A"))).outcome, "replayed");
  assert.equal(await w.sum("t_partner_A"), 250_000);
  await w.ref("po_1", "t_partner_A");
  assert.equal((await w.store.ledgerOf("t_partner_A")).filter((x) => x.kind === "payout_reversal").length, 1);
});

test("note is sanitised and bounded; a non-string note is 400", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  const r = await w.j(await w.rel("po_1", "t_partner_A", "<script>alert(1)</script> ok " + "z".repeat(500)));
  assert.ok(!r.payout.operatorNote.includes("<")); assert.ok(r.payout.operatorNote.length <= 200);
  await w.hold("po_2", "t_partner_A");
  assert.equal((await w.call("/internal/enterprise/payouts/po_2/refund", { tenantId: "t_partner_A", note: { a: 1 } })).status, 400);
  assert.equal((await w.store.payoutById("po_2"))!.status, "held");
});

test("route shape: GET on release, unknown action, extra segments = 404; no secrets in output", async () => {
  const w = await world();
  await w.hold("po_1", "t_partner_A");
  assert.equal((await w.call("/internal/enterprise/payouts/po_1/release", undefined, INTERNAL, "GET")).status, 404);
  assert.equal((await w.call("/internal/enterprise/payouts/po_1/destroy", { tenantId: "t_partner_A" })).status, 404);
  assert.equal((await w.call("/internal/enterprise/payouts/po_1/release/x", { tenantId: "t_partner_A" })).status, 404);
  const raw = JSON.stringify(await w.j(await w.rel("po_1", "t_partner_A")));
  assert.ok(!raw.includes(INTERNAL) && !raw.includes("acct_SYNTH"));
});

test("source check: no transfer call, no stripe/fetch/timers, no em or en dashes", () => {
  const src = readFileSync(new URL("../src/enterprise/payout_release.ts", import.meta.url), "utf8");
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/\.transfer\(|stripe|fetch\(|setTimeout|setInterval|cron/i.test(code));
  assert.ok(!/[\u2013\u2014]/.test(src));
});
