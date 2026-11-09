// C4 kill test, backfill f63: "first 10 jobs: 100% paid only after re-proof". SYNTHETIC jobs on in-memory adapters:
// MemoryMarketStore, MockPayments (a Stripe Connect stand-in that records calls and makes none), the fake DNS zones.
// Nothing here touches a network, Stripe, DNS or email. Domains are made-up .com.au labels that are never resolved (fake DoH only), owners/pros are made up.
// ORACLE: each scenario states, from what the SCRIPT did to the fake world, whether a passing re-proof exists. The
// service is then judged against that list, never against its own output. Payout cards are read back from the store.
import { rig, FIXED_SPF, faulty } from "./market_harness.ts";
import { healthy } from "./owner_harness.ts";
import { releasePayout } from "../src/market/service.ts";

export interface PayCard { jobId: string; domain: string; check: string; amountCents: number; proofScanId: string; proofBaseline: string; proofNow: string; transferId?: string; via: "auto" | "review_card_approved" }
export interface JobRow { n: number; kind: string; domain: string; jobId: string; status: string; provenExpected: boolean; transfers: number; card?: PayCard; note: string }
export interface DrillReport { rows: JobRow[]; cards: PayCard[]; transferCalls: number; claimFees: number; expectedPaid: string[]; actualCardJobs: string[]; actualTransferJobs: string[]; ok: boolean; failures: string[] }

const MTA = (d: string) => ({ ...healthy(d), txt: { ...healthy(d).txt, [`_mta-sts.${d}`]: [] as string[] } });

