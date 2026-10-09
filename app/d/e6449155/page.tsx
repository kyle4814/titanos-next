import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DEMO · Security evidence register (sample)",
  description: "Unlisted demonstration on synthetic records.",
  robots: { index: false, follow: false, nocache: true },
};

const wrap = { maxWidth: 880, margin: "0 auto", padding: "24px 20px 64px", fontFamily: "system-ui, sans-serif", color: "#e8ecf1", lineHeight: 1.55 } as const;
const card = { border: "1px solid #3a4658", borderRadius: 8, padding: 16, margin: "16px 0", background: "#141a23" } as const;
const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #3a4658", fontSize: 13 } as const;
const td = { padding: "6px 8px", borderBottom: "1px solid #232c3a", fontSize: 14 } as const;

const SAMPLE: [string, string, string, string][] = [
  ["SAMPLE-001", "Depot gate controller firmware", "OT", "Patch window agreed"],
  ["SAMPLE-002", "Terminal operating system login audit", "IT", "Evidence attached"],
  ["SAMPLE-003", "Rail signalling gateway remote access", "OT", "Owner review due"],
  ["SAMPLE-004", "Supplier portal multi-factor sign-in", "IT", "Evidence attached"],
  ["SAMPLE-005", "Crane telemetry network segment", "OT", "Gap: no owner named"],
];

export default function Page() {
  return (
    <main style={{ background: "#0d1117", minHeight: "100vh" }}>
      <div style={wrap}>
        <p style={{ display: "inline-block", border: "2px solid #f2b84b", color: "#f2b84b", padding: "4px 10px", fontWeight: 700, letterSpacing: 1 }}>
          DEMO · SYNTHETIC SAMPLE RECORDS · NOT FOR CIRCULATION
        </p>
        <h1 style={{ fontSize: 30, margin: "16px 0 8px" }}>One live register for IT and OT security evidence</h1>
        <p>
          A TITANOS demonstration for a large Australian logistics operator. It uses only public information and invented sample records.
          Nothing here touches any real system, and nobody is replaced: the security team keeps every decision, and the register hands
          back the hours they spend chasing and formatting evidence.
        </p>

        <section style={card}>
          <h2 style={{ fontSize: 20, marginTop: 0 }}>The use case</h2>
          <p>
            The annual report names cybersecurity threats to information technology, data and operational technology systems as a
            material risk. Showing that risk is managed means gathering evidence from many owners, again, for every reader: the board,
            auditors, insurers and customers.
          </p>
          <p style={{ marginBottom: 0 }}>
            Source (public): the company&apos;s 2025 Appendix 4E and Annual Report, section on cybersecurity threats to IT and OT
            (qube.com.au, August 2025).
          </p>
        </section>

        <section style={card}>
          <h2 style={{ fontSize: 20, marginTop: 0 }}>Before and after</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: "1 1 300px" }}>
              <h3 style={{ fontSize: 16 }}>Before (EXAMPLE)</h3>
              <ul>
                <li>Each reader asks for evidence in a different format.</li>
                <li>Owners are emailed one by one; replies arrive as files and screenshots.</li>
                <li>Gaps are found at the last minute, by whoever is chasing.</li>
              </ul>
            </div>
            <div style={{ flex: "1 1 300px" }}>
              <h3 style={{ fontSize: 16 }}>After (EXAMPLE)</h3>
              <ul>
                <li>One register, one row per control, each with a named owner.</li>
                <li>Every report is a view of the same rows, so formats stop mattering.</li>
                <li>Gaps show on the day they open, with the owner beside them.</li>
              </ul>
            </div>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ fontSize: 20, marginTop: 0 }}>Sample register (all records invented)</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead>
                <tr><th style={th}>ID</th><th style={th}>Control</th><th style={th}>Domain</th><th style={th}>Status</th></tr>
              </thead>
              <tbody>
                {SAMPLE.map((r) => (
                  <tr key={r[0]}>{r.map((c) => <td key={c} style={td}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ fontSize: 20, marginTop: 0 }}>The value number</h2>
          <p style={{ fontSize: 28, fontWeight: 700, margin: "4px 0" }}>AU$62,900,000 a year</p>
          <p><strong>Label: MODELLED.</strong> It is a whole-programme figure, never revenue and never a promise.</p>
          <p>
            Method: the central case of our ranking model across the full programme of work this kind of operator carries. It is not
            a bottom-up count of one process; the bottom-up figure for the security evidence workflow alone is UNKNOWN until we measure
            it with your team. The conservative scenario sits below this central case and is the one to plan against.
          </p>
        </section>

        <p style={{ fontSize: 13, color: "#9aa7b8" }}>
          Prepared by TITANOS (Brisbane). DEMO page, unlisted, not indexed. Public data and synthetic records only.
        </p>
      </div>
    </main>
  );
}
