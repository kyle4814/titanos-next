import type { ReactNode } from "react";
import Link from "next/link";
import type { SeatAnchor } from "@/lib/seatAnchors";

// In-page anchor sections for a portal seat page. Server component: no state, no fetch, no model call.
// Renders an "On this page" nav (every anchor is linked) and one section per anchor, honest about "coming".
export default function SeatAnchors({ rows, slots }: { rows: SeatAnchor[]; slots?: Record<string, ReactNode> }) {
  if (!rows.length) return null;
  const wrap = { maxWidth: 960, margin: "0 auto", padding: "0 20px 60px", display: "flex", flexDirection: "column", gap: 16 } as const;
  const card = { border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8, scrollMarginTop: 80 } as const;
  return (
    <div style={wrap}>
      <nav aria-label="On this page" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {rows.map((r) => <Link key={r.id} href={`#${r.id}`} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>{r.title}</Link>)}
      </nav>
      {rows.map((r) => (
        <section key={r.id} id={r.id} aria-labelledby={`${r.id}-h`} style={card}>
          <h2 id={`${r.id}-h`} style={{ margin: 0 }}>{r.title}</h2>
          <small>{r.status === "live" ? "Built" : "Coming, not built yet"}</small>
          <p style={{ margin: 0 }}>{r.body}</p>
          {slots?.[r.id]}
        </section>
      ))}
    </div>
  );
}
