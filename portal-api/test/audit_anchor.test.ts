// f102: audit head anchor. SYNTHETIC fixtures only (example jobs, fake amounts, in-memory stores, FakeD1 on node:sqlite; no live D1).
// Mutation test per invariant: `node test/mutate_audit_anchor.mjs` (reruns this file per mutant; not part of npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { apply, openDispute, verifyAudit, type DisputeCase, type DEvent } from "../src/market/dispute.ts";
import { MemoryAnchorStore, D1AnchorStore, anchorCase, verifyAnchored, type AnchorStore } from "../src/market/audit_anchor.ts";
import { FakeD1 } from "./fake_d1.ts";

const T0 = 1_800_000_000_000;   // SYNTHETIC epoch
const H = (n: number) => createHash("sha256").update(`syn${n}`).digest("hex");
const ev = (kind: DEvent["kind"], n: number, extra: Partial<DEvent> = {}): DEvent => ({ eventId: `e${n}`, kind, at: T0 + n, actor: "syn", detail: kind === "SUBMIT_EVIDENCE" ? "SYNTHETIC: screenshot" : "", ...extra });
function paidCase(jobId = "job_syn_a"): DisputeCase {
  let c = openDispute({ jobId, amountCents: 15_000, at: T0, actor: "owner_syn", eventId: "e0", reason: "SYNTHETIC: fix not as described", synthetic: true });
  for (const e of [ev("SUBMIT_EVIDENCE", 1), ev("RESOLVE_PAID", 2)]) { const r = apply(c, e); assert.equal(r.ok, true); c = (r as { case: DisputeCase }).case; }
  return c;
}
// What an attacker with write access to the case does: edit an entry, then recompute every later hash (same algorithm as dispute.ts).
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function rewriteAndRecompute(c: DisputeCase, idx: number, patch: { detail?: string; actor?: string }): DisputeCase {
  const x = structuredClone(c); Object.assign(x.audit[idx], patch);
  let prev = "0".repeat(64);
  for (const e of x.audit) { e.prev = prev; e.hash = sha(JSON.stringify([e.seq, e.eventId, e.kind, e.from, e.to, e.at, e.actor, e.detail, e.payloadHash, e.prev])); prev = e.hash; }
  return x;
}

type Make = () => { store: AnchorStore; d1?: FakeD1 };
const adapters: [string, Make][] = [
  ["memory", () => ({ store: new MemoryAnchorStore() })],
  ["d1 (FakeD1)", () => { const d1 = new FakeD1(); /* restack f350: the int-head FakeD1 takes an rng and applies every migration, 0006_audit_anchor included */ return { store: new D1AnchorStore(d1), d1 }; }],
];

