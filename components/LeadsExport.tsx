"use client";
import { useState } from "react";
import { checkLeads, SAMPLE_TEXT, type DncInput } from "@/lib/leads-ui";

// /pro#leads panel (plan D2). Export only: no sending, no outreach, no register lookup. Rows below are an EXAMPLE.
export default function LeadsExport() {
  const [country, setCountry] = useState("AU");
  const [dnc, setDnc] = useState<DncInput>("unknown");
  const [text, setText] = useState(SAMPLE_TEXT);
  const [view, setView] = useState(() => checkLeads(SAMPLE_TEXT, "AU", "unknown"));
  const run = () => setView(checkLeads(text, country, dnc));
  const download = () => {
    if (!view.ok) return;
    const url = URL.createObjectURL(new Blob([view.csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "leads-export.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p role="note" data-testid="leads-draft-banner" style={{ margin: 0, padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}>
        <strong>DRAFT rules, pending legal sign-off.</strong> This check is not legal advice. It exports a file only. It does not send anything, contact anyone or look up any register.
      </p>
      <p style={{ margin: 0 }}><small>The list below is an example with made-up people. Replace it with your own rows to check them.</small></p>
      <label>Buyer country <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={3} style={{ minHeight: 44 }} /></label>
      <label>Do-not-contact reading for phone rows{" "}
        <select value={dnc} onChange={(e) => setDnc(e.target.value as DncInput)} style={{ minHeight: 44 }}>
          <option value="unknown">Not checked</option><option value="clear">Clear</option><option value="listed">Listed</option>
        </select>
      </label>
      <label>Example list (JSON) <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} style={{ width: "100%", fontFamily: "monospace" }} /></label>
      <button type="button" onClick={run} style={{ minHeight: 44 }}>Check rows</button>
      {!view.ok ? (
        <p role="alert" data-testid="leads-error">{view.message}</p>
      ) : (
        <div data-testid="leads-result" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <small>Rule table: {view.rulesVersion}. {view.emitted} allowed, {view.withheld} held back.</small>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {view.rows.map((r) => (
              <li key={r.index}><strong>{r.id}</strong> ({r.channel}): {r.allowed ? "ALLOW" : "BLOCK"}. {r.text}</li>
            ))}
          </ul>
          <small>{view.method}</small>
          <button type="button" onClick={download} disabled={view.emitted === 0} style={{ minHeight: 44 }}>Download CSV of allowed rows</button>
        </div>
      )}
    </div>
  );
}
