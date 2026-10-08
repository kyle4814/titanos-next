import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import { Suspense } from "react";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import AnimatedButton from "@/components/AnimatedButton";
import ContactButtons from "@/components/ContactButtons";
import FaqItem from "@/components/FaqItem";
import BrisbaneClock from "@/components/BrisbaneClock";
import AuditRequestClient from "./client";
import { Inscription, SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";

const META_TITLE = "Free AI Audit Call for Australian Businesses | Titanos";
const META_DESC =
  "A free call with Kyle. Tell him what's eating your week and work out what is automatable in your business, and what it's worth. No cost, no obligation.";

const baseMetadata: Metadata = {
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

export const metadata: Metadata = withSeo("/audit", baseMetadata);

const STEPS = [
  { num: "01", title: "You tell me how your business actually runs day to day" },
  { num: "02", title: "We find the repetitive work that's costing you time and money" },
  { num: "03", title: "I tell you straight what's automatable, what it'd take, and what it's worth" },
  { num: "04", title: "If it makes sense, we start your first system in month 1. If it doesn't, I'll say so" },
];

export default function AuditPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Free AI Audit Call",
    provider: { "@type": "Organization", name: "Titanos" },
    serviceType: "AI Consulting",
    description: "Free, no-obligation call to work out what's automatable in a business and what it's worth.",
    areaServed: ["AU", "NZ", "SG"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is this actually free?",
        acceptedAnswer: { "@type": "Answer", text: "Yes. No card, no obligation, no pitch deck. If there's nothing worth automating in the business yet, that gets said too." },
      },
      {
        "@type": "Question",
        name: "How long is the call?",
        acceptedAnswer: { "@type": "Answer", text: "Long enough to actually understand the business. Not capped at a fixed slot like a normal sales call." },
      },
      {
        "@type": "Question",
        name: "What happens after the call?",
        acceptedAnswer: { "@type": "Answer", text: "If it makes sense, the first system starts inside month 1 of a retainer. If it doesn't, an honest answer and nothing owed." },
      },
      {
        "@type": "Question",
        name: "Do I need to prepare anything?",
        acceptedAnswer: { "@type": "Answer", text: "No. Just be ready to talk about the most repetitive, time-consuming part of running the business." },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PageHero
        badge="FREE · NO OBLIGATION · NO PITCH DECK"
        title="Get your free AI consultation and report."
        sub="You tell me what's eating your week. We work out together what's automatable in your business, and what it's worth. No cost, no pitch deck, no obligation. Just a straight conversation."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · Kyle takes the call personally
          </>
        }
      />
      <Bluf replaced>
        A free half-hour with Kyle, then a free report on your business. You leave knowing what a machine can carry for you, and what that is worth.
      </Bluf>
      <Analogy k="healthcheck" />

      <section style={{ padding: "0 20px 28px", position: "relative", zIndex: 2, textAlign: "center" }}>
        <AnimatedButton href="#message" variant="primary">
          Message Kyle for a free consultation and report →
        </AnimatedButton>
      </section>

      {/* THE DOOR — this page is where an observer becomes a participant.
          The inscription states the trade plainly before anything is asked
          of them. */}
      <section style={{ padding: "var(--space-6) 20px var(--space-12)", position: "relative", zIndex: 2 }}>
        <Inscription
          label="No cost · No pitch deck · No obligation"
          sub="Thirty minutes. You describe how the work actually gets done. I tell you which parts a machine can carry, and which parts shouldn't leave your hands. One question to bring: what's the task you repeat every single week?"
        >
          You bring the problem.
          <br />
          <span style={{ color: "var(--gold)" }}>I bring the machine.</span>
        </Inscription>
      </section>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="What happens on the call" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 18,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {STEPS.map((s) => (
              <div
                key={s.num}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "22px 24px",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 34,
                    height: 24,
                    padding: "0 8px",
                    background: "rgb(var(--gold-rgb) / 0.12)",
                    border: "1px solid var(--gold-dim)",
                    color: "var(--gold)",
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: "var(--fs-xs)",
                    letterSpacing: "0.08em",
                    borderRadius: 999,
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  {s.num}
                </span>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.65, margin: 0 }}>
                  {s.title}
                </p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 28, maxWidth: "var(--maxw-prose)", marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
            No cost. No obligation. No pitch deck. If there&apos;s nothing worth automating yet,
            I&apos;ll tell you that too.
          </p>
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <AnimatedButton href="#message" variant="primary">
              Message Kyle for a free consultation and report →
            </AnimatedButton>
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }} id="message">
        <div className="container-vault">
          <SystemLabel tone="gold" style={{ textAlign: "center", marginBottom: 12 }}>
            Direct line. No gatekeeper
          </SystemLabel>
          <SectionHeading title="Message Kyle now" lead="Send a message on Telegram, or just call. No booking, no forms, no waiting for a slot." />
          <OperatorNote style={{ margin: "0 auto var(--space-8)" }}>
            I take every one of these myself. If automation isn&apos;t worth it for your
            business, I&apos;ll tell you on the call rather than sell you something that
            won&apos;t pay for itself.
          </OperatorNote>
          <BrisbaneClock />
          <ContactButtons />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
          <SectionHeading title="Questions before you message" />
          <FaqItem question="Is this actually free?">
            Yes. No card, no obligation, no pitch deck. If there's nothing worth automating in your business yet, I'll tell you that too.
          </FaqItem>
          <FaqItem question="How long is the call?">
            As long as it takes to understand your business. There's no booking and no fixed slot, so we talk until it's clear.
          </FaqItem>
          <FaqItem question="What happens after the call?">
            If it makes sense, we start with your first system inside month 1 of a retainer. If it doesn't, you walk away with an honest answer and nothing owed.
          </FaqItem>
          <FaqItem question="Do I need to prepare anything?">
            No. Just be ready to talk about the most repetitive, time-consuming part of running your business.
          </FaqItem>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }} id="request">
        <div className="container-vault">
          <details>
            <summary
              style={{
                cursor: "pointer",
                textAlign: "center",
                fontFamily: "var(--font-body), system-ui, sans-serif",
                fontWeight: 500,
                fontSize: "var(--fs-body)",
                color: "var(--ice)",
                listStyle: "none",
                marginBottom: 24,
              }}
            >
              Prefer to write it all down first?
            </summary>
            <Suspense>
              <AuditRequestClient />
            </Suspense>
          </details>
        </div>
      </SectionReveal>

      {/* The seal closes the door page — the one Omega on this route. */}
      <SectionReveal style={{ padding: "0 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <OmegaSeal
          withStem={false}
          caption="One operator. One call. No sales team behind this door."
          style={{ marginTop: "var(--space-8)" }}
        />
      </SectionReveal>
      <FrontLoad/>
    </>
  );
}
