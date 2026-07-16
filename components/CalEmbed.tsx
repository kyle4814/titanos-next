"use client";

// Inline cal.com booking widget so the audit call is booked without ever
// leaving the site. Falls back to a plain link for anyone whose browser
// blocks third-party iframes.

import { SITE } from "@/lib/config";

export default function CalEmbed() {
  const embedSrc = `${SITE.AUDIT_CALL_URL}?embed=true&theme=dark`;
  return (
    <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          background: "var(--card)",
        }}
      >
        <iframe
          src={embedSrc}
          title="Book your free AI audit call"
          loading="lazy"
          style={{ width: "100%", height: 720, border: "none", display: "block" }}
        />
      </div>
      <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 10 }}>
        Booking widget not loading?{" "}
        <a href={SITE.AUDIT_CALL_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>
          Open it in a new tab →
        </a>
      </p>
    </div>
  );
}
