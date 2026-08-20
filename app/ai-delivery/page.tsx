import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import Testimonials from "@/components/Testimonials";
import { DISPLAY } from "@/lib/pricing";
import { Inscription, SystemLabel, DepthIndex, OperatorNote, OmegaSeal } from "@/components/Myth";

const META_TITLE = "AI Partnership Retainers for Australian Businesses | Titanos";
const META_DESC = `Monthly AI partnerships that build, optimise and scale your business — from ${DISPLAY.AI_GROWTH_PARTNER}. Privacy-compliant by design. ${DISPLAY.AI_RETAINER_MIN}.`;

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/ai-delivery" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/ai-delivery",
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

const TIERS = [
  {
    tier: "growth",
    name: "AI Growth Partner",
    price: DISPLAY.AI_GROWTH_PARTNER,
    who: "For SMBs, solo operators, and early adopters",
    body: "One system built and running in month 1. Optimised through months 2-3. Ongoing support and iterations after that.",
    popular: false,
  },
  {
    tier: "ops",
    name: "AI Ops Partner",
    price: DISPLAY.AI_OPS_PARTNER,
    who: "For growing businesses scaling their operations",
    body: "Multiple systems, automations across your core ops, reporting and dashboards, continuous improvement month over month.",
    popular: true,
  },
  {
    tier: "embedded",
    name: "Embedded AI Partner",
    price: DISPLAY.AI_EMBEDDED_PARTNER,
    who: "For businesses over AU$3M needing full transformation",
    body: "A full-stack AI partnership — end-to-end automation strategy, custom development, and team enablement.",
    popular: false,
  },
];

const INCLUDED = [
  "Privacy by Design",
  "Data Security",
  "Compliance Alignment",
  "Ongoing Support",
];

const WHAT_I_BUILD = [
  { title: "AI Lead Gen & Outreach Systems", body: "Finds and follows up with the customers you're currently missing — in your voice, on autopilot." },
  { title: "AI Customer Service & Support Bots", body: "Answers the same ten questions your inbox gets every day, instantly, correctly, in your tone." },
  { title: "AI Appointment & Booking Systems", body: "Books, reminds, and reschedules without anyone touching a calendar." },
  { title: "AI Content & Social Media Machines", body: "Keeps your channels active without you writing a single post." },
  { title: "AI Sales & Follow-Up Automations", body: "Chases every quote, every lead, every unanswered message until someone answers." },
  { title: "AI Data & Insights Dashboards", body: "Your numbers, pulled from the systems you already run, in your inbox before Monday's meeting." },
  { title: "AI Admin Automations", body: "Data entry, invoicing, onboarding, documents — the repetitive work, gone." },
];

const HOW_IT_WORKS: ThreadStep[] = [
  {
    num: "I",
    title: "Free AI audit call",
    body: "We get on a call, you tell me the most repetitive job in your business, and we work out together what's automatable and what it's worth.",
  },
  {
    num: "II",
    title: "Pick your tier",
    body: "Growth, Ops, or Embedded — sized to your business. Every tier has a 3-month minimum, no fine print.",
  },
  {
    num: "III",
    title: "Month 1: I build",
    body: "The first system goes live in month 1 — inside the retainer, not billed separately. One sale, recurring from day one.",
  },
  {
    num: "IV",
    title: "Months 2-3: I optimise",
    body: "I tune what's built, add the next system if your tier includes it, and report on what it's actually saving you.",
  },
  {
    num: "V",
    title: "Ongoing: we keep scaling",
    body: "Month-to-month after the minimum. Real results or it doesn't continue.",
  },
];

const FAQS = [
  {
    q: "Why a retainer instead of a one-off project?",
    a: "Because AI systems need tuning after they go live, and because I don't sell projects — I sell partnerships that build, optimise and scale. The build is inside month 1 of the retainer; there's no separate build fee.",
  },
  {
    q: "What's the minimum commitment?",
    a: `${DISPLAY.AI_RETAINER_MIN} on every tier, stated plainly. After that, it's month-to-month — real results or it doesn't continue.`,
  },
  {
    q: "Is this compliant with the new privacy rules?",
    a: "Every system I build is privacy-compliant by design — that's the other half of my practice. See the foundation page for what that actually covers.",
  },
  {
    q: "Do I need new software?",
    a: "Built on what you already use where possible: your CRM, your inbox, your job management system. I'm not selling you a new platform to learn.",
  },
];

