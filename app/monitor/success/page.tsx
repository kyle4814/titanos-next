import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import { SystemLabel, OmegaSeal } from "@/components/Myth";
import MonitorPortalLink from "./MonitorPortalLink";

// Site Fix 6 — Stripe Checkout success redirect target. The Checkout
// Session is configured server-side to redirect here with
// ?session_id={CHECKOUT_SESSION_ID} — the client component below reads
// that and renders a portal link that hits ${API_BASE_URL}/billing/portal.

export const metadata: Metadata = {
  title: "Subscribed — Titanos Monitor",
  description:
    "Your Titanos Monitor subscription is active. First check runs within 1 business day; monthly security summary lands on the same date every month.",
  alternates: { canonical: "https://titanos.tech/monitor/success" },
  robots: { index: false, follow: false },
};

const CADENCE = [
  { label: "First check", detail: "Runs within 1 business day" },
  { label: "Monthly summary", detail: "Same calendar date, every month after that" },
  { label: "Cancel", detail: "One click, no email, no retention call" },
];

export default function MonitorSuccessPage() {
  return (
    <SectionReveal
      style={{ padding: "var(--space-30) 20px", position: "relative", zIndex: 2, textAlign: "center" }}
    >
      <OmegaSeal caption="The watch has begun." />

      <h1
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          fontWeight: 400,
          color: "var(--ice)",
          fontSize: "var(--fs-h3)",
          marginTop: 28,
          marginBottom: 12,
        }}
      >
        Something is now running on your behalf.
      </h1>
      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-body)",
          maxWidth: "var(--maxw-prose)",
          margin: "0 auto var(--space-8)",
          lineHeight: 1.7,
        }}
      >
        Quietly, continuously, on the schedule below. The receipt is already in your inbox.
      </p>

      <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", textAlign: "left" }}>
        <SystemLabel tone="gold" style={{ textAlign: "center", marginBottom: 16 }}>
          Cadence
        </SystemLabel>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {CADENCE.map((c) => (
            <li key={c.label} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              <span className="label-system" style={{ color: "var(--gold-dim)", display: "block", marginBottom: 4 }}>
                {c.label}
              </span>
              <span style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                {c.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: "var(--space-8)" }}>
        <MonitorPortalLink />
      </div>
    </SectionReveal>
  );
}
