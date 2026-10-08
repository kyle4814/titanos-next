import Link from "next/link";
import { BTN, CARD, H2, MUTED } from "@/components/tix/ui";

const STEPS: [string, string][] = [
  ["Create an event", "On this computer: name it and set the highest price a ticket may be resold for."],
  ["Issue a ticket", "Give it to a fan. Their wallet shows a QR that changes every 15 seconds."],
  ["Pair your phone", "Point your phone camera at the pairing code on the organiser page. The phone becomes the gate scanner."],
  ["Scan it", "Aim the phone at the wallet QR on this screen. See ADMIT, then try to cheat it."],
];

export default function Start() {
  return (
    <div>
      <h1 style={{ ...H2, fontSize: 28 }}>TIX-999 live demo</h1>
      <p style={{ ...MUTED, fontSize: 15 }}>One ticket, one real owner, one valid entry. Run the whole thing yourself in about three minutes with this computer and your phone.</p>
      <ol data-testid="guide" style={{ listStyle: "none", padding: 0, margin: "18px 0" }}>
        {STEPS.map(([h, d], i) => (
          <li key={h} style={{ ...CARD, display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 10 }}>
            <span style={{ background: "var(--gold)", color: "#000", fontWeight: 800, borderRadius: 99, minWidth: 30, height: 30, display: "grid", placeItems: "center" }}>{i + 1}</span>
            <span><b>{h}</b><br /><span style={MUTED}>{d}</span></span>
          </li>
        ))}
      </ol>
      <Link href="/demo/tix/organiser" style={{ ...BTN, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>Start the demo</Link>
      <p style={{ ...MUTED, marginTop: 14 }}>Afterwards, open the wallet and use the &quot;Try to cheat it&quot; panel: a screenshot, a second scan and a forged code all get stopped, each with a plain reason.</p>
    </div>
  );
}
