"use client";

// Inline partner-signup embed, same pattern as CalEmbed: the actual form
// (and its POST to /partner/signup) lives on vault.titanos.tech, loaded in
// an iframe — the fetch happens same-origin from inside the iframe, so a
// pre-existing zone-wide Cloudflare rule that strips
// Access-Control-Allow-Origin on cross-origin fetches (confirmed on
// /api/site-event too, not new to this page) never comes into play.
// Falls back to a plain link for anyone whose browser blocks third-party
// iframes.

const PARTNER_PORTAL_URL = "https://vault.titanos.tech/partner";

export default function ReferForm() {
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
          src={PARTNER_PORTAL_URL}
          title="Apply to the Titanos partner network"
          loading="lazy"
          style={{ width: "100%", height: 420, border: "none", display: "block" }}
        />
      </div>
      <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 10 }}>
        Form not loading?{" "}
        <a href={PARTNER_PORTAL_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>
          Open it in a new tab →
        </a>
      </p>
    </div>
  );
}
