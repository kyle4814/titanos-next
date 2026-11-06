// x3 C: payout without payment, funding forgery, money orphaned by state races, chargebacks, seat billing bypass, cancel term.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fullRig } from "./lib.ts";
import { blocked, finding } from "./lib.ts";
import { makeEnt } from "../../test/ent_harness.ts";
import { signStripePayload } from "../../src/stripe.ts";
import { SECRET } from "../../test/harness.ts";
import { handle } from "../../src/index.ts";
import { HOLD_DAYS } from "../../src/enterprise/share.ts";
import { releasePayout, confirmFunded } from "../../src/market/service.ts";

const DAY = 86_400_000;
const body = async (r: Response) => (await r.json()) as any;

test("C-01 BLOCKED: no payout without our re-scan PASS (delivery note, rescans, sweep, card resolve, repeated calls)", async () => {
  const r = fullRig(); const { h } = r;
  const o = await r.owner("own@x3.test", "c01.com.au"); const p = await r.pro("pro@x3.test");
  const job = (await r.hire(o)).job; assert.equal((await r.store.getJob(job.id))!.status, "open");
  assert.equal((await r.claim(p.session, job.id)).status, 200);
  assert.equal((await r.deliver(p.session, job.id)).status, 200);            // pro says done; the fault is still there
  for (let i = 0; i < 4; i++) { h.clock.t += 61_000; await h.req("POST", `/market/jobs/${job.id}/rescan`, { token: p.session }); await h.req("POST", `/market/jobs/${job.id}/rescan`, { token: o.session }); }
  await r.internal("POST", "/internal/market/sweep");
  const j = (await r.store.getJob(job.id))!;
  assert.equal(j.status, "delivered"); assert.equal(r.payments.count("transfer"), 0);
  // the money function itself refuses an unproved job (reachability aside, the guard is the last line)
  await assert.rejects(() => releasePayout(r.h.deps, job.id), (e: any) => e.code === "payout_requires_reproof");
  await assert.rejects(() => releasePayout(r.h.deps, job.id, "mc_any_card"), (e: any) => e.code === "payout_requires_reproof");
  assert.equal(r.payments.count("transfer"), 0);
  // an operator card id guessed or reused cannot pay an unproved job
  assert.equal((await r.internal("POST", "/internal/market/cards/mc_guess/resolve", { outcome: "approve" })).status, 404);
  blocked("C-01", "payout requires proof");
});

test("C-02 BLOCKED: a job never opens without real money (forged, wrong amount, unpaid, foreign checkout, replayed)", async () => {
  const r = fullRig(); const { h } = r;
  const o = await r.owner("own2@x3.test", "c02.com.au"); const p = await r.pro("pro2@x3.test");
  const a = (await r.hire(o, "SPF", false)).job;
  assert.equal((await r.claim(p.session, a.id)).status, 409, "awaiting_funds job is not claimable");
  // forged: signed with the wrong secret / unsigned / stale
  const job = (await r.store.getJob(a.id))!;
  const payload = JSON.stringify({ id: "evt_forged", type: "checkout.session.completed", data: { object: { id: job.checkoutId, payment_status: "paid", payment_intent: "pi_x", amount_total: job.priceCents, metadata: { market_job_id: a.id } } } });
  const send = async (sig: string | null) => handle(new Request("https://api.test/stripe/webhook", { method: "POST", headers: sig ? { "stripe-signature": sig } : {}, body: payload }), {}, h.deps);
  assert.equal((await send(null)).status, 400);
  assert.equal((await send(await signStripePayload(payload, "whsec_attacker", Math.floor(h.clock.t / 1000)))).status, 400);
  assert.equal((await send(await signStripePayload(payload, SECRET, Math.floor(h.clock.t / 1000) - 1000))).status, 400, "stale");
  // genuine signature but the wrong money
  for (const o2 of [{ amount: 100 }, { amount: job.priceCents + 1 }]) { await r.fundJob(a.id, { amount: o2.amount }); assert.equal((await r.store.getJob(a.id))!.status, "awaiting_funds", "wrong amount"); }
  await h.webhook("checkout.session.completed", { id: job.checkoutId, payment_status: "unpaid", amount_total: job.priceCents, metadata: { market_job_id: a.id } });
  assert.equal((await r.store.getJob(a.id))!.status, "awaiting_funds", "unpaid");
  await h.webhook("checkout.session.completed", { id: "cs_other_session", payment_status: "paid", amount_total: job.priceCents, metadata: { market_job_id: a.id } });
  assert.equal((await r.store.getJob(a.id))!.status, "awaiting_funds", "foreign checkout id");
  assert.equal((await r.claim(p.session, a.id)).status, 409);
  blocked("C-02", "funding forgery");
});

