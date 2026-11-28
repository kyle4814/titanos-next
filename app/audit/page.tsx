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
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";
import W2c from "@/components/w2c/W2c";
import "@/components/g4/g4.css";

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
    <W2c>
     <div className="g4">
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
        title="A free chat about what a machine could carry for you."
        sub="You tell me what is eating your week. We work out together what is automatable in your business and what it is worth, and you get a free report to keep. No cost, no pitch deck, no obligation. Just a straight conversation."
        trustLine={
          <>
            <strong style={{ color: "var(--pe-gold)" }}>ABN 34 318 502 254</strong> · Kyle takes the call personally
          </>
        }
      />
      <Bluf replaced>
        A free half-hour with Kyle, then a free report on your business. You leave knowing what a machine can carry for you, and what that is worth.
      </Bluf>
      <Analogy k="healthcheck" />

      <SectionReveal className="pe-section">
        <div className="pe-page--narrow">
          <FlexNumber f={FLEX.fleetJobs} />
          <p className="pe-muted" style={{ lineHeight: 1.75, margin: "18px 0 0", textAlign: "center" }}>
            That is the machine I would be pointing at your repetitive work. Before you ask: I am Kyle Deligny, a sole
            trader (ABN 34 318 502 254), and I take the call myself. I touch nothing in your business on the call, nobody
            is replaced, your IT person stays in charge, and it costs nothing.
          </p>
          <div className="g4-cta">
            <AnimatedButton href="/book" variant="primary">
              Book a free call with Kyle →
            </AnimatedButton>
          </div>
        </div>
      </SectionReveal>

      {/* THE DOOR: the inscription states the trade plainly before anything is asked of them. */}
      <section className="pe-section">
        <div className="pe-page--narrow">
          <Inscription
            label="No cost · No pitch deck · No obligation"
            sub="Thirty minutes. You describe how the work actually gets done. I tell you which parts a machine can carry, and which parts shouldn't leave your hands. One thing worth bringing: the task you repeat every single week."
          >
            You bring the problem.
            <br />
            <span style={{ color: "var(--pe-gold)" }}>I bring the machine.</span>
          </Inscription>
        </div>
      </section>

      <OpenLoop>So what actually happens in that half-hour, and what do you walk away with?</OpenLoop>

      <SectionReveal className="pe-section">
        <div className="pe-page">
          <SectionHeading title="What happens on the call" lead="Four steps, and the last one is allowed to be a no." showKeyhole={false} />
          <div className="pe-grid">
            {STEPS.map((s) => (
              <div key={s.num} className="pe-card pe-card--pad g4-step">
                <span aria-hidden="true" className="g4-step__num">{s.num}</span>
                <p>{s.title}</p>
              </div>
            ))}
          </div>
          <p className="g4-note">
            No cost. No obligation. No pitch deck. If there&apos;s nothing worth automating yet,
            I&apos;ll tell you that too.
          </p>
          <div className="g4-cta">
            <AnimatedButton href="/book" variant="primary">
              Book a free call with Kyle →
            </AnimatedButton>
          </div>
        </div>
      </SectionReveal>

      <OpenLoop>How do you get hold of me? Probably more simply than you expect.</OpenLoop>

      <SectionReveal className="pe-section" id="message">
        <div className="pe-page pe-page--narrow">
          <SystemLabel tone="gold" style={{ textAlign: "center", marginBottom: 12 }}>
            Direct line. No gatekeeper
          </SystemLabel>
          <SectionHeading title="Would it be okay if you messaged me?" lead="Book a 20 minute call, send a message on Telegram, or just call. Whichever suits you. A no is welcome." showKeyhole={false} />
          <OperatorNote style={{ margin: "0 auto var(--pe-sp-6, 32px)" }}>
            I take every one of these myself. If automation isn&apos;t worth it for your
            business, I&apos;ll tell you on the call rather than sell you something that
            won&apos;t pay for itself.
          </OperatorNote>
          <BrisbaneClock />
          <ContactButtons />
        </div>
      </SectionReveal>

      <SectionReveal className="pe-section">
        <div className="pe-page pe-page--narrow">
          <SectionHeading title="Questions before you message" lead="The ones people ask first, answered here." showKeyhole={false} />
          <FaqItem question="Is this actually free?">
            Yes. No card, no obligation, no pitch deck. If there's nothing worth automating in your business yet, I'll tell you that too.
          </FaqItem>
          <FaqItem question="How long is the call?">
            As long as it takes to understand your business. The first call is booked for 20 minutes, and if you both want to keep going we keep going until it's clear.
          </FaqItem>
          <FaqItem question="What happens after the call?">
            If it makes sense, we start with your first system inside month 1 of a retainer. If it doesn't, you walk away with an honest answer and nothing owed.
          </FaqItem>
          <FaqItem question="Do I need to prepare anything?">
            No. Just be ready to talk about the most repetitive, time-consuming part of running your business.
          </FaqItem>
        </div>
      </SectionReveal>

      <SectionReveal className="pe-section" id="request">
        <div className="pe-page pe-page--narrow">
          <details className="g4-details">
            <summary>Prefer to write it all down first?</summary>
            <Suspense>
              <AuditRequestClient />
            </Suspense>
          </details>
        </div>
      </SectionReveal>

      {/* The seal closes the door page: the one Omega on this route. */}
      <SectionReveal className="pe-section">
        <OmegaSeal
          withStem={false}
          caption="One operator. One call. No sales team behind this door."
        />
      </SectionReveal>
      <FrontLoad/>
     </div>
    </W2c>
  );
}
