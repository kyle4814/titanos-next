import { rig, INTERNAL, FIXED_SPF } from "../../test/market_harness.ts";
import { healthy } from "../../test/owner_harness.ts";
import { MemoryOwnerStore } from "../../src/owner/engine.ts";
const out: string[] = [];
const rec = (id: string, held: boolean, note: string) => { out.push(`${held ? "HELD  " : "BREACH"} ${id}: ${note}`); };

async function newRig() { return rig(); }

// P-A: cross-tenant reads on owner seat (C3/C2)
{
  const r = await newRig();
  const A = await r.owner("a@victim.example.com", "victim.example.com.au");
  const B = await r.owner("b@other.example.com", "other.example.com.au");
  const paths = [["GET", `/app/domains/${A.domainId}`], ["POST", `/app/domains/${A.domainId}/scan`], ["GET", `/app/domains/${A.domainId}/report`], ["POST", `/app/domains/${A.domainId}/fix`], ["POST", `/domains/${A.domainId}/verify`], ["GET", `/app/domains/${A.domainId}/report?format=md`]];
  let bad = 0; const codes: number[] = [];
  for (const [m, p] of paths) { const res = await r.h.req(m, p, { token: B.session, body: m === "POST" ? { check: "SPF" } : undefined }); codes.push(res.status); if (res.status < 400) bad++; }
  rec("XT-owner-domain", bad === 0, `B hitting A's domain id: ${codes.join(",")}`);
  const lst = await r.h.j(await r.h.req("GET", "/app/domains", { token: B.session }));
  rec("XT-owner-list", !JSON.stringify(lst).includes("victim.example.com.au"), "B's domain list leaks A?");
  const me = await r.h.j(await r.h.req("GET", "/domains", { token: B.session }));
  rec("XT-domains-list", !JSON.stringify(me).includes("victim.example.com.au"), "B GET /domains leaks A?");
  // B adds A's verified domain
  const add = await r.h.req("POST", "/domains", { token: B.session, body: { domain: "victim.example.com.au" } });
  rec("XT-domain-squat-verified", add.status === 409, `B adds A's verified domain -> ${add.status}`);
  // case / trailing dot / subdomain-as-same / unicode variants
  for (const v of ["VICTIM.example", "victim.example.com.au.", " victim.example.com.au ", "www.victim.example.com.au", "victim.example.com.au/", "victim.example.com.au:443", "xn--victim.example.com.au"]) {
    const x = await r.h.req("POST", "/domains", { token: B.session, body: { domain: v } });
    const bd = await r.h.j(x.clone());
    if (x.status < 300 && /^(victim\.example)$/i.test(String(bd.domain))) rec("XT-domain-variant-" + v, false, `variant accepted as ${bd.domain} status ${x.status}`);
  }
  // Unverified-first squat: attacker adds victim domain BEFORE victim verifies; does victim still verify?
  const r2 = await newRig();
  r2.zone("target.example.com.au");
  const att = await r2.h.login("att@e.example.com"); const vic = await r2.h.login("vic@e.example.com");
  const ad = await r2.h.j(await r2.h.req("POST", "/domains", { token: att.session, body: { domain: "target.example.com.au" } }));
  const vd = await r2.h.j(await r2.h.req("POST", "/domains", { token: vic.session, body: { domain: "target.example.com.au" } }));
  r2.h.dns.zone[vd.record.name] = [vd.record.value];
  const v = await r2.h.req("POST", `/domains/${vd.id}/verify`, { token: vic.session });
  rec("XT-squat-unverified", v.status === 200, `victim verifies after attacker pre-registered: ${v.status}`);
  // attacker's token differs?
  rec("XT-token-unique", ad.record.value !== vd.record.value, "per-account TXT tokens differ");
  // attacker verifying with victim's record value?
  const v2 = await r2.h.req("POST", `/domains/${ad.id}/verify`, { token: att.session });
  rec("XT-replay-victim-token", v2.status !== 200, `attacker verify after victim verified: ${v2.status}`);
}

