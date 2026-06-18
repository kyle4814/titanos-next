"use client";

/**
 * MonitorCheckoutButton — Site Fix 2.
 *
 * The /monitor page CTAs use this. Posts {plan: "monthly"|"annual"} to
 * ${API_BASE_URL}/checkout/monitor; server creates a Stripe Checkout
 * Session and returns {url}. We redirect via window.location.
 *
 * No Stripe keys ever touch the client — server owns price logic.
 *
 * States: idle → submitting → (redirect | error). Error state surfaces
 * a single fallback link to email kyle@ with the plan in the subject —
 * matches the scan-form failure pattern. <noscript> exposes a visible
 * email fallback so users with JS off can still reach the offer.
 */

import { useState } from "react";
import { SITE } from "@/lib/config";

type Plan = "monthly" | "annual";

const ENDPOINT = `${SITE.API_BASE_URL}/checkout/monitor`;

function mailtoFallback(plan: Plan): string {
  const subject = encodeURIComponent(`Monitor subscription request (${plan})`);
  const body = encodeURIComponent(
    `Hi Kyle,\n\nI'd like to subscribe to Titanos Monitor (${plan}). My domain is:\n\n\n--\nSent from titanos.tech/monitor checkout fallback`,
  );
  return `mailto:${SITE.KYLE_EMAIL}?subject=${subject}&body=${body}`;
}

type Props = {
  plan: Plan;
  label: string;
  ariaLabel?: string;
  variant?: "primary" | "secondary";
};

export default function MonitorCheckoutButton({
  plan,
  label,
  ariaLabel,
  variant = "primary",
}: Props) {
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  const handle = async () => {
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error(`POST ${res.status}`);
      const data: { url?: string } = await res.json();
      if (!data.url) throw new Error("no url");
      window.location.assign(data.url);
    } catch {
      setStatus("error");
    }
  };

  const isPrimary = variant === "primary";

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <button
        type="button"
        onClick={handle}
        disabled={status === "submitting"}
        aria-label={ariaLabel ?? label}
        aria-busy={status === "submitting" || undefined}
        data-analytics={`monitor-checkout-${plan}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 28px",
          minHeight: 48,
          borderRadius: "var(--radius-sm)",
          border: `1px solid ${isPrimary ? "var(--gold)" : "var(--gold-dim)"}`,
          color: isPrimary ? "var(--gold)" : "var(--ice)",
          background: "transparent",
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          fontSize: "var(--fs-sm)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: status === "submitting" ? "wait" : "pointer",
          opacity: status === "submitting" ? 0.6 : 1,
        }}
      >
        {status === "submitting" ? "Opening checkout…" : label}
      </button>
      {status === "error" && (
        <span
          role="alert"
          data-analytics={`monitor-checkout-error-${plan}`}
          style={{ color: "var(--text)", fontSize: "var(--fs-xs)", lineHeight: 1.5 }}
        >
          Checkout couldn&apos;t open.{" "}
          <a
            href={mailtoFallback(plan)}
            style={{ color: "var(--ice)", textDecoration: "underline" }}
          >
            Email me directly →
          </a>
        </span>
      )}
      <noscript>
        <span style={{ color: "var(--dim)", fontSize: "var(--fs-xs)" }}>
          JavaScript off?{" "}
          <a
            href={mailtoFallback(plan)}
            style={{ color: "var(--ice)", textDecoration: "underline" }}
          >
            Email me to subscribe →
          </a>
        </span>
      </noscript>
    </span>
  );
}
