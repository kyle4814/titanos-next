// drill_ten_jobs.mjs - C4 kill test (plan line 1492): first 10 jobs, 100% paid only after re-proof.
// Runs 10 SYNTHETIC jobs (6 honest, 4 adversarial) through the real marketplace code on in-memory adapters:
// MemoryMarketStore + MockPayments (a recorded stand-in for Stripe Connect, no request is ever made) + fake DNS.
// Exit 0 and a final "PAY10 OK" line only if payout cards AND transfers exist for exactly the re-proved jobs.
// Run: node scripts/drill_ten_jobs.mjs   (part of npm test; the same drill is asserted in portal-api/test/drill_ten_jobs.test.ts)
const { runDrill } = await import(new URL("../portal-api/test/drill_ten_jobs.ts", import.meta.url).href);
const rep = await runDrill();
const aud = (c) => `AU$${(c / 100).toFixed(2)}`;
console.log("n  kind                              status     proven  transfers  card");
for (const r of rep.rows) console.log(`${String(r.n).padEnd(3)}${r.kind.padEnd(34)}${r.status.padEnd(11)}${String(r.provenExpected).padEnd(8)}${String(r.transfers).padEnd(11)}${r.card ? `${aud(r.card.amountCents)} ${r.card.via} proof ${r.card.proofBaseline}->${r.card.proofNow}` : "none"}`);
console.log(`cards ${rep.cards.length}, transfers ${rep.transferCalls}, claim fees ${rep.claimFees}, expected proven ${rep.expectedPaid.length}`);
if (!rep.ok) {
  for (const f of rep.failures) console.log("FAIL " + f);
  console.log(`PAY10 FAILED ${rep.failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PAY10 OK ${rep.cards.length} of ${rep.rows.length} jobs paid, each only after a passing re-scan; ${rep.rows.length - rep.cards.length} unproven jobs got no card and no transfer (synthetic, mock Stripe)`);
