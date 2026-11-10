import type { CSSProperties } from "react";
import { brandVars, buildSampleReport } from "@/lib/whiteLabel";

// Synthetic white-label report sample for /pro#white-label-reports. Server component: no state, no fetch, no upload,
// no model call. The partner logo is an empty labelled slot, the brand colours arrive as CSS custom properties.
const STATUS: Record<string, string> = { PASS: "Pass", WARN: "Needs attention", FAIL: "Fix first", UNKNOWN: "Could not read" };

export default async function WhiteLabelReport() {
  const r = await buildSampleReport();
  const b = r.brand;
  const vars = brandVars(b) as CSSProperties;
  return (
    <figure aria-label="Sample white-label report" style={{ ...vars, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <figcaption><strong>{r.label}</strong></figcaption>
      <article data-wl-report style={{ background: "var(--wl-paper)", color: "var(--wl-ink)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 14, borderTop: "6px solid var(--wl-accent)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div data-wl-logo-slot role="img" aria-label={b.logoSlot.label} style={{ width: b.logoSlot.width, height: b.logoSlot.height, border: "2px dashed var(--wl-accent)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 12, padding: 4 }}>{b.logoSlot.label}</div>
          <div style={{ textAlign: "right" }}>
            <strong>{b.partnerName}</strong><br />
            <small>Email security report for {r.scan.domain}</small><br />
            <small>{r.dateLabel}</small>
          </div>
        </header>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span data-wl-grade style={{ background: "var(--wl-accent)", color: "var(--wl-on-accent)", borderRadius: 10, minWidth: 64, minHeight: 64, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700 }}>{r.scan.grade}</span>
          <span>Score {r.scan.score} out of 100. Public DNS records only, nothing on the client&apos;s servers was touched.</span>
        </div>
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={{ textAlign: "left", paddingBottom: 6 }}>What we checked</caption>
          <thead><tr><th scope="col" style={{ textAlign: "left" }}>Control</th><th scope="col" style={{ textAlign: "left" }}>Result</th><th scope="col" style={{ textAlign: "left" }}>Detail</th></tr></thead>
          <tbody>
            {r.scan.findings.map((f) => (
              <tr key={f.check} style={{ borderTop: "1px solid var(--wl-accent)" }}>
                <th scope="row" style={{ textAlign: "left", padding: "6px 8px 6px 0" }}>{f.check}</th>
                <td style={{ padding: "6px 8px 6px 0" }}>{STATUS[f.status]}</td>
                <td style={{ padding: "6px 0" }}>{f.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <section aria-label="Fix plan">
          <strong>Fix plan, most important first</strong>
          <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
            {r.plan.steps.map((s) => <li key={s.check}>{s.title}</li>)}
          </ol>
          <small>Time estimates are modelled, not measured: about {r.plan.hoursHandedBack} hours handed back against doing it by hand.</small>
        </section>
        <footer><small>Prepared for the client by {b.partnerName}. Colours and logo are the partner&apos;s own.</small></footer>
      </article>
    </figure>
  );
}
