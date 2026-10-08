import type { Metadata } from "next";
import Hero from "@/components/hero/Hero";
import VoidPortal from "@/components/hero/VoidPortal";
import { withSeo } from "@/lib/seo";
import { ARIANCE, arianceVisible, ariancePath } from "@/lib/case-studies/ariance";
import SpaceImage from "@/components/SpaceImage";
import OfferCard from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import NumberCounter from "@/components/NumberCounter";
import AnimatedButton from "@/components/AnimatedButton";
import { STATS } from "@/lib/stats";
import HeroScrollCue from "@/components/HeroScrollCue";
import CostCurve from "@/components/charts/CostCurve";
import LoopOrbit from "@/components/charts/LoopOrbit";
import ProofWall from "@/components/charts/ProofWall";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import JourneySteps from "@/components/JourneySteps";
import TierQuiz from "@/components/TierQuiz";
import RoiEstimator from "@/components/RoiEstimator";
import StatsTicker from "@/components/StatsTicker";
import ContactButtons from "@/components/ContactButtons";
import { AUDIT_MESSAGE_HREF } from "@/lib/config";
import { DISPLAY } from "@/lib/pricing";
import { Inscription } from "@/components/Myth";
import { FlexGrid, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

import type { Offer } from "@/components/OfferCard";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";

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

const offers: Offer[] = [
  {
    tag: "AI Growth Partner",
    title: "AI Growth Partner",
    price: DISPLAY.AI_GROWTH_PARTNER,
    priceUnit: DISPLAY.AI_RETAINER_MIN,
    body:
      "One system built and running in month 1, optimised through months 2-3, then ongoing support and iterations. Built for SMBs, solo operators and early adopters.",
    bullets: [
      "Month 1: your highest-impact system built and live",
      "Month 2: optimised against how you actually use it",
      "Month 3+: ongoing support, new systems as you grow",
    ],
    primary: { label: "Start with Growth →", href: "/order/ai?tier=growth", external: false },
    secondary: { label: "See AI Partnership", href: "/ai-delivery" },
    icon: "sparkles",
    index: 0,
  },
  {
    tag: "Most popular",
    title: "AI Ops Partner",
    price: DISPLAY.AI_OPS_PARTNER,
    priceUnit: DISPLAY.AI_RETAINER_MIN,
    body:
      "Multiple systems, automations across your core ops, reporting and dashboards, continuous improvement month over month. For growing businesses ready to scale ops.",
    bullets: [
      "Month 1: first system(s) built + a reporting dashboard",
      "Month 2: automations added across your core ops",
      "Month 3+: continuous improvement, new systems as ops grow",
    ],
    primary: { label: "Start with Ops →", href: "/order/ai?tier=ops", external: false },
    secondary: { label: "See AI Partnership", href: "/ai-delivery" },
    icon: "shield",
    index: 1,
    popular: true,
  },
  {
    tag: "Embedded AI Partner",
    title: "Embedded AI Partner",
    price: DISPLAY.AI_EMBEDDED_PARTNER,
    priceUnit: DISPLAY.AI_RETAINER_MIN,
    body:
      "A full automation strategy across your whole operation, custom systems built for how you actually work, and your team trained to run them. For businesses ready to rebuild how they operate.",
    bullets: [
      "Month 1: automation strategy + first systems built",
      "Month 2: full-stack rollout + your team trained to run it",
      "Month 3+: ongoing transformation partnership",
    ],
    primary: { label: "Start with Embedded →", href: "/order/ai?tier=embedded", external: false },
    secondary: { label: "See AI Partnership", href: "/ai-delivery" },
    icon: "users",
    index: 2,
  },
];

type LadderItem = { label: string; price: string };
type LadderBand = {
  name: string; who: string; price: string;
  items: LadderItem[]; cta: string; href: string;
};

// The full ladder: every entry point, cheapest first. Prices come from
// lib/pricing.ts only; never inline a figure here (QA greps for it).
const LADDER: LadderBand[] = [
  {
    name: "Open door",
    who: "Anyone. No card, no commitment.",
    price: DISPLAY.FREE_SCAN_PRICE,
    items: [
      { label: "Free security + AI exposure scan", price: DISPLAY.FREE_SCAN_PRICE },
      { label: "Free half-hour audit call", price: DISPLAY.FREE_SCAN_PRICE },
    ],
    cta: "Start free →",
    href: "/scan",
  },
  {
    name: "Starter",
    who: "Solo operators and small teams testing the water.",
    price: `From ${DISPLAY.MONITOR_MONTHLY}`,
    items: [
      { label: "TITANOS Monitor (monthly)", price: DISPLAY.MONITOR_MONTHLY },
      { label: "TITANOS Monitor (annual)", price: DISPLAY.MONITOR_ANNUAL },
      { label: "Leads Starter", price: DISPLAY.LEADS_STARTER },
      { label: "Job Flow for tradies (launching soon)", price: DISPLAY.JOB_FLOW_MONTHLY },
    ],
    cta: "See monitoring →",
    href: "/monitor",
  },
  {
    name: "Business",
    who: "SMBs getting compliant and buying pipeline.",
    price: `From ${DISPLAY.LEADS_GROWTH}`,
    items: [
      { label: "Leads Growth", price: DISPLAY.LEADS_GROWTH },
      { label: "Leads Campaign", price: DISPLAY.LEADS_CAMPAIGN },
      { label: "Leads monthly retainer", price: DISPLAY.LEADS_RETAINER },
      { label: "Privacy Act + Essential Eight pack", price: DISPLAY.PACK_PRICE },
    ],
    cta: "See compliance →",
    href: "/compliance",
  },
  {
    name: "Partnership",
    who: "Businesses rebuilding how they operate.",
    price: `From ${DISPLAY.AI_GROWTH_PARTNER}`,
    items: [
      { label: "AI Growth Partner", price: DISPLAY.AI_GROWTH_PARTNER },
      { label: "AI Ops Partner", price: DISPLAY.AI_OPS_PARTNER },
      { label: "Embedded AI Partner", price: DISPLAY.AI_EMBEDDED_PARTNER },
    ],
    cta: "See AI partnership →",
    href: "/ai-delivery",
  },
  {
    name: "Enterprise",
    who: "Groups, regulated entities and boards. Scoped on a call.",
    price: DISPLAY.ENTERPRISE_FROM,
    items: [
      { label: "Board AI risk advisory", price: DISPLAY.BOARD_ADVISORY_MONTHLY },
      { label: "Enterprise continuous monitoring", price: DISPLAY.ENTERPRISE_MONITORING_MONTHLY },
      { label: "Enterprise AI security operations", price: DISPLAY.ENTERPRISE_SOC_MONTHLY },
      { label: "Enterprise AI governance program", price: DISPLAY.ENTERPRISE_GOVERNANCE },
      { label: "Multi-entity compliance program", price: DISPLAY.ENTERPRISE_MULTI_ENTITY },
      { label: "EU AI Act readiness program", price: DISPLAY.ENTERPRISE_AI_ACT },
      { label: "OEM platform licence", price: DISPLAY.OEM_LICENCE_ANNUAL },
    ],
    cta: "Message Kyle about enterprise →",
    href: "/contact",
  },
];

const AUDIT_STEPS: ThreadStep[] = [
  { num: "I", title: "You tell me how your business runs", body: "How your day-to-day actually works, in your own words." },
  { num: "II", title: "We find the repetitive work", body: "Together we find what's costing you the most time and money." },
  { num: "III", title: "I tell you straight", body: "What's automatable, what it'd take, and what it's worth. If it's not worth it, I'll say so." },
  { num: "IV", title: "We start in month 1", body: "If it makes sense, we build your first system inside month 1 of a retainer." },
];

const WHAT_WE_BUILD = [
  { title: "Lead gen & outreach", body: "Finds and follows up with the customers you're currently missing." },
  { title: "Customer service & support", body: "Answers the same ten questions your inbox gets every day, instantly." },
  { title: "Appointments & booking", body: "Books, reminds, and reschedules without anyone touching a calendar." },
  { title: "Content & social media", body: "Keeps your channels active without you writing a single post." },
  { title: "Sales & follow-up", body: "Chases every quote and lead until someone answers." },
  { title: "Data & reporting", body: "Your numbers, pulled from the systems you already run, before Monday's meeting." },
  { title: "Admin & data entry", body: "Invoicing, onboarding, documents. The repetitive work, gone." },
];

export default function Home() {
  return (
    <>
      {/* ═══ HERO ═══ */}
      <Hero />
      <VoidPortal />
      <div className="ds-band">
        <SpaceImage id="webb-cosmic-cliffs" sizes="100vw" />
        <a className="ds-band__cap" href="/credits#webb-cosmic-cliffs">NASA, ESA, CSA, STScI</a>
      </div>

      {/* FIND YOUR OFFER: early door to the finder and the full list. */}
      <section
        aria-label="Find the right offer"
        style={{ padding: "var(--space-6) 20px 0", position: "relative", zIndex: 2 }}
      >
        <div
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            textAlign: "center",
            border: "1px solid rgb(var(--gold-rgb) / 0.25)",
            borderRadius: "var(--radius-md)",
            background: "rgb(var(--gold-rgb) / 0.03)",
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

      {/* THE OPENING: the threshold. Inscription primitive, the
          claim is set INTO the page (lintel rules + stone recess), not
          printed on it. See components/Myth.tsx for the vocabulary. */}
      <section
        aria-label="What TITANOS is"
        style={{ padding: "var(--space-6) 20px var(--space-12)", position: "relative", zIndex: 2 }}
      >
        <Inscription
          label="US$0.97 to US$0.12 per job · recorded 8 October 2026"
          sub="We did not buy a bigger machine. We found the waste, turned each lesson into code, and ran it again. Below is the proof, with the source of every number one tap away."
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
            <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary">
              Message Kyle for a free consultation and report →
            </AnimatedButton>
            <AnimatedButton href="#tiers" variant="secondary">
              See how it works ↓
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
        {/* Testimonials / case studies go here once client 1 to 3 are delivered.
            Do not fabricate proof before then. The honest trust units above
            are the only proof that exists right now. */}
      </SectionReveal>

      <HeroScrollCue />

      {/* W4: live charts from lib/site-data/proof.json (generated), the loop orbit, the proof wall */}
      <CostCurve />
      <LoopOrbit />
      <ProofWall />
      {/* THE PROOF: biggest true numbers first, each with its label and source. */}
      <SectionReveal style={{ padding: "var(--space-12) 20px 0", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="The machine, measured on itself first"
            lead="Every number below was read off our own running system on 8 October 2026. Tap any card to see exactly where it came from."
          />
          <FlexGrid items={[FLEX.costPerJob, FLEX.startTokens, FLEX.fleetJobs, FLEX.tests]} />
        </div>
      </SectionReveal>
      <OpenLoop>Cheaper, faster and passing more tests. So what does one person with this system actually build?</OpenLoop>

      {/* ═══ BLUF + THE FIVE PILLARS ═══ */}
      <Bluf replaced>
        One engineer built TITANOS in about 4 months. The industry COCOMO model says that is about 20 engineers for 27 months (MODELLED, method on the Engineering page). We exist to give your business that output safely, without
        replacing anyone.
      </Bluf>
      <Analogy k="department" />
      <Pillars />
      <Analogy k="preflight" />

      {/* ═══ THE PROBLEM ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px 0", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Four places the manual work is quietly costing you"
            lead="Leads that never get followed up. The same questions answered by hand, every day. Data copied between systems by a person instead of a computer. A privacy problem nobody's checked in a year. Most owners know AI could help. Fewer know where to start."
          />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <OpenLoop>If that is where the cost goes, what does a first conversation with us look like, and what does it cost you?</OpenLoop>
      {/* ═══ THE FREE AI AUDIT ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Start with a free consultation and a free report" lead="A half-hour with Kyle, then a report on your business. No cost, no obligation, and a no is welcome." />
          <GoldThread steps={AUDIT_STEPS} />
          <p style={{ textAlign: "center", color: "var(--ice)", fontSize: "var(--fs-body)", maxWidth: "var(--maxw-prose)", margin: "24px auto 0", lineHeight: 1.7 }}>
            If there&apos;s nothing worth automating yet, <strong style={{ color: "var(--gold)" }}>I&apos;ll tell you that too</strong>.
          </p>
          <div style={{ marginTop: 24 }}>
            <ContactButtons heading="Message Kyle. No booking, no forms." />
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ THE JOURNEY ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="How this actually works" lead="One path, start to finish." />
          <JourneySteps />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ THE OFFER STACK ═══ */}
      <SectionReveal id="tiers" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Pick the partnership that fits where you are today"
            lead="We don't sell projects. We sell partnerships that build, optimise and scale. Every plan includes Privacy by Design, Data Security, Compliance Alignment and Ongoing Support."
          />
          <TierQuiz />
          <div className="grid-doors" style={{ maxWidth: "var(--maxw-wide)", margin: "24px auto 0" }}>
            {offers.map((o) => {
              const isFlagship = o.popular;
              const tierSlug = new URL(o.primary.href, "https://titanos.tech").searchParams.get("tier") ?? "";
              return (
                <div
                  key={o.tag}
                  id={`tier-${tierSlug}`}
                  style={{
                    position: "relative",
                    height: "100%",
                    boxShadow: isFlagship
                      ? "0 0 0 1px var(--gold-dim), 0 20px 60px -20px rgb(var(--gold-rgb) / 0.25)"
                      : undefined,
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {isFlagship && (
                    <span
                      className="offer-popular-badge"
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 3,
                        color: "var(--vault-black)",
                        fontFamily: "var(--font-body), system-ui, sans-serif",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        padding: "5px 14px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                        boxShadow: "0 4px 14px rgb(0 0 0 / 0.4)",
                      }}
                    >
                      Most popular
                    </span>
                  )}
                  <OfferCard {...o} />
                </div>
              );
            })}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* EVERY DOOR: the full ladder */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Pick your door. There is one at every budget."
            lead="From a free scan with no card, to enterprise programs across a whole group. If none of it fits yet, the free scan and the audit call are still yours."
          />

          <div className="ladder-grid">
            {LADDER.map((band) => (
              <div key={band.name} className="ladder-band">
                <div className="ladder-band-head">
                  <div>
                    <div className="ladder-band-name">{band.name}</div>
                    <div className="ladder-band-who">{band.who}</div>
                  </div>
                  <div className="ladder-band-price">{band.price}</div>
                </div>
                <ul className="ladder-band-list">
                  {band.items.map((it) => (
                    <li key={it.label}>
                      <span className="ladder-item-label">{it.label}</span>
                      <span className="ladder-item-price">{it.price}</span>
                    </li>
                  ))}
                </ul>
                <a className="ladder-band-cta" href={band.href}>
                  {band.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="ladder-note">
            Nobody gets turned away for budget. If the ladder does not reach you yet, take the free
            scan and the audit call. You keep the findings and the plan either way, and you are
            welcome back whenever the timing is right.
          </p>
          <p className="ladder-note">
            <a className="ladder-band-cta" href="/offers">See every offer</a>
          </p>
        </div>
      </SectionReveal>


      <OpenLoop>Seven kinds of repetitive work come up again and again. Which one is eating your week?</OpenLoop>
      {/* ═══ WHAT WE BUILD ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="If it's repetitive, we automate it." />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 18,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {WHAT_WE_BUILD.map((w) => (
              <div
                key={w.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "22px 24px",
                }}
              >
                <h3 style={{ fontFamily: "var(--font-body), system-ui, sans-serif", color: "var(--ice)", fontSize: "var(--fs-lg)", fontWeight: 600, marginBottom: 6, lineHeight: 1.35 }}>
                  {w.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.65 }}>{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* THE CEILING: market size and the build-cost multiple, labelled. */}
      <SectionReveal style={{ padding: "var(--space-12) 20px 0", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="How far this reaches"
            lead="Hours handed back, nobody replaced. The market is large, and the cost of building for it just fell. Both numbers are labelled and sourced."
          />
          <FlexGrid items={[FLEX.market, FLEX.engineers, FLEX.memory]} />
        </div>
      </SectionReveal>
      <OpenLoop>Big numbers are easy to say. Here is a way to test them against your own business, with your own figures.</OpenLoop>

      {/* ═══ ROI ESTIMATOR ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="What is manual work actually costing you?" lead="Move the sliders. This uses your numbers, not a claim about past results." />
          <RoiEstimator />
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "22px auto 0",
              background: "var(--card)",
              border: "1px solid var(--gold-dim)",
              borderRadius: "var(--radius-md)",
              padding: "22px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "var(--gold)", fontSize: "var(--fs-body)", fontWeight: 600, margin: "0 0 8px" }}>
              Not ready to talk yet? Take the self-audit.
            </p>
            <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", margin: "0 0 16px" }}>
              The AI Readiness Guide: a real checklist for whether AI will save your business time, and what governance you need before deploying it. Free, no form, no catch.
            </p>
            <AnimatedButton href="/ai-readiness-guide.pdf" variant="secondary" external>
              Download the free guide (PDF) →
            </AnimatedButton>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

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
