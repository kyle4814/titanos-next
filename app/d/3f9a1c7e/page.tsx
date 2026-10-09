import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo: evidence and reporting workload",
  robots: { index: false, follow: false },
};

// SYNTHETIC records only. Invented for illustration; they describe no real person, site or audit.
const SAMPLE = [
  { id: "SYN-001", item: "Incident note, fall, Site A", before: "Found across 3 systems", after: "Matched to 1 standard clause" },
  { id: "SYN-002", item: "Medication round check, Site B", before: "Paper log, re-keyed", after: "Logged once, cited in report" },
  { id: "SYN-003", item: "Staff training record, Site C", before: "Spreadsheet, out of date", after: "Current, flagged 14 days early" },
];

export default function DemoPage() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 20px", lineHeight: 1.6 }}>
      <p style={{ display: "inline-block", border: "2px solid currentColor", padding: "4px 10px", fontWeight: 700, letterSpacing: 1 }}>
        DEMO: SYNTHETIC SAMPLE DATA, NOT A CLIENT DELIVERABLE
      </p>
      <h1>Less time assembling evidence, more time on care</h1>

      <h2>The use case</h2>
      <p>
        Providers are preparing for the new Aged Care Act and its reforms. A large part of that work is gathering
        evidence from many places and turning it into reports. This demo shows one workflow: matching everyday
        records to the standard they support, so the report assembles itself and people review it instead of
        rebuilding it. Nobody is replaced. Staff stay in charge and get hours back.
      </p>
      <p>
        Public source: the organisation&apos;s 2025 year in review states that the overwhelming policy focus this year
        has been preparing customers for the new Aged Care Act and associated reforms.
      </p>

      <h2>Before and after (synthetic records)</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Record</th>
              <th style={{ textAlign: "left", padding: 8 }}>Item</th>
              <th style={{ textAlign: "left", padding: 8 }}>Before</th>
              <th style={{ textAlign: "left", padding: 8 }}>After</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid currentColor" }}>
                <td style={{ padding: 8 }}>{r.id}</td>
                <td style={{ padding: 8 }}>{r.item}</td>
                <td style={{ padding: 8 }}>{r.before}</td>
                <td style={{ padding: 8 }}>{r.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>The value number</h2>
      <p>
        <strong>AU$60,860,000 a year</strong> [MODELLED].
      </p>
      <p>
        Method: our factory ranking, central scenario (central_aud_m = 60.86). This is a whole-programme figure, not
        a bottom-up count of one process. The bottom-up figure is UNKNOWN until a value case is run on real
        workflows. It is a model, never revenue and never a promise. A conservative scenario sits below it in our
        working file.
      </p>

      <p style={{ marginTop: 40, fontSize: 14 }}>
        Built from public information only. Unlisted page, not indexed. Prepared by TITANOS.
      </p>
    </main>
  );
}