test("C-02b BLOCKED (was F20 P1, fixed x4): confirmFunded fails closed on its own: unpaid, async-pending, absent or odd payment_status never opens a job, at function level and route level", async () => {
  const r = fullRig(); const { h } = r;
  const o = await r.owner("own2b@x3.test", "c02b.com.au");
  const a = (await r.hire(o, "SPF", false)).job; const job = (await r.store.getJob(a.id))!;
  for (const st of [undefined, "", "unpaid", "no_payment_required", "PAID", "paid "]) {
    assert.equal(await confirmFunded(h.deps, { jobId: a.id, checkoutId: job.checkoutId!, amountTotal: job.priceCents, paymentStatus: st as any }), "ignored", String(st));
  }
  assert.equal(await confirmFunded(h.deps, { jobId: a.id, checkoutId: job.checkoutId!, amountTotal: job.priceCents } as any), "ignored", "caller omits paymentStatus");
  for (const st of ["unpaid", "no_payment_required"]) {
    await h.webhook("checkout.session.completed", { id: job.checkoutId, payment_status: st, amount_total: job.priceCents, metadata: { market_job_id: a.id } }, { id: `evt_${st}` });
    assert.equal((await r.store.getJob(a.id))!.status, "awaiting_funds", st);
  }
  assert.equal((await r.fundJob(a.id)).status, 200); assert.equal((await r.store.getJob(a.id))!.status, "open", "genuinely paid still opens");
  blocked("C-02b", "unpaid checkout opens a paid job");
});

test("C-03 BLOCKED: owner cannot claim own job; a pro cannot pay itself via dispute resolution (internal secret only)", async () => {
  const r = fullRig(); const { h } = r;
  const o = await r.owner("own3@x3.test", "c03.com.au"); await r.pro("x@x3.test");
  const job = (await r.hire(o)).job;
  await h.req("POST", "/pro/join", { token: o.session, body: { acceptTerms: true } });
  assert.equal((await r.claim(o.session, job.id)).status, 403);
  for (const secret of ["", "x", "internal_test_secre", "INTERNAL_TEST_SECRET"]) assert.equal((await r.internal("GET", "/internal/market/cards", undefined, secret)).status, 401, JSON.stringify(secret));
  blocked("C-03", "self-claim and internal door");
});

test("C-04 FINDING F3 [P2]: captured payments with no live record are ignored AND the event id is burned; no refund, no review card", async () => {
  const r = fullRig(); const { h } = r;
  const o = await r.owner("own4@x3.test", "c04.com.au");
  // (a) owner cancels while awaiting_funds, then pays the session they already opened (or the 24h funding window lapses first)
  const j = (await r.hire(o, "SPF", false)).job;
  assert.equal((await h.req("POST", `/market/jobs/${j.id}/cancel`, { token: o.session })).status, 200);
  const res = await body(await r.fundJob(j.id, { evId: "evt_late_fund" }));
  assert.equal(res.result, "ignored");
  assert.equal(r.payments.count("refund"), 0, "money was captured by Stripe, nothing is refunded");
  assert.equal((await body(await r.fundJob(j.id, { evId: "evt_late_fund" }))).result, "duplicate", "event id burned: a Stripe retry cannot recover it");
  await r.internal("POST", "/internal/market/sweep");
  assert.equal(r.payments.count("refund"), 0, "sweep only refunds jobs with fundedAt, so this one never will be");
  assert.equal((await r.store.openCards()).length, 0, "no operator card raised");
  // (b) same class on C2: a paid session whose purchase row does not exist (row write failed after the Stripe session was made)
  const unk = await body(await h.webhook("checkout.session.completed", { id: "cs_paid_no_row", payment_status: "paid", payment_intent: "pi_orphan", amount_total: 14900 }, { id: "evt_orphan" }));
  assert.equal(unk.result, "ignored");
  assert.equal((await body(await h.webhook("checkout.session.completed", { id: "cs_paid_no_row", payment_status: "paid", payment_intent: "pi_orphan", amount_total: 14900 }, { id: "evt_orphan" }))).result, "duplicate");
  assert.equal((await h.store.openCards()).length, 0);
  finding("F3", "P2", "money captured with no job/purchase record is silently ignored, event id consumed, no refund path, no operator card", "market: cancel-then-pay and C2 paid-session-without-row both ignored then duplicate; refund calls 0; open cards 0");
});

