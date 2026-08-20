"use client";

// Persistent mobile-only bottom CTA bar — the single highest-leverage
// conversion surface on a phone. Desktop already has the nav + in-page
// CTAs, so this stays hidden above the mobile breakpoint via CSS.
//
// RED-TEAM NOTE (see brief): this is a real, load-bearing conversion
// element, not a dark pattern — but it's the shape (fixed, persistent,
// bottom-of-screen) dark patterns love, so it's held to a specific
// bar: no pulsing/attention animation, no countdown, no fake urgency
// copy, nothing that grows/shrinks/flashes on its own. It just sits
// there, quietly tappable, every time. The only motion is a 0.15s
// press-feedback scale on tap, gated on prefers-reduced-motion.
// Keyboard focus relies on the sitewide a:focus-visible rule in
// globals.css (gold outline) — not restyled here, so it stays
// consistent with every other link on the site.

import Link from "next/link";
import { AUDIT_BOOK_HREF } from "@/lib/config";

export default function StickyMobileCta() {
  return (
    <div className="sticky-mobile-cta">
      <Link href={AUDIT_BOOK_HREF}>Book Free AI Audit Call</Link>
      <style>{`
        .sticky-mobile-cta {
          display: none;
        }
        @media (max-width: 720px) {
          .sticky-mobile-cta {
            display: block;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 40;
            padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
            background: rgb(10 7 7 / 0.92);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-top: 1px solid var(--gold-dim);
          }
          .sticky-mobile-cta a {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            width: 100%;
            background: var(--gold);
            color: var(--vault-black, #0a0a0a);
            font-family: var(--font-body), system-ui, sans-serif;
            font-weight: 600;
            font-size: 0.95rem;
            letter-spacing: 0.01em;
            text-decoration: none;
            border-radius: var(--radius-lg);
          }
        }
        @media (max-width: 720px) and (prefers-reduced-motion: no-preference) {
          .sticky-mobile-cta a { transition: transform 0.15s ease; }
          .sticky-mobile-cta a:active { transform: scale(0.97); }
        }
      `}</style>
    </div>
  );
}
