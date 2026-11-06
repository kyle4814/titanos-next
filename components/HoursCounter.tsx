import { sampleHours, ledgerHours, LEDGER_SEED } from "@/lib/guestscan/hours";
import { STATS } from "@/lib/stats";

/** Home: the hours counter. Two labelled numbers, never blended (see lib/guestscan/hours.ts). */
export default function HoursCounter() {
  const s = sampleHours();
  const hrs = ledgerHours();
  return (
    <section aria-label="Hours handed back" style={{ textAlign: "center", padding: "var(--space-12) 20px" }}>
      <p style={{ fontSize: "var(--fs-xl)", margin: 0 }}>
        A domain with no email protection costs about <strong>{s.byHandHours} hours</strong> to fix by hand. <a href="/scan#instant">Check yours free</a> and get it in about <strong>{s.planMinutes} minutes</strong>.
      </p>
      <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 8 }}>
        Estimate, not a measurement ({s.label}). Hours laid out for real visitors since {LEDGER_SEED.since}: <strong>{hrs}</strong>
        {" "}({LEDGER_SEED.source}). {STATS.scansLast30Days} scans were run in the 30 days to {STATS.asOf}.
      </p>
    </section>
  );
}
