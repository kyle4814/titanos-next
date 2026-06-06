"use client";

import Link from "next/link";

const LINKS = [
  { label: "Free Scan", href: "/scan", external: false },
  { label: "Compliance", href: "/compliance", external: false },
  { label: "AI Implementation", href: "/ai-delivery", external: false },
  { label: "Methodology", href: "/methodology", external: false },
  { label: "Our scan", href: "/our-scan", external: false },
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
        <div style={{ marginBottom: 14 }}>
          {LINKS.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ margin: "0 12px", color: "var(--dim)" }}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                style={{ margin: "0 12px", color: "var(--dim)" }}
              >
                {l.label}
              </Link>
            )
          )}
        </div>
        <div>
          {/* AES-15 — wordmark in Cinzel to match Nav + Hero */}
          <span style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}>
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
          ABN 34 318 502 254 · titanos.tech · powered by Claude Code
        </div>
      </div>
    </footer>
  );
}