test("C-05 FINDING F4 [P2]: no dispute/chargeback/refund-event handling; transfers and partner commissions proceed on money Stripe may take back", async () => {
  const r = fullRig(); const { h } = r;
  const o = await r.owner("own5@x3.test", "c05.com.au"); const p = await r.pro("pro5@x3.test");
  const job = (await r.hire(o)).job; await r.claim(p.session, job.id); r.fix("c05.com.au");
  await r.deliver(p.session, job.id);
  const paid = (await r.store.getJob(job.id))!; assert.equal(paid.status, "paid"); assert.equal(r.payments.count("transfer"), 1);
  for (const type of ["charge.dispute.created", "charge.refunded", "charge.dispute.funds_withdrawn", "payment_intent.payment_failed"]) {
    const res = await body(await h.webhook(type, { id: "dp_1", payment_intent: paid.paymentIntent, amount: paid.priceCents, status: "needs_response" }));
    assert.equal(res.result, "ignored", type);
  }
  assert.equal((await r.store.getJob(job.id))!.status, "paid", "nothing frozen, nothing clawed back");
  assert.equal(r.payments.count("refund"), 0);
  // partner side: a commission on a payment later charged back is still paid out after the hold
  const e = makeEnt();
  const pt = await e.provision("partner", "boss@x3.test", "X3 MSP", "x3-msp", { termsAccepted: true, payoutAccount: "acct_x3" });
  const ref = await e.login("referred@x3.test");
  await e.req("POST", "/referrals/claim", { token: ref.session, body: { code: pt.tenant.refCode } });
  await e.req("POST", "/checkout", { token: ref.session, body: { product: "leads_growth" } });
  const { purchase } = await e.pay("leads_growth");
  await e.webhook("charge.dispute.created", { id: "dp_2", payment_intent: `pi_${purchase.id}`, amount: 149700 });
  e.clock.t += (HOLD_DAYS + 1) * DAY; const s2 = (await e.login("boss@x3.test")).session;
  const pay = await e.j(await e.req("POST", `/partners/${pt.tenant.id}/payouts`, { token: s2 }));
  assert.equal(pay.status, "paid"); assert.ok(e.payouts.sent.length === 1 && e.payouts.sent[0].amountCents > 0);
  finding("F4", "P2", "charge.dispute.* / charge.refunded not handled anywhere", `job payout ${paid.priceCents}c transferred and partner commission ${e.payouts.sent[0].amountCents}c paid after a dispute event for the same payment; both events returned result=ignored`);
});

test("C-06 FINDING F2 [P2]: POST /pro/join {plan:\"seat\"} grants the half-price claim fee without any seat purchase", async () => {
  const r = fullRig();
  const o = await r.owner("own6@x3.test", "c06.com.au"); const o2 = await r.owner("own6b@x3.test", "c06b.com.au");
  const payg = await r.pro("payg@x3.test"); const seat = await r.pro("seat@x3.test", { plan: "seat" });
  const j1 = (await r.hire(o)).job, j2 = (await r.hire(o2)).job;
  const full1 = (await r.store.getJob(j1.id))!, full2 = (await r.store.getJob(j2.id))!;
  await r.claim(seat.session, j1.id); await r.claim(payg.session, j2.id);
  const fees = r.payments.calls.filter((c) => c.op === "claim_fee").map((c) => (c.args as any).cents);
  assert.equal(fees[0], Math.round(full1.claimFeeCents * 0.5)); assert.equal(fees[1], full2.claimFeeCents);
  assert.ok(fees[0] < full1.claimFeeCents);
  assert.equal([...r.h.store.purchases.values()].length, 0, "no purchase of any kind exists");
  finding("F2", "P2", "pro seat discount is client-selectable; the AU$149/month seat is not wired to billing (service.ts comment says so)", `claim fee ${fees[0]}c (seat, unpaid) vs list ${full1.claimFeeCents}c, purchases 0`);
});

