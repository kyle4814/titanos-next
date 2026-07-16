import type { Metadata } from "next";
import { Suspense } from "react";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import AuditRequestClient from "./client";

const META_TITLE = "Free AI Audit for Australian Businesses | Titanos";
const META_DESC = "A free AI audit of your business — a plain-English report on where AI can save you time and money, plus a technical appendix, delivered in 1 business day.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/audit" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/audit",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: META_TITLE,
    description: META_DESC,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const STEPS: ThreadStep[] = [
  {
    num: "I",
    title: "Input",
    body: "Tell me about your business and the most repetitive job eating your team's time.",
  },
  {
    num: "II",
    title: "AI Analysis",
    body: "I run it through the same analysis pipeline I use for paying clients — mapping where automation fits your actual workflow.",
  },
  {
    num: "III",
    title: "Human Review",
    body: "I personally review every finding before it goes out. No auto-generated report ever reaches you unchecked.",
  },
  {
    num: "IV",
    title: "Your Report",
    body: "A two-layer report: a plain-English summary anyone can read, plus a technical appendix for whoever runs your systems.",
  },
];

export default function AuditPage() {
  return (
    <>
      <PageHero
        badge="FREE · NO CARD · REPORT IN 1 BUSINESS DAY"
        title="Get your free AI audit."
        sub="A plain-English report on where AI can save your business time and money — plus a technical appendix, plus your top 3 opportunities. No cost, no obligation."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · personally
            reviewed by Kyle before it reaches you
          </>
        }
      />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="How It Works" lead="Four steps. One business day." />
          <GoldThread steps={STEPS} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="What You Get" />
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto",
              background: "var(--card)",
              border: "1px solid var(--gold-dim)",
              borderRadius: "var(--radius-md)",
              padding: "28px 26px",
            }}
          >
            <p style={{ color: "var(--text)", fontSize: "var(--fs-lg)", lineHeight: 1.7, marginBottom: 14 }}>
              <strong style={{ color: "var(--gold)" }}>Layer 1 — Executive summary:</strong> the
              opportunities I found, the likely impact, roughly how much time and money each one
              could save, and my recommendations — written so a non-technical owner understands it
              in seconds.
            </p>
            <p style={{ color: "var(--text)", fontSize: "var(--fs-lg)", lineHeight: 1.7, marginBottom: 14 }}>
              <strong style={{ color: "var(--gold)" }}>Layer 2 — Technical appendix:</strong> the
              analysis behind it, an automation map, and the technical approach — for whoever runs
              your systems.
            </p>
            <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
              Every audit ends with your <strong style={{ color: "var(--gold)" }}>top 3
              opportunities</strong> — and an offer to build the first one in month 1, if you want
              to go ahead.
            </p>
          </div>
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 20 }}>
            No catch — if there's nothing worth automating yet, I'll tell you that too.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }} id="request">
        <div className="container-vault">
          <Suspense>
            <AuditRequestClient />
          </Suspense>
        </div>
      </SectionReveal>
    </>
  );
}
