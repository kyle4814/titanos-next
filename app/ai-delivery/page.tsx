import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import Faq from "@/components/w2e/Faq";
import s from "@/components/w2e/w2e.module.css";
import { GlowCard, BentoGrid, BentoItem } from "@/components/house";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import Testimonials from "@/components/Testimonials";
import { DISPLAY } from "@/lib/pricing";
import { Inscription, SystemLabel, DepthIndex, OperatorNote, OmegaSeal } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexGrid, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

const META_TITLE = "AI Partnership Retainers for Australian Businesses | Titanos";
const META_DESC = `Monthly AI partnerships that build, optimise and scale your business, from ${DISPLAY.AI_GROWTH_PARTNER}. Privacy-compliant by design. ${DISPLAY.AI_RETAINER_MIN}.`;

const baseMetadata: Metadata = {
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

export const metadata: Metadata = withSeo("/ai-delivery", baseMetadata);

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
    popular: false,
  },
  {
    tier: "embedded",
    name: "Embedded AI Partner",
    price: DISPLAY.AI_EMBEDDED_PARTNER,
    who: "For established businesses needing full transformation",
    body: "A full-stack AI partnership: end-to-end automation strategy, custom development, and team enablement.",
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
  { title: "AI Lead Gen & Outreach Systems", body: "Finds and follows up with the customers you're currently missing, in your voice, on autopilot." },
  { title: "AI Customer Service & Support Bots", body: "Answers the same ten questions your inbox gets every day, instantly, correctly, in your tone." },
  { title: "AI Appointment & Booking Systems", body: "Books, reminds, and reschedules without anyone touching a calendar." },
  { title: "AI Content & Social Media Machines", body: "Keeps your channels active without you writing a single post." },
  { title: "AI Sales & Follow-Up Automations", body: "Chases every quote, every lead, every unanswered message until someone answers." },
  { title: "AI Data & Insights Dashboards", body: "Your numbers, pulled from the systems you already run, in your inbox before Monday's meeting." },
  { title: "AI Admin Automations", body: "Data entry, invoicing, onboarding, documents. The repetitive work, gone." },
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
    body: "Growth, Ops, or Embedded, sized to your business. Every tier has a 3-month minimum, no fine print.",
  },
  {
    num: "III",
    title: "Month 1: I build",
    body: "The first system goes live in month 1, inside the retainer, not billed separately. One sale, recurring from day one.",
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
    a: "Because AI systems need tuning after they go live, and because I don't sell projects. I sell partnerships that build, optimise and scale. The build is inside month 1 of the retainer. There's no separate build fee.",
  },
  {
    q: "What's the minimum commitment?",
    a: `${DISPLAY.AI_RETAINER_MIN} on every tier, stated plainly. After that, it's month-to-month. Real results or it doesn't continue.`,
  },
  {
    q: "Is this compliant with the new privacy rules?",
    a: "Every system I build is privacy-compliant by design. That's the other half of my practice. See the foundation page for what that actually covers.",
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
        badge={`AI GROWTH PARTNER · RETAINER FROM ${DISPLAY.AI_GROWTH_PARTNER.toUpperCase()}`}
        title="A roughly 20-person team's output behind your build, for one monthly price."
        sub="That figure is modelled with the COCOMO method, and the method is on the Engineering page. Pick your tier and the first system goes live in month 1, inside the retainer, with no separate build fee. Every plan is privacy-compliant by design."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · Australian-owned
            · single-operator practice · {DISPLAY.AI_RETAINER_MIN} on every tier
          </>
        }
      >
        <AnimatedButton href="/audit" variant="primary" ariaLabel="Get your free AI audit">
          Get your free consultation and report →
        </AnimatedButton>
      </PageHero>
      <div className={s.scope}>
      <Bluf replaced>
        Three monthly partnerships that build the AI system taking repetitive work off your team, with the first one live in month 1.
      </Bluf>
      <Analogy k="powersteering" />

      <SectionReveal style={{ padding: "var(--space-8) 20px 0", position: "relative", zIndex: 2 }}>
        <FlexGrid items={[FLEX.engineers, FLEX.costPerJob]} />
        <p className={s.intro}>
          Before you ask. I am Kyle Deligny, a sole trader (ABN 34 318 502 254), and you deal with me directly. I build on
          the tools you already use, and I only touch accounts you have given me access to. Nobody is replaced, your IT
          person stays in charge and is welcome in every meeting, and the price of each tier is below.
        </p>
      </SectionReveal>
      <OpenLoop>So what do you actually get for the monthly price, and when does the first piece go live?</OpenLoop>

      <div className="divider-gold" />

      <section aria-label="What partnership means here" style={{ padding: "0 20px var(--space-12)", position: "relative", zIndex: 2 }}>
        <Inscription
          label="No separate build fee. No second sale later."
          sub="The machine carries the repetition: the plumbing, the follow-up, the reporting. You keep the calls that need judgement."
        >
          One system live in month 1.
          <br />
          <span style={{ color: "var(--gold)" }}>Everything after that is tuning.</span>
        </Inscription>
      </section>

      {/* TIERS */}
      <SectionReveal className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={1} total={5} />
          <SystemLabel style={{ marginBottom: 10 }}>Partnership tiers · scoped on the audit call</SystemLabel>
          <SectionHeading title="Choose Your Partnership" lead={`Three retainer tiers. ${DISPLAY.AI_RETAINER_MIN} on all of them.`} />
          <div className={s.tiers}>
            {TIERS.map((t) => (
              <GlowCard key={t.tier} as="article" className={`${s.tier}${t.popular ? ` ${s.tierPop}` : ""}`}>
                {t.popular && <span className={s.badge}>Most Popular</span>}
                <h3 className={s.tierName}>{t.name}</h3>
                <p className={s.price}>{t.price}</p>
                <p className={s.min}>{DISPLAY.AI_RETAINER_MIN}</p>
                <p className={s.who}>{t.who}</p>
                <p className={s.tierBody}>{t.body}</p>
                <AnimatedButton href={`/order/ai?tier=${t.tier}`} variant={t.popular ? "primary" : "secondary"}>
                  Order {t.name} →
                </AnimatedButton>
              </GlowCard>
            ))}
          </div>
          <p className={s.small}>
            Every plan includes: {INCLUDED.join(" · ")}
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>What kinds of jobs do these partnerships take off your plate? Here is the list.</OpenLoop>

      <div className="divider-gold" />

      {/* WHAT I BUILD */}
      <SectionReveal className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={2} total={5} />
          <SectionHeading title="What We Build" lead="If it is repetitive, it is a candidate. Which of these already eats your week?" />
          <BentoGrid className={s.wide}>
            {WHAT_I_BUILD.map((item, i) => (
              <BentoItem key={item.title} span={i < 3 ? 4 : 6} style={{ padding: 0 }}>
                <GlowCard as="article" className={s.card}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </GlowCard>
              </BentoItem>
            ))}
          </BentoGrid>
        </div>
      </SectionReveal>

      <OpenLoop>And what does the first month look like, hour by hour?</OpenLoop>

      <div className="divider-gold" />

      {/* HOW IT WORKS */}
      <SectionReveal className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={3} total={5} />
          <SectionHeading title="How It Works" lead="Five steps, and the first one is a free conversation." />
          <GoldThread steps={HOW_IT_WORKS} />
        </div>
      </SectionReveal>

      <OpenLoop>One more thing people ask me early: what happens to your customers&apos; data?</OpenLoop>

      <div className="divider-gold" />

      {/* PRIVACY */}
      <SectionReveal className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={4} total={5} />
          <SectionHeading title="Privacy Built In, Not Bolted On" lead="Compliance is my other practice, so it comes along for free." />
          <p className={s.proseLg}>
            Building a chatbot is the easy part. Making it privacy-compliant by design is where my other
            practice comes in, because compliance is what I do all day. See{" "}
            <a href="/compliance" className={s.link}>what that covers</a>.
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
      <SectionReveal className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={5} total={5} />
          <SectionHeading title="Questions I Get" lead="The ones people ask before they commit to anything." />
          <Faq items={FAQS} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* FINAL CTA */}
      <SectionReveal style={{ textAlign: "center", padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <OmegaSeal caption="Retainer. Privacy-compliant by design. No permission required to start." style={{ marginBottom: "var(--space-8)" }} />
        <h2 className={s.ctaH}>
          Would it be okay if we started with a free chat?
        </h2>
        <p className={s.ctaP}>
          No cost, no obligation, no pitch deck. Just a straight conversation about the most repetitive job in your business, and a report of your own to keep. If it is not for you, a no is welcome.
        </p>
        <AnimatedButton href="/audit" variant="primary">
          Message Kyle for a free consultation and report →
        </AnimatedButton>
      </SectionReveal>
      <FrontLoad
        extra={[
          { q: "What do I get in month 1?", a: "Your highest-impact system, built and live, inside the retainer. Months 2 and 3 tune it against how you actually use it, then it runs month-to-month." },
        ]}
      />
      <FreeStart />
      </div>
    </>
  );
}
