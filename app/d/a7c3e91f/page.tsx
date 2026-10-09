import type { CSSProperties } from "react";

const WRAP: CSSProperties = { maxWidth: 880, margin: "0 auto", padding: "110px 16px 60px", position: "relative", zIndex: 2, color: "var(--ice)", lineHeight: 1.55 };
const CARD: CSSProperties = { border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: 18, margin: "16px 0" };
const TBL: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const CELL: CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.12)" };
const SCROLL: CSSProperties = { overflowX: "auto" };

const BEFORE = [
  ["Mon 06:00", "Support worker A", "Called in sick 05:10", "Coordinator phones 7 people; 3 voicemails; filled 07:25"],
  ["Mon 14:00", "Support worker B", "Double-booked (two clients)", "Found at 13:40 by chance; one visit moved by phone"],
  ["Tue 08:00", "Allied health C", "Leave not entered", "Client arrives; nobody rostered"],
];
const AFTER = [
  ["Mon 06:00", "Support worker A", "Sick call logged 05:10", "Draft shortlist of 4 qualified, available, nearby staff ready 05:12; coordinator taps one; filled 05:25"],
  ["Mon 14:00", "Support worker B", "Clash flagged on entry", "Flag shown when the second booking was typed; coordinator resolves in the same minute"],
  ["Tue 08:00", "Allied health C", "Leave in the system", "Gap shown 3 days ahead with 2 suggested cover options"],
];

function Table({ rows }: { rows: string[][] }) {
  return (
    <div style={SCROLL}>
      <table style={TBL}>
        <thead><tr>{["Shift", "Person (synthetic)", "Event", "What happens"].map((h) => <th key={h} style={CELL}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} style={CELL}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function Page() {
  return (
    <main style={WRAP}>
      <p style={{ display: "inline-block", border: "1px solid currentColor", padding: "4px 10px", borderRadius: 6, fontWeight: 700, letterSpacing: 1 }}>
        DEMO. SYNTHETIC SAMPLE RECORDS. NOT A PRODUCT OF, OR ENDORSED BY, THE ORGANISATION IT IS ABOUT.
      </p>
      <h1>Rostering and shift fill, with the coordinator still deciding</h1>
      <p>
        A sketch built from public information only (the charity register, the annual report and published job ads). No
        client system was touched and no real person or client appears below. Every name, time and event is invented to show the shape of the workflow.
      </p>

      <section style={CARD}>
        <h2>The use case</h2>
        <p>
          When a shift falls open (sick call, leave, clash), the coordinator today works through phone lists and spreadsheets.
          The assistant drafts a ranked shortlist of qualified, available, nearby staff and flags clashes at the moment they are typed.
          The coordinator picks. Nobody is replaced; the hours spent chasing cover are given back.
        </p>
      </section>

      <section style={CARD}>
        <h2>Before (synthetic week)</h2>
        <Table rows={BEFORE} />
        <h2 style={{ marginTop: 24 }}>After (same synthetic week)</h2>
        <Table rows={AFTER} />
      </section>

      <section style={CARD}>
        <h2>The value number</h2>
        <p style={{ fontSize: 32, fontWeight: 700, margin: "4px 0" }}>AU$121,985 a year</p>
        <p><strong>MODELLED</strong> (bottom-up, central case). Not a quote and not revenue.</p>
        <p>
          Method: about 40.4 hours a week of coordination time given back (addressable rostering hours multiplied by a modest share)
          x AU$58.12 an hour x 52 weeks. The hours figure is rounded here, which is why the product is not exactly the headline.
          Process evidence: the StewartBrown FY24 sector benchmark names rostering and payroll inefficiency. No neutral study measures an
          AI rostering saving, so the shares are deliberately modest and a conservative case sits below this number.
        </p>
      </section>

      <p style={{ fontSize: 13, opacity: 0.8 }}>
        Level reached: L2 (builds, unlisted, noindex). Pain quotes: UNKNOWN, none sourced yet. Labelled per our evidence ladder.
      </p>
    </main>
  );
}
