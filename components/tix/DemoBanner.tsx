import Link from "next/link";

export default function DemoBanner() {
  return (
    <div role="note" style={{ background: "rgba(212,175,55,.08)", border: "1px solid var(--pe-line-gold, var(--gold))", color: "var(--pe-gold-hi, var(--gold))", padding: "10px 14px", fontSize: 13, lineHeight: 1.5, borderRadius: 8, margin: "0 0 18px" }}>
      <strong>DEMO MODE.</strong> The signing key lives in this browser; in production verification runs server-side and the key never reaches a phone.
      No payments, no real fan data, no tracking. Data stays on this device.
      <div style={{ marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Link href="/demo/tix" style={{ color: "var(--pe-text, var(--ice))" }}>Start</Link>
        <Link href="/demo/tix/organiser" style={{ color: "var(--pe-text, var(--ice))" }}>Organiser</Link>
        <Link href="/demo/tix/wallet" style={{ color: "var(--pe-text, var(--ice))" }}>Fan wallet</Link>
        <Link href="/demo/tix/scan" style={{ color: "var(--pe-text, var(--ice))" }}>Gate scanner</Link>
      </div>
    </div>
  );
}
