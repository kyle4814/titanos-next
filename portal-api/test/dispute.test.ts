// f97: dispute + warranty state machine. SYNTHETIC fixtures only (example.com jobs, fake amounts, no store, no money).
// Mutation test per invariant: `node --experimental-strip-types test/mutate_dispute.mjs` (not part of npm test; it reruns this file per mutant).
import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, openDispute, importPaid, rankCredit, verifyAudit, EDGES, STATES, KINDS, WARRANTY_WINDOW_DAYS, type DisputeCase, type DEvent, type DState, type DKind } from "../src/market/dispute.ts";
import { rankFor } from "../src/market/rank.ts";

const DAY = 86_400_000, T0 = 1_800_000_000_000;   // SYNTHETIC epoch
const mk = (extra: Partial<Parameters<typeof openDispute>[0]> = {}) => openDispute({ jobId: "job_syn_1", amountCents: 15_000, at: T0, actor: "owner_syn", eventId: "e0", reason: "SYNTHETIC: fix not as described", synthetic: true, ...extra });
const ev = (kind: DKind, n: number, at: number, extra: Partial<DEvent> = {}): DEvent => ({ eventId: `e${n}`, kind, at, actor: "syn", detail: kind === "SUBMIT_EVIDENCE" ? "SYNTHETIC: screenshot of the SPF record" : "", ...extra });
const ok = (r: ReturnType<typeof apply>) => { assert.equal(r.ok, true, JSON.stringify(r)); return r as Extract<typeof r, { ok: true }>; };

// ---------- unit: the happy paths ----------
test("OPEN -> EVIDENCE -> RESOLVED_PAID, audit chained, rank credit frozen until resolved", () => {
  let c = mk(); assert.equal(c.state, "OPEN"); assert.equal(rankCredit(c), "frozen");
  c = ok(apply(c, ev("SUBMIT_EVIDENCE", 1, T0 + 1))).case; assert.equal(c.state, "EVIDENCE"); assert.equal(rankCredit(c), "frozen");
  c = ok(apply(c, ev("RESOLVE_PAID", 2, T0 + 2))).case; assert.equal(c.state, "RESOLVED_PAID"); assert.equal(rankCredit(c), "counts");
  assert.equal(c.audit.length, 3); assert.equal(verifyAudit(c), null); assert.deepEqual(c.audit.map((a) => a.to), ["OPEN", "EVIDENCE", "RESOLVED_PAID"]);
});
test("EVIDENCE -> RESOLVED_REFUNDED revokes credit and raises no clawback card", () => {
  let c = ok(apply(mk(), ev("SUBMIT_EVIDENCE", 1, T0 + 1))).case;
  c = ok(apply(c, ev("RESOLVE_REFUND", 2, T0 + 2))).case; assert.equal(c.state, "RESOLVED_REFUNDED"); assert.equal(rankCredit(c), "revoked"); assert.equal(c.cards.length, 0);
});
test("more evidence is a self loop that still appends one audit entry per piece", () => {
  let c = mk(); for (let i = 1; i <= 3; i++) c = ok(apply(c, ev("SUBMIT_EVIDENCE", i, T0 + i))).case;
  assert.equal(c.state, "EVIDENCE"); assert.equal(c.evidence.length, 3); assert.equal(c.audit.length, 4);
});

