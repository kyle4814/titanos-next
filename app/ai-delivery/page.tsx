import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import Testimonials from "@/components/Testimonials";
import { SCOPING_CALL_URL, SCOPING_CALL_LABEL, SITE } from "@/lib/config";
import { PRICING, DISPLAY } from "@/lib/pricing";

// Fix 5c — until a 30-min cal.com event exists, scoping CTA derives
// label + URL from config and quietly relabels to 15-MIN. The 30-min
// length stays the spec'd default; config provides the swap point.
const SCOPING_LENGTH_MINUTES = SITE.CAL_30MIN_URL ? 30 : 15;

const META_TITLE = "AI Implementation for Business — TITANOS";
const META_DESC = `AI Diagnostic ${DISPLAY.AI_DIAGNOSTIC} (2 weeks, credits to a build). AI Build ${DISPLAY.AI_BUILD_FLOOR} quoted by scope. AI Ops Retainer ${DISPLAY.AI_OPS_RETAINER} post-build.`;

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

const PROBLEMS = [
  {
    title: "The deck is done. The thing isn’t built.",
    body: "Strategy consultants delivered the AI roadmap eight months ago. The engineering team still hasn’t found a free quarter to ship the first prototype. Momentum dies.",
  },
  {
    title: "The big-four quote is 12 months and $2M.",
    body: "Procurement-grade SOWs scale to procurement-grade pricing. Most of what you actually want built doesn’t justify either the calendar or the budget.",
  },
  {
    title: "Internal teams are at capacity.",
    body: "Your AI/ML engineers exist. They are fully booked on the current roadmap. New capabilities have to wait or get outsourced to whoever shows up first.",
  },
];

const DELIVERABLES = [
  {
    title: "Custom AI workflow",
    body: "When the answer is \u201chave your team use AI better\u201d \u2014 a Claude Project, custom GPT, or Make.com / n8n flow your team actually opens every day. Lives in your tooling, not mine. Trained on your context, your voice, your data.",
  },
  {
    title: "AI in your codebase",
    body: "When there's a repo, I commit working code to your GitHub or GitLab \u2014 reviewed by your engineers before merge, deployed in your staging then production environment. You own it from day one.",
  },
  {
    title: "AI-run process",
    body: "When the right answer is \u201chave AI do this work continuously\u201d \u2014 doc generation, email triage, research, lead enrichment \u2014 I set it up and hand it over. Or run it as a service if you'd rather. Either way, fully documented.",
  },
  {
    title: "Strategy, scoped sharply",
    body: "When the real question is \u201cwhere does AI actually fit here\u201d \u2014 a 2-week diagnostic ending in a prioritised, costed build list. No slide-deck consulting; the output is what to build next, by whom, in what order.",
  },
];

const STEPS = [
  {
    num: "I",
    title: `SCOPING CALL · ${SCOPING_LENGTH_MINUTES} MIN`,
    body: "You tell me what you’d build if delivery wasn’t the bottleneck. I tell you whether it’s a 4-week thing, a 12-week thing, or a “this needs to be three engagements” thing. No pitch. No slides.",
  },
  {
    num: "II",
    title: "FIXED-SCOPE SOW + DEPOSIT",
    body: "Within 72 hours of the call you receive a written SOW: scope, milestones, fixed price, delivery date. Approve, sign, pay 30% deposit. The remaining 70% is milestone-billed.",
  },
  {
    num: "III",
    title: "SHIP IN YOUR ENVIRONMENT",
    body: "I launch a Claude Code instance scoped to your engagement. Daily commits to a branch in your repo. Mid-engagement demo. Final delivery against SOW acceptance criteria. Done.",
  },
];

