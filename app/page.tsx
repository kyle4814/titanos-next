import type { Metadata } from "next";
import Hero from "@/components/hero/Hero";
import { withSeo } from "@/lib/seo";
import { ARIANCE, arianceVisible, ariancePath } from "@/lib/case-studies/ariance";
import SpaceImage from "@/components/SpaceImage";
import FlowThread from "@/components/flow/FlowThread";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import NumberCounter from "@/components/NumberCounter";
import AnimatedButton from "@/components/AnimatedButton";
import { STATS } from "@/lib/stats";
import HeroScrollCue from "@/components/HeroScrollCue";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import StatsTicker from "@/components/StatsTicker";
import HoursCounter from "@/components/HoursCounter";
import ContactButtons from "@/components/ContactButtons";
import { BOOK_HREF } from "@/lib/config";
import { Inscription } from "@/components/Myth";
import PriceStrip from "@/components/home/PriceStrip";
import { OpenLoop } from "@/components/FlexBlock";

import { Analogy, FrontLoad, FreeStart } from "@/components/SalesKit";
import PricingGlance from "@/components/home/PricingGlance";

const baseMetadata: Metadata = {
  title: "Titanos | AI automation and Privacy Act compliance, Brisbane",
  description:
    "One operator finds the manual task eating your week and builds the system that does it. Free consultation, free security scan, fixed-price Privacy Act compliance.",
  alternates: { canonical: "https://titanos.tech/" },
  openGraph: {
    title: "Titanos | AI automation and Privacy Act compliance",
    description:
      "Free consultation and report, free security scan, fixed-price Privacy Act compliance. One operator, Brisbane, ABN 34 318 502 254.",
    url: "https://titanos.tech/",
    siteName: "Titanos",
    type: "website",
  },
};

export const metadata: Metadata = withSeo("/", baseMetadata);

const AUDIT_STEPS: ThreadStep[] = [
  { num: "I", title: "You tell me how your business runs", body: "How your day-to-day actually works, in your own words." },
  { num: "II", title: "We find the repetitive work", body: "Together we find what's costing you the most time and money." },
  { num: "III", title: "I tell you straight", body: "What's automatable, what it'd take, and what it's worth. If it's not worth it, I'll say so." },
  { num: "IV", title: "We start in month 1", body: "If it makes sense, we build your first system inside month 1 of a retainer." },
];

// The homepage stays short: each long section lives on the page that owns its topic (components/home/moved/).
const GO_DEEPER = [
  { href: "/proof", title: "The proof", body: "The cost curve, the measured cards and the replayed build, each with its source." },
  { href: "/pricing", title: "Partnerships and prices", body: "Pick a partnership, see every door from free to enterprise, and test the cost of manual work with your own figures." },
  { href: "/how-it-works", title: "How it works", body: "Where the manual work quietly costs you, and the one path from first message to a running system." },
  { href: "/ai-delivery", title: "What we automate", body: "Leads, support, bookings, content, follow-up, reporting and admin." },
  { href: "/about", title: "Who builds it", body: "Privacy by Design, and the doctrine behind every delivery." },
  { href: "/learning-loop", title: "The learning loop", body: "Every turn of the loop leaves a receipt." },
];


