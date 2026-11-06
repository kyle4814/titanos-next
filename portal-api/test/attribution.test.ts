// F-C4 backfill: attribution is proven, not assumed. SYNTHETIC data only (example.com domains, mock payments, in-memory stores).
// Scenarios PAY-owner-self-fix and RANK-wash-trade come from acceptance/wA/p1.ts; here they are regression tests with mutation notes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rig, INTERNAL } from "./market_harness.ts";
import { MemoryOwnerStore, newState } from "../src/owner/engine.ts";
import { rankFor } from "../src/market/rank.ts";
import { PAYOUT_REVIEW_CENTS } from "../src/market/service.ts";
import { judgeAttribution, washTradeFlags, clawbackFor, mayRaisePayoutCard, emailDomain, type WashJob } from "../src/market/attribution.ts";

const DAY = 86_400_000;

// ---------- (a) pure ----------
test("judgeAttribution: pay only when the pass follows delivery; owner fix or earlier PASS withholds; a returned fault resets the clock", () => {
  const base = { check: "SPF", deliveredAt: 1000 };
  assert.deepEqual(judgeAttribution({ ...base, observations: [{ at: 1, status: "FAIL", src: "baseline" }, { at: 2, status: "FAIL", src: "claim" }] }), { pay: true, reason: "pass_follows_delivery" });
  assert.equal(judgeAttribution({ check: "SPF" }).reason, "no_delivery_recorded");
  const w = judgeAttribution({ ...base, observations: [{ at: 1, status: "FAIL", src: "baseline" }, { at: 500, status: "PASS", src: "watch" }] });
  assert.equal(w.pay, false); assert.equal(w.reason, "fix_observed_before_delivery"); assert.equal(w.evidenceAt, 500);
  // the owner's own auto-fix / own scan, from the owner event log, for THIS check only
  assert.equal(judgeAttribution({ ...base, observations: [{ at: 1, status: "FAIL", src: "baseline" }] }, [{ at: 400, kind: "fix_applied", check: "SPF" }]).pay, false);
  assert.equal(judgeAttribution({ ...base, observations: [{ at: 1, status: "FAIL", src: "baseline" }] }, [{ at: 400, kind: "proven_fixed", check: "SPF" }]).evidenceSrc, "owner:proven_fixed");
  assert.equal(judgeAttribution({ ...base, observations: [{ at: 1, status: "FAIL", src: "baseline" }] }, [{ at: 400, kind: "fix_applied", check: "DMARC" }]).pay, true, "another check's fix is not this fix");
  assert.equal(judgeAttribution({ ...base, observations: [{ at: 1, status: "FAIL", src: "baseline" }] }, [{ at: 1500, kind: "fix_applied", check: "SPF" }]).pay, true, "an owner event AFTER delivery is not pre-delivery evidence");
  // fixed, then the fault came back, then the pro fixed it: the pro's pass
  assert.equal(judgeAttribution({ ...base, observations: [{ at: 1, status: "FAIL", src: "baseline" }, { at: 300, status: "PASS", src: "watch" }, { at: 600, status: "FAIL", src: "watch" }] }).pay, true);
  // the proof attempt itself (rescan) is never pre-delivery evidence, even at the same millisecond
  assert.equal(judgeAttribution({ ...base, observations: [{ at: 1, status: "FAIL", src: "baseline" }, { at: 1000, status: "PASS", src: "rescan" }] }).pay, true);
});

