import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import { OmegaSeal } from "@/components/Myth";
import { DISPLAY } from "@/lib/pricing";
import "../monitor-pe.css";

// Site Fix 6, Stripe Checkout cancel redirect target. No subscription
// was created. Graceful exit, route back to /monitor or /scan.

const baseMetadata: Metadata = {
  title: "Checkout cancelled: Titanos Monitor",
  description:
    "Checkout cancelled. No subscription was created. The free security check is still available if you'd like to see your business's gaps first.",
  alternates: { canonical: "https://titanos.tech/monitor/cancelled" },
  robots: { index: false, follow: false },
};

export const metadata: Metadata = withSeo("/monitor/cancelled", baseMetadata);

export default function MonitorCancelledPage() {
  return (
    <div className="g18">
      <SectionReveal className="mo-wrap">
        <OmegaSeal caption="Nothing happened. Nothing was charged." />
        <h1>The checkout closed. That&apos;s a fine place to stop.</h1>
        <p className="mo-lead">
          No subscription was created and no charge was made. If you&apos;d like to see your
          business&apos;s security gaps before deciding on {DISPLAY.MONITOR_MONTHLY}, the free
          check is the easier place to start.
        </p>

        <div className="mo-cta">
          <AnimatedButton href="/monitor" variant="primary">
            BACK TO MONITOR
          </AnimatedButton>
          <AnimatedButton href="/scan#request" variant="secondary">
            FREE SCAN FIRST
          </AnimatedButton>
        </div>

        <p className="mo-note">
          Questions? Email <a href="mailto:kyle@titanos.tech">kyle@titanos.tech</a> and a person reads it.
        </p>
      </SectionReveal>
    </div>
  );
}
