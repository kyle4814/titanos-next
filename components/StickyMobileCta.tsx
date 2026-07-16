"use client";

// Persistent mobile-only bottom CTA bar — the single highest-leverage
// conversion surface on a phone. Desktop already has the nav + in-page
// CTAs, so this stays hidden above the mobile breakpoint via CSS.

import { SITE } from "@/lib/config";

export default function StickyMobileCta() {
  return (
    <div className="sticky-mobile-cta">
      <a href={SITE.AUDIT_CALL_URL} target="_blank" rel="noopener noreferrer">
        Book Free AI Audit Call
      </a>
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
            font-weight: 700;
            font-size: 0.95rem;
            text-decoration: none;
            border-radius: 999px;
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