// ---------- I5 clawback ----------
test("regression inside the warranty window after payout raises ONE data-only clawback card", () => {
  const c0 = importPaid({ jobId: "job_syn_2", amountCents: 20_000, proofAt: T0, paidAt: T0 + DAY, actor: "sys", eventId: "p0", synthetic: true });
  assert.equal(c0.state, "RESOLVED_PAID"); assert.equal(rankCredit(c0), "counts");
  const r = ok(apply(c0, ev("REGRESSION", 1, T0 + 10 * DAY, { regressedAt: T0 + 10 * DAY })));
  assert.equal(r.case.state, "CLAWBACK"); assert.equal(rankCredit(r.case), "revoked");
  assert.equal(r.card?.kind, "clawback_review"); assert.equal(r.card?.moneyMoved, false); assert.equal(r.card?.amountCents, 20_000); assert.equal(r.case.cards.length, 1);
  assert.match(r.card!.reason, /10 days after the proof/);
  // a second regression event cannot raise a second card: CLAWBACK is terminal
  const again = apply(r.case, ev("REGRESSION", 2, T0 + 11 * DAY)); assert.equal(again.ok, false); assert.equal(r.case.cards.length, 1);
});
test("regression on the last day of the window clawbacks; one millisecond later is a new fault, not a clawback", () => {
  const c0 = importPaid({ jobId: "job_syn_3", amountCents: 100, proofAt: T0, paidAt: T0, actor: "sys", eventId: "p0" });
  const edge = WARRANTY_WINDOW_DAYS * DAY;
  assert.equal(apply(c0, ev("REGRESSION", 1, T0 + edge, { regressedAt: T0 + edge })).ok, true);
  const late = apply(c0, ev("REGRESSION", 1, T0 + edge + 1, { regressedAt: T0 + edge + 1 })); assert.equal(late.ok, false); assert.equal((late as any).reason, "outside_warranty_window");
});
test("regression is refused with no payout, before the proof, or dated in the future", () => {
  let c = ok(apply(ok(apply(mk(), ev("SUBMIT_EVIDENCE", 1, T0 + 1))).case, ev("RESOLVE_PAID", 2, T0 + 2))).case;
  const base = importPaid({ jobId: "j", amountCents: 1, proofAt: T0 + 100, paidAt: T0 + 100, actor: "s", eventId: "p" });
  assert.equal((apply(base, ev("REGRESSION", 1, T0 + 200, { regressedAt: T0 + 50 })) as any).reason, "regression_before_proof");
  assert.equal((apply(base, ev("REGRESSION", 1, T0 + 200, { regressedAt: T0 + 300 })) as any).reason, "regression_in_the_future");
  const noPay = structuredClone(c); delete noPay.paidAt;
  assert.equal((apply(noPay, ev("REGRESSION", 9, T0 + 9)) as any).reason, "no_payout_to_claw_back");
  assert.throws(() => importPaid({ jobId: "j", amountCents: 1, proofAt: 10, paidAt: 5, actor: "s", eventId: "p" }), /paid_before_proof/);
  assert.throws(() => mk({ amountCents: -1 }), /amount_invalid/);
});

// ---------- I1 illegal transitions, exhaustive over the full state x kind grid ----------
test("every (state, kind) pair outside EDGES is rejected and leaves the case untouched", () => {
  const at: Record<DState, () => DisputeCase> = {
    OPEN: () => mk(),
    EVIDENCE: () => ok(apply(mk(), ev("SUBMIT_EVIDENCE", 1, T0 + 1))).case,
    RESOLVED_PAID: () => ok(apply(ok(apply(mk(), ev("SUBMIT_EVIDENCE", 1, T0 + 1))).case, ev("RESOLVE_PAID", 2, T0 + 2))).case,
    RESOLVED_REFUNDED: () => ok(apply(ok(apply(mk(), ev("SUBMIT_EVIDENCE", 1, T0 + 1))).case, ev("RESOLVE_REFUND", 2, T0 + 2))).case,
    CLAWBACK: () => ok(apply(importPaid({ jobId: "j", amountCents: 5, proofAt: T0, paidAt: T0, actor: "s", eventId: "p" }), ev("REGRESSION", 1, T0 + DAY))).case,
  };
  let legal = 0, illegal = 0;
  for (const s of STATES) for (const k of KINDS) {
    const c = at[s](); assert.equal(c.state, s); const before = JSON.stringify(c);
    const r = apply(c, ev(k, 77, T0 + 5 * DAY, { regressedAt: T0 + DAY }));
    if (EDGES[`${s}:${k}`]) { legal++; assert.equal(r.ok, true, `${s}:${k}`); }
    else { illegal++; assert.equal(r.ok, false, `${s}:${k} must be illegal`); assert.match((r as any).reason, /^illegal_transition/); }
    assert.equal(JSON.stringify(c), before, "input never mutated");
  }
  assert.equal(legal, 5); assert.equal(illegal, 15);
  // terminal states have no way out
  for (const s of ["RESOLVED_REFUNDED", "CLAWBACK"] as DState[]) assert.equal(Object.keys(EDGES).filter((e) => e.startsWith(s + ":")).length, 0);
});
test("malformed events are rejected: no id, unknown kind, NaN time, empty evidence, time running backwards", () => {
  const c = mk();
  assert.equal((apply(c, { ...ev("SUBMIT_EVIDENCE", 1, T0 + 1), eventId: "" }) as any).reason, "event_id_required");
  assert.equal((apply(c, { ...ev("SUBMIT_EVIDENCE", 1, T0 + 1), kind: "PAY_NOW" as DKind }) as any).reason, "unknown_event_kind");
  assert.equal((apply(c, ev("SUBMIT_EVIDENCE", 1, NaN)) as any).reason, "time_invalid");
  assert.equal((apply(c, { ...ev("SUBMIT_EVIDENCE", 1, T0 + 1), detail: "   " }) as any).reason, "evidence_empty");
  assert.equal((apply(c, ev("SUBMIT_EVIDENCE", 1, T0 - 1)) as any).reason, "time_runs_backwards");
});

