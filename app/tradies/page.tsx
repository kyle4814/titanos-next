import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import Faq from "@/components/w2e/Faq";
import s from "@/components/w2e/w2e.module.css";
import { GlowCard, BentoGrid, BentoItem } from "@/components/house";
import { PRICING, DISPLAY } from "@/lib/pricing";
import { AUDIT_MESSAGE_HREF } from "@/lib/config";
import { SystemLabel, DepthIndex, TempleFrame } from "@/components/Myth";
import { Bluf, FrontLoad } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

// Job Flow: tradie entry offer, approved by Kyle 2026-10-05.
// Sits on the ladder between Monitor and the AI retainers. Register: plain,
// owner-operator, no pressure. The free first step reuses the site's
// existing free consultation route (AUDIT_MESSAGE_HREF); no new form backend.

const META_TITLE = `Job Flow for Tradies: New Work Found Before It's Advertised | ${DISPLAY.JOB_FLOW_MONTHLY}`;
const META_DESC = `Job Flow finds you new work before it is advertised: who won the contract near you, fresh local leads, more reviews. ${DISPLAY.JOB_FLOW_MONTHLY}, launching soon. Subbie Finder is live.`;

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/tradies" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/tradies",
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

export const metadata: Metadata = withSeo("/tradies", baseMetadata);

const WHAT_YOU_GET = [
  "Winners near you: contract awards in your postcode and radius each month, with value, scope, suburb and how to reach the head contractor who now needs subbies.",
  "Fresh local leads: 50 commercial leads near you that match your trade (for example property managers, builders, strata managers and facilities managers), each with business name, phone and website.",
  "Review booster: review-request messages for last month's finished jobs, and replies drafted for any new Google reviews.",
  `Scam shield: TITANOS Monitor included. A monthly check of your business email settings, with alerts. On its own that is ${DISPLAY.MONITOR_MONTHLY}.`,
  "One-page monthly report: what was sent, and what came back.",
];

const STEPS = [
  { n: "1", t: "Tell us your trade and area", d: "Your trade, postcode, radius and the smallest job worth your time. Nothing else to set up." },
  { n: "2", t: "We find the work", d: "We match fresh contract awards and local leads to your settings, and write review requests in your voice." },
  { n: "3", t: "You call and win", d: "You ring the winners and leads that fit. You stay in control of every word that reaches anyone." },
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Who are you?",
    a: "I am Kyle Deligny, the founder of TITANOS, an Australian sole trader (ABN 34 318 502 254). You deal with me directly.",
  },
  {
    q: "Will you message my customers?",
    a: "No. Nothing is sent to your customers unless you send it. We hand you the messages and you decide what goes out.",
  },
  {
    q: "What do you need from me?",
    a: "Your trade, your postcode and how far you travel. Any customer details you share for review requests are only used to write your messages, never sold and never shared.",
  },
  {
    q: "Does this replace anyone?",
    a: "No. Nobody is replaced. It gives you hours back from searching and writing, so more of your week goes to the actual work.",
  },
  {
    q: "How do I cancel?",
    a: "Send one email and it is done. No lock-in, no setup fee, no retention call, no further charges after you cancel.",
  },
  {
    q: "I already have an IT person. Where do they fit?",
    a: "They stay. Scam shield only checks your email settings from the outside and alerts you, and your IT person is welcome to see everything it finds.",
  },
  {
    q: "Is there any pressure or catch?",
    a: "No tactics and no pressure. The price is on this page, and the free sample comes first so you can see what it finds before paying anything.",
  },
  {
    q: "What does it cost?",
    a: `${DISPLAY.JOB_FLOW_MONTHLY}, billed monthly, no setup fee, once Job Flow launches. Subbie Finder (the contract-winners list on its own) is available now for AU$99 a month.`,
  },
];