export default function Home() {
  return (
    <>
      {/* ═══ HERO ═══ */}
      <FlowThread />
      <Hero />
      <PriceStrip />
      {/* FLOW STAGE: space image is a full-bleed BACKGROUND layers (slow parallax, feathered masks, breathing), not blocks. */}
      <div className="fx-bleed">
        <div className="fx-bg fx-bg--img" data-flow="0.22">
          <div className="fx-pulse fx-pulse--slow"><SpaceImage id="webb-cosmic-cliffs" sizes="100vw" /></div>
        </div>
        <a className="fx-bleed__cap" href="/credits#webb-cosmic-cliffs">NASA, ESA, CSA, STScI</a>
      {/* FIND YOUR OFFER: early door to the finder and the full list. */}
      <section
        aria-label="Find the right offer"
        style={{ padding: "var(--space-6) 20px 0", position: "relative", zIndex: 2 }}
      >
        <div
          className="fx-soft"
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            textAlign: "center",
            padding: "28px 20px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h3, 1.5rem)",
              margin: "0 0 10px",
            }}
          >
            Find the right offer in 30 seconds
          </h2>
          <p style={{ color: "var(--ice)", lineHeight: 1.65, margin: "0 0 18px" }}>
            Answer a few plain questions and get pointed to the page that fits your business. It runs
            in your browser, nothing is sent anywhere, and a no is fine.
          </p>
          <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <AnimatedButton href="/find" variant="primary">
              Find the right offer →
            </AnimatedButton>
            <AnimatedButton href="/offers" variant="secondary">
              See every offer
            </AnimatedButton>
          </div>
        </div>
      </section>
      </div>

      {/* THE OPENING: the threshold. Inscription primitive, the
          claim is set INTO the page (lintel rules + stone recess), not
          printed on it. See components/Myth.tsx for the vocabulary. */}
      <section
        aria-label="What TITANOS is"
        style={{ padding: "var(--space-6) 20px var(--space-12)", position: "relative", zIndex: 2 }}
      >
        <Inscription
          label="US$0.97 to US$0.12 per job · recorded 8 October 2026"
          sub="We did not buy a bigger machine. We found the waste, turned each lesson into code, and ran it again. The proof is one tap away, with the source of every number."
        >
          The machine carries the complexity.
          <br />
          <span style={{ color: "var(--gold)" }}>You keep the judgement.</span>
        </Inscription>
      </section>

      <StatsTicker />

      <section style={{ padding: "0 20px 28px", position: "relative", zIndex: 2 }}>
        <p
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "var(--fs-lg)",
            color: "var(--ice)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 26px",
            textAlign: "center",
            lineHeight: 1.65,
          }}
        >
          <strong style={{ color: "var(--gold)" }}>You know the work that eats your week.</strong>{" "}
          Missed enquiries. Quotes nobody follows up on. Compliance risk you cannot see until it
          costs you. I run the same system on my own business first, I show you what it did, and
          then I build yours, privacy-compliant by design. Your team stays. They get their hours back.
        </p>

        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <AnimatedButton href={BOOK_HREF} variant="primary">
              Book a free call with Kyle →
            </AnimatedButton>
            <AnimatedButton href="/how-it-works" variant="secondary">
              See how it works →
            </AnimatedButton>
          </div>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12 }}>
            No cost · No obligation
          </p>
        </div>
      </section>

      <SectionReveal
        as="div"
        style={{ padding: "24px 20px 40px", position: "relative", zIndex: 2 }}
      >
        <div
          data-phi-reveal
          className="trust-bar"
          style={{
            maxWidth: "var(--maxw-wide)",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 0,
            border: "1px solid rgb(var(--gold-rgb) / 0.15)",
            borderRadius: "var(--radius-md)",
            background: "rgb(var(--gold-rgb) / 0.02)",
          }}
        >
          <TrustUnit big={<><NumberCounter value={STATS.scansLast30Days} /></>} small="domains checked in the last 30 days" />
          <TrustUnit big={<><NumberCounter value={STATS.organisationsResearched} /></>} small="organisations researched in full dossiers" />
          <TrustUnit big="ABN 34 318 502 254" small="Australian-owned" tone="text" />
          <TrustUnit big="Personally reviewed" small="by Kyle before delivery" tone="text" last />
        </div>
        <HoursCounter />
        <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 16 }}>
          Every finding is verifiable.{" "}
          <a href="/our-evidence-pack" style={{ color: "var(--gold)" }}>
            See the actual quality of work you would get, before you pay a cent →
          </a>
        </p>
        {arianceVisible && (
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 10 }}>
            Latest build:{" "}
            <a href={ariancePath} style={{ color: "var(--gold)" }}>
              {ARIANCE.title} →
            </a>
          </p>
        )}
        <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 10 }}>
          <a href="/case-studies" style={{ color: "var(--dim)", textDecoration: "underline", textUnderlineOffset: 3 }}>
            See the case studies
          </a>
        </p>
        {/* Testimonials / case studies go here once client 1 to 3 are delivered.
            Do not fabricate proof before then. The honest trust units above
            are the only proof that exists right now. */}
      </SectionReveal>

      <HeroScrollCue />

      {/* ═══ THE FREE AI AUDIT ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Start with a free consultation and a free report" lead="A half-hour with Kyle, then a report on your business. No cost, no obligation, and a no is welcome." />
          <GoldThread steps={AUDIT_STEPS} />
          <p style={{ textAlign: "center", color: "var(--ice)", fontSize: "var(--fs-body)", maxWidth: "var(--maxw-prose)", margin: "24px auto 0", lineHeight: 1.7 }}>
            If there&apos;s nothing worth automating yet, <strong style={{ color: "var(--gold)" }}>I&apos;ll tell you that too</strong>.
          </p>
          <div style={{ marginTop: 24 }}>
            <ContactButtons heading="Book a call, or message Kyle. Whichever is easiest." />
          </div>
        </div>
      </SectionReveal>

      {/* GO DEEPER: the long sections live on their own pages now (2026-11-10, phone page cut from about 41 screens). */}
      <SectionReveal style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Everything else is one tap away"
            lead="The proof, the prices and the method each have their own page, so this one stays short. Every figure on them carries its source."
          />
          <nav aria-label="Go deeper" className="grid-doors" style={{ maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
            {GO_DEEPER.map((g) => (
              <a
                key={g.href}
                href={g.href}
                style={{
                  display: "block",
                  padding: "18px 20px",
                  border: "1px solid rgb(var(--gold-rgb) / 0.18)",
                  borderRadius: "var(--radius-md)",
                  background: "rgb(var(--gold-rgb) / 0.02)",
                  textDecoration: "none",
                }}
              >
                <span style={{ display: "block", color: "var(--gold)", fontWeight: 600, marginBottom: 4 }}>{g.title} →</span>
                <span style={{ display: "block", color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>{g.body}</span>
              </a>
            ))}
          </nav>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ FRONT-LOAD: concerns answered before they are raised ═══ */}
      <FrontLoad
        extra={[
          { q: "Why monthly and not a one-off build?", a: "A system you build once and never touch again decays as usage and tools change. The retainer is one price that includes the build, the tuning and the support, instead of a build fee followed by a second sale later." },
          { q: "What is the 3-month minimum for?", a: "Month 1 is the build. Months 2 and 3 are where it gets tuned against how you actually use it, which is when it starts paying for itself. After that it is month-to-month, no lock-in." },
          { q: "We are not a tech business. Does this even apply to us?", a: "That is most of who I work with. You do not need to understand how it works, the same way you do not need to understand accounting software to use it. The free half-hour is for exactly that." },
          { q: "I am flat out. I do not have time for a project.", a: "Fair. Month 1 needs about an hour of your time in total: one call to work out which task is worth automating, one to check I built the right thing. If I need more than that, I have scoped it wrong." },
          { q: "Could I just do this myself with ChatGPT?", a: "Sometimes, genuinely, and I will say so if that is the honest answer. The part that eats weeks is not the prompt. It is the plumbing: getting it running against your real data and keeping it working when the tools change." },
          { q: "What if it breaks?", a: "Ongoing support is part of the retainer, not an add-on. Like a spare tyre and a full service history, anything that breaks can be rolled back to yesterday in one command." },
          { q: "Who are you, and why should I trust you?", a: <>Kyle Deligny, founder of TITANOS, Brisbane. ABN 34 318 502 254, verifiable on the Australian Business Register. My own security report is published in full at <a href="/our-evidence-pack" style={{ color: "var(--gold)" }}>/our-evidence-pack</a>, not a mock-up.</> },
          { q: "Is my data safe?", a: "Every system is built privacy-compliant by design. That is the other half of my practice, not a bolt-on." },
        ]}
      />

      {/* ═══ PRICES: compact list, same numbers and wording as /pricing (2026-11-12) ═══ */}
      <PricingGlance />

      {/* ═══ Final CTA ═══ */}
      <OpenLoop>You have seen the receipts. Would it be okay if I looked at your business the same way, free, and told you straight what I find? A no is welcome.</OpenLoop>
      <Analogy k="healthcheck" />
      <FreeStart />
    </>
  );
}

function TrustUnit({
  big,
  small,
  tone = "gold",
  last,
}: {
  big: React.ReactNode;
  small: string;
  tone?: "gold" | "text";
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "18px 20px",
        textAlign: "center",
        borderRight: last ? "none" : "1px solid rgb(var(--gold-rgb) / 0.10)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: tone === "gold" ? "var(--gold)" : "var(--ice)",
          fontSize: tone === "gold" ? "clamp(1.4rem, 3vw, 1.75rem)" : "var(--fs-lg)",
          fontWeight: 700,
          letterSpacing: "0.02em",
          lineHeight: 1.15,
          marginBottom: 4,
        }}
      >
        {big}
      </div>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--dim)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {small}
      </div>
    </div>
  );
}
