// Sections moved off the homepage on 2026-11-10 (the phone page was 37,141 px tall, about 41 screens at 412 x 915).
// The JSX and copy are unchanged from app/page.tsx at d6c7c57ad; each one now renders on the page that owns its topic:
//   ProofCharts      -> /proof         (cost curve, the measured flex cards, the market ceiling)
//   PartnershipStack -> /pricing       (tier quiz + retainer cards, every door, the ROI estimator)
//   HowSections      -> /how-it-works  (BLUF + pillars, the four costs, the journey)
//   WhatWeBuild      -> /ai-delivery
//   OperatorSections -> /about         (Privacy by Design, the doctrine behind the delivery)
// The homepage keeps the hero, trust strip, free consultation, front-loaded answers and a link to each of these.
// This file: PartnershipStack.
import OfferCard from "@/components/OfferCard";
import type, { Offer } from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import AnimatedButton from "@/components/AnimatedButton";
import TierQuiz from "@/components/TierQuiz";
import RoiEstimator from "@/components/RoiEstimator";
import { DISPLAY } from "@/lib/pricing";

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
