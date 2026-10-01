"use client";

/**
 * MonitorCheckoutButton — Site Fix 2.
 *
 * The /monitor page CTAs use this. Posts {plan: "monthly"|"annual", domain}
 * to ${API_BASE_URL}/checkout/monitor; server creates a Stripe Checkout
 * Session and returns {url}. We redirect via window.location.
 *
 * The Worker REQUIRES a domain (400 invalid_domain without one: verified
 * live 2026-10-01, which sent every buyer to the email fallback). First
 * click reveals a domain field; the second submit goes to checkout.
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
import { isValidDomain, normaliseDomain } from "@/lib/monitorDomain";

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
  const [status, setStatus] = useState<"idle" | "asking" | "submitting" | "error">("idle");
  const [domain, setDomain] = useState("");
  const [invalid, setInvalid] = useState(false);

  const handle = async () => {
    if (status === "submitting") return;
    if (status === "idle") {
      setStatus("asking");
      return;
    }
    if (!isValidDomain(domain)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setStatus("submitting");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ plan, domain: normaliseDomain(domain) }),
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
      {status !== "idle" && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--fs-xs)", color: "var(--text)" }}>
          Your business domain (the one we monitor)
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="yourbusiness.com.au"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handle();
            }}
            aria-invalid={invalid || undefined}
            data-analytics={`monitor-checkout-domain-${plan}`}
            style={{
              padding: "10px 12px",
              minHeight: 44,
              minWidth: 260,
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${invalid ? "var(--gold)" : "var(--gold-dim)"}`,
              background: "transparent",
              color: "var(--ice)",
              fontSize: "var(--fs-sm)",
            }}
          />
          {invalid && (
            <span role="alert" style={{ color: "var(--gold)" }}>
              That doesn&apos;t look like a domain. Try something like yourbusiness.com.au
            </span>
          )}
        </label>
      )}
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
        {status === "submitting" ? "Opening checkout…" : status === "idle" ? label : "Continue to checkout"}
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