// ---------- (a) PAY-owner-self-fix, end to end ----------
test("PAY-owner-self-fix: the owner fixes their own DNS after the claim and the pro delivers nothing: observed, so no pay and no rank", async () => {
  const r = rig(); const o = await r.owner("own@fixme.example.com", "self.example.com.au"); const p = await r.pro("pro@other.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  r.h.clock.t += 3600_000; r.fix("self.example.com.au");                  // the owner's own change
  r.h.clock.t += 3600_000; const sw = await r.h.j(await r.internal("POST", "/internal/market/sweep")); assert.equal(sw.sweep.watched, 1, "the sweep watches claimed jobs");
  r.h.clock.t += 3600_000; const d = await r.h.j(await r.deliver(p.session, id, "I did nothing"));
  assert.equal(d.reproved, false, "the pass pre-dates the delivery");
  assert.equal(r.payments.count("transfer"), 0);
  const j = (await r.store.getJob(id))!; assert.equal(j.status, "delivered"); assert.equal(j.attribution?.reason, "fix_observed_before_delivery");
  assert.equal(rankFor(p.account.id, [j]).provenFixes, 0);
  // sticky: re-scanning again later cannot launder it into a payout
  for (let i = 0; i < 3; i++) { r.h.clock.t += 120_000; await r.h.req("POST", `/market/jobs/${id}/rescan`, { token: o.session }); await r.internal("POST", "/internal/market/sweep"); }
  assert.equal(r.payments.count("transfer"), 0); assert.equal((await r.store.getJob(id))!.status, "delivered");
});
test("PAY-owner-self-fix via the owner's OWN scan: an owner proven_fixed event before delivery withholds pay", async () => {
  const r = rig(); r.h.deps.owner = { store: new MemoryOwnerStore(), doh: () => { throw new Error("unused"); }, zones: { zoneFor: () => undefined } };
  const o = await r.owner("own@scan.example.com", "ownscan.example.com.au"); const p = await r.pro("pro@other.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  r.h.clock.t += 1000; r.fix("ownscan.example.com.au");
  const st = newState(o.domainId, "ownscan.example.com.au", o.account.id, true); st.events.push({ at: r.h.clock.t, kind: "proven_fixed", check: "SPF", detail: "owner scan shows PASS" });
  await r.h.deps.owner.store.put(st);
  r.h.clock.t += 1000; const d = await r.h.j(await r.deliver(p.session, id, "delivered after the owner fixed it"));
  assert.equal(d.reproved, false); assert.equal(r.payments.count("transfer"), 0); assert.equal((await r.store.getJob(id))!.attribution?.evidenceSrc, "owner:proven_fixed");
});
test("the honest pro is still paid: fault observed at hire and claim, a sweep sees it still failing, the fix lands, delivery follows", async () => {
  const r = rig(); const o = await r.owner("own@ok.example.com", "ok.example.com.au"); const p = await r.pro("pro@other.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  r.h.clock.t += 3600_000; await r.internal("POST", "/internal/market/sweep");   // still FAIL
  r.fix("ok.example.com.au"); r.h.clock.t += 60_000;
  const d = await r.h.j(await r.deliver(p.session, id)); assert.equal(d.reproved, true); assert.equal(r.payments.count("transfer"), 1);
});

// ---------- (b) wash trade ----------
const wj = (id: string, o: Partial<WashJob>): WashJob => ({ id, status: "paid", ownerAccountId: "o_" + id, proAccountId: "pro1", ...o });
test("washTradeFlags: org email-domain pair, shared card, one card over many owner accounts; free-mail and single jobs do not flag", () => {
  const dom = washTradeFlags([wj("a", { ownerEmailDomain: "acme.example.com", proEmailDomain: "acme.example.com" }), wj("b", { ownerEmailDomain: "acme.example.com", proEmailDomain: "acme.example.com" })]);
  assert.deepEqual([...dom.keys()].sort(), ["a", "b"]); assert.equal(dom.get("a"), "domain_pair");
  assert.equal(washTradeFlags([wj("a", { ownerEmailDomain: "acme.example.com", proEmailDomain: "acme.example.com" })]).size, 0, "one job is not a repeat");
  assert.equal(washTradeFlags([wj("a", { ownerEmailDomain: "gmail.com", proEmailDomain: "gmail.com" }), wj("b", { ownerEmailDomain: "gmail.com", proEmailDomain: "gmail.com" })]).size, 0, "two gmail users are strangers");
  const fp = washTradeFlags([wj("a", { payerFp: "fp1", proPayerFp: "fp1" }), wj("b", { payerFp: "fp1", proPayerFp: "fp1" })]); assert.equal(fp.get("a"), "shared_card");
  const multi = washTradeFlags([wj("a", { payerFp: "fp9" }), wj("b", { payerFp: "fp9" })]); assert.equal(multi.get("b"), "one_card_many_owners");
  assert.equal(washTradeFlags([wj("a", { payerFp: "fp9", ownerAccountId: "same" }), wj("b", { payerFp: "fp9", ownerAccountId: "same" })]).size, 0, "one owner paying one pro twice with their own card is ordinary repeat business");
  assert.equal(washTradeFlags([wj("a", { ownerEmailDomain: "acme.example.com", proEmailDomain: "acme.example.com", status: "open" }), wj("b", { ownerEmailDomain: "acme.example.com", proEmailDomain: "acme.example.com", status: "refunded" })]).size, 0, "unclaimed or refunded jobs do not count");
  assert.equal(emailDomain(" Kim@Acme.Example.com "), "acme.example.com");
});
test("RANK-wash-trade: a sockpuppet pair repeating jobs is still PAID but earns no rank and no leaderboard row; an honest pro beside them keeps theirs", async () => {
  const r = rig(); const sock = await r.pro("sock@m.example.com"); const honest = await r.pro("honest@real.example.org");
  for (let i = 0; i < 2; i++) { const o = await r.owner(`own${i}@m.example.com`, `wash${i}.example.com.au`); const id = (await r.hire(o)).job.id; await r.claim(sock.session, id); r.fix(`wash${i}.example.com.au`); const d = await r.h.j(await r.deliver(sock.session, id)); assert.equal(d.reproved, true, "wash trade is not blocked from paying"); }
  assert.equal(r.payments.count("transfer"), 2);
  const oh = await r.owner("honest-owner@unrelated.example.com", "honestjob.example.com.au"); const hid = (await r.hire(oh)).job.id; await r.claim(honest.session, hid); r.fix("honestjob.example.com.au"); await r.deliver(honest.session, hid);
  const rk = await r.h.j(await r.h.req("GET", "/pro/rank", { token: sock.session })); assert.equal(rk.provenFixes, 0); assert.equal(rk.points, 0); assert.equal(rk.washExcluded, 2);
  const hr = await r.h.j(await r.h.req("GET", "/pro/rank", { token: honest.session })); assert.equal(hr.provenFixes, 1); assert.equal(hr.washExcluded, 0);
  const lb = await r.h.j(await r.h.req("GET", "/market/leaderboard")); assert.equal(lb.rows.length, 1);
});

// ---------- (c) clawback ledger ----------
test("clawbackFor: only a paid, regressed, in-window job gets one ledger entry; no money fields move", () => {
  const paid = { id: "j1", status: "paid" as const, proAccountId: "p", check: "SPF", payout: { status: "paid" as const, amountCents: 9900, transferId: "tr_1" }, proof: { scanId: "s", at: 0, baseline: "FAIL", now: "PASS", detail: "" }, regressedAt: 5 * DAY };
  const cb = clawbackFor(paid, 6 * DAY)!; assert.equal(cb.amountCents, 9900); assert.equal(cb.moneyMoved, false); assert.equal(cb.status, "recorded"); assert.equal(cb.transferId, "tr_1");
  assert.equal(clawbackFor({ ...paid, clawbacks: [cb] }, 7 * DAY), null, "idempotent");
  assert.equal(clawbackFor({ ...paid, status: "reproved" as never }, 1), null, "not paid, nothing to claw back");
  assert.equal(clawbackFor({ ...paid, regressedAt: undefined }, 1), null);
  assert.equal(clawbackFor({ ...paid, regressedAt: 31 * DAY }, 32 * DAY), null, "outside the warranty window");
});
test("warranty regression after pay records ONE clawback entry and ONE GATE1 card; no transfer moves; approval only marks it awaiting transfer", async () => {
  const r = rig(); const o = await r.owner("own@cb.example.com", "cb.example.com.au"); const p = await r.pro("pro@other.example.net");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); r.fix("cb.example.com.au"); await r.deliver(p.session, id);
  assert.equal(r.payments.count("transfer"), 1);
  r.unfix("cb.example.com.au"); r.h.clock.t += 5 * DAY;
  const w1 = await r.h.j(await r.internal("POST", "/internal/market/sweep")); assert.equal(w1.warranty.clawbacks, 1);
  await r.internal("POST", "/internal/market/sweep"); await r.internal("POST", "/internal/market/sweep");
  const j = (await r.store.getJob(id))!; assert.equal(j.clawbacks!.length, 1); assert.equal(j.clawbacks![0].moneyMoved, false); assert.equal(j.clawbacks![0].amountCents, j.priceCents);
  const cards = (await r.store.openCards()).filter((c) => c.kind === "clawback_review"); assert.equal(cards.length, 1);
  assert.equal(r.payments.count("transfer"), 1, "no money moved by the ledger");
  assert.equal((await r.internal("POST", `/internal/market/cards/${cards[0].id}/resolve`, { outcome: "approve" })).status, 200);
  assert.equal((await r.store.getJob(id))!.clawbacks![0].status, "approved_awaiting_transfer"); assert.equal(r.payments.count("transfer"), 1); assert.equal(r.payments.count("refund"), 0);
});
test("a regression on a job that was never paid (held for review) records no clawback", async () => {
  const r = rig(); const o = await r.owner("own@big2.example.com", "big2.example.com.au"); const p = await r.pro("pro@other.example.net");
  const id = (await r.hire(o)).job.id; const j0 = (await r.store.getJob(id))!; j0.priceCents = PAYOUT_REVIEW_CENTS; await r.store.putJob(j0);
  await r.claim(p.session, id); r.fix("big2.example.com.au"); await r.deliver(p.session, id); r.unfix("big2.example.com.au"); r.h.clock.t += DAY;
  const w = await r.h.j(await r.internal("POST", "/internal/market/sweep")); assert.equal(w.warranty.regressed, 1); assert.equal(w.warranty.clawbacks, 0);
});

// ---------- (d) a denied card stays denied ----------
test("mayRaisePayoutCard: denied on this proof blocks; a different proof reopens", () => {
  const proof = { scanId: "s1", at: 5, baseline: "FAIL", now: "PASS", detail: "" };
  assert.equal(mayRaisePayoutCard({ proof }), true);
  assert.equal(mayRaisePayoutCard({ proof, payoutDenied: { at: 6, cardId: "c", proofKey: "s1@5" } }), false);
  assert.equal(mayRaisePayoutCard({ proof: { ...proof, scanId: "s2", at: 9 }, payoutDenied: { at: 6, cardId: "c", proofKey: "s1@5" } }), true);
});
test("deny on a payout card does not re-raise a card on any later sweep; a NEW re-scan is new evidence and may", async () => {
  const r = rig(); const o = await r.owner("own@deny.example.com", "deny.example.com.au"); const p = await r.pro("pro@other.example.net");
  const id = (await r.hire(o)).job.id; const j0 = (await r.store.getJob(id))!; j0.priceCents = PAYOUT_REVIEW_CENTS; await r.store.putJob(j0);
  await r.claim(p.session, id); r.fix("deny.example.com.au"); await r.deliver(p.session, id);
  const card = (await r.store.openCards())[0]; assert.equal(card.kind, "payout_review");
  assert.equal((await r.internal("POST", `/internal/market/cards/${card.id}/resolve`, { outcome: "deny" })).status, 200);
  for (let i = 0; i < 4; i++) { r.h.clock.t += DAY; await r.internal("POST", "/internal/market/sweep"); }
  assert.equal((await r.store.openCards()).length, 0, "no new card on the next sweeps");
  assert.equal((await r.store.getJob(id))!.status, "reproved"); assert.equal(r.payments.count("transfer"), 0);
  r.h.clock.t += 120_000; await r.h.req("POST", `/market/jobs/${id}/rescan`, { token: o.session });   // fresh scan = new proof = new evidence
  const again = await r.store.openCards(); assert.equal(again.length, 1); assert.notEqual(again[0].id, card.id);
});
