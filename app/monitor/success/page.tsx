import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import { OmegaSeal } from "@/components/Myth";
import MonitorPortalLink from "./MonitorPortalLink";
import "../monitor-pe.css";

// Site Fix 6, Stripe Checkout success redirect target. The Checkout
// Session is configured server-side to redirect here with
// ?session_id={CHECKOUT_SESSION_ID}. The client component below reads
// that and renders a portal link that hits ${API_BASE_URL}/billing/portal.

const baseMetadata: Metadata = {
  title: "Subscribed: Titanos Monitor",
  description:
    "Your Titanos Monitor subscription is active. First check runs within 1 business day; monthly security summary lands on the same date every month.",
  alternates: { canonical: "https://titanos.tech/monitor/success" },
  robots: { index: false, follow: false },
};

export const metadata: Metadata = withSeo("/monitor/success", baseMetadata);

const CADENCE = [
  { label: "First check", detail: "Runs within 1 business day" },
  { label: "Monthly summary", detail: "Same calendar date, every month after that" },
  { label: "Cancel", detail: "One click, no email, no retention call" },
];

export default function MonitorSuccessPage() {
  return (
    <div className="g18">
      <SectionReveal className="mo-wrap">
        <OmegaSeal caption="The watch has begun." />
        <h1>Something is now running on your behalf.</h1>
        <p className="mo-lead">
          Quietly, continuously, on the schedule below. The receipt is already in your inbox.
        </p>

        <p className="pe-eyebrow-line" style={{ marginTop: 40 }}>Cadence</p>
        <ul className="mo-cadence">
          {CADENCE.map((c) => (
            <li key={c.label} className="pe-card">
              <span className="mo-k">{c.label}</span>
              <span className="mo-v">{c.detail}</span>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: "var(--space-8)" }}>
          <MonitorPortalLink />
        </div>

        <p className="mo-note">
          Know someone who&apos;d want this? You can <a href="/refer">refer them here</a>, no pressure.
        </p>
      </SectionReveal>
    </div>
  );
}
