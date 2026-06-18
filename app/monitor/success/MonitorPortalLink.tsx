"use client";

/**
 * MonitorPortalLink — reads ?session_id={CHECKOUT_SESSION_ID} (Stripe
 * template variable) from the URL and emits a portal link that hits
 * ${API_BASE_URL}/billing/portal?session={id}. The server resolves the
 * session to the customer and creates a Stripe-hosted Customer Portal
 * session (one-click cancel, no retention coupons — see Server Fix 3).
 */

import { useEffect, useState } from "react";
import { SITE } from "@/lib/config";

export default function MonitorPortalLink() {
  const [href, setHref] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) {
      setHref(`${SITE.API_BASE_URL}/billing/portal?session=${encodeURIComponent(sid)}`);
    }
  }, []);

  if (!href) {
    return (
      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-sm)",
          lineHeight: 1.6,
        }}
      >
        Reply to your Stripe receipt or email{" "}
        <a
          href={`mailto:${SITE.KYLE_EMAIL}`}
          style={{ color: "var(--ice)", textDecoration: "underline" }}
        >
          {SITE.KYLE_EMAIL}
        </a>{" "}
        to manage your subscription.
      </p>
    );
  }

  return (
    <a
      href={href}
      data-analytics="monitor-portal-link"
      style={{
        display: "inline-flex",
        padding: "14px 28px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--gold)",
        color: "var(--gold)",
        fontFamily: "var(--font-display), Georgia, serif",
        fontStyle: "italic",
        fontSize: "var(--fs-sm)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        textDecoration: "none",
      }}
    >
      Manage your subscription →
    </a>
  );
}