export async function runDrill(): Promise<DrillReport> {
  const r = rig(); const rows: JobRow[] = []; const failures: string[] = [];
  const mkJob = async (n: number, kind: string, domain: string, check: "SPF" | "MTA-STS" | "MX" = "SPF") => {
    const o = await r.owner(`owner${n}@drill${n}.com.au`, domain);
    if (check === "MTA-STS") r.zones.get(domain)!.world.txt![`_mta-sts.${domain}`] = [];
    if (check === "MX") r.zones.get(domain)!.world.mx = [];
    const hired = await r.hire(o, check); const jobId = hired.job.id as string;
    return { o, jobId, domain, check };
  };
  const fixMX = (dom: string) => { r.zones.get(dom)!.world.mx = ["10 aspmx.l.google.com."]; };
  const fixMTA = (dom: string) => { r.zones.get(dom)!.world.txt![`_mta-sts.${dom}`] = ["v=STSv1; id=20261106"]; };
  const applyFix = (j: { domain: string; check: string }) => (j.check === "SPF" ? r.fix(j.domain) : j.check === "MX" ? fixMX(j.domain) : fixMTA(j.domain));
  const pros = [] as Awaited<ReturnType<typeof r.pro>>[];
  for (let i = 1; i <= 5; i++) pros.push(await r.pro(`pro${i}@agency${i}.com.au`));
  const expectedPaid = new Set<string>();
  const add = (n: number, kind: string, j: { jobId: string; domain: string }, provenExpected: boolean, note: string) => { if (provenExpected) expectedPaid.add(j.jobId); rows.push({ n, kind, domain: j.domain, jobId: j.jobId, status: "", provenExpected, transfers: 0, note }); };

  // 1 to 5: honest jobs (SPF x3, MX x1, MTA-STS x1 which is AU$599 and so waits for the review card)
  const honest: [number, "SPF" | "MX" | "MTA-STS"][] = [[1, "SPF"], [2, "SPF"], [3, "MX"], [4, "SPF"], [5, "MTA-STS"]];
  for (const [n, chk] of honest) {
    const j = await mkJob(n, "honest", `h${n}.com.au`, chk); const p = pros[n - 1];
    if ((await r.claim(p.session, j.jobId)).status !== 200) failures.push(`job ${n}: claim refused`);
    applyFix(j); r.h.clock.t += 61_000;
    await r.deliver(p.session, j.jobId); add(n, "honest", j, true, chk === "MTA-STS" ? "large tier: held at the AU$500 review line until the card is approved" : "fix applied before delivery");
  }
  // 6: honest, owner asks for the re-scan (not the pro). Proof is still our own scan.
  { const j = await mkJob(6, "honest_owner_rescan", "h6.com.au"); const p = pros[0]; await r.claim(p.session, j.jobId); await r.deliver(p.session, j.jobId, "fix is rolling out"); applyFix(j); r.h.clock.t += 61_000;
    await r.h.req("POST", `/market/jobs/${j.jobId}/rescan`, { token: j.o.session }); add(6, "honest_owner_rescan", j, true, "delivered while still faulty (not paid), fix lands later, owner presses re-scan, passes, paid"); }
  // 7 ADVERSARIAL A: deliver without a passing re-scan ("done, trust me"). The fault is still there.
  { const j = await mkJob(7, "adv_deliver_no_proof", "a7.com.au"); const p = pros[1]; await r.claim(p.session, j.jobId); const d = await r.h.j(await r.deliver(p.session, j.jobId, "all done, trust me"));
    if (d.reproved !== false) failures.push("job 7: a delivery with the fault still present was marked reproved");
    await releasePayout(r.h.deps, j.jobId).then(() => failures.push("job 7: direct releasePayout did not refuse"), (e: any) => { if (e.code !== "payout_requires_reproof") failures.push(`job 7: wrong refusal ${e.code}`); });
    add(7, "adv_deliver_no_proof", j, false, "pro says done, nothing changed; direct payout call refused"); }
  // 8 ADVERSARIAL B: re-scan fails after delivery. Pro delivers a broken "fix" (SPF record deleted = FAIL, not PASS); the owner re-scans.
  { const j = await mkJob(8, "adv_rescan_fails_after_delivery", "a8.com.au"); const p = pros[2]; await r.claim(p.session, j.jobId);
    await r.deliver(p.session, j.jobId, "fixed it");
    r.h.clock.t += 61_000; r.zones.get(j.domain)!.world.txt![j.domain] = [];   // the "fix" made it worse
    const d2 = await r.h.j(await r.h.req("POST", `/market/jobs/${j.jobId}/rescan`, { token: j.o.session }));
    if (d2.reproved !== false) failures.push("job 8: a failing re-scan was treated as proof");
    add(8, "adv_rescan_fails_after_delivery", j, false, "delivered, then the re-scan shows the record broken (FAIL)"); }
  // 9 ADVERSARIAL C: double claim. Two pros race for one job; one wins, one is refused, the winner fixes and is paid once.
  { const j = await mkJob(9, "adv_double_claim", "a9.com.au");
    // Forced interleave: the first DNS query of the claimants' fresh scan waits until BOTH claimants have reached it, so both have
    // read the job as open and only the store's compare-and-set can pick a winner (a mutant without the CAS lets both through).
    const mk = r.h.deps.market!, realDoh = mk.doh; let arrived = 0; let release: () => void = () => {}; const both = new Promise<void>((res) => { release = res; });
    mk.doh = (dom: string) => { const f = realDoh(dom); if (dom !== j.domain) return f; let first = true; return (async (...args: Parameters<typeof f>) => { if (first) { first = false; if (++arrived >= 2) release(); await both; } return f(...args); }) as typeof f; };
    const [a, b] = await Promise.all([r.claim(pros[3].session, j.jobId), r.claim(pros[4].session, j.jobId)]);
    mk.doh = realDoh;
    const codes = [a.status, b.status].sort(); if (codes[0] !== 200 || codes[1] !== 409) failures.push(`job 9: claim race gave ${codes}`);
    const winner = a.status === 200 ? pros[3] : pros[4]; const loser = a.status === 200 ? pros[4] : pros[3];
    applyFix(j); r.h.clock.t += 61_000;
    if ((await r.deliver(loser.session, j.jobId)).status === 200) failures.push("job 9: the losing claimant could deliver");
    await r.deliver(winner.session, j.jobId);
    await releasePayout(r.h.deps, j.jobId).catch(() => { /* already paid: refusal expected */ });   // a second payout attempt must not add a transfer
    add(9, "adv_double_claim", j, true, "one claim fee, one winner, one transfer"); }
  // 10: DNS goes dark at re-scan time (UNKNOWN). Unknown never proves.
  { const j = await mkJob(10, "adv_unknown_rescan", "a10.com.au"); const p = pros[0]; await r.claim(p.session, j.jobId); applyFix(j); r.zones.get(j.domain)!.world.servfail = true;
    await r.deliver(p.session, j.jobId); add(10, "adv_unknown_rescan", j, false, "fix applied but the re-scan could not read DNS (UNKNOWN)"); }

  // The review card for job 5 (large tier): the card exists, nothing has moved yet. Approve it through the internal route.
  const open = await r.store.openCards();
  const reviewCards = open.filter((c) => c.kind === "payout_review");
  const job5 = rows[4].jobId;
  if (reviewCards.length !== 1 || reviewCards[0].jobId !== job5) failures.push(`expected exactly one review card, for job 5; got ${reviewCards.map((c) => c.jobId)}`);
  if (r.payments.calls.some((c) => c.op === "transfer" && (c.args.group === job5))) failures.push("job 5 was paid before its review card was approved");
  for (const c of reviewCards) if ((await r.internal("POST", `/internal/market/cards/${c.id}/resolve`, { outcome: "approve" })).status !== 200) failures.push("review card approve failed");
  // A sweep after everything must pay nothing new.
  const before = r.payments.count("transfer"); await r.internal("POST", "/internal/market/sweep"); r.h.clock.t += 3_600_000; await r.internal("POST", "/internal/market/sweep");
  if (r.payments.count("transfer") !== before) failures.push("a later sweep paid a job nobody proved");

  // Read back: transfers by job (from the Stripe stand-in's call log), and payout cards built from the store's own records.
  const transferJobs = new Map<string, number>(); for (const c of r.payments.calls) if (c.op === "transfer") transferJobs.set(String(c.args.group), (transferJobs.get(String(c.args.group)) ?? 0) + 1);
  const cards: PayCard[] = [];
  for (const row of rows) {
    const j = (await r.store.getJob(row.jobId))!; row.status = j.status; row.transfers = transferJobs.get(row.jobId) ?? 0;
    if (j.status === "paid" && j.payout?.status === "paid" && j.proof && j.proof.now === "PASS") {
      const c: PayCard = { jobId: j.id, domain: j.domain, check: j.check, amountCents: j.payout.amountCents, proofScanId: j.proof.scanId, proofBaseline: j.proof.baseline, proofNow: j.proof.now, transferId: j.payout.transferId, via: j.events.some((e) => e.kind === "payout_review") ? "review_card_approved" : "auto" };
      cards.push(c); row.card = c;
    }
  }
  const actualCardJobs = cards.map((c) => c.jobId).sort(), actualTransferJobs = [...transferJobs.keys()].sort(), exp = [...expectedPaid].sort();
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (!same(actualCardJobs, exp)) failures.push(`payout cards ${actualCardJobs.length} != proven jobs ${exp.length}`);
  if (!same(actualTransferJobs, exp)) failures.push(`transfers ${actualTransferJobs.length} != proven jobs ${exp.length}`);
  for (const [k, n] of transferJobs) if (n !== 1) failures.push(`job ${k} has ${n} transfers`);
  for (const row of rows) { if (row.provenExpected && row.status !== "paid") failures.push(`job ${row.n} proven but ${row.status}`); if (!row.provenExpected && (row.status === "paid" || row.transfers || row.card)) failures.push(`job ${row.n} unproven but paid/carded`); }
  for (const c of cards) { const j = (await r.store.getJob(c.jobId))!; if (j.proof!.at < (j.claimedAt ?? Infinity)) failures.push(`proof before claim on ${c.jobId}`); }
  const claimFees = r.payments.count("claim_fee"); if (claimFees !== 10) failures.push(`claim fees ${claimFees} != 10 (one per claimed job)`);
  return { rows, cards, transferCalls: r.payments.count("transfer"), claimFees, expectedPaid: exp, actualCardJobs, actualTransferJobs, ok: failures.length === 0, failures };
}
