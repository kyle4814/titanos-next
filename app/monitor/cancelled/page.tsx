import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import { OmegaSeal } from "@/components/Myth";
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
      style={{ padding: "var(--space-30) 20px", position: "relative", zIndex: 2, textAlign: "center" }}
    >
      <OmegaSeal caption="Nothing happened. Nothing was charged." />

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
        The checkout closed. That&apos;s a fine place to stop.
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
        No subscription was created and no charge was made. If you&apos;d like to see your
        business&apos;s security gaps before deciding on {DISPLAY.MONITOR_MONTHLY}, the free
        check is the easier place to start.
      </p>

      <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
        <AnimatedButton href="/monitor" variant="primary">
          BACK TO MONITOR
        </AnimatedButton>
        <AnimatedButton href="/scan#request" variant="secondary">
          FREE SCAN FIRST
        </AnimatedButton>
      </div>

      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-sm)",
          marginTop: "var(--space-8)",
          maxWidth: "var(--maxw-prose)",
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: 1.7,
        }}
      >
        Questions? Email{" "}
        <a href="mailto:kyle@titanos.tech" style={{ color: "var(--gold)" }}>
          kyle@titanos.tech
        </a>{" "}
        — a person reads it.
      </p>
    </SectionReveal>
  );
}