export default function TradiesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Job Flow",
    description:
      "A monthly done-for-you service for tradies and small service businesses: contract winners near you, local commercial leads, review requests and drafted review replies, email security monitoring, and a one-page monthly report.",
    brand: { "@type": "Organization", name: "Titanos", url: "https://titanos.tech" },
    offers: {
      "@type": "Offer",
      name: "Monthly",
      price: String(PRICING.JOB_FLOW_MONTHLY),
      priceCurrency: PRICING.MONITOR_CURRENCY,
      availability: "https://schema.org/InStock",
      url: "https://titanos.tech/tradies",
    },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <PageHero
        badge="JOB FLOW · FOR TRADIES · LAUNCHING SOON"
        title="New work found before it's advertised."
        tagline={`Every month: who just won the contract near you, fresh local leads and more reviews. ${DISPLAY.JOB_FLOW_MONTHLY} when it launches. Cancel any time, no lock-in, no setup fee.`}
        sub="For sparkies, plumbers, builders, cleaners, landscapers and other small service businesses. Want a taste today? Subbie Finder, the contract-winners list on its own, is available now at /offers/subbie-finder."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · Australian-owned · Run by Kyle Deligny
          </>
        }
      >
        <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary" ariaLabel="Start with a free sample">
          FREE SAMPLE: WINNERS NEAR YOU →
        </AnimatedButton>
        <p className={s.heroNote}>
          No card, no obligation. We send you five contract winners near your postcode, sourced and dated.
        </p>
      </PageHero>

      <div className={s.scope}>
      <Bluf>
        Job Flow finds you new work before it is advertised, for {DISPLAY.JOB_FLOW_MONTHLY} when it launches. Subbie Finder is available now.
      </Bluf>

      <SectionReveal style={{ padding: "var(--space-8) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <FlexNumber f={FLEX.market} />
          <p className={s.intro}>
            Before you ask. I am Kyle Deligny, a sole trader (ABN 34 318 502 254), and you deal with me directly. The
            contract awards and leads come from public records, nothing of yours is touched, and nothing goes to your
            customers unless you send it. Nobody is replaced, your IT person stays in charge, and the price is on this
            page.
          </p>
        </div>
      </SectionReveal>
      <OpenLoop>So what does a month of Job Flow actually put in your hands?</OpenLoop>

      <div className="divider-gold" />

      {/* WHAT YOU GET */}
      <SectionReveal className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={1} total={4} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>Every month, done for you</SystemLabel>
          <SectionHeading title="What You Get" lead="Five things, every month, for one flat price." />
          <BentoGrid className={s.wide}>
            {WHAT_YOU_GET.map((it, i) => (
              <BentoItem key={it} as="div" span={i < 2 ? 6 : 4} style={{ padding: 0 }}>
                <GlowCard className={s.tick}>
                  <span className={s.tickMark} aria-hidden="true" />
                  <span>{it}</span>
                </GlowCard>
              </BentoItem>
            ))}
          </BentoGrid>
        </div>
      </SectionReveal>

      <OpenLoop>That is a lot of work found for you. How much of it is on you?</OpenLoop>

      <div className="divider-gold" />

      {/* HOW IT WORKS */}
      <SectionReveal className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={2} total={4} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>Three steps</SystemLabel>
          <SectionHeading title="How It Works" lead="You stay in control of everything that reaches a customer." />
          <BentoGrid className={s.wide}>
            {STEPS.map((st) => (
              <BentoItem key={st.n} span={4} style={{ padding: 0 }}>
                <GlowCard as="article" className={s.step}>
                  <div className={s.stepN} aria-hidden="true">{st.n}</div>
                  <h3>{st.t}</h3>
                  <p>{st.d}</p>
                </GlowCard>
              </BentoItem>
            ))}
          </BentoGrid>
        </div>
      </SectionReveal>

      <OpenLoop>And what does it cost, and how do you stop it if it is not working?</OpenLoop>

      <div className="divider-gold" />

      {/* PRICE + LADDER */}
      <SectionReveal id="pricing" className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={3} total={4} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>The price</SystemLabel>
          <SectionHeading title="One Price. Cancel Any Time." lead="No lock-in. No setup fee. One email to stop." />
          <TempleFrame style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <article className={s.priceBox}>
              <div className={s.priceTag}>JOB FLOW</div>
              <div className={s.priceBig}>{DISPLAY.JOB_FLOW_MONTHLY}</div>
              <p className={s.priceNote}>
                Launching soon. Billed monthly once live. Cancel any time with one email. Nothing more is charged after you cancel.
              </p>
              <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary" ariaLabel="Start with a free sample">
                START WITH THE FREE CHECK →
              </AnimatedButton>
            </article>
          </TempleFrame>
          <p className={s.proseTop}>
            Where it sits: <a href="/monitor" className={s.link}>Titanos Monitor</a> on its own is{" "}
            {DISPLAY.MONITOR_MONTHLY}, and Job Flow includes it. Job Flow is {DISPLAY.JOB_FLOW_MONTHLY}. If you later want
            a bigger build, <a href="/ai-delivery" className={s.link}>AI partner retainers</a> are
            there: {DISPLAY.AI_LADDER_ENTRY}.
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>A few things tradies ask before they trust a stranger with this.</OpenLoop>

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal id="faq" className={s.sec}>
        <div className="container-vault">
          <DepthIndex index={4} total={4} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>Straight answers</SystemLabel>
          <SectionHeading title="Before You Ask" />
          <Faq items={FAQ_ITEMS} />
        </div>
      </SectionReveal>

      <SectionReveal style={{ textAlign: "center", padding: "var(--space-8) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <AnimatedButton href="/offers" variant="secondary" ariaLabel="See every offer">
            SEE EVERY OFFER →
          </AnimatedButton>
        </div>
      </SectionReveal>

      <FrontLoad />

      {/* PERMISSION CLOSE */}
      <SectionReveal className={s.sec} style={{ paddingBottom: "var(--space-20)" }}>
        <div className={s.close}>
          <h2>Would it be okay if I sent you a free sample?</h2>
          <p>
            If it looks useful and you are comfortable with all of that, would it be okay if I sent you five
            contract winners near your postcode, sourced and dated? You would see what it finds before you pay
            anything. A no is completely fine. Prefer to talk first? You can also book a free audit call.
          </p>
          <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary" ariaLabel="Start with a free sample">
            FREE SAMPLE: WINNERS NEAR YOU →
          </AnimatedButton>
        </div>
      </SectionReveal>
      </div>
    </>
  );
}
