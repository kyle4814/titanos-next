import HeroEntrance from "@/components/HeroEntrance";
import OfferCard from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import NumberCounter from "@/components/NumberCounter";
import AnimatedButton from "@/components/AnimatedButton";
import HeroScrollCue from "@/components/HeroScrollCue";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import JourneySteps from "@/components/JourneySteps";
import TierQuiz from "@/components/TierQuiz";
import RoiEstimator from "@/components/RoiEstimator";
import StatsTicker from "@/components/StatsTicker";
import FaqItem from "@/components/FaqItem";
import { STATS } from "@/lib/stats";
import { AUDIT_BOOK_HREF } from "@/lib/config";
import { DISPLAY } from "@/lib/pricing";

import type { Offer } from "@/components/OfferCard";

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

// The full ladder — every entry point, cheapest first. Prices come from
// lib/pricing.ts only; never inline a figure here (QA greps for it).
const LADDER: LadderBand[] = [
  {
    name: "Open door",
    who: "Anyone. No card, no commitment.",
    price: DISPLAY.FREE_SCAN_PRICE,
    items: [
      { label: "Free security + AI exposure scan", price: DISPLAY.FREE_SCAN_PRICE },
      { label: "Free 15-minute audit call", price: DISPLAY.FREE_SCAN_PRICE },
    ],
    cta: "Start free →",
    href: "/scan",
  },
  {
    name: "Starter",
    who: "Solo operators and small teams testing the water.",
    price: `From ${DISPLAY.MONITOR_MONTHLY}`,
    items: [
      { label: "Compliance Monitor — monthly", price: DISPLAY.MONITOR_MONTHLY },
      { label: "Compliance Monitor — annual", price: DISPLAY.MONITOR_ANNUAL },
      { label: "Leads — Starter", price: DISPLAY.LEADS_STARTER },
    ],
    cta: "See monitoring →",
    href: "/monitor",
  },
  {
    name: "Business",
    who: "SMBs getting compliant and buying pipeline.",
    price: `From ${DISPLAY.LEADS_GROWTH}`,
    items: [
      { label: "Leads — Growth", price: DISPLAY.LEADS_GROWTH },
      { label: "Leads — Campaign", price: DISPLAY.LEADS_CAMPAIGN },
      { label: "Leads — monthly retainer", price: DISPLAY.LEADS_RETAINER },
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
    cta: "Book an enterprise call →",
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
      <HeroEntrance
        wordmark="TITANOS"
        eyebrow="TITANOS · AI Systems for Australian Businesses"
        tagline="I find the manual task eating your week, and build the system that does it instead."
        trust={
          <>
            Personally reviewed · Australian-owned · ABN 34 318 502 254 ·{" "}
            {STATS.scansThisMonth}+ external scans run this month
          </>
        }
      />

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
          Manual admin. Missed enquiries. Quotes nobody follows up on. Compliance risk you can&apos;t
          see until it costs you. <strong style={{ color: "var(--gold)" }}>AI fixes all four.</strong> I
          build the systems, and every one of them is privacy-compliant by design, because
          compliance is my other practice.
        </p>

        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">
              Book your free AI audit call →
            </AnimatedButton>
            <AnimatedButton href="#tiers" variant="secondary">
              See how it works ↓
            </AnimatedButton>
          </div>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12 }}>
            No cost · No obligation · No pitch deck
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
          <TrustUnit big={<><NumberCounter value={STATS.scansThisMonth} suffix="+" /></>} small="scans this month" />
          <TrustUnit big={<><NumberCounter value={STATS.uniqueBusinesses} suffix="+" /></>} small="AU/NZ/SG businesses in corpus" />
          <TrustUnit big="ABN 34 318 502 254" small="Australian-owned" tone="text" />
          <TrustUnit big="Personally reviewed" small="by Kyle before delivery" tone="text" last />
        </div>
        <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 16 }}>
          Every finding verifiable —{" "}
          <a href="/our-evidence-pack" style={{ color: "var(--gold)" }}>
            see the actual quality of work you&apos;d get, before you pay a cent →
          </a>
        </p>
        {/* Testimonials / case studies go here once client 1-3 are delivered.
            Do not fabricate proof before then — the honest trust units above
            are the only proof that exists right now. */}
      </SectionReveal>

      <HeroScrollCue />

      {/* ═══ THE PROBLEM ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px 0", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Four ways it's happening right now"
            lead="Leads that never get followed up. The same questions answered by hand, every day. Data copied between systems by a person instead of a computer. A privacy problem nobody's checked in a year. Most owners know AI could help. Fewer know where to start."
          />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ THE FREE AI AUDIT ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Start with a free AI audit call" lead="A call with Kyle. No cost, no obligation, no pitch deck." />
          <GoldThread steps={AUDIT_STEPS} />
          <p style={{ textAlign: "center", color: "var(--ice)", fontSize: "var(--fs-body)", maxWidth: "var(--maxw-prose)", margin: "24px auto 0", lineHeight: 1.7 }}>
            If there&apos;s nothing worth automating yet, <strong style={{ color: "var(--gold)" }}>I&apos;ll tell you that too</strong>.
          </p>
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">Book your free AI audit call →</AnimatedButton>
          </p>
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

      {/* ═══ EVERY DOOR — the full ladder ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Every door is open"
            lead="From a free scan with no card, to enterprise programs across a whole group. Wherever you are on this ladder, there is a way in — and if none of it fits your budget yet, the free scan and the audit call are still yours."
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
            scan and the audit call — you keep the findings and the plan either way, and you are
            welcome back whenever the timing is right.
          </p>
        </div>
      </SectionReveal>


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

      {/* ═══ ROI ESTIMATOR ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="What is manual work actually costing you?" lead="Move the sliders — this uses your numbers, not a claim about past results." />
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
              The AI Readiness Guide — a real checklist for whether AI will save your business time, and what governance you need before deploying it. Free, no form, no catch.
            </p>
            <AnimatedButton href="/ai-readiness-guide.pdf" variant="secondary" external>
              Download the free guide (PDF) →
            </AnimatedButton>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ PRIVACY BY DESIGN — the foundation ═══ */}
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
              privacy-compliant by design — because compliance is my other practice.&rdquo;
            </p>
            <ul style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
              <li>Every AI system we build is privacy-compliant by design</li>
              <li>Privacy policy + automated-decision disclosure handled as part of onboarding</li>
              <li>Building AI without this creates legal exposure. With us, it doesn&apos;t</li>
              <li>We monitor regulation changes and update your systems</li>
              <li>One person handles both, so nothing falls through the gap between them</li>
            </ul>
          </div>
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <AnimatedButton href="/compliance" variant="secondary">See the standalone privacy deep-dive →</AnimatedButton>
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ WHY THIS WINS ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Why owners pick Titanos" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto", display: "grid", gap: 14 }}>
            {[
              "You see value before you pay a cent — the free audit call, no strings",
              "One partner from day one. No separate build fee, no second sale later",
              "Privacy by design. Almost nobody else in this market can say that honestly",
              "The systems keep improving the longer we run them, not just at handover",
              "I respond in minutes and build in days, not months",
            ].map((line) => (
              <div key={line} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px 22px" }}>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, margin: 0 }}>{line}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", maxWidth: "var(--maxw-prose)", margin: "28px auto 0", lineHeight: 1.7 }}>
            Kyle Deligny, one operator, Brisbane. ABN 34 318 502 254. Personally accountable for
            every system shipped.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ FAQ ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
          <SectionHeading title="Straight answers" />
          <FaqItem question="How much does it cost?">
            Retainers start at {DISPLAY.AI_GROWTH_PARTNER}, {DISPLAY.AI_RETAINER_MIN}. Ops is {DISPLAY.AI_OPS_PARTNER}, Embedded is {DISPLAY.AI_EMBEDDED_PARTNER}. The audit call itself is free.
          </FaqItem>
          <FaqItem question="Why monthly and not a one-off build?">
            A system you build once and never touch again decays — usage changes, tools change, edge cases show up. The retainer is one sale that includes the build, the tuning, and the support, instead of a build fee followed by a second sale later.
          </FaqItem>
          <FaqItem question="What's the 3-month minimum for?">
            Month 1 is the build. Month 2-3 is where it gets optimised against how you actually use it — that's when it starts paying for itself. After that, it's month-to-month.
          </FaqItem>
          <FaqItem question="We're not a tech business — does this even apply to us?">
            That's most of who I work with. You don't need to understand how it works, the same way you don't need to understand accounting software to use it. That's what the audit call is for.
          </FaqItem>
          <FaqItem question="I'm flat out — I don't have time for a project right now.">
            Fair. Month 1 needs about an hour of your time in total: one call to work out which task is worth automating, one to check I built the right thing. If I need more from you than that, I've scoped it wrong.
          </FaqItem>
          <FaqItem question="We've already got software for this.">
            Then you might not need me, and I'll tell you that. A lot of what gets sold as automation just books appointments or shuffles data between two tools you already pay for. Tell me what you're running on the call and I'll give you a straight answer on whether there's a real gap.
          </FaqItem>
          <FaqItem question="Couldn't I just do this myself with ChatGPT?">
            Sometimes, genuinely — and I'll say so on the call if that's the honest answer. The part that eats weeks isn't the prompt, it's the plumbing: getting it running against your actual data, handling the cases where it gets things wrong, and keeping it working when the tools change underneath it.
          </FaqItem>
          <FaqItem question="What if it breaks?">
            Ongoing support is part of the retainer, not an add-on you have to remember to buy.
          </FaqItem>
          <FaqItem question="Who are you, and why should I trust you?">
            Kyle Deligny, one operator, Brisbane. ABN 34 318 502 254 — verifiable on the Australian Business Register. The evidence pack at /our-evidence-pack is my own real report, published in full, not a mock-up.
          </FaqItem>
          <FaqItem question="Is my data safe?">
            Every system is built privacy-compliant by design — that's the other half of my practice, not a bolt-on.
          </FaqItem>
          <FaqItem question="What if it doesn't work?">
            Real results or it doesn't continue — month-to-month after the 3-month minimum, no lock-in beyond that.
          </FaqItem>
        </div>
      </SectionReveal>

      <SectionReveal style={{ textAlign: "center", padding: "0 20px var(--space-8)", position: "relative", zIndex: 2 }}>
        <a
          href="/black-ice"
          data-analytics="black_ice_view"
          style={{
            color: "var(--dim)",
            fontSize: "var(--fs-sm)",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Everything on this site runs on one operating doctrine — <span style={{ color: "var(--ice)" }}>Black Ice →</span>
        </a>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ Final CTA ═══ */}
      <SectionReveal style={{ textAlign: "center", padding: "var(--space-30) 20px", position: "relative", zIndex: 2 }}>
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            fontWeight: 400,
            fontStyle: "italic",
            marginBottom: 14,
            letterSpacing: "0.01em",
          }}
        >
          Not sure where to start?
        </h2>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-lg)",
            marginBottom: 32,
            maxWidth: "var(--maxw-prose)",
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.6,
          }}
        >
          Book the free AI audit call. You&apos;ll see exactly what&apos;s automatable in your
          business and what it&apos;s worth — no cost, no obligation.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">Book your free AI audit call →</AnimatedButton>
          <AnimatedButton href="#tiers" variant="secondary">See the partnership tiers ↓</AnimatedButton>
        </div>
      </SectionReveal>
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
