// C4 independent verifier, step 1 (f399): run 10 SYNTHETIC jobs through the real marketplace code on in-memory adapters
// (MemoryMarketStore + MockPayments, a Stripe stand-in that records calls and makes none, fake DNS zones) and print the RAW
// LEDGER as JSON lines. No scoring, no oracle, no verdict: scripts/c4_paid_reproof_verify.py recomputes "100 percent paid
// only after re-proof" from this ledger alone. Its own scenario (different from drill_ten_jobs.ts), imports no drill or payout test.
//   node --experimental-strip-types scripts/c4_ledger_dump.ts          (cwd portal-api)
// Line kinds: {t:"meta"}, {t:"job",...full job record}, {t:"call",op,args} (payments log, in order), {t:"card",...}.
import { rig } from "../test/market_harness.ts";
import { healthy } from "../test/owner_harness.ts";

const r = rig();
const pros = [];
for (let i = 1; i <= 4; i++) pros.push(await r.pro(`ledgerpro${i}@verify${i}.com.au`));
const mk = async (n: number, check: "SPF" | "MX" | "MTA-STS") => {
  const dom = `c4v${n}.com.au`; const o = await r.owner(`ledgerowner${n}@verify${n}.com.au`, dom);
  if (check === "MTA-STS") r.zones.get(dom)!.world.txt![`_mta-sts.${dom}`] = [];
  if (check === "MX") r.zones.get(dom)!.world.mx = [];
  const hired = await r.hire(o, check);
  return { o, dom, id: hired.job.id as string, check };
};
const fix = (j: { dom: string; check: string }) => {
  if (j.check === "SPF") r.fix(j.dom);
  else if (j.check === "MX") r.zones.get(j.dom)!.world.mx = ["10 aspmx.l.google.com."];
  else r.zones.get(j.dom)!.world.txt![`_mta-sts.${j.dom}`] = ["v=STSv1; id=20261110"];
};
const tick = () => { r.h.clock.t += 61_000; };

// jobs 1-4: honest, fixed before delivery (SPF, SPF, MX, SPF)
const kinds: ("SPF" | "MX" | "MTA-STS")[] = ["SPF", "SPF", "MX", "SPF", "MTA-STS"];
const js = [];
for (let n = 1; n <= 5; n++) {
  const j = await mk(n, kinds[n - 1]); js.push(j); const p = pros[(n - 1) % 4];
  await r.claim(p.session, j.id); fix(j); tick(); await r.deliver(p.session, j.id);
}
// job 6: delivered while still faulty, then the fix lands and the OWNER presses re-scan
{ const j = await mk(6, "SPF"); await r.claim(pros[0].session, j.id); await r.deliver(pros[0].session, j.id, "rolling out"); fix(j); tick(); await r.h.req("POST", `/market/jobs/${j.id}/rescan`, { token: j.o.session }); }
// job 7: "done, trust me" with the fault still present
{ const j = await mk(7, "SPF"); await r.claim(pros[1].session, j.id); await r.deliver(pros[1].session, j.id, "done, trust me"); }
// job 8: delivered, then the zone gets WORSE (SPF record deleted); owner re-scans
{ const j = await mk(8, "SPF"); await r.claim(pros[2].session, j.id); await r.deliver(pros[2].session, j.id, "fixed"); tick(); r.zones.get(j.dom)!.world.txt![j.dom] = []; await r.h.req("POST", `/market/jobs/${j.id}/rescan`, { token: j.o.session }); }
// job 9: fix applied but DNS is dark at re-scan time (UNKNOWN never proves)
{ const j = await mk(9, "SPF"); await r.claim(pros[3].session, j.id); fix(j); r.zones.get(j.dom)!.world.servfail = true; await r.deliver(pros[3].session, j.id); }
// job 10: funded, claimed, fixed, never delivered
{ const j = await mk(10, "SPF"); await r.claim(pros[0].session, j.id); fix(j); }

// approve any open payout review cards through the internal route, then sweep twice (a sweep must add no transfer for an unproven job)
for (const c of (await r.store.openCards()).filter((c) => c.kind === "payout_review")) await r.internal("POST", `/internal/market/cards/${c.id}/resolve`, { outcome: "approve" });
await r.internal("POST", "/internal/market/sweep"); tick(); tick(); await r.internal("POST", "/internal/market/sweep");

const out = (o: unknown) => console.log(JSON.stringify(o));
out({ t: "meta", scenario: "c4-ledger-dump", synthetic: true, review_line_cents: 50_000, jobs: (await r.store.allJobs()).length });
for (const j of await r.store.allJobs()) out({ t: "job", ...j });
for (const c of r.payments.calls) out({ t: "call", op: c.op, args: c.args });
// every card ever raised, resolved or not (MemoryMarketStore keeps them in a public map)
for (const c of (r.store as unknown as { cards: Map<string, unknown> }).cards.values()) out({ t: "card", ...(c as object) });
