import { provenance, longDate } from "@/lib/provenance";

/** EV6 stamp: the system and the date behind the numbers on this page. */
export default function Provenance({ route }: { route: string }) {
  const p = provenance(route);
  return (
    <aside
      data-provenance={route}
      aria-label="Where these numbers come from"
      style={{ maxWidth: 860, margin: "0 auto", padding: "10px 20px", color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6, borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", position: "relative", zIndex: 2 }}
    >
      <strong style={{ color: "var(--gold)" }}>Source of the numbers:</strong> {p.system}, read {longDate(p.date)}. {p.scope} Record: {p.source}.
    </aside>
  );
}
