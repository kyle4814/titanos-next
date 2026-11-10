// Sections moved off the homepage on 2026-11-10 (the phone page was 37,141 px tall, about 41 screens at 412 x 915).
// The JSX and copy are unchanged from app/page.tsx at d6c7c57ad; each one now renders on the page that owns its topic:
//   ProofCharts      -> /proof         (cost curve, the measured flex cards, the market ceiling)
//   PartnershipStack -> /pricing       (tier quiz + retainer cards, every door, the ROI estimator)
//   HowSections      -> /how-it-works  (BLUF + pillars, the four costs, the journey)
//   WhatWeBuild      -> /ai-delivery
//   OperatorSections -> /about         (Privacy by Design, the doctrine behind the delivery)
// The homepage keeps the hero, trust strip, free consultation, front-loaded answers and a link to each of these.
import { TEAM_LINE, ELAPSED_LINE } from "@/lib/ledger";
import OfferCard from "@/components/OfferCard";
import type { Offer } from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import AnimatedButton from "@/components/AnimatedButton";
import BentoGrid from "@/components/home/BentoGrid";
import CostCurve from "@/components/charts/CostCurve";
import JourneySteps from "@/components/JourneySteps";
import TierQuiz from "@/components/TierQuiz";
import RoiEstimator from "@/components/RoiEstimator";
import { DISPLAY } from "@/lib/pricing";
import { FlexGrid, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";
import { Bluf, Analogy, Pillars } from "@/components/SalesKit";

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
    tag: "AI Ops Partner",
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

const WHAT_WE_BUILD = [
  { title: "Lead gen & outreach", body: "Finds and follows up with the customers you're currently missing." },
  { title: "Customer service & support", body: "Answers the same ten questions your inbox gets every day, instantly." },
  { title: "Appointments & booking", body: "Books, reminds, and reschedules without anyone touching a calendar." },
  { title: "Content & social media", body: "Keeps your channels active without you writing a single post." },
  { title: "Sales & follow-up", body: "Chases every quote and lead until someone answers." },
  { title: "Data & reporting", body: "Your numbers, pulled from the systems you already run, before Monday's meeting." },
  { title: "Admin & data entry", body: "Invoicing, onboarding, documents. The repetitive work, gone." },
];

export function ProofCharts() {
  return (
    <>
    <CostCurve />
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
    </>
  );
}

export function PartnershipStack() {
  return (
    <>
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
            const tierSlug = new URL(o.primary.href, "https://titanos.tech").searchParams.get("tier") ?? "";
            return (
              <div
                key={o.tag}
                id={`tier-${tierSlug}`}
                style={{
                  position: "relative",
                  height: "100%",
                  borderRadius: "var(--radius-md)",
                }}
              >
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
            <div key={band.name} className="ladder-band" data-phi-reveal>
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

    <div className="divider-gold" />

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
    </>
  );
}

export function HowSections() {
  return (
    <>
    {/* ═══ BLUF + THE FIVE PILLARS ═══ */}
    <Bluf replaced>
      One engineer built TITANOS in {ELAPSED_LINE}, around a day job. The industry COCOMO model says that is {TEAM_LINE} (MODELLED, method on the Engineering page). We exist to give your business that output safely, without
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

    {/* ═══ THE JOURNEY ═══ */}
    <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading title="How this actually works" lead="One path, start to finish." />
        <JourneySteps />
      </div>
    </SectionReveal>
    </>
  );
}

export function WhatWeBuild() {
  return (
    <>
    {/* ═══ WHAT WE BUILD ═══ */}
    <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading title="If it's repetitive, we automate it." />
        <BentoGrid items={WHAT_WE_BUILD} />
      </div>
    </SectionReveal>
    </>
  );
}

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
