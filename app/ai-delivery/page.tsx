import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import Testimonials from "@/components/Testimonials";
import { SCOPING_CALL_URL, SCOPING_CALL_LABEL } from "@/lib/config";
import { DISPLAY } from "@/lib/pricing";

const AI_BUILD_PRICE = DISPLAY.AI_BUILD_FLOOR.replace(/^From /, "");
const AI_BUILD_FROM_LOWER = `from ${AI_BUILD_PRICE}`;

const META_TITLE = `AI Implementation for Australian Small Business — From ${AI_BUILD_PRICE} | Titanos`;
const META_DESC = `A working AI system built for your business, not a chatbot demo. Free 15-minute scoping call, fixed-price build ${AI_BUILD_FROM_LOWER}, personally reviewed and shipped by one operator.`;

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

const WHAT_I_BUILD = [
  {
    title: "Quote follow-up that chases every unanswered quote",
    body: "For 30 days, every quote you send that goes quiet gets a plain-English follow-up in your voice. No more revenue sitting in a sent-items folder.",
  },
  {
    title: "Inbox triage that drafts the replies you'd write anyway",
    body: "The same 10 questions make up 80% of your inbox. This drafts the reply so you approve and send, instead of typing it from scratch every time.",
  },
  {
    title: "A weekly numbers report that writes itself",
    body: "Pulled straight from the systems you already use, no new dashboard to check, no spreadsheet to maintain. It lands in your inbox before Monday's meeting.",
  },
  {
    title: "Intake forms that fill your job management software",
    body: "A customer request goes straight into the system your team already works from, instead of into your inbox where it waits for someone to retype it.",
  },
];

const HOW_IT_WORKS: ThreadStep[] = [
  {
    num: "I",
    title: "Free 15-minute call",
    body: "No deck, no discovery workshop. Tell me the task eating your week. If I can't solve it, or it's not worth the money, I tell you on the call and we're done in 15 minutes.",
  },
  {
    num: "II",
    title: "Fixed-price scope, in writing",
    body: `Within 2 business days you get a written scope and a fixed price, ${AI_BUILD_FROM_LOWER}. No hourly rate, no surprise invoice later.`,
  },
  {
    num: "III",
    title: "I build it",
    body: "Typically 2–4 weeks, depending on scope. Built with Claude Code, Anthropic's agentic coding tool, every system personally reviewed and tested by me before handover.",
  },
  {
    num: "IV",
    title: "Handover, in plain English",
    body: "Documentation you can actually read, not a wiki nobody opens. You own what I build, no platform lock-in.",
  },
];

const FAQS = [
  {
    q: "Will this replace my staff?",
    a: "No. It removes the work nobody wants to do. Quote chasing, inbox triage, retyping the same form into two systems. The work that's left is the work that actually needs a person.",
  },
  {
    q: "What if it breaks?",
    a: "30 days fix-it-free after handover. After that, the Ops Retainer or ad-hoc fixes, your call, no obligation to continue.",
  },
  {
    q: "Do I need new software?",
    a: "Built on what you already use where possible: your CRM, your inbox, your job management system. I'm not selling you a new platform to learn.",
  },
  {
    q: "Why so much cheaper than agencies?",
    a: "One operator, agentic tooling, no office, no account managers. Same margin logic as the compliance page: you're not paying for a floor of people you'll never talk to.",
  },
];

export default function AiDeliveryPage() {
  return (
    <>
      <PageHero
        badge={`FREE CALL · FIXED PRICE · ${DISPLAY.AI_BUILD_FLOOR.toUpperCase()}`}
        title="You don't need an AI strategy. You need one problem solved."
        sub={`Pick the task that eats your week — quoting, follow-ups, reporting, admin. I scope it in a free 15-minute call, quote a fixed price, and build it. ${DISPLAY.AI_BUILD_FLOOR}. No retainer required to start.`}
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · Australian-owned
            · single-operator practice · you own everything I build
          </>
        }
      >
        <AnimatedButton href={SCOPING_CALL_URL} external variant="primary" ariaLabel="Book the free scoping call">
          Book the free 15-min scoping call →
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      {/* WHAT I ACTUALLY BUILD */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="What I Actually Build"
            lead="No jargon, no digital transformation. Four examples of the kind of task that's worth automating."
          />
          <div
            className="grid-auto-cards"
            style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}
          >
            {WHAT_I_BUILD.map((item) => (
              <article
                key={item.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--gold-dim)",
                  borderRadius: "var(--radius-md)",
                  padding: "26px 24px",
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-lg)",
                    letterSpacing: "0.02em",
                    marginBottom: 10,
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* HOW IT WORKS */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="How It Works" />
          <GoldThread steps={HOW_IT_WORKS} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* PRICING */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Pricing" />
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
            <p style={{ color: "var(--text)", fontSize: "var(--fs-lg)", lineHeight: 1.7, marginBottom: 14 }}>
              Build {AI_BUILD_FROM_LOWER}, fixed price, scoped on the call. No hourly rates,
              no surprise invoices.
            </p>
            <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
              Optional Ops Retainer, {DISPLAY.AI_OPS_RETAINER}: monitoring, iteration, and support after
              handover. Explicitly optional. Explicitly cancellable any time.
            </p>
          </div>
          <p style={{ textAlign: "center", marginTop: 28 }}>
            <AnimatedButton href={SCOPING_CALL_URL} external variant="primary">
              {SCOPING_CALL_LABEL}
            </AnimatedButton>
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHO'S BUILDING IT */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Who's Building It" />
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-lg)",
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto",
              lineHeight: 1.7,
              textAlign: "center",
            }}
          >
            One operator, Kyle Deligny, ABN 34 318 502 254: the same person who runs the{" "}
            <a href="/compliance" style={{ color: "var(--gold)" }}>
              Privacy Act compliance practice
            </a>
            . Built with Claude Code, Anthropic&apos;s agentic coding tool, every system
            personally reviewed and tested by me before handover. Same trust stack as{" "}
            <a href="/about" style={{ color: "var(--gold)" }}>
              everything else I do
            </a>
            .
          </p>
        </div>
      </SectionReveal>

      <Testimonials offer="ai-delivery" heading="What AI Build Customers Said" />

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
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
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            fontWeight: 700,
            marginBottom: 14,
            letterSpacing: "0.05em",
          }}
        >
          You don&apos;t need an AI strategy. You need one problem solved.
        </h2>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-body)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          Pick the task that eats your week — quoting, follow-ups, reporting, admin. I scope it in
          a free 15-minute call, quote a fixed price, and build it. {DISPLAY.AI_BUILD_FLOOR}. No
          retainer required to start.
        </p>
        <AnimatedButton href={SCOPING_CALL_URL} external variant="primary">
          Book the free 15-min scoping call →
        </AnimatedButton>
      </SectionReveal>
    </>
  );
}