test("C-07 FINDING F7 [P2]: cancelling a minimum-term retainer tells Stripe cancel_at_period_end, so Stripe stops billing after month 1 while the portal reports month 3", async () => {
  const r = fullRig(); const { h } = r;
  const a = await h.login("term@x3.test");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "ai_ops" } });
  await h.pay("ai_ops");
  h.clock.t += 2 * DAY;
  const c = await body(await h.req("POST", `/subscriptions/${[...h.store.subs.keys()][0]}/cancel`, { token: a.session }));
  assert.equal(c.status, "cancel_scheduled");
  assert.ok(c.effectiveAt - h.clock.t > 80 * DAY, "portal promises month 3 (the 3-month minimum)");
  const call = h.billing.calls.find((x) => x.op === "cancel")!;
  assert.deepEqual(call.args, { subId: [...h.store.subs.keys()][0], atPeriodEnd: true }, "provider contract carries no end date: Stripe cancel_at_period_end ends at the CURRENT period");
  finding("F7", "P2", "min-term end date is local only; billing.cancelSubscription(subId, true) cannot express it", `AU$2,500/month tier: portal effectiveAt +${Math.round((c.effectiveAt - h.clock.t) / DAY)}d, provider told atPeriodEnd=true (period 1 end)`);
});

test("C-08 FINDING F8 [P3]: wash trade: owner and a sock-puppet pro (two accounts, one human) earn rank and 'proven fixes' with the owner's own money", async () => {
  const r = fullRig();
  const o = await r.owner("wash-owner@x3.test", "c08.com.au"); const p = await r.pro("wash-pro@x3.test");
  const job = (await r.hire(o)).job; assert.equal((await r.claim(p.session, job.id)).status, 200);
  r.fix("c08.com.au"); await r.deliver(p.session, job.id);
  const lb = await body(await r.h.req("GET", "/market/leaderboard"));
  assert.ok(lb.rows.length === 1 && lb.rows[0].provenFixes === 1);
  finding("F8", "P3", "no link analysis between owner and pro accounts (same human, email, payment fingerprint)", "leaderboard row provenFixes=1 for a job the owner fixed themselves");
});

test("C-09 FINDING F9 [P3]: the board masks only the first label, so a subdomain job leaks the apex domain to every pro before any claim", async () => {
  const r = fullRig();
  const o = await r.owner("mask@x3.test", "billing.victimcorp.com.au"); const p = await r.pro("peek@x3.test");
  await r.hire(o);
  const board = await body(await r.h.req("GET", "/pro/board", { token: p.session }));
  assert.equal(board.jobs.length, 1);
  assert.match(board.jobs[0].domainMasked, /victimcorp\.com\.au$/);
  finding("F9", "P3", "maskDomain keeps everything after the first dot", `board shows ${board.jobs[0].domainMasked} for billing.victimcorp.com.au`);
});

test("C-10 FINDING F10 [P3]: a pro can trigger unlimited scans on any open job by repeating a failing claim", async () => {
  const r = fullRig();
  const o = await r.owner("amp@x3.test", "c10.com.au"); const p = await r.pro("amp-pro@x3.test");
  const job = (await r.hire(o)).job;
  let scans = 0; const inner = r.h.deps.market!.doh; r.h.deps.market!.doh = (d: string) => { const f = inner(d); return (n: string, t: string) => { scans++; return f(n, t); }; };
  r.payments.failClaimFee = true;
  let status = 0; for (let i = 0; i < 25; i++) status = (await r.claim(p.session, job.id)).status;
  assert.equal(status, 402); assert.ok(scans > 150, `DoH lookups for one victim domain: ${scans}`);
  finding("F10", "P3", "no per-pro/per-job throttle on claim, each attempt runs a full scan (about 10 DoH lookups)", `25 failing claims = ${scans} DoH lookups, never 429`);
});
