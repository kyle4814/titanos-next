"use client";

/**
 * DigitalBuyButton: one click to Stripe Checkout for a downloadable product.
 * Posts {slug} (never a price) to the digital Worker, which creates the Checkout Session from its own catalogue and returns {url}.
 * States: idle -> submitting -> (redirect | error). The error state offers an email fallback so a buyer is never stranded.
 */

import { useState } from "react";
import { SITE } from "@/lib/config";
import { DIGITAL_API_BASE } from "@/lib/shop/digital_api";

const ENDPOINT = `${DIGITAL_API_BASE}/digital/checkout`;

export default function DigitalBuyButton({ slug, name, label = "BUY NOW" }: { slug: string; name: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const go = async () => {
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ slug }) });
      if (!res.ok) throw new Error(`POST ${res.status}`);
      const data: { url?: string } = await res.json();
      if (!data.url || !/^https:\/\/checkout\.stripe\.com\//.test(data.url)) throw new Error("no url");
      window.location.assign(data.url);
    } catch {
      setStatus("error");
    }
  };
  const mail = `mailto:${SITE.KYLE_EMAIL}?subject=${encodeURIComponent(`Order: ${name}`)}`;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={go}
        disabled={status === "submitting"}
        aria-busy={status === "submitting" || undefined}
        data-analytics={`digital-buy-${slug}`}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 28px", minHeight: 48,
          borderRadius: "var(--radius-sm)", border: "1px solid var(--gold)", color: "var(--gold)", background: "transparent",
          fontFamily: "var(--font-display), Georgia, serif", fontStyle: "italic", fontSize: "var(--fs-sm)", letterSpacing: "0.08em",
          textTransform: "uppercase", cursor: status === "submitting" ? "wait" : "pointer", opacity: status === "submitting" ? 0.6 : 1,
        }}
      >
        {status === "submitting" ? "Opening checkout…" : `${label} →`}
      </button>
      {status === "error" && (
        <span role="alert" style={{ color: "var(--text)", fontSize: "var(--fs-xs)", lineHeight: 1.5 }}>
          Checkout couldn&apos;t open. <a href={mail} style={{ color: "var(--ice)", textDecoration: "underline" }}>Email me and I will sort it →</a>
        </span>
      )}
      <noscript>
        <span style={{ color: "var(--dim)", fontSize: "var(--fs-xs)" }}>JavaScript off? <a href={mail} style={{ color: "var(--ice)", textDecoration: "underline" }}>Email me to order →</a></span>
      </noscript>
    </span>
  );
}
