"use client";

// Partner-signup link-out card (was an iframe embed; see the comment above the return).
// (and its POST to /partner/signup) lives on vault.titanos.tech, loaded in
// an iframe — the fetch happens same-origin from inside the iframe, so a
// pre-existing zone-wide Cloudflare rule that strips
// Access-Control-Allow-Origin on cross-origin fetches (confirmed on
// /api/site-event too, not new to this page) never comes into play.
// Falls back to a plain link for anyone whose browser blocks third-party
// iframes.
//
// ?ref=<code> forwards through to the iframe unchanged — that's how an
// existing partner's invite link (titanos.tech/refer?ref=xxx) attributes a
// new signup back to them. Attribution only, never commission for it (see
// partner_terms.md — no paying for recruiting partners).
//
// ?src=<tag> also forwards through — this is Kyle's OWN recruitment
// channel tag (e.g. "linkedin", "dm"), separate from ?ref= — it answers
// "which of MY outreach channels actually works," not "who gets credit."

import { useEffect, useState } from "react";

const PARTNER_PORTAL_URL = "https://vault.titanos.tech/partner";

export default function ReferForm() {
  const [iframeSrc, setIframeSrc] = useState(PARTNER_PORTAL_URL);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const src = params.get("src");
    const q = new URLSearchParams();
    if (ref) q.set("ref", ref);
    if (src) q.set("src", src);
    if (q.toString()) setIframeSrc(`${PARTNER_PORTAL_URL}?${q.toString()}`);
  }, []);

  // The vault answers with X-Frame-Options: SAMEORIGIN, so an iframe renders a blocked box and a console error (L6 defect
  // found 2026-10-09). A direct link-out card carries the same ?ref=/?src= attribution without the dead frame.
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid var(--gold-dim)",
          borderRadius: "var(--radius-md)",
          background: "var(--card)",
          padding: "28px 24px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0 0 18px", color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
          The partner application opens in its own secure page. It takes about two minutes.
        </p>
        <a
          href={iframeSrc}
          target="_blank"
          rel="noopener noreferrer"
         
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "0 28px", borderRadius: "var(--radius-sm)", background: "var(--gold)", color: "#0a0a0a", fontWeight: 600, textDecoration: "none" }}
        >
          Apply to the partner network →
        </a>
      </div>
    </div>
  );
}
