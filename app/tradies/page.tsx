import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
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
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12, maxWidth: "var(--maxw-micro)" }}>
          No card, no obligation. We send you five contract winners near your postcode, sourced and dated.
        </p>
      </PageHero>

      <Bluf>
        Job Flow finds you new work before it is advertised, for {DISPLAY.JOB_FLOW_MONTHLY} when it launches. Subbie Finder is available now.
      </Bluf>

      <SectionReveal style={{ padding: "var(--space-8) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <FlexNumber f={FLEX.market} />
          <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "18px 0 0", textAlign: "center" }}>
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
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={1} total={4} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>Every month, done for you</SystemLabel>
          <SectionHeading title="What You Get" lead="Five things, every month, for one flat price." />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <ul
              style={{
                listStyle: "none",
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: "var(--radius-md)",
                padding: "26px 28px",
                margin: 0,
              }}
            >
              {WHAT_YOU_GET.map((it) => (
                <li
                  key={it}
                  style={{
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.7,
                    padding: "10px 0 10px 26px",
                    position: "relative",
                  }}
                >
                  <span aria-hidden="true" style={{ position: "absolute", left: 0, color: "var(--ok)", fontWeight: 700 }}>
                    ✓
                  </span>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionReveal>

      <OpenLoop>That is a lot of work found for you. How much of it is on you?</OpenLoop>

      <div className="divider-gold" />

      {/* HOW IT WORKS */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={2} total={4} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>Three steps</SystemLabel>
          <SectionHeading title="How It Works" lead="You stay in control of everything that reaches a customer." />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 18,
              maxWidth: "var(--maxw-content)",
              margin: "0 auto",
            }}
          >
            {STEPS.map((s) => (
              <article
                key={s.n}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "24px 22px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-h2)",
                    fontWeight: 700,
                    lineHeight: 1,
                    marginBottom: 10,
                  }}
                >
                  {s.n}
                </div>
                <h3 style={{ color: "var(--ice)", fontSize: "var(--fs-lg)", margin: "0 0 8px" }}>{s.t}</h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, margin: 0 }}>{s.d}</p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <OpenLoop>And what does it cost, and how do you stop it if it is not working?</OpenLoop>

      <div className="divider-gold" />

      {/* PRICE + LADDER */}
      <SectionReveal id="pricing" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={3} total={4} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>The price</SystemLabel>
          <SectionHeading title="One Price. Cancel Any Time." lead="No lock-in. No setup fee. One email to stop." />
          <TempleFrame style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <article style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--ice)",
                  fontSize: "var(--fs-xs)",
                  letterSpacing: "0.18em",
                  marginBottom: 14,
                }}
              >
                JOB FLOW
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold)",
                  fontSize: "var(--fs-h2)",
                  fontWeight: 700,
                  lineHeight: 1.15,
                }}
              >
                {DISPLAY.JOB_FLOW_MONTHLY}
              </div>
              <p
                style={{
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  lineHeight: 1.75,
                  margin: "20px auto 24px",
                  maxWidth: "var(--maxw-prose)",
                }}
              >
                Launching soon. Billed monthly once live. Cancel any time with one email. Nothing more is charged after you cancel.
              </p>
              <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary" ariaLabel="Start with a free sample">
                START WITH THE FREE CHECK →
              </AnimatedButton>
            </article>
          </TempleFrame>
          <p
            style={{
              color: "var(--ice)",
              fontSize: "var(--fs-body)",
              maxWidth: "var(--maxw-prose)",
              margin: "var(--space-8) auto 0",
              lineHeight: 1.75,
              textAlign: "center",
            }}
          >
            Where it sits: <a href="/monitor" style={{ color: "var(--gold)" }}>Titanos Monitor</a> on its own is{" "}
            {DISPLAY.MONITOR_MONTHLY}, and Job Flow includes it. Job Flow is {DISPLAY.JOB_FLOW_MONTHLY}. If you later want
            a bigger build, <a href="/ai-delivery" style={{ color: "var(--gold)" }}>AI partner retainers</a> are
            there: {DISPLAY.AI_LADDER_ENTRY}.
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>A few things tradies ask before they trust a stranger with this.</OpenLoop>

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal id="faq" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <DepthIndex index={4} total={4} />
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>Straight answers</SystemLabel>
          <SectionHeading title="Before You Ask" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            {FAQ_ITEMS.map((f) => (
              <FaqItem key={f.q} question={f.q}>
                {f.a}
              </FaqItem>
            ))}
          </div>
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
      <SectionReveal style={{ textAlign: "center", padding: "var(--space-12) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h2)",
              fontWeight: 400,
              fontStyle: "italic",
              marginBottom: 14,
            }}
          >
            Would it be okay if I sent you a free sample?
          </h2>
          <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 22px" }}>
            If it looks useful and you are comfortable with all of that, would it be okay if I sent you five
            contract winners near your postcode, sourced and dated? You would see what it finds before you pay
            anything. A no is completely fine. Prefer to talk first? You can also book a free audit call.
          </p>
          <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary" ariaLabel="Start with a free sample">
            FREE SAMPLE: WINNERS NEAR YOU →
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
