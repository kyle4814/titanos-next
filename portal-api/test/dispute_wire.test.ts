// f99: dispute.ts wired into market/service.ts. SYNTHETIC data only (example domains, mock payments, in-memory stores).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rig } from "./market_harness.ts";
import { rankFor } from "../src/market/rank.ts";
import { openDispute, apply, rankCredit, verifyAudit } from "../src/market/dispute.ts";

const DAY = 86_400_000;

test("W1 synthetic: dispute() opens a machine case in OPEN with a verifiable audit; the job is frozen", async () => {
  const r = rig(); const o = await r.owner("o@w1.example.com", "w1.example.com.au"); const p = await r.pro("p@w1.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); await r.deliver(p.session, id);
  await r.h.req("POST", `/market/jobs/${id}/dispute`, { token: o.session, body: { reason: "pro disappeared" } });
  const j = (await r.store.getJob(id))!; assert.equal(j.status, "disputed");
  assert.equal(j.disputeCase!.state, "OPEN"); assert.equal(verifyAudit(j.disputeCase!), null); assert.equal(j.disputeCase!.audit.length, 1);
  assert.equal(rankCredit(j.disputeCase!), "frozen");
});

test("W1b synthetic: a job that already carries a proof passes proof.at into the case (warranty clock source)", async () => {
  const r = rig(); const o = await r.owner("o@w1b.example.com", "w1b.example.com.au"); const p = await r.pro("p@w1b.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); await r.deliver(p.session, id);
  const j0 = (await r.store.getJob(id))!; j0.status = "delivered"; j0.proof = { scanId: "sc_syn", at: 12345, baseline: "FAIL", now: "PASS", detail: "synthetic" }; await r.store.putJob(j0);
  await r.h.req("POST", `/market/jobs/${id}/dispute`, { token: o.session, body: { reason: "pro disappeared" } });
  assert.equal((await r.store.getJob(id))!.disputeCase!.proofAt, 12345);
});

test("W2 synthetic: refund_owner drives OPEN>EVIDENCE>RESOLVED_REFUNDED, credit revoked, audit intact, one refund", async () => {
  const r = rig(); const o = await r.owner("o@w2.example.com", "w2.example.com.au"); const p = await r.pro("p@w2.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); await r.deliver(p.session, id);
  await r.h.req("POST", `/market/jobs/${id}/dispute`, { token: o.session, body: { reason: "pro disappeared" } });
  const card = (await r.store.openCards())[0]; await r.internal("POST", `/internal/market/cards/${card.id}/resolve`, { outcome: "refund_owner" });
  const j = (await r.store.getJob(id))!; assert.equal(j.status, "refunded");
  assert.equal(j.disputeCase!.state, "RESOLVED_REFUNDED"); assert.deepEqual(j.disputeCase!.audit.map((a) => a.to), ["OPEN", "EVIDENCE", "RESOLVED_REFUNDED"]);
  assert.equal(verifyAudit(j.disputeCase!), null); assert.equal(rankCredit(j.disputeCase!), "revoked"); assert.equal(r.payments.count("refund"), 1);
});

test("W2b synthetic: resume archives the case (audit kept) and the job can still only pay on proof", async () => {
  const r = rig(); const o = await r.owner("o@w2b.example.com", "w2b.example.com.au"); const p = await r.pro("p@w2b.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  await r.h.req("POST", `/market/jobs/${id}/dispute`, { token: p.session, body: { reason: "owner unresponsive" } });
  await r.internal("POST", `/internal/market/cards/${(await r.store.openCards())[0].id}/resolve`, { outcome: "resume" });
  const j = (await r.store.getJob(id))!; assert.equal(j.status, "claimed"); assert.equal(j.disputeCase, undefined); assert.equal(j.disputeArchive!.length, 1);
  assert.equal(verifyAudit(j.disputeArchive![0]), null);
});

test("W3 synthetic: a disputed job earns 0 rank even when it carries a proof; the machine agrees (frozen)", async () => {
  const r = rig(); const o = await r.owner("o@w3.example.com", "w3.example.com.au"); const p = await r.pro("p@w3.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); await r.deliver(p.session, id);
  await r.h.req("POST", `/market/jobs/${id}/dispute`, { token: o.session, body: { reason: "pro disappeared" } });
  const j = (await r.store.getJob(id))!; j.proof = { scanId: "sc_synthetic", at: r.h.clock.t, baseline: "FAIL", now: "PASS", detail: "synthetic" };
  assert.equal(rankFor(p.id, [j]).points, 0); assert.equal(rankFor(p.id, [j]).provenFixes, 0); assert.equal(rankCredit(j.disputeCase!), "frozen");
});

test("W4 synthetic: a regressed paid job clawbacks ONCE; the machine case is CLAWBACK, hash chain intact, no money moves", async () => {
  const r = rig(); const o = await r.owner("own@w4.example.com", "w4.example.com.au"); const p = await r.pro("pro@w4.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); r.fix("w4.example.com.au"); await r.deliver(p.session, id);
  r.unfix("w4.example.com.au"); r.h.clock.t += 5 * DAY;
  for (let i = 0; i < 3; i++) await r.internal("POST", "/internal/market/sweep");
  const j = (await r.store.getJob(id))!;
  assert.equal(j.clawbacks!.length, 1); assert.equal((await r.store.openCards()).filter((c) => c.kind === "clawback_review").length, 1);
  assert.equal(j.disputeCase!.state, "CLAWBACK"); assert.equal(j.disputeCase!.cards.length, 1); assert.equal(j.disputeCase!.cards[0].moneyMoved, false);
  assert.equal(verifyAudit(j.disputeCase!), null); assert.equal(rankCredit(j.disputeCase!), "revoked"); assert.equal(rankFor(p.id, [j]).points, 0);
  assert.equal(r.payments.count("transfer"), 1);
});

test("W5 pure synthetic: proofAt in openDispute starts the warranty clock at the job's proof, not at the resolution", () => {
  const T = 1_000 * DAY;
  const run = (proofAt?: number) => {
    let c = openDispute({ jobId: "j_syn", amountCents: 5000, at: T + 2 * DAY, actor: "o", eventId: "e0", reason: "synthetic dispute", proofAt, synthetic: true });
    for (const [id, kind, at, detail] of [["e1", "SUBMIT_EVIDENCE", T + 3 * DAY, "note"], ["e2", "RESOLVE_PAID", T + 20 * DAY, undefined]] as const) { const x = apply(c, { eventId: id, kind, at, actor: "k", detail }); assert.ok(x.ok); c = x.case; }
    return { c, reg: apply(c, { eventId: "e3", kind: "REGRESSION", at: T + 32 * DAY, actor: "s", regressedAt: T + 31 * DAY }) };
  };
  const withProof = run(T); assert.equal(withProof.c.proofAt, T); assert.equal(withProof.reg.ok, false); assert.equal((withProof.reg as any).reason, "outside_warranty_window");
  const without = run(undefined); assert.equal(without.c.proofAt, T + 20 * DAY); assert.equal(without.reg.ok, true, "legacy: clock starts at resolution when no proofAt is known");
  assert.throws(() => openDispute({ jobId: "j", amountCents: 1, at: 1, actor: "o", eventId: "e", reason: "r", proofAt: NaN }), /proof_at_invalid/);
});

test("W4b synthetic: a regression 31 days after proof is a new fault: no clawback, no card, no case", async () => {
  const r = rig(); const o = await r.owner("o@w4b.example.com", "w4b.example.com.au"); const p = await r.pro("p@w4b.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); r.fix("w4b.example.com.au"); await r.deliver(p.session, id);
  const j0 = (await r.store.getJob(id))!; j0.regressedAt = j0.proof!.at + 31 * DAY; await r.store.putJob(j0);
  r.h.clock.t = j0.regressedAt; await r.internal("POST", "/internal/market/sweep");
  const j = (await r.store.getJob(id))!; assert.equal(j.clawbacks?.length ?? 0, 0); assert.equal(j.disputeCase, undefined);
  assert.equal((await r.store.openCards()).filter((c) => c.kind === "clawback_review").length, 0);
});
