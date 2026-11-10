import { test } from "node:test";
import assert from "node:assert/strict";
import { rig, INTERNAL } from "./market_harness.ts";
import { rankFor } from "../src/market/rank.ts";
import { releasePayout, PAYOUT_REVIEW_CENTS, TIERS, CLAIM_WINDOW_MS } from "../src/market/service.ts";
import { StripeConnectPayments } from "../src/market/payments.ts";
import { FLOWS } from "../src/flows.ts";

test("happy path: hire, fund, claim, deliver, re-scan proof, payout once, rank from the proof", async () => {
  const r = rig(); const o = await r.owner("o@acme.com.au", "acme.com.au"); const p = await r.pro("pro@agency.com");
  const hired = await r.hire(o); assert.equal(hired.job.status, "awaiting_funds"); assert.match(hired.payUrl, /checkout\.mock/);
  const id = hired.job.id; assert.equal((await r.store.getJob(id))!.status, "open");
  const board = await r.h.j(await r.h.req("GET", "/pro/board", { token: p.session }));
  assert.equal(board.jobs.length, 1); assert.equal(board.jobs[0].domainMasked, "a***.com.au"); assert.equal(JSON.stringify(board).includes("acme.com.au"), false, "full domain hidden before claim");
  const c = await r.h.j(await r.claim(p.session, id)); assert.equal(c.status, "claimed"); assert.equal(c.domain, "acme.com.au");
  assert.equal(r.payments.count("claim_fee"), 1);
  r.fix("acme.com.au");
  const dres = await r.h.j(await r.deliver(p.session, id));
  assert.equal(dres.reproved, true); assert.equal(dres.job.status, "paid"); assert.equal(dres.job.proof.baseline, "WARN"); assert.equal(dres.job.proof.now, "PASS");
  assert.equal(r.payments.count("transfer"), 1);
  assert.equal(r.payments.calls.find((x) => x.op === "transfer")!.args.cents, TIERS[dres.job.tier as "small"].priceCents);
  const rank = await r.h.j(await r.h.req("GET", "/pro/rank", { token: p.session })); assert.equal(rank.provenFixes, 1); assert.equal(rank.points, 1); assert.equal(rank.tier, "Bronze");
  const pay = await r.h.j(await r.h.req("GET", "/pro/payouts", { token: p.session })); assert.equal(pay.paidCents, dres.job.payCents); assert.equal(pay.paid.length, 1);
});

