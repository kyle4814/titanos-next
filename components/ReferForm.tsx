"use client";

// Inline partner-signup embed, same pattern as CalEmbed: the actual form
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

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid var(--gold-dim)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          background: "var(--card)",
        }}
      >
        <iframe
          src={iframeSrc}
          title="Apply to the Titanos partner network"
          loading="lazy"
          style={{ width: "100%", height: 420, border: "none", display: "block" }}
        />
      </div>
      <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 10 }}>
        Form not loading?{" "}
        <a href={iframeSrc} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>
          Open it in a new tab →
        </a>
      </p>
    </div>
  );
}
