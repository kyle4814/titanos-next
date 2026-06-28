import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import { DISPLAY } from "@/lib/pricing";

// Site Fix 6 — Stripe Checkout cancel redirect target. No subscription
// was created. Graceful exit, route back to /monitor or /scan.

export const metadata: Metadata = {
  title: "Checkout cancelled — Titanos Monitor",
  description:
    "Checkout cancelled. No subscription was created. The free security check is still available if you'd like to see your business's gaps first.",
  alternates: { canonical: "https://titanos.tech/monitor/cancelled" },
  robots: { index: false, follow: false },
};

export default function MonitorCancelledPage() {
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
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--ice)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.18em",
            marginBottom: 12,
          }}
        >
          CHECKOUT CANCELLED
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
          No subscription was created.
        </h1>
        <p
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-body)",
            lineHeight: 1.75,
            marginBottom: 28,
          }}
        >
          You were not charged. If something went wrong in checkout, try again or email
          me. If you want to see your business&apos;s security gaps before committing to {DISPLAY.MONITOR_MONTHLY},
          the free check is the easier way to start.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/monitor" variant="primary">
            BACK TO MONITOR
          </AnimatedButton>
          <AnimatedButton href="/scan#request" variant="secondary">
            FREE SCAN FIRST
          </AnimatedButton>
        </div>
      </div>
    </SectionReveal>
  );
}