test("get_paid kill test: a delivery the re-scan does not confirm never pays, and no direct payout call can bypass the proof", async () => {
  const r = rig(); const o = await r.owner("o@a.com.au", "a.com.au"); const p = await r.pro("p@x.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  const d1 = await r.h.j(await r.deliver(p.session, id, "all done, trust me"));
  assert.equal(d1.reproved, false); assert.equal(d1.job.status, "delivered"); assert.equal(d1.job.lastRescan.status, "WARN");
  assert.equal(r.payments.count("transfer"), 0);
  await assert.rejects(releasePayout(r.h.deps, id), (e: any) => e.code === "payout_requires_reproof" && e.status === 409);
  assert.equal(r.payments.count("transfer"), 0);
  r.h.clock.t += 61_000; r.fix("a.com.au");
  const d2 = await r.h.j(await r.h.req("POST", `/market/jobs/${id}/rescan`, { token: o.session }));   // the OWNER can ask for the re-scan; it is still our scan
  assert.equal(d2.reproved, true); assert.equal(r.payments.count("transfer"), 1);
  assert.equal((await r.h.req("POST", `/market/jobs/${id}/rescan`, { token: p.session })).status, 409, "already settled");
});

test("a fix that is UNKNOWN on re-scan (DNS failure) is not a proof", async () => {
  const r = rig(); const o = await r.owner("o@u.com.au", "u.com.au"); const p = await r.pro("p@u.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  r.zones.get("u.com.au")!.world.servfail = true;
  const d = await r.h.j(await r.deliver(p.session, id)); assert.equal(d.reproved, false); assert.equal(r.payments.count("transfer"), 0);
});

test("claim race: two pros claim at once, exactly one wins and only one claim fee is taken", async () => {
  const r = rig(); const o = await r.owner("o@race.com.au", "race.com.au"); const p1 = await r.pro("p1@x.com"), p2 = await r.pro("p2@x.com");
  const id = (await r.hire(o)).job.id;
  const [a, b] = await Promise.all([r.claim(p1.session, id), r.claim(p2.session, id)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(r.payments.count("claim_fee"), 1);
});

test("who may claim: not the owner, not an un-onboarded pro, not a non-pro, not an unfunded job", async () => {
  const r = rig(); const o = await r.owner("o@who.com.au", "who.com.au");
  const id = (await r.hire(o, "SPF", false)).job.id;
  const pFree = await r.pro("pf@x.com"); assert.equal((await r.claim(pFree.session, id)).status, 409, "awaiting_funds is not claimable");
  await r.fundJob(id);
  const noOnboard = await r.pro("pn@x.com", { onboard: false }); assert.equal((await r.h.j(await r.claim(noOnboard.session, id))).error, "payout_onboarding_required");
  const plain = await r.h.login("plain@x.com"); assert.equal((await r.h.j(await r.claim(plain.session, id))).error, "pro_seat_required");
  // the owner becomes a pro: still cannot claim their own job
  await r.h.req("POST", "/pro/join", { token: o.session, body: { acceptTerms: true } }); r.payments.autoReady = true;
  await r.h.req("POST", "/pro/onboarding", { token: o.session }); await r.h.req("POST", "/pro/onboarding/refresh", { token: o.session });
  assert.equal((await r.h.j(await r.claim(o.session, id))).error, "cannot_claim_own_job");
  // a second account that is not the owner is fine
  assert.equal((await r.claim(pFree.session, id)).status, 200);
});

test("hand-raise needs a VERIFIED domain you own; one live job per domain and check; PASS means nothing to fix", async () => {
  const r = rig(); const o = await r.owner("o@h.com.au", "h.com.au"); const other = await r.h.login("other@x.com");
  assert.equal((await r.h.req("POST", "/market/jobs", { token: other.session, body: { domainId: o.domainId, check: "SPF" } })).status, 404, "another account's domain");
  const unv = await r.h.j(await r.h.req("POST", "/domains", { token: other.session, body: { domain: "unverified.com.au" } }));
  r.zone("unverified.com.au"); assert.equal((await r.h.j(await r.h.req("POST", "/market/jobs", { token: other.session, body: { domainId: unv.id, check: "SPF" } }))).error, "domain_not_verified");
  assert.equal((await r.hire(o, "SPF", false)).job.status, "awaiting_funds");
  assert.equal((await r.h.j(await r.h.req("POST", "/market/jobs", { token: o.session, body: { domainId: o.domainId, check: "SPF" } }))).error, "job_already_open_for_this_check");
  r.fix("h.com.au"); const o2 = await r.owner("o2@h.com.au", "h2.com.au"); r.fix("h2.com.au");
  assert.equal((await r.h.j(await r.h.req("POST", "/market/jobs", { token: o2.session, body: { domainId: o2.domainId, check: "SPF" } }))).error, "nothing_to_fix");
  assert.equal((await r.h.j(await r.h.req("POST", "/market/jobs", { token: o2.session, body: { domainId: o2.domainId, check: "NOPE" } }))).error, "unknown_check");
});

test("owner fixed it themselves before anyone claimed: the claim attempt refunds the owner and nobody is paid", async () => {
  const r = rig(); const o = await r.owner("o@self.com.au", "self.com.au"); const p = await r.pro("p@x.com");
  const id = (await r.hire(o)).job.id; r.fix("self.com.au");
  assert.equal((await r.h.j(await r.claim(p.session, id))).error, "already_fixed");
  const j = (await r.store.getJob(id))!; assert.equal(j.status, "refunded"); assert.equal(r.payments.count("refund"), 1); assert.equal(r.payments.count("claim_fee"), 0); assert.equal(r.payments.count("transfer"), 0);
});

test("funding by webhook: signed, right amount, idempotent; wrong amount or a bad signature opens nothing", async () => {
  const r = rig(); const o = await r.owner("o@f.com.au", "f.com.au");
  const id = (await r.hire(o, "SPF", false)).job.id; const j = (await r.store.getJob(id))!;
  assert.equal((await r.h.j(await r.fundJob(id, { amount: 1 }))).result, "ignored"); assert.equal((await r.store.getJob(id))!.status, "awaiting_funds");
  const bad = await r.h.webhook("checkout.session.completed", { id: j.checkoutId, amount_total: j.priceCents, metadata: { market_job_id: id } }, { secret: "wrong" }); assert.equal(bad.status, 400);
  assert.equal((await r.h.j(await r.fundJob(id, { evId: "evt_same" }))).result, "funded");
  assert.equal((await r.h.j(await r.fundJob(id, { evId: "evt_same" }))).result, "duplicate");
  assert.equal((await r.store.getJob(id))!.status, "open");
  const fake = await r.h.webhook("checkout.session.completed", { id: "cs_other", amount_total: j.priceCents, metadata: { market_job_id: id } }); assert.equal((await r.h.j(fake)).result, "ignored");
});

test("dispute freezes the money and NO resolution can pay the pro; only a refund or a resume exists", async () => {
  const r = rig(); const o = await r.owner("o@d.com.au", "d.com.au"); const p = await r.pro("p@x.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); await r.deliver(p.session, id);
  const dsp = await r.h.j(await r.h.req("POST", `/market/jobs/${id}/dispute`, { token: o.session, body: { reason: "pro disappeared" } })); assert.equal(dsp.status, "disputed");
  assert.equal((await r.h.req("POST", `/market/jobs/${id}/rescan`, { token: o.session })).status, 409, "no re-scan while frozen");
  assert.equal((await r.h.j(await r.h.req("GET", "/pro/payouts", { token: p.session }))).frozenByDisputeCents, dsp.priceCents);
  const cards = await r.h.j(await r.internal("GET", "/internal/market/cards")); assert.equal(cards.cards.length, 1);
  assert.equal((await r.internal("POST", `/internal/market/cards/${cards.cards[0].id}/resolve`, { outcome: "pay_pro" })).status, 400);
  assert.equal((await r.internal("POST", `/internal/market/cards/${cards.cards[0].id}/resolve`, { outcome: "refund_owner" })).status, 200);
  assert.equal((await r.store.getJob(id))!.status, "refunded"); assert.equal(r.payments.count("refund"), 1); assert.equal(r.payments.count("transfer"), 0);
});

test("dispute then resume: the job returns to its prior state and can still only pay on proof", async () => {
  const r = rig(); const o = await r.owner("o@dr.com.au", "dr.com.au"); const p = await r.pro("p@x.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  await r.h.req("POST", `/pro/jobs/${id}/deliver`, { token: p.session, body: { note: "x" } }).then((x) => x.text());   // note too short? 'x' < 3: rejected
  assert.equal((await r.store.getJob(id))!.status, "claimed");
  await r.h.req("POST", `/market/jobs/${id}/dispute`, { token: p.session, body: { reason: "owner unresponsive" } });
  const card = (await r.store.openCards())[0]; await r.internal("POST", `/internal/market/cards/${card.id}/resolve`, { outcome: "resume" });
  assert.equal((await r.store.getJob(id))!.status, "claimed");
  r.fix("dr.com.au"); assert.equal((await r.h.j(await r.deliver(p.session, id))).reproved, true);
});

test("payouts at or over the review line wait for the internal tap; approval pays once; denial pays nothing", async () => {
  const r = rig(); const o = await r.owner("o@big.com.au", "big.com.au"); const p = await r.pro("p@x.com");
  const id = (await r.hire(o)).job.id; const j = (await r.store.getJob(id))!;
  j.priceCents = PAYOUT_REVIEW_CENTS; await r.store.putJob(j);   // force a large job
  await r.claim(p.session, id); r.fix("big.com.au");
  const d = await r.h.j(await r.deliver(p.session, id)); assert.equal(d.reproved, true); assert.equal(d.payout.status, "pending_review"); assert.equal(d.job.status, "reproved");
  assert.equal(r.payments.count("transfer"), 0);
  assert.equal((await r.internal("GET", "/internal/market/cards", undefined, "wrong")).status, 401); assert.equal((await r.h.req("GET", "/internal/market/cards")).status, 401);
  const card = (await r.store.openCards())[0]; assert.equal(card.kind, "payout_review");
  assert.equal((await r.internal("POST", `/internal/market/cards/${card.id}/resolve`, { outcome: "approve" })).status, 200);
  assert.equal(r.payments.count("transfer"), 1); assert.equal((await r.store.getJob(id))!.status, "paid");
  await assert.rejects(releasePayout(r.h.deps, id, card.id), (e: any) => e.code === "payout_requires_reproof", "no second payout");
  assert.equal(r.payments.count("transfer"), 1);
});

test("transfer failure leaves the job reproved (not paid); the sweep retries and pays exactly once", async () => {
  const r = rig(); const o = await r.owner("o@tf.com.au", "tf.com.au"); const p = await r.pro("p@x.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); r.fix("tf.com.au"); r.payments.failTransfer = true;
  const d = await r.h.j(await r.deliver(p.session, id)); assert.equal(d.reproved, true); assert.equal(d.payout.status, "failed"); assert.equal((await r.store.getJob(id))!.status, "reproved");
  r.payments.failTransfer = false; const sw = await r.h.j(await r.internal("POST", "/internal/market/sweep")); assert.equal(sw.sweep.retriedPayouts, 1);
  await r.internal("POST", "/internal/market/sweep"); assert.equal(r.payments.count("transfer"), 1);
});

test("claim fee failure reopens the job; seat pros pay half; claim expiry reopens and marks the pro abandoned", async () => {
  const r = rig(); const o = await r.owner("o@cf.com.au", "cf.com.au"); const seat = await r.pro("seat@x.com", { plan: "seat", sub: { status: "active", paidThroughMs: r.h.clock.t + 30 * 86_400_000 } }); const payg = await r.pro("payg@x.com");
  const id = (await r.hire(o)).job.id; r.payments.failClaimFee = true;
  assert.equal((await r.claim(seat.session, id)).status, 402); assert.equal((await r.store.getJob(id))!.status, "open"); r.payments.failClaimFee = false;
  const board = async (k: string) => r.h.j(await r.h.req("GET", "/pro/board", { token: k }));
  assert.equal((await board(seat.session)).jobs[0].claimFeeCents * 2, (await board(payg.session)).jobs[0].claimFeeCents);
  await r.claim(seat.session, id); r.h.clock.t += CLAIM_WINDOW_MS + 1;
  const sw = await r.h.j(await r.internal("POST", "/internal/market/sweep")); assert.equal(sw.sweep.reopened, 1);
  const j = (await r.store.getJob(id))!; assert.equal(j.status, "open"); assert.equal(rankFor(seat.account.id, [j]).abandoned, 1);
});

test("unfunded jobs cancel after 24 h; owners can cancel before a claim but not after", async () => {
  const r = rig(); const o = await r.owner("o@c.com.au", "c.com.au"); const p = await r.pro("p@x.com");
  const a = (await r.hire(o, "SPF", false)).job.id; r.h.clock.t += 25 * 3_600_000; await r.internal("POST", "/internal/market/sweep"); assert.equal((await r.store.getJob(a))!.status, "cancelled");
  const b = (await r.hire(o)).job.id; assert.equal((await r.h.req("POST", `/market/jobs/${b}/cancel`, { token: o.session })).status, 200); assert.equal(r.payments.count("refund"), 1);
  const c = (await r.hire(o)).job.id; await r.claim(p.session, c); assert.equal((await r.h.j(await r.h.req("POST", `/market/jobs/${c}/cancel`, { token: o.session }))).error, "cannot_cancel_after_claim");
});

test("rank comes from proven fixes only: no review field exists, unproven work scores 0, a returned fault removes the points", async () => {
  const r = rig(); const p = await r.pro("p@x.com"); const jobsToProve: string[] = [];
  for (let i = 0; i < 3; i++) { const o = await r.owner(`o${i}@r.com.au`, `r${i}.com.au`); const id = (await r.hire(o)).job.id; await r.claim(p.session, id); r.fix(`r${i}.com.au`); await r.deliver(p.session, id); jobsToProve.push(id); }
  const rankOf = async () => r.h.j(await r.h.req("GET", "/pro/rank", { token: p.session }));
  assert.equal((await rankOf()).points, 3);
  for (const route of ["review", "rating", "reviews"]) assert.equal((await r.h.req("POST", `/market/jobs/${jobsToProve[0]}/${route}`, { token: p.session, body: { stars: 5 } })).status, 404);
  const o4 = await r.owner("o4@r.com.au", "r4.com.au"); const id4 = (await r.hire(o4)).job.id; await r.claim(p.session, id4); await r.deliver(p.session, id4, "claimed but not fixed");
  assert.equal((await rankOf()).points, 3, "delivered but unproven adds nothing");
  r.unfix("r0.com.au"); r.h.clock.t += 5 * 86_400_000;
  const w = await r.h.j(await r.internal("POST", "/internal/market/sweep")); assert.equal(w.warranty.regressed, 1);
  const rk = await rankOf(); assert.equal(rk.points, 2); assert.equal(rk.regressed, 1); assert.equal(rk.holdRate, 66.7);
  const lb = await r.h.j(await r.h.req("GET", "/market/leaderboard")); assert.equal(lb.rows.length, 1); assert.equal(JSON.stringify(lb).includes("@"), false, "no email in the public board");
});

test("tier and fee pricing sits inside the plan range (EXAMPLE AU$29 to AU$149 claim fee)", () => {
  const fees = Object.values(TIERS).map((t) => t.claimFeeCents); assert.equal(Math.min(...fees), 2900); assert.equal(Math.max(...fees), 14900);
});

test("delete and export: an account with money held against it cannot be deleted; export lists its jobs", async () => {
  const r = rig(); const o = await r.owner("o@del.com.au", "del.com.au"); const p = await r.pro("p@x.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  assert.equal((await r.h.j(await r.h.req("DELETE", "/account", { token: o.session, body: { confirm: "DELETE" } }))).error, "market_jobs_active");
  assert.equal((await r.h.j(await r.h.req("DELETE", "/account", { token: p.session, body: { confirm: "DELETE" } }))).error, "market_jobs_active");
  const ex = await r.h.j(await r.h.req("GET", "/account/export", { token: o.session })); assert.equal(ex.marketJobsAsOwner.length, 1);
  r.fix("del.com.au"); await r.deliver(p.session, id);
  assert.equal((await r.h.req("DELETE", "/account", { token: o.session, body: { confirm: "DELETE" } })).status, 200);
});

test("tenant isolation: a stranger gets 404 on another account's job in every route", async () => {
  const r = rig(); const o = await r.owner("o@iso.com.au", "iso.com.au"); const p = await r.pro("p@x.com"); const evil = await r.pro("evil@x.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  for (const [m, path] of [["POST", `/market/jobs/${id}/cancel`], ["POST", `/market/jobs/${id}/dispute`], ["POST", `/market/jobs/${id}/rescan`], ["POST", `/pro/jobs/${id}/deliver`]] as const)
    assert.equal((await r.h.req(m, path, { token: evil.session, body: { reason: "hello there", note: "hello there" } })).status, 404, path);
  const mine = await r.h.j(await r.h.req("GET", "/market/jobs", { token: evil.session })); assert.equal(mine.asOwner.length + mine.asPro.length, 0);
});

test("Stripe Connect adapter: refuses a mode-mismatched key, sends destination + idempotency key, creates account then link", async () => {
  assert.throws(() => new StripeConnectPayments("sk_live_x", "test"), /mismatch/);
  const seen: { url: string; body: string; idem?: string }[] = [];
  const f = (async (url: string, init: RequestInit) => { seen.push({ url, body: String(init.body ?? ""), idem: (init.headers as any)["idempotency-key"] }); return new Response(JSON.stringify({ id: "x_1", url: "https://u", payouts_enabled: true, details_submitted: true }), { status: 200 }); }) as unknown as typeof fetch;
  const s = new StripeConnectPayments("sk_test_abc", "test", f);
  await s.transfer("acct_1", 9900, "job_1", "payout_job_1"); assert.match(seen[0].url, /\/transfers$/); assert.match(seen[0].body, /destination=acct_1/); assert.match(seen[0].body, /amount=9900/); assert.equal(seen[0].idem, "payout_job_1");
  const o = await s.onboardingLink("acc_1", "a@b.co", undefined, "https://r", "https://f"); assert.equal(o.connectAccountId, "x_1"); assert.match(seen[1].url, /\/accounts$/); assert.match(seen[2].url, /account_links$/);
  assert.equal(await s.accountReady("acct_1"), true);
  await assert.rejects(s.chargeClaimFee("a", "b", 1, "k"), /not_configured/);
});

test("kill test C4: the first 10 jobs, 100% paid only after re-proof (6 honest pros, 4 who claim done without fixing)", async () => {
  const r = rig(); const p = await r.pro("drill@x.com", { plan: "seat", sub: { status: "active", paidThroughMs: r.h.clock.t + 365 * 86_400_000 } }); const pros = [p];
  for (let i = 1; i < 4; i++) pros.push(await r.pro(`drill${i}@x.com`));
  const ids: { id: string; honest: boolean; dom: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const dom = `drill${i}.com.au`; const o = await r.owner(`owner${i}@drill.com.au`, dom); const id = (await r.hire(o)).job.id; const pr = pros[i % 4];
    assert.equal((await r.claim(pr.session, id)).status, 200); const honest = i % 5 !== 4 && i % 5 !== 2;
    if (honest) r.fix(dom); await r.deliver(pr.session, id, honest ? "fixed it" : "done!"); ids.push({ id, honest, dom });
  }
  const transfers = r.payments.calls.filter((c) => c.op === "transfer"); const honestN = ids.filter((x) => x.honest).length;
  assert.equal(honestN, 6); assert.equal(transfers.length, honestN, "one transfer per proven job, none for the cheats");
  for (const x of ids) { const j = (await r.store.getJob(x.id))!; assert.equal(j.status, x.honest ? "paid" : "delivered"); assert.equal(!!j.payout?.transferId, x.honest); if (x.honest) assert.ok(j.proof && j.proof.at >= j.claimedAt!, "proof is not older than the claim"); }
  // sweeping again pays nothing extra
  await r.internal("POST", "/internal/market/sweep"); assert.equal(r.payments.calls.filter((c) => c.op === "transfer").length, honestN);
});

test("naive stranger: hire, get_paid and dispute all have registered C4 routes; a bare request is refused, not guessed", async () => {
  for (const id of ["hire", "get_paid", "dispute"]) { const f = FLOWS.find((x) => x.id === id)!; assert.equal(f.owner, "C4"); assert.ok(f.route, id + " has a route"); }
  const r = rig(); assert.equal((await r.h.req("GET", "/pro/board")).status, 401); assert.equal((await r.h.req("POST", "/market/jobs")).status, 401);
  const u = await r.h.login("n@x.com"); assert.equal((await r.h.j(await r.h.req("POST", "/pro/join", { token: u.session, body: {} }))).error, "terms_required");
  assert.equal((await r.h.j(await r.h.req("GET", "/pro/board", { token: u.session }))).error, "pro_seat_required");
});

test("claim race, forced: both pros read the job as open before either writes; the compare-and-set lets exactly one through", async () => {
  const r = rig(); const o = await r.owner("o@race2.com.au", "race2.com.au"); const p1 = await r.pro("p1@x.com"), p2 = await r.pro("p2@x.com");
  const id = (await r.hire(o)).job.id; const orig = r.store.getJob.bind(r.store); let reads = 0; let release!: () => void; const gate = new Promise<void>((res) => (release = res));
  r.store.getJob = async (jid: string) => { const j = await orig(jid); if (jid === id && reads < 2) { reads++; if (reads === 2) release(); await gate; } return j; };
  const [a, b] = await Promise.all([r.claim(p1.session, id), r.claim(p2.session, id)]);
  r.store.getJob = orig; assert.equal(reads, 2);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]); assert.equal(r.payments.count("claim_fee"), 1);
  const j = (await r.store.getJob(id))!; assert.ok([p1.account.id, p2.account.id].includes(j.proAccountId!));
});

test("payout twice, forced: two concurrent releases of one proven job produce one transfer and one refusal", async () => {
  const r = rig(); const o = await r.owner("o@pp.com.au", "pp.com.au"); const p = await r.pro("p@x.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); r.fix("pp.com.au"); r.payments.failTransfer = true; await r.deliver(p.session, id);   // reproved, transfer failed
  r.payments.failTransfer = false;
  const orig = r.store.getJob.bind(r.store); let reads = 0; let release!: () => void; const gate = new Promise<void>((res) => (release = res));
  r.store.getJob = async (jid: string) => { const j = await orig(jid); if (jid === id && reads < 2) { reads++; if (reads === 2) release(); await gate; } return j; };
  const res = await Promise.allSettled([releasePayout(r.h.deps, id), releasePayout(r.h.deps, id)]); r.store.getJob = orig;
  assert.equal(res.filter((x) => x.status === "fulfilled").length, 1); assert.equal(r.payments.count("transfer"), 1);
});

test("rank unit: a paid job with no proof object scores nothing, and a rating-shaped field on a job is ignored", () => {
  const base: any = { id: "j", ownerAccountId: "o", domainId: "d", domain: "x.au", check: "SPF", severity: "FAIL", tier: "small", priceCents: 1, claimFeeCents: 1, status: "paid", createdAt: 0, updatedAt: 0, baseline: { at: 0, status: "FAIL", detail: "" }, proAccountId: "p", abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [] };
  assert.equal(rankFor("p", [base]).points, 0, "paid without proof");
  const withProof = { ...base, proof: { scanId: "s", at: 1, baseline: "FAIL", now: "PASS", detail: "" }, stars: 5, review: "great" };
  assert.equal(rankFor("p", [withProof]).points, 3); assert.equal(rankFor("p", [{ ...withProof, stars: 1, review: "awful" }]).points, 3);
});

// ---------- R-C4 (wA acceptance): money must exist before a job opens ----------
const mevent = (r: ReturnType<typeof rig>, id: string, status: string | undefined, o: { amount?: number; type?: string; evId?: string } = {}) => {
  return (async () => {
    const job = (await r.store.getJob(id))!;
    return r.h.webhook(o.type ?? "checkout.session.completed", { id: job.checkoutId, ...(status ? { payment_status: status } : {}), payment_intent: `pi_${id}`, amount_total: o.amount ?? job.priceCents, metadata: { market_job_id: id } }, { id: o.evId });
  })();
};
test("R-C4: an unpaid checkout.session.completed funds nothing and does not burn the event id", async () => {
  const r = rig(); const o = await r.owner("o@u.com.au", "u.com.au"); const p = await r.pro("p@u.com");
  const id = (await r.hire(o, "SPF", false)).job.id;
  for (const st of ["unpaid", undefined, "no_payment_required", "PAID"]) assert.equal((await r.h.j(await mevent(r, id, st as string | undefined))).result, "ignored", `status ${st}`);
  assert.equal((await r.store.getJob(id))!.status, "awaiting_funds");
  assert.equal((await r.h.j(await r.claim(p.session, id))).error !== undefined, true, "pro cannot claim an unfunded job");
  assert.equal(r.payments.count("claim_fee"), 0);
  // the same event id, replayed later as paid (Stripe would not, but a burned id must not matter): still funds, id was never claimed
  assert.equal((await r.h.j(await mevent(r, id, "unpaid", { evId: "evt_delayed" }))).result, "ignored");
  assert.equal((await r.h.j(await mevent(r, id, "paid", { evId: "evt_delayed" }))).result, "funded");
  assert.equal((await r.store.getJob(id))!.status, "open");
});
test("R-C4: async_payment_succeeded funds the job with the same signature, amount and checkout checks", async () => {
  const r = rig(); const o = await r.owner("o@a.com.au", "a.com.au");
  const id = (await r.hire(o, "SPF", false)).job.id; const T = "checkout.session.async_payment_succeeded";
  assert.equal((await r.h.j(await mevent(r, id, "unpaid"))).result, "ignored");
  const job = (await r.store.getJob(id))!;
  const forged = await r.h.webhook(T, { id: job.checkoutId, payment_status: "paid", amount_total: job.priceCents, metadata: { market_job_id: id } }, { secret: "wrong" }); assert.equal(forged.status, 400);
  assert.equal((await r.h.j(await mevent(r, id, "paid", { type: T, amount: 1 }))).result, "ignored", "wrong amount");
  assert.equal((await r.h.j(await r.h.webhook(T, { id: "cs_other", payment_status: "paid", amount_total: job.priceCents, metadata: { market_job_id: id } }))).result, "ignored", "wrong checkout");
  assert.equal((await r.h.j(await mevent(r, id, "unpaid", { type: T }))).result, "ignored", "async event that is not paid");
  assert.equal((await r.store.getJob(id))!.status, "awaiting_funds");
  assert.equal((await r.h.j(await mevent(r, id, "paid", { type: T, evId: "evt_async" }))).result, "funded");
  assert.equal((await r.h.j(await mevent(r, id, "paid", { type: T, evId: "evt_async" }))).result, "duplicate");
  assert.equal((await r.h.j(await mevent(r, id, "paid", { type: T }))).result, "ignored", "already open");
  const j = (await r.store.getJob(id))!; assert.equal(j.status, "open"); assert.equal(j.paymentIntent, `pi_${id}`);
});
test("R-C4 mutation check: with the paid guard removed from the webhook route these regressions go red", async () => {
  const { readFileSync, writeFileSync, rmSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const guard = 'if (o.payment_status !== "paid") return json({ result: "ignored" });';
  assert.ok(src.includes(guard), "guard line present in src/index.ts");
  const mutUrl = new URL("../src/__mut_index.ts", import.meta.url);
  try {
    writeFileSync(mutUrl, src.replace(guard, ""));
    const mut = await import(mutUrl.href);
    const r = rig(); const o = await r.owner("o@m.com.au", "m.com.au");
    const id = (await r.hire(o, "SPF", false)).job.id; const job = (await r.store.getJob(id))!;
    const { signStripePayload } = await import("../src/stripe.ts"); const { SECRET } = await import("./harness.ts");
    const payload = JSON.stringify({ id: "evt_mut", type: "checkout.session.completed", data: { object: { id: job.checkoutId, payment_status: "unpaid", amount_total: job.priceCents, metadata: { market_job_id: id } } } });
    const sig = await signStripePayload(payload, SECRET, Math.floor(r.h.clock.t / 1000));
    await mut.handle(new Request("https://api.test/stripe/webhook", { method: "POST", headers: { "stripe-signature": sig }, body: payload }), {}, r.h.deps);
    assert.equal((await r.store.getJob(id))!.status, "open", "the mutant funds an unpaid job, so the real guard is what the tests above protect");
  } finally { rmSync(mutUrl, { force: true }); }
});
