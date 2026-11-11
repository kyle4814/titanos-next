// Sections moved off the homepage on 2026-11-10 (the phone page was 37,141 px tall, about 41 screens at 412 x 915).
// The JSX and copy are unchanged from app/page.tsx at d6c7c57ad; each one now renders on the page that owns its topic:
//   ProofCharts      -> /proof         (cost curve, the measured flex cards, the market ceiling)
//   PartnershipStack -> /pricing       (tier quiz + retainer cards, every door, the ROI estimator)
//   HowSections      -> /how-it-works  (BLUF + pillars, the four costs, the journey)
//   WhatWeBuild      -> /ai-delivery
//   OperatorSections -> /about         (Privacy by Design, the doctrine behind the delivery)
// The homepage keeps the hero, trust strip, free consultation, front-loaded answers and a link to each of these.
// This file: OperatorSections.
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import AnimatedButton from "@/components/AnimatedButton";



export function OperatorSections() {
  return (
    <>
    {/* PRIVACY BY DESIGN: the foundation */}
    <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading title="Privacy by Design" />
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
          <p style={{ color: "var(--gold)", fontSize: "var(--fs-lg)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 18 }}>
            &ldquo;Every AI shop can build you a chatbot. None of them can tell you it&apos;s
            privacy-compliant by design, because compliance is my other practice.&rdquo;
          </p>
          <ul style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
            <li>Every AI system we build is privacy-compliant by design</li>
            <li>Privacy policy and automated-decision disclosure handled as part of onboarding</li>
            <li>One person handles both AI and compliance, so nothing falls through the gap between them</li>
            <li>I respond in minutes and build in days, not months</li>
          </ul>
        </div>
        <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", maxWidth: "var(--maxw-prose)", margin: "18px auto 0", lineHeight: 1.7 }}>
          Kyle Deligny, one operator, Brisbane. ABN 34 318 502 254. Personally accountable for
          every system shipped.
        </p>
        <p style={{ textAlign: "center", marginTop: 24 }}>
          <AnimatedButton href="/compliance" variant="secondary">See the standalone privacy deep-dive →</AnimatedButton>
        </p>
      </div>
    </SectionReveal>

    <div className="divider-gold" />

    {/* THE OPERATOR: myth section, deliberately a different layer of the site */}
    <SectionReveal style={{ padding: "var(--space-30) 20px", position: "relative", zIndex: 2 }}>
      <div
        style={{
          maxWidth: "var(--maxw-wide)",
          margin: "0 auto",
          border: "1px solid rgb(var(--gold-rgb) / 0.2)",
          borderRadius: "var(--radius-md)",
          background: "rgb(var(--gold-rgb) / 0.02)",
          padding: "clamp(28px, 4vw, 56px) clamp(20px, 4vw, 48px)",
        }}
      >
        <p
          className="font-mono"
          style={{
            textAlign: "center",
            color: "var(--gold-dim)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          The doctrine behind the delivery
        </p>
        <h2
          data-phi-reveal
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 400,
            fontStyle: "italic",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            textAlign: "center",
            maxWidth: "var(--maxw-content)",
            margin: "0 auto 28px",
            lineHeight: 1.35,
          }}
        >
          Built from a phone. Solo. Pre-revenue. No permission asked.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
            maxWidth: "var(--maxw-wide)",
            margin: "0 auto 30px",
          }}
        >
          <div>
            <p className="font-mono" style={{ color: "var(--gold-dim)", fontSize: "var(--fs-xs)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
              The operator
            </p>
            <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8 }}>
              One person built TITANOS from a phone. No office, no team, no
              one&apos;s permission required. Capability was never supposed to be something
              you have to be given. It is something you build.
            </p>
          </div>
          <div>
            <p className="font-mono" style={{ color: "var(--gold-dim)", fontSize: "var(--fs-xs)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
              The division of labour
            </p>
            <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8 }}>
              The machine carries the repetition, the plumbing, the noise.
              The human decides what matters and stays accountable for it. AI is
              infrastructure here, never a character standing in for you.
            </p>
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "var(--ice)",
            fontSize: "var(--fs-lg)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 30px",
            lineHeight: 1.7,
          }}
        >
          Automate the known. Preserve human judgement for the unknown.{" "}
          <span style={{ color: "var(--gold)" }}>That is the whole method, and everything
          we build for you runs on it too.</span>
        </p>

        <div style={{ textAlign: "center" }}>
          <a
            href="/black-ice"
            data-analytics="black_ice_view"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: "var(--gold)",
              fontSize: "var(--fs-body)",
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid var(--gold-dim)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 22px",
            }}
          >
            Read the doctrine: Black Ice →
          </a>
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 12 }}>
            Free field guide. The actual operating system behind every build, not a lead
            magnet.
          </p>
        </div>
      </div>
    </SectionReveal>
    </>
  );
}
