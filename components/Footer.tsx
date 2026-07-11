"use client";

import Link from "next/link";

const LINKS = [
  { label: "Free Scan", href: "/scan", external: false },
  { label: "Monitor", href: "/monitor", external: false },
  { label: "Compliance", href: "/compliance", external: false },
  { label: "AI Implementation", href: "/ai-delivery", external: false },
  { label: "Leads & Intelligence", href: "/leads", external: false },
  { label: "Methodology", href: "/methodology", external: false },
  { label: "Our scan", href: "/scan#self-scan", external: false },
  { label: "Evidence pack", href: "/our-evidence-pack", external: false },
  { label: "About", href: "/about", external: false },
  {
    label: "Book a call",
    href: "https://cal.com/kyle-deligny-msvz6s/15min",
    external: true,
  },
  { label: "Privacy", href: "/privacy", external: false },
  { label: "Terms", href: "/terms", external: false },
];

export default function Footer() {
  return (
    <footer
      style={{
        padding: "50px 20px",
        borderTop: "1px solid var(--border)",
        textAlign: "center",
        color: "var(--dim)",
        fontSize: "var(--fs-sm)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div className="container-vault">
        {/* MOB-03 — flex-wrap clean instead of 7 inline links wrapping ragged */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "10px 18px",
            marginBottom: 18,
          }}
        >
          {LINKS.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--dim)", padding: "4px 2px" }}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                style={{ color: "var(--dim)", padding: "4px 2px" }}
              >
                {l.label}
              </Link>
            )
          )}
        </div>
        <div>
          {/* AES-15 — wordmark in Cinzel to match Nav + Hero */}
          <span style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "0.1em" }}>
            TITANOS
          </span>
          {" · Kyle Deligny · Brisbane, Australia"}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.05em",
            color: "var(--dim)",
          }}
        >
          ABN 34 318 502 254 · I personally review every deliverable before it reaches you · titanos.tech
        </div>
      </div>
    </footer>
  );
}