export default function AiDeliveryPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "AI Implementation for Business",
    provider: { "@type": "Organization", name: "Titanos" },
    serviceType: "AI System Implementation",
    description:
      "AI Diagnostic (2 weeks, fixed price, credits to a build), AI Build (quoted by scope after diagnostic), AI Ops Retainer (post-build only).",
    areaServed: ["AU", "NZ", "SG"],
    offers: [
      {
        "@type": "Offer",
        name: "AI Diagnostic",
        price: String(PRICING.AI_DIAGNOSTIC),
        priceCurrency: "AUD",
        description: "2-week prioritised, costed build list. Credits 100% toward a subsequent build.",
      },
      {
        "@type": "Offer",
        name: "AI Build",
        price: String(PRICING.AI_BUILD_FLOOR),
        priceCurrency: "AUD",
        priceSpecification: {
          "@type": "PriceSpecification",
          valueAddedTaxIncluded: false,
          description: `From ${DISPLAY.AI_BUILD_FLOOR} — quoted by scope after diagnostic or scoping call`,
        },
      },
      {
        "@type": "Offer",
        name: "AI Ops Retainer",
        price: String(PRICING.AI_OPS_RETAINER_LOW),
        priceCurrency: "AUD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          valueAddedTaxIncluded: false,
          referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
          description: `${DISPLAY.AI_OPS_RETAINER} — post-build only, maintains the dependency I shipped`,
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        badge="TITANOS · AI IMPLEMENTATION FOR BUSINESS"
        title="AI Implementation, Delivered"
        tagline="Not consulted. Not slide-ware. Shipped."
        sub="You don’t need another deck telling you AI matters. You need the capability built, integrated, and live in production. I diagnose the problem, plan the solution, build it in your repo, and implement it in your environment — 99% Claude Code, 1% expert human review."
        trustLine="Scoping → SOW → ship. Projects priced by scope. No retainer trap."
      >
        <AnimatedButton
          href={SCOPING_CALL_URL}
          external
          variant="primary"
          ariaLabel={`Book a ${SCOPING_LENGTH_MINUTES}-minute scoping call`}
        >
          {SCOPING_CALL_LABEL}
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="WHY ENTERPRISE AI PROJECTS STALL" />
          <div
            className="grid-auto-cards"
            style={{
              gap: 22,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {PROBLEMS.map((p) => (
              <article
                key={p.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 28,
                }}
              >
                <h4
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-body)",
                    letterSpacing: "0.06em",
                    marginBottom: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {p.title}
                </h4>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="WHAT SHIPS"
            lead="An outcome that solves the problem we scoped — built, integrated, live in your business. The shape depends on the problem."
          />
          <div
            className="grid-auto-cards"
            style={{
              gap: 22,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {DELIVERABLES.map((d) => (
              <article
                key={d.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 28,
                }}
              >
                <h3
                  style={{
                    color: "var(--ice)",
                    fontSize: "var(--fs-body)",
                    fontWeight: 600,
                    marginBottom: 10,
                    lineHeight: 1.35,
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                    letterSpacing: 0,
                  }}
                >
                  <span style={{ color: "var(--ok)", marginRight: 8, fontWeight: 400 }}>✓</span>
                  {d.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  {d.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="HOW IT WORKS" lead="Three steps, no surprises." />
          {/* Fix 6 — promote "1% human review is load-bearing" out of the FAQ into a visible callout */}
          <p
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto 24px",
              padding: "16px 22px",
              background: "rgb(var(--gold-rgb) / 0.06)",
              borderLeft: "3px solid var(--gold)",
              color: "var(--ice)",
              fontFamily: "var(--font-display), Georgia, serif",
              fontStyle: "italic",
              fontSize: "var(--fs-lg)",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            The 1% human review is the load-bearing 1%.
          </p>
          <div
            className="grid-auto-cards"
            style={{
              gap: 22,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {STEPS.map((s) => (
              <article
                key={s.num}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--gold-dim)",
                  borderRadius: "var(--radius-md)",
                  padding: "32px 26px 26px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-h3)",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  {s.num}
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-body)",
                    letterSpacing: "0.08em",
                    marginBottom: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  {s.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* Site Fix 4 — Restructured offer ladder: Diagnostic (fixed) + Build (floor) + Ops Retainer (post-build) */}
      <SectionReveal id="offer" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="TWO WAYS IN. ONE WAY TO STAY."
            lead="A fixed-price diagnostic to figure out what to build, a built thing in your repo, and a retainer to keep it alive after I ship — if you want one."
          />
          <div
            className="grid-auto-cards"
            style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}
          >
            {/* DIAGNOSTIC — fixed price */}
            <OfferTile
              tag="ENTRY · FIXED PRICE"
              title="AI Diagnostic"
              price={DISPLAY.AI_DIAGNOSTIC}
              priceUnit="2 weeks · fixed · credits 100% toward a build"
              body="I spend two weeks inside your stack. Output: a prioritised, costed build list — what to build next, in what order, by whom, with named tools and time estimates. No slide-deck consulting. If you commission a build off the back of it, the diagnostic credits in full against the build SOW."
              ctaLabel={SCOPING_CALL_LABEL}
              ctaHref={SCOPING_CALL_URL}
            />
            {/* BUILD — floor */}
            <OfferTile
              tag="BUILD · QUOTED BY SCOPE"
              title="AI Build"
              price={DISPLAY.AI_BUILD_FLOOR}
              priceUnit="quoted by scope · fixed-price SOW · deposit + milestones"
              body="I diagnose the problem, plan the solution, build it in your repo, and implement it in your environment. Daily commits to a branch you own. Mid-engagement demo. Final delivery against SOW acceptance criteria. One operator, no subcontractor chain."
              ctaLabel={SCOPING_CALL_LABEL}
              ctaHref={SCOPING_CALL_URL}
            />
          </div>
          <p
            style={{
              textAlign: "center",
              color: "var(--ice)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.7,
              maxWidth: "var(--maxw-prose)",
              margin: "32px auto 0",
            }}
          >
            Project-quoted within range.{" "}
            <strong style={{ color: "var(--gold)" }}>
              You see the full SOW with the fixed price before you pay a deposit.
            </strong>
          </p>

          {/* Fix 6 — delivered-state-on-pause clause (retained from prior PR) */}
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "32px auto 0",
              padding: "22px 24px",
              background: "var(--card)",
              border: "1px solid var(--gold-dim)",
              borderLeft: "3px solid var(--gold)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <h4
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                color: "var(--gold)",
                fontSize: "var(--fs-body)",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              IF I DISAPPEAR MID-ENGAGEMENT
            </h4>
            <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, margin: 0 }}>
              You keep the branch, the docs, and a refund of unearned milestones. It&apos;s in the SOW.
            </p>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* Site Fix 4 — AI Ops Retainer (post-build only) */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="AFTER I SHIP, I CAN KEEP IT ALIVE"
            lead="The post-build problem nobody warns you about: AI stacks shift fast. Models deprecate. Tools break. The thing I built becomes the thing you depend on."
          />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <article
              style={{
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: "var(--radius-md)",
                padding: "32px 30px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--ice)",
                  fontSize: "var(--fs-xs)",
                  letterSpacing: "0.18em",
                  marginBottom: 10,
                }}
              >
                AI OPS RETAINER · POST-BUILD ONLY
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold)",
                  fontSize: "var(--fs-h3)",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  marginBottom: 14,
                }}
              >
                {DISPLAY.AI_OPS_RETAINER}
              </div>
              <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.75, marginBottom: 14 }}>
                I maintain it, extend it, fix it when your stack shifts, and commit improvements
                monthly. Same accountable contact as the build. Same branch, same docs. The
                retainer band reflects depth of dependency — single-workflow at the floor, full
                AI-run pipeline at the ceiling. Quoted at the end of the build.
              </p>
              <p
                style={{
                  color: "var(--ice)",
                  fontSize: "var(--fs-body)",
                  lineHeight: 1.7,
                  fontStyle: "italic",
                  background: "rgb(var(--gold-rgb) / 0.06)",
                  borderLeft: "3px solid var(--gold)",
                  padding: "12px 16px",
                  margin: "18px 0",
                }}
              >
                Sold only after a build — because I won&apos;t retainer something I didn&apos;t build
                and don&apos;t understand.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <AnimatedButton href={SITE.CAL_15MIN_URL} external variant="secondary">
                  Discuss after your build
                </AnimatedButton>
              </div>
            </article>
          </div>
        </div>
      </SectionReveal>

      {/* TRUST STRIP */}
      <SectionReveal
        as="div"
        style={{
          background: "var(--card)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "50px 20px",
          textAlign: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            color: "var(--text)",
            fontSize: "var(--fs-body)",
            lineHeight: 2,
          }}
        >
          <div>
            <strong style={{ color: "var(--gold)", fontFamily: "var(--font-display), Georgia, serif" }}>
              ABN 34 318 502 254
            </strong>{" "}
            · AU jurisdiction · single-operator practice
          </div>
          <div>
            Powered by{" "}
            <strong style={{ color: "var(--gold)", fontFamily: "var(--font-display), Georgia, serif" }}>
              Claude Code
            </strong>{" "}
            — Anthropic’s flagship reasoning model, AI-native delivery end-to-end
          </div>
          {/* Fix 5d — kill "Titanos Security" sister-brand split. One operator, one brand, three doors. */}
          <div>
            The same practice runs{" "}
            <strong style={{ color: "var(--gold)", fontFamily: "var(--font-display), Georgia, serif" }}>
              1,700+ external security scans this month
            </strong>{" "}
            — see{" "}
            <a href="/methodology" style={{ color: "var(--ice)" }}>
              /methodology
            </a>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="THE QUESTIONS EVERY CTO ASKS FIRST" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <FaqItem question="Are you a real consulting firm or a one-person shop running an AI agent?">
              Single-operator practice. I run every engagement. The leverage comes
              from Claude Code doing the implementation work under continuous human review — the
              same pattern senior engineers use to ship faster, applied as a delivery business
              model. You get one accountable contact, no subcontractor chain, no project manager
              between you and the code.
            </FaqItem>
            <FaqItem question="How do you handle my IP and source code?">
              Mutual NDA before scoping call if you want one. Engagement work happens in a branch
              on your own repository — I never hold your source. All Claude Code runs are scoped
              to the engagement; no training, no cross-client reuse, no retained context after
              handover.
            </FaqItem>
            <FaqItem question="What about model outputs that are wrong?">
              Every line of code, every prompt, every model invocation is reviewed by me before
              commit. The 1% human review is the load-bearing 1%. I also write test coverage and
              (where applicable) evals — so wrongness is caught by the test suite, not by your
              users.
            </FaqItem>
            <FaqItem question="What if you disappear mid-engagement?">
              SOW includes a “delivered-state-on-pause” clause. If the engagement halts for any
              reason, you get the current branch state, the documentation written to date, and a
              refund of unearned milestone billing. No retainer trap.
            </FaqItem>
            <FaqItem question="Can our procurement do a vendor security review?">
              Yes. I’ve completed external attack-surface DD on myself —{" "}
              <a href="/our-scan" style={{ color: "var(--ice)" }}>see the findings</a>. I’ll fill
              in any vendor risk assessment your procurement requires.
            </FaqItem>
            <FaqItem question="How fast can we start?">
              Scoping call usually within 3 business days of your enquiry. SOW within 72 hours of
              the scoping call. Engagement starts on deposit clearance — typically inside 10
              business days from first email.
            </FaqItem>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal
        style={{
          textAlign: "center",
          padding: "var(--space-20) 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
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
          READY TO SCOPE A BUILD?
        </h2>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-lg)",
            marginBottom: 32,
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          Tell me what you’d build if delivery wasn’t the bottleneck.{" "}
          {SCOPING_LENGTH_MINUTES}-minute scoping call. No deck. No salespeople.
          One operator.
        </p>
        <AnimatedButton href={SCOPING_CALL_URL} external variant="primary">
          BOOK THE SCOPING CALL
        </AnimatedButton>
      </SectionReveal>

      {/* Render-only-if-non-empty testimonials block — Fix 2c */}
      <Testimonials offer="ai-delivery" heading="WHAT AI-IMPLEMENTATION CUSTOMERS SAID" />
    </>
  );
}

function OfferTile({
  tag,
  title,
  price,
  priceUnit,
  body,
  ctaLabel,
  ctaHref,
}: {
  tag: string;
  title: string;
  price: string;
  priceUnit: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <article
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-md)",
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--ice)",
          fontSize: "var(--fs-xs)",
          letterSpacing: "0.16em",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {tag}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h3)",
          fontWeight: 700,
          letterSpacing: "0.04em",
          lineHeight: 1.25,
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h3)",
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {price}
        <span
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-xs)",
            fontWeight: 400,
            display: "block",
            marginTop: 4,
            letterSpacing: "0.02em",
          }}
        >
          {priceUnit}
        </span>
      </div>
      <p
        style={{
          color: "var(--text)",
          fontSize: "var(--fs-body)",
          lineHeight: 1.7,
          margin: "16px 0 22px",
          flexGrow: 1,
        }}
      >
        {body}
      </p>
      <AnimatedButton href={ctaHref} external variant="primary">
        {ctaLabel}
      </AnimatedButton>
    </article>
  );
}