for (const [name, make] of adapters) {
  test(`[${name}] intact case anchors and verifies; unanchored tail is reported, not hidden`, async () => {
    const { store } = make(); const c = paidCase();
    assert.deepEqual(await verifyAnchored(store, c), { ok: false, reason: "unanchored" });   // A6
    const r = await anchorCase(store, c, T0 + 10); assert.deepEqual(r, { ok: true, anchored: 3 });
    assert.deepEqual(await verifyAnchored(store, c), { ok: true, anchoredThrough: 3, unanchoredTail: 0 });
    const more = apply(c, ev("REGRESSION", 3, { regressedAt: T0 + 3 })); assert.equal(more.ok, true);
    assert.deepEqual(await verifyAnchored(store, (more as { case: DisputeCase }).case), { ok: true, anchoredThrough: 3, unanchoredTail: 1 });
  });

  test(`[${name}] A4 rewrite-and-recompute passes verifyAudit alone but is caught by the anchor`, async () => {
    const { store } = make(); const c = paidCase(); await anchorCase(store, c, T0 + 10);
    const forged = rewriteAndRecompute(c, 1, { detail: "SYNTHETIC: forged evidence note" });
    assert.equal(verifyAudit(forged), null, "the gap: internal consistency alone is fooled");
    assert.notEqual(forged.audit[1].hash, c.audit[1].hash);
    assert.deepEqual(await verifyAnchored(store, forged), { ok: false, reason: "head_mismatch", seq: 2 });
    // rewriting only the very first entry shifts every later hash, caught at seq 1
    assert.deepEqual(await verifyAnchored(store, rewriteAndRecompute(c, 0, { actor: "someone_else" })), { ok: false, reason: "head_mismatch", seq: 1 });
  });

  test(`[${name}] A5 truncation below the latest anchor is caught (even though the shorter chain is internally valid)`, async () => {
    const { store } = make(); const c = paidCase(); await anchorCase(store, c, T0 + 10);
    const cut = structuredClone(c); cut.audit.pop(); cut.state = "EVIDENCE";
    assert.equal(verifyAudit(cut), null);
    assert.deepEqual(await verifyAnchored(store, cut), { ok: false, reason: "truncated", seq: 3 });
    const gone = structuredClone(c); gone.audit = [];
    assert.deepEqual(await verifyAnchored(store, gone), { ok: false, reason: "truncated", seq: 1 });
  });

  test(`[${name}] A1 append-only: a different head for an anchored seq is rejected and the original survives`, async () => {
    const { store } = make();
    assert.deepEqual(await store.append({ jobId: "j", seq: 1, head: H(1), at: T0 }), { ok: true, replay: false });
    assert.deepEqual(await store.append({ jobId: "j", seq: 1, head: H(2), at: T0 + 1 }), { ok: false, reason: "anchor_conflict" });
    assert.deepEqual((await store.list("j")).map((a) => a.head), [H(1)]);
  });

  test(`[${name}] A2 replay of the same head is idempotent: one row, no error`, async () => {
    const { store } = make();
    await store.append({ jobId: "j", seq: 1, head: H(1), at: T0 });
    for (let i = 0; i < 3; i++) assert.deepEqual(await store.append({ jobId: "j", seq: 1, head: H(1), at: T0 + 99 }), { ok: true, replay: true });
    const l = await store.list("j"); assert.equal(l.length, 1); assert.equal(l[0].at, T0, "first-write timestamp kept");
    const c = paidCase(); await anchorCase(store, c, T0); assert.deepEqual(await anchorCase(store, c, T0 + 5), { ok: true, anchored: 0 });
  });

  test(`[${name}] A3 no gaps, invalid input refused, jobs are independent`, async () => {
    const { store } = make();
    assert.deepEqual(await store.append({ jobId: "j", seq: 2, head: H(2), at: T0 }), { ok: false, reason: "anchor_gap" });
    for (const bad of [{ jobId: "", seq: 1, head: H(1) }, { jobId: "j", seq: 0, head: H(1) }, { jobId: "j", seq: 1.5, head: H(1) }, { jobId: "j", seq: 1, head: "xyz" }])
      assert.deepEqual(await store.append({ ...bad, at: T0 }), { ok: false, reason: "anchor_invalid" });
    assert.deepEqual(await store.append({ jobId: "k", seq: 1, head: H(1), at: T0 }), { ok: true, replay: false });
    assert.deepEqual(await store.list("j"), []);
  });

  test(`[${name}] anchorCase refuses to bless a rewritten case as new history`, async () => {
    const { store } = make(); const c = paidCase(); await anchorCase(store, c, T0 + 10);
    const forged = rewriteAndRecompute(c, 1, { detail: "SYNTHETIC: forged" });
    assert.deepEqual(await anchorCase(store, forged, T0 + 20), { ok: false, reason: "anchor_mismatch_at_2" });
    const broken = structuredClone(c); broken.audit[1].detail = "x";   // no recompute: chain itself broken
    const fresh = make().store; assert.deepEqual(await anchorCase(fresh, broken, T0), { ok: false, reason: "chain_broken_at_2" });
    assert.deepEqual(await verifyAnchored(store, c), { ok: true, anchoredThrough: 3, unanchoredTail: 0 });
  });

  test(`[${name}] verifyAnchored reports a broken internal chain before consulting anchors`, async () => {
    const { store } = make(); const c = paidCase(); await anchorCase(store, c, T0);
    const t = structuredClone(c); t.audit[2].actor = "evil";
    assert.deepEqual(await verifyAnchored(store, t), { ok: false, reason: "chain_broken", seq: 3 });
  });
}

test("D1 adapter: the table itself refuses UPDATE and DELETE (trigger), and a raced duplicate insert changes no rows", async () => {
  const [, make] = adapters[1]; const { store, d1 } = make(); await store.append({ jobId: "j", seq: 1, head: H(1), at: T0 });
  assert.throws(() => d1!.db.exec("UPDATE audit_anchor SET head = 'x'"), /audit_anchor_append_only/);
  assert.throws(() => d1!.db.exec("DELETE FROM audit_anchor"), /audit_anchor_append_only/);
  const rs = await Promise.all([1, 2, 3, 4].map(() => store.append({ jobId: "j", seq: 2, head: H(2), at: T0 })));
  assert.equal(rs.filter((r) => r.ok && !r.replay).length, 1, "exactly one writer wins the race"); assert.equal((await store.list("j")).length, 2);
});

test("property: random single-field rewrites of a random-length case are always caught, never a false alarm on the original", async () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let t = 0; t < 200; t++) {
    let c = openDispute({ jobId: `job_syn_${t}`, amountCents: 100, at: T0, actor: "s", eventId: "e0", reason: "SYNTHETIC" });
    const extra = Math.floor(rnd() * 6); for (let i = 1; i <= extra; i++) c = (apply(c, ev("SUBMIT_EVIDENCE", i)) as { case: DisputeCase }).case;
    const store = new MemoryAnchorStore(); await anchorCase(store, c, T0);
    assert.equal((await verifyAnchored(store, c)).ok, true);
    const idx = Math.floor(rnd() * c.audit.length), f = rewriteAndRecompute(c, idx, { detail: `forged${t}` });
    const v = await verifyAnchored(store, f); assert.equal(v.ok, false, `t=${t} idx=${idx}`);
  }
});

test("anchorCase counts only newly written anchors: a concurrent anchorer that already wrote them yields replays, counted as 0", async () => {
  const c = paidCase(); const real = new MemoryAnchorStore(); await anchorCase(real, c, T0);
  const stale: AnchorStore = { list: async () => [], append: (a) => real.append(a) };   // list is stale, append sees the truth
  assert.deepEqual(await anchorCase(stale, c, T0 + 1), { ok: true, anchored: 0 });
});
