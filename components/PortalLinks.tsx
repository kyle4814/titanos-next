import Link from "next/link";

// Server component: real <a href> links to the in-app sections that the client tabs also open.
// Without these, /app/billing, /app/estate and /app/partner exist only behind client-side tab state.
export const PORTAL_LINKS = [
  { href: "/app/billing", label: "Billing, invoices and your data" },
  { href: "/app/estate", label: "Estate" },
  { href: "/app/partner", label: "Partner" },
] as const;

export default function PortalLinks() {
  return (
    <nav aria-label="Owner portal sections" style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 24px", display: "flex", gap: 12, flexWrap: "wrap" }}>
      {PORTAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>{l.label}</Link>
      ))}
    </nav>
  );
}
