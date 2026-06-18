import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import MonitorPortalLink from "./MonitorPortalLink";

// Site Fix 6 — Stripe Checkout success redirect target. The Checkout
// Session is configured server-side to redirect here with
// ?session_id={CHECKOUT_SESSION_ID} — the client component below reads
// that and renders a portal link that hits ${API_BASE_URL}/billing/portal.

export const metadata: Metadata = {
  title: "Subscribed — Titanos Monitor",
  description:
    "Your Titanos Monitor subscription is active. First scan runs within 1 business day; monthly delta lands on the same date every month.",
  alternates: { canonical: "https://titanos.tech/monitor/success" },
  robots: { index: false, follow: false },
};

export default function MonitorSuccessPage() {
  return (
    <SectionReveal
      style={{
        textAlign: "center",
        padding: "var(--space-30) 20px",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div
        style={{
          maxWidth: "var(--maxw-prose)",
          margin: "0 auto",
          padding: "36px 32px",
          background: "var(--card)",
          border: "1px solid var(--gold)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.18em",
            marginBottom: 12,
          }}
        >
          SUBSCRIBED
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            fontWeight: 700,
            letterSpacing: "0.04em",
            marginBottom: 18,
            lineHeight: 1.3,
          }}
        >
          You&apos;re in.
        </h1>
        <p
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-body)",
            lineHeight: 1.75,
            marginBottom: 18,
          }}
        >
          Your first scan runs within 1 business day. Your monthly delta lands on the
          same calendar date every month after that. The receipt is already in your
          inbox.
        </p>
        <p
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-body)",
            lineHeight: 1.75,
            marginBottom: 26,
          }}
        >
          Manage your subscription, update payment, or cancel any time — one click,
          no email, no retention call.
        </p>
        <MonitorPortalLink />
      </div>
    </SectionReveal>
  );
}
