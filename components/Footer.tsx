"use client";

import Link from "next/link";

/**
 * Enterprise footer — three link columns + identity block.
 * Columns collapse to a centred single column under 640px (most
 * visitors are SMB owners on phones). All links unchanged from the
 * previous flat list; only the arrangement is new.
 */

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: "Services",
    links: [
      { label: "Free AI Audit", href: "/audit" },
      { label: "AI Partnership", href: "/ai-delivery" },
      { label: "Monitor", href: "/monitor" },
      { label: "Compliance", href: "/compliance" },
      { label: "Leads & Intelligence", href: "/leads" },
      { label: "Free Scan", href: "/scan" },
    ],
  },
  {
    heading: "Proof",
    links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Black Ice doctrine", href: "/black-ice" },
      { label: "Our scan", href: "/scan#self-scan" },
      { label: "Evidence pack", href: "/our-evidence-pack" },
      { label: "Free AI Readiness Guide (PDF)", href: "/ai-readiness-guide.pdf", external: true },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      {
        label: "Book a call",
        href: "https://cal.com/kyle-deligny-msvz6s/15min",
        external: true,
      },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

function FooterAnchor({ l }: { l: FooterLink }) {
  const style = {
    color: "var(--dim)",
    padding: "4px 0",
    display: "inline-block",
    minHeight: 28,
  } as const;
  return l.external ? (
    <a href={l.href} target="_blank" rel="noopener noreferrer" style={style}>
      {l.label}
    </a>
  ) : (
    <Link href={l.href} style={style}>
      {l.label}
    </Link>
  );
}

export default function Footer() {
  return (
    <footer
      style={{
        padding: "56px 20px 44px",
        borderTop: "1px solid var(--border)",
        color: "var(--dim)",
        fontSize: "var(--fs-sm)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div className="container-vault">
        <div className="footer-columns">
          {/* Identity block leads on desktop, sits on top on mobile */}
          <div className="footer-identity">
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                letterSpacing: "0.1em",
                color: "var(--gold)",
                fontSize: "var(--fs-h4)",
                marginBottom: 10,
              }}
            >
              TITANOS
            </div>
            <div style={{ lineHeight: 1.8 }}>
              Kyle Deligny · Brisbane, Australia
              <br />
              ABN 34 318 502 254
            </div>
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                fontFamily: "var(--font-display), Georgia, serif",
                fontStyle: "italic",
                color: "var(--gold-dim)",
                fontSize: "var(--fs-sm)",
                letterSpacing: "0.02em",
              }}
            >
              Built without asking. Kept honest by what you can check.
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--ice)",
                  fontSize: "var(--fs-xs)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                {col.heading}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <FooterAnchor l={l} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div
          style={{
            marginTop: 36,
            paddingTop: 18,
            borderTop: "1px solid var(--border)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.05em",
            color: "var(--dim)",
            textAlign: "center",
          }}
        >
          I personally review every deliverable before it reaches you · titanos.tech
        </div>
      </div>
    </footer>
  );
}