export default function AiDeliveryPage() {
  return (
    <>
      <PageHero
        badge="AI GROWTH PARTNER · RETAINER FROM AU$1,500/MO"
        title="We don't sell AI projects. We sell partnerships that build, optimise and scale."
        sub="Pick your tier. The first system goes live in month 1 — inside the retainer, not a separate build fee. Every plan is privacy-compliant by design."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · Australian-owned
            · single-operator practice · {DISPLAY.AI_RETAINER_MIN} on every tier
          </>
        }
      >
        <AnimatedButton href="/audit" variant="primary" ariaLabel="Get your free AI audit">
          Get your free AI audit →
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      <section aria-label="What partnership means here" style={{ padding: "0 20px var(--space-12)", position: "relative", zIndex: 2 }}>
        <Inscription
          label="No separate build fee. No second sale later."
          sub="The machine carries the repetition — the plumbing, the follow-up, the reporting. You keep the calls that need judgement."
        >
          One system live in month 1.
          <br />
          <span style={{ color: "var(--gold)" }}>Everything after that is tuning.</span>
        </Inscription>
      </section>

      {/* TIERS */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={1} total={5} />
          <SystemLabel style={{ marginBottom: 10 }}>Partnership tiers · scoped on the audit call</SystemLabel>
          <SectionHeading title="Choose Your Partnership" lead={`Three retainer tiers. ${DISPLAY.AI_RETAINER_MIN} on all of them.`} />
          <div className="grid-auto-cards" style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
            {TIERS.map((t) => (
              <article
                key={t.tier}
                style={{
                  background: "var(--card)",
                  border: t.popular ? "1px solid var(--gold)" : "1px solid var(--gold-dim)",
                  borderRadius: "var(--radius-md)",
                  padding: "26px 24px",
                  position: "relative",
                }}
              >
                {t.popular && (
                  <span
                    style={{
                      position: "absolute",
                      top: -12,
                      left: 24,
                      background: "var(--gold)",
                      color: "#0a0a0a",
                      fontSize: "var(--fs-xs)",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "3px 10px",
                      borderRadius: 999,
                    }}
                  >
                    Most Popular
                  </span>
                )}
                <h3 style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--gold)", fontSize: "var(--fs-lg)", marginBottom: 6 }}>
                  {t.name}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-h3)", fontWeight: 700, marginBottom: 4 }}>{t.price}</p>
                <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", marginBottom: 14 }}>{DISPLAY.AI_RETAINER_MIN}</p>
                <p style={{ color: "var(--ice)", fontSize: "var(--fs-sm)", marginBottom: 10 }}>{t.who}</p>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, marginBottom: 18 }}>{t.body}</p>
                <AnimatedButton href={`/order/ai?tier=${t.tier}`} variant={t.popular ? "primary" : "secondary"}>
                  Order {t.name} →
                </AnimatedButton>
              </article>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 24 }}>
            Every plan includes: {INCLUDED.join(" · ")}
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHAT I BUILD */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={2} total={5} />
          <SectionHeading title="What We Build" lead="If it's repetitive, we automate it." />
          <div className="grid-auto-cards" style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
            {WHAT_I_BUILD.map((item) => (
              <article
                key={item.title}
                style={{ background: "var(--card)", border: "1px solid var(--gold-dim)", borderRadius: "var(--radius-md)", padding: "26px 24px" }}
              >
                <h3 style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--gold)", fontSize: "var(--fs-lg)", marginBottom: 10, lineHeight: 1.3 }}>
                  {item.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* HOW IT WORKS */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={3} total={5} />
          <SectionHeading title="How It Works" />
          <GoldThread steps={HOW_IT_WORKS} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* PRIVACY */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={4} total={5} />
          <SectionHeading title="Privacy Built In, Not Bolted On" />
          <p style={{ color: "var(--text)", fontSize: "var(--fs-lg)", maxWidth: "var(--maxw-prose)", margin: "0 auto", lineHeight: 1.7, textAlign: "center" }}>
            Every AI shop can build you a chatbot. None of them can tell you it&apos;s privacy-compliant
            by design — because compliance is my other practice. See{" "}
            <a href="/compliance" style={{ color: "var(--gold)" }}>what that covers</a>.
          </p>
          <OperatorNote style={{ margin: "var(--space-8) auto 0" }}>
            I won&apos;t build you an automation that creates a compliance problem I&apos;d then
            have to fix for someone else. That&apos;s the whole reason both practices sit
            with the one person.
          </OperatorNote>
        </div>
      </SectionReveal>

      <Testimonials offer="ai-delivery" heading="What AI Partnership Customers Said" />

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={5} total={5} />
          <SectionHeading title="Questions I Get" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            {FAQS.map((f) => (
              <FaqItem key={f.q} question={f.q}>
                {f.a}
              </FaqItem>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* FINAL CTA */}
      <SectionReveal style={{ textAlign: "center", padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <OmegaSeal caption="Retainer. Privacy-compliant by design. No permission required to start." style={{ marginBottom: "var(--space-8)" }} />
        <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--gold)", fontSize: "var(--fs-h2)", fontWeight: 700, marginBottom: 14, letterSpacing: "0.05em" }}>
          Start with the free AI audit call.
        </h2>
        <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", maxWidth: "var(--maxw-prose)", margin: "0 auto 32px", lineHeight: 1.7 }}>
          No cost, no obligation, no pitch deck. Just a straight conversation about your business.
        </p>
        <AnimatedButton href="/audit" variant="primary">
          Book your free AI audit call →
        </AnimatedButton>
      </SectionReveal>
    </>
  );
}