// P-B: market payouts
{
  const r = await newRig();
  const own = await r.owner("own@m.example.com", "fix.example.com.au");
  const pro = await r.pro("pro@m.example.com");
  const job = await r.hire(own);
  const jid = job.job.id;
  // payout without claim/deliver: internal sweep
  let s = await r.internal("POST", "/internal/market/sweep");
  let jobs = await r.h.j(await r.h.req("GET", "/market/jobs", { token: own.session }));
  rec("PAY-sweep-unclaimed", !jobs.asOwner.some((x: any) => x.status === "paid"), "sweep on an unclaimed funded job pays nobody");
  await r.claim(pro.session, jid);
  // deliver with fault still present
  let d = await r.h.j(await r.deliver(pro.session, jid));
  rec("PAY-deliver-no-fix", d.reproved === false && d.payout === null, `deliver without fix -> reproved=${d.reproved}`);
  // spam rescans & sweeps while unfixed
  for (let i = 0; i < 3; i++) { await r.internal("POST", "/internal/market/sweep"); r.h.clock.t += 120_000; await r.h.req("POST", `/market/jobs/${jid}/rescan`, { token: own.session }); }
  rec("PAY-no-payment-ledger", r.payments.transfers?.length === 0 || r.payments.transfers === undefined, `transfers=${JSON.stringify((r.payments as any).transfers?.length)}`);
  // fix, then rescan -> pay once
  r.fix("fix.example.com.au"); r.h.clock.t += 120_000;
  const rs = await r.h.j(await r.h.req("POST", `/market/jobs/${jid}/rescan`, { token: pro.session }));
  // double rescans/sweeps -> single payout
  for (let i = 0; i < 4; i++) { r.h.clock.t += 120_000; await r.h.req("POST", `/market/jobs/${jid}/rescan`, { token: pro.session }); await r.internal("POST", "/internal/market/sweep"); }
  const tr = (r.payments as any).calls.filter((c: any) => c.op === "transfer");
  rec("PAY-single-transfer", tr.length === 1, `transfers after repeated rescan+sweep: ${tr.length} first status ${rs.job?.status}`);
}
// P-C: payout with stale / faked reproof: dispute after deliver then resume path; fix reverts before sweep
{
  const r = await newRig();
  const own = await r.owner("o2@m.example.com", "rev.example.com.au"); const pro = await r.pro("p2@m.example.com");
  const jid = (await r.hire(own)).job.id; await r.claim(pro.session, jid);
  r.fix("rev.example.com.au");  // owner fixes themselves AFTER claim, then pro "delivers": allowed? who is paid
  const d = await r.h.j(await r.deliver(pro.session, jid));
  rec("PAY-owner-self-fix-then-pro-delivers", d.reproved !== true, `owner fixed own fault, pro delivered nothing -> reproved=${d.reproved} (pro paid for owner's work)`);
}
// P-D: self-dealing sockpuppet: same human, two accounts
{
  const r = await newRig();
  const own = await r.owner("o3@m.example.com", "wash.example.com.au"); const pro = await r.pro("sock@m.example.com");
  const jid = (await r.hire(own)).job.id; await r.claim(pro.session, jid); r.fix("wash.example.com.au");
  const d = await r.h.j(await r.deliver(pro.session, jid, "done"));
  const rk = await r.h.j(await r.h.req("GET", "/pro/rank", { token: pro.session }));
  rec("RANK-wash-trade", !(d.reproved && rk.provenFixes > 0), `sockpuppet pro earns provenFixes=${rk.provenFixes} on an owner-colluded job (observation: needs 2 emails, real money round-trips less fees)`);
}
// P-E: funding abuse
{
  const r = await newRig();
  const own = await r.owner("o4@m.example.com", "fund.example.com.au");
  const j = await r.hire(own, "SPF", false); const id = j.job.id;
  const wrong = await r.fundJob(id, { amount: 1 });
  let jj = await r.store.getJob(id); rec("FUND-wrong-amount", jj!.status === "awaiting_funds", `status ${jj!.status}`);
  const bad = await r.h.webhook("checkout.session.completed", { id: "cs_other", payment_status: "paid", amount_total: jj!.priceCents, metadata: { market_job_id: id } });
  jj = await r.store.getJob(id); rec("FUND-wrong-checkout-id", jj!.status === "awaiting_funds", `status ${jj!.status}`);
  const unpaid = await r.h.webhook("checkout.session.completed", { id: jj!.checkoutId, payment_status: "unpaid", amount_total: jj!.priceCents, metadata: { market_job_id: id } });
  jj = await r.store.getJob(id); rec("FUND-unpaid-session", jj!.status === "awaiting_funds", `payment_status=unpaid funds the job? status ${jj!.status}`);
  const sig = await r.h.webhook("checkout.session.completed", { id: jj!.checkoutId, payment_status: "paid", amount_total: jj!.priceCents, metadata: { market_job_id: id } }, { secret: "whsec_wrong" });
  rec("FUND-bad-sig", sig.status === 400, `${sig.status}`);
  const stale = await r.h.webhook("checkout.session.completed", { id: jj!.checkoutId, payment_status: "paid", amount_total: jj!.priceCents, metadata: { market_job_id: id } }, { t: Math.floor(r.h.clock.t / 1000) - 3600 });
  rec("FUND-stale-ts", stale.status === 400, `${stale.status}`);
}
// internal secret
{
  const r = await newRig();
  for (const [h, lbl] of [[{}, "none"], [{ "x-internal-secret": "" }, "empty"], [{ "x-internal-secret": "x" }, "wrong"]] as any) {
    const res = await r.h.req("GET", "/internal/market/cards", { headers: h });
    rec("INT-" + lbl, res.status === 401, `${res.status}`);
  }
  r.h.deps.market!.internalSecret = ""; 
  const res = await r.h.req("GET", "/internal/market/cards", { headers: { "x-internal-secret": "" } });
  rec("INT-unset-secret-empty-header", res.status === 401, `${res.status}`);
}
console.log(out.join("\n"));
