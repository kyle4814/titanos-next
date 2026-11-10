"use client";
// /enterprise#estate: renders the estate view-model from a clearly labelled synthetic example estate.
// No fetch, no scanning, no outreach: the rows below are made up and nothing here reads a real domain.
import { useMemo, useState } from "react";
import { buildEstateView, SAMPLE_ESTATE, SAMPLE_NOW, SYNTHETIC_LABEL, type Grade } from "@/lib/estate-ui";

const SHOW: Grade[] = ["A", "B", "C", "D", "F", "UNKNOWN"];

export default function EstateView() {
  const [showStale, setShowStale] = useState(true);
  const view = useMemo(() => buildEstateView(SAMPLE_ESTATE, SAMPLE_NOW), []);
  const box = { border: "1px solid var(--border)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 } as const;
  if (!view.ok) return <p role="alert" style={{ margin: 0 }}>{view.message}</p>;
  const rows = showStale ? view.rows : view.rows.filter((r) => !r.stale);
  return (
    <div style={box} aria-label="Estate view example">
      <p style={{ margin: 0 }}><strong>{SYNTHETIC_LABEL}</strong></p>
      <p style={{ margin: 0 }}>{view.method}</p>
      <ul aria-label="Grade summary" style={{ display: "flex", gap: 12, flexWrap: "wrap", listStyle: "none", padding: 0, margin: 0 }}>
        {SHOW.map((g) => <li key={g}>{g === "UNKNOWN" ? "Not read" : `Grade ${g}`}: {view.summary[g]}</li>)}
        <li>Out of date: {view.summary.stale}</li>
      </ul>
      <label style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={showStale} onChange={(e) => setShowStale(e.target.checked)} /> Show out of date scans
      </label>
      {view.empty || rows.length === 0 ? <p style={{ margin: 0 }}>{view.emptyText}</p> : (
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table>
          <thead><tr><th>Domain</th><th>Grade</th><th>Owner</th><th>Last scanned</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.domain}>
                <td>{r.domain}</td>
                <td>{r.grade === "UNKNOWN" ? "Not read" : r.grade}</td>
                <td>{r.owner}</td>
                <td>{r.ageMinutes === null ? "Not scanned yet" : `${r.ageMinutes} min ago`}{r.stale ? " (out of date)" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