// ---------- I2 replay ----------
test("replaying an event id is a no-op; reusing it with a different payload is rejected", () => {
  const c1 = ok(apply(mk(), ev("SUBMIT_EVIDENCE", 1, T0 + 1))).case;
  const r = ok(apply(c1, ev("SUBMIT_EVIDENCE", 1, T0 + 1))); assert.equal(r.replay, true); assert.equal(r.case.audit.length, 2); assert.deepEqual(r.case, c1);
  const clash = apply(c1, { ...ev("SUBMIT_EVIDENCE", 1, T0 + 1), detail: "SYNTHETIC: different" }); assert.equal((clash as any).reason, "event_id_reused_with_different_payload");
  // the opening event id is also protected: reusing e0 for a different payload is rejected
  assert.equal((apply(mk(), { eventId: "e0", kind: "SUBMIT_EVIDENCE", at: T0, actor: "x", detail: "SYNTHETIC" }) as any).reason, "event_id_reused_with_different_payload");
});
test("a replayed resolution after the case moved on does not move it again or double the card", () => {
  let c = importPaid({ jobId: "j", amountCents: 9, proofAt: T0, paidAt: T0, actor: "s", eventId: "p" });
  const reg = ev("REGRESSION", 1, T0 + DAY);
  c = ok(apply(c, reg)).case; const again = ok(apply(c, reg)); assert.equal(again.replay, true); assert.equal(again.case.cards.length, 1); assert.equal(again.card, undefined);
});

// ---------- I3 audit ----------
test("audit tamper is detected by verifyAudit (edited field, deleted entry, reordered entries)", () => {
  let c = mk(); c = ok(apply(c, ev("SUBMIT_EVIDENCE", 1, T0 + 1))).case; c = ok(apply(c, ev("RESOLVE_REFUND", 2, T0 + 2))).case;
  assert.equal(verifyAudit(c), null);
  const edit = structuredClone(c); edit.audit[1].actor = "mallory"; assert.equal(verifyAudit(edit), 2);
  const del = structuredClone(c); del.audit.splice(1, 1); assert.notEqual(verifyAudit(del), null);
  const swap = structuredClone(c); [swap.audit[1], swap.audit[2]] = [swap.audit[2], swap.audit[1]]; assert.notEqual(verifyAudit(swap), null);
  const head = structuredClone(c); head.audit[0].detail = "rewritten"; assert.equal(verifyAudit(head), 1);
});

// ---------- I4 against the live rank function ----------
test("rankFor already gives a disputed job no credit; the machine's rankCredit agrees on every state", () => {
  const job = (status: string, regressedAt?: number) => ({ id: "j", proAccountId: "pro", status, severity: "FAIL", proof: { at: T0 }, abandonedBy: [], ownerAccountId: "o", domain: "example.com", check: "SPF", regressedAt } as any);
  assert.equal(rankFor("pro", [job("disputed")]).points, 0);
  assert.equal(rankFor("pro", [job("paid")]).points, 3);
  assert.equal(rankFor("pro", [job("paid", T0 + DAY)]).points, 0, "a regressed paid job loses credit, matching CLAWBACK = revoked");
  assert.deepEqual(STATES.map((s) => rankCredit({ state: s })), ["frozen", "frozen", "counts", "revoked", "revoked"]);
});

