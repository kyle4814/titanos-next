import HeroEntrance from "@/components/HeroEntrance";
import OfferCard from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import NumberCounter from "@/components/NumberCounter";
import AnimatedButton from "@/components/AnimatedButton";
import HeroScrollCue from "@/components/HeroScrollCue";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import { STATS } from "@/lib/stats";
import { SITE } from "@/lib/config";
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
      "One AI system, shipped working in month 1",
      "Privacy by Design · Data Security · Compliance Alignment",
      "Ongoing support included",
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
      "Multiple AI systems across core ops",
      "Reporting + dashboards",
      "Privacy by Design · Data Security · Compliance Alignment",
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
      "A full-stack AI partnership — end-to-end automation strategy, custom development, and team enablement. For businesses over AU$3M needing full transformation.",
    bullets: [
      "End-to-end automation strategy",
      "Custom development + team enablement",
      "Privacy by Design · Data Security · Compliance Alignment",
    ],
    primary: { label: "Start with Embedded →", href: "/order/ai?tier=embedded", external: false },
    secondary: { label: "See AI Partnership", href: "/ai-delivery" },
    icon: "users",
    index: 2,
  },
];

const AUDIT_STEPS: ThreadStep[] = [
  { num: "I", title: "Input", body: "Your website, your industry, and public data about your business." },
  { num: "II", title: "AI Analysis", body: "A deep automation-opportunity scan — the same pipeline I run for paying clients." },
  { num: "III", title: "Human Review", body: "I personally check it for accuracy before anything reaches you." },
  { num: "IV", title: "Your Report", body: "A two-layer report: plain English on top, technical appendix underneath." },
];

const WHAT_WE_BUILD = [
  { title: "AI Lead Gen & Outreach Systems", body: "Finds and follows up with the customers you're currently missing." },
  { title: "AI Customer Service & Support Bots", body: "Answers the same ten questions your inbox gets every day, instantly." },
  { title: "AI Appointment & Booking Systems", body: "Books, reminds, and reschedules without anyone touching a calendar." },
  { title: "AI Content & Social Media Machines", body: "Keeps your channels active without you writing a single post." },
  { title: "AI Sales & Follow-Up Automations", body: "Chases every quote and lead until someone answers." },
  { title: "AI Data & Insights Dashboards", body: "Your numbers, pulled from the systems you already run, before Monday's meeting." },
  { title: "AI Admin Automations", body: "Data entry, invoicing, onboarding, documents — the repetitive work, gone." },
];

export default function Home() {
  return (
    <>
      {/* ═══ HERO ═══ */}
      <HeroEntrance
        wordmark="TITANOS"
        eyebrow="TITANOS · AI Growth Partner"
        tagline="We build AI systems that grow your business — and protect your data by design."
        trust={
          <>
            Personally reviewed · Australian-owned · ABN 34 318 502 254 ·{" "}
            {STATS.scansThisMonth}+ external scans run this month
          </>
        }
      />

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
          Every business is bleeding time and money on manual work. I find exactly where, build
          the AI systems that fix it, and keep improving them month after month —
          privacy-compliant by design, because compliance is my other practice.
        </p>

        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <AnimatedButton href="/audit#request" variant="primary">
              Get your free AI audit →
            </AnimatedButton>
            <AnimatedButton href="#tiers" variant="secondary">
              See how it works ↓
            </AnimatedButton>
          </div>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12 }}>
            No card · No obligation · Report in 1 business day
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
      </SectionReveal>

      <HeroScrollCue />

      {/* ═══ THE PROBLEM ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px 0", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Every business is bleeding time and money right now."
            lead="Chasing leads. Answering the same questions. Booking. Data entry. Follow-ups. Reporting. You know AI could help — you just don't know where to start, or who to trust with it."
          />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ THE FREE AI AUDIT ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Start with a free AI audit" lead="Four steps. One business day. No cost, no obligation." />
          <GoldThread steps={AUDIT_STEPS} />
          <p style={{ textAlign: "center", color: "var(--ice)", fontSize: "var(--fs-body)", maxWidth: "var(--maxw-prose)", margin: "24px auto 0", lineHeight: 1.7 }}>
            Every audit ends with your <strong style={{ color: "var(--gold)" }}>top 3 opportunities</strong> —
            and we can build the first one in month 1.
          </p>
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <AnimatedButton href="/audit#request" variant="primary">Get your free AI audit →</AnimatedButton>
          </p>
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
          <div className="grid-doors" style={{ maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
            {offers.map((o) => {
              const isFlagship = o.popular;
              return (
                <div
                  key={o.tag}
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
              <li>We de-risk your business — implementing AI without this creates legal exposure, with us it doesn&apos;t</li>
              <li>We monitor regulation changes and update your systems</li>
              <li>One-stop shop: AI + compliance = growth + protection</li>
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
              "You get value before you buy — the free AI audit, no strings",
              "We lead with opportunity, not fear",
              "One partner from day one — no second sale, no build-then-maybe-retainer",
              "Privacy by design = trust nobody else in this market can claim",
              "AI systems compound — they get more valuable the longer we run them",
              "Speed — I respond in minutes and build in days, not months",
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
          Get the free AI audit. You&apos;ll see exactly what&apos;s automatable in your business
          and what it&apos;s worth — no cost, no obligation.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/audit#request" variant="primary">Get your free AI audit →</AnimatedButton>
          <AnimatedButton href={SITE.CAL_15MIN_URL} external variant="secondary">Book a 15-min fit call</AnimatedButton>
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