// ---------- property tests over generated sequences ----------
function prng(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
// Independent reference model written without importing EDGES (so a mutated EDGES cannot also mutate the oracle).
function refStep(state: DState, kind: DKind): DState | null {
  if (state === "OPEN" && kind === "SUBMIT_EVIDENCE") return "EVIDENCE";
  if (state === "EVIDENCE" && kind === "SUBMIT_EVIDENCE") return "EVIDENCE";
  if (state === "EVIDENCE" && kind === "RESOLVE_PAID") return "RESOLVED_PAID";
  if (state === "EVIDENCE" && kind === "RESOLVE_REFUND") return "RESOLVED_REFUNDED";
  if (state === "RESOLVED_PAID" && kind === "REGRESSION") return "CLAWBACK";
  return null;
}
function gen(rnd: () => number, n: number): DEvent[] {
  const out: DEvent[] = []; let t = T0;
  for (let i = 0; i < n; i++) {
    const kind = KINDS[Math.floor(rnd() * KINDS.length)];
    t += Math.floor(rnd() * 3 * DAY) - (rnd() < 0.08 ? 4 * DAY : 0);   // sometimes backwards
    const dup = out.length && rnd() < 0.2;
    const base = dup ? out[Math.floor(rnd() * out.length)] : null;
    out.push(base && rnd() < 0.5 ? { ...base } : { eventId: dup ? base!.eventId : `g${i}`, kind, at: t, actor: "syn", detail: kind === "SUBMIT_EVIDENCE" && rnd() < 0.9 ? "SYNTHETIC evidence" : "", regressedAt: kind === "REGRESSION" ? t - Math.floor(rnd() * 45 * DAY) : undefined });
  }
  return out;
}
test("property: 1500 generated sequences hold I1..I6 against an independent reference model", () => {
  const rnd = prng(20261107); let accepted = 0, rejected = 0, replays = 0, clawbacks = 0, resolvedPaid = 0, refunded = 0;
  for (let run = 0; run < 1500; run++) {
    const evs = gen(rnd, Math.floor(rnd() * 14));
    // half the runs start from a paid import so the clawback branch is exercised
    let c: DisputeCase = run % 2 ? importPaid({ jobId: `j${run}`, amountCents: 1000 + run, proofAt: T0, paidAt: T0, actor: "s", eventId: "p0", synthetic: true }) : mk({ jobId: `j${run}`, amountCents: 1000 + run });
    const acc: DEvent[] = [];
    for (const e of evs) {
      const before = JSON.stringify(c); const prevLen = c.audit.length, prevState = c.state, prevAt = c.audit[c.audit.length - 1].at;
      const r = apply(c, e);
      assert.equal(JSON.stringify(c), before, "I: input never mutated");
      if (!r.ok) { rejected++; assert.deepEqual(r.case, c, "rejected leaves case untouched"); assert.equal(r.case.audit.length, prevLen); continue; }
      if (r.replay) { replays++; assert.equal(r.case.audit.length, prevLen, "I2/I3 replay appends nothing"); assert.deepEqual(r.case, c); continue; }
      accepted++; acc.push(e);
      assert.equal(refStep(prevState, e.kind), r.case.state, "I1 vs reference");   // accepted implies the reference edge exists
      assert.equal(r.case.audit.length, prevLen + 1, "I3 exactly one audit entry");
      assert.ok(r.case.audit[prevLen].at >= prevAt, "I6 time monotone");
      assert.equal(r.case.audit[prevLen].from, prevState);
      c = r.case; assert.equal(verifyAudit(c), null);
      // I4 at every prefix
      const credit = rankCredit(c); assert.equal(credit, c.state === "OPEN" || c.state === "EVIDENCE" ? "frozen" : c.state === "RESOLVED_PAID" ? "counts" : "revoked");
      // I5
      assert.ok(c.cards.length <= 1); assert.equal(c.cards.length === 1, c.state === "CLAWBACK"); for (const k of c.cards) assert.equal(k.moneyMoved, false);
    }
    // reference replay of the same stream gives the same terminal state; replaying the whole stream again is a no-op
    const again = acc.reduce((x, e) => apply(x, e).case, c);
    assert.deepEqual(again, c, "replaying every accepted event onto the final case changes nothing");
    if (c.state === "CLAWBACK") clawbacks++; if (c.state === "RESOLVED_PAID") resolvedPaid++; if (c.state === "RESOLVED_REFUNDED") refunded++;
  }
  // the generator must actually reach every region, or the property proves nothing
  assert.ok(accepted > 800 && rejected > 800 && replays > 50, `coverage accepted=${accepted} rejected=${rejected} replays=${replays}`);
  assert.ok(clawbacks > 20 && resolvedPaid > 20 && refunded > 20, `terminal coverage clawbacks=${clawbacks} paid=${resolvedPaid} refunded=${refunded}`);
  console.log(`# property coverage: accepted=${accepted} rejected=${rejected} replays=${replays} clawback=${clawbacks} resolved_paid=${resolvedPaid} refunded=${refunded}`);
});
