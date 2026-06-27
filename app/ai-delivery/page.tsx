import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import Testimonials from "@/components/Testimonials";
import { SCOPING_CALL_URL, SCOPING_CALL_LABEL, SITE } from "@/lib/config";
import { PRICING, DISPLAY } from "@/lib/pricing";

const SCOPING_LENGTH_MINUTES = SITE.CAL_30MIN_URL ? 30 : 15;

const META_TITLE =
  "Titanos AI Implementation — Automate the Manual Work in Your Business";
const META_DESC = `Free scoping call (no charge, no obligation). I find the highest-leverage task to automate in your AU business and build the AI system that does it. Builds ${DISPLAY.AI_BUILD_FLOOR.toLowerCase()}, quoted by scope.`;

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

// Outcomes, not engineer-shop framing. Each card is a "what could land in your
// business" — broad enough that the scoping call decides the exact build,
// narrow enough that an SMB owner reads one and thinks "that's my Tuesday."
const BUILDS = [
  {
    title: "Kill the manual busywork",
    body:
      "The repetitive task someone on your team does every day — sorting enquiries, copying data between systems, chasing forms, formatting reports. I automate it so it just happens.",
  },
  {
    title: "Custom internal tools",
    body:
      "A dashboard that pulls your numbers into one place. A search tool over your documents. A quote generator. A lead-scoring system. Small, sharp tools built for exactly how your business works.",
  },
  {
    title: "Customer-facing AI",
    body:
      "An assistant that answers your customers' questions from your own information. AI that handles first-touch enquiries. Drafted responses your team just approves and sends. The visible stuff that makes you look five years ahead.",
  },
  {
    title: "Document & data processing",
    body:
      "Bulk-process your PDFs, contracts, records, applications — extract, sort, summarise, flag. The paperwork mountain, handled. (And because compliance is my other practice, it's built to handle your data properly.)",
  },
];

const STEPS = [
  {
    num: "I",
    tag: "SCOPING CALL · FREE · 15–30 MIN",
    title: "Scoping call",
    body:
      "We get on a call, I dig into how your business runs, and I tell you honestly the highest-leverage thing worth automating and what it'd cost to build. No charge, no obligation. If there's nothing worth doing, I'll say so on the call.",
  },
  {
    num: "II",
    tag: `BUILD · FROM ${DISPLAY.AI_BUILD_FLOOR.toUpperCase()} · QUOTED BY SCOPE`,
    title: "Build",
    body:
      "I build the thing we picked, ship it working into your business, and document it so your team can actually use it. Working system, not a slide deck. Fixed-scope SOW from the call so there are no surprises.",
  },
  {
    num: "III",
    tag: `MAINTAIN (OPTIONAL) · ${DISPLAY.AI_OPS_RETAINER.toUpperCase()}`,
    title: "Maintain",
    body:
      "Once it's live, I can keep it alive — fix it when your tools change, extend it as you grow, improve it monthly. Sold only after a build, because I won't maintain something I didn't build and don't understand.",
  },
];

export default function AiDeliveryPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "AI Implementation for Australian Businesses",
    provider: { "@type": "Organization", name: "Titanos" },
    serviceType: "AI System Implementation",
    description:
      "Free scoping call → Build → Maintain. I find the highest-leverage manual task in your business and ship the AI system that does it.",
    areaServed: ["AU", "NZ", "SG"],
    offers: [
      {
        "@type": "Offer",
        name: "AI Build",
        price: String(PRICING.AI_BUILD_FLOOR),
        priceCurrency: "AUD",
        priceSpecification: {
          "@type": "PriceSpecification",
          valueAddedTaxIncluded: false,
          description: `${DISPLAY.AI_BUILD_FLOOR} — fixed-scope SOW, deposit + milestones, shipped working into your business`,
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
          description: `${DISPLAY.AI_OPS_RETAINER} — post-build only, maintains and extends what I shipped`,
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
        badge="TITANOS · AI IMPLEMENTATION"
        title="Tell me the manual task eating your week. I'll build an AI system that does it — shipped, working, in your business."
        tagline="Most AU businesses know AI could save them hours but have no idea where to start or who to trust. I find the highest-leverage thing to automate in your business, build it, and hand it over working. No jargon, no offshore dev team, no half-finished prototype. One operator who ships."
        sub="Built for Australian small and mid-sized businesses — accountants, clinics, agencies, trades, professional services. Plain English on the call. You don't need to know what a repo is."
        trustLine={
          <>
            Australian-owned ·{" "}
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> ·{" "}
            you own everything I build
          </>
        }
      >
        <AnimatedButton href="/order/ai" variant="primary" ariaLabel="Start AI implementation enquiry">
          START AI ENQUIRY →
        </AnimatedButton>
        <AnimatedButton href={SCOPING_CALL_URL} external variant="secondary" ariaLabel={`Book a free ${SCOPING_LENGTH_MINUTES}-minute scoping call`}>
          {SCOPING_CALL_LABEL}
        </AnimatedButton>
        <AnimatedButton href="#how-it-works" variant="secondary">
          SEE HOW IT WORKS ↓
        </AnimatedButton>
        <p
          style={{
            width: "100%",
            textAlign: "center",
            color: "var(--ice)",
            fontSize: "var(--fs-sm)",
            letterSpacing: "0.04em",
            marginTop: 10,
            opacity: 0.85,
          }}
        >
          Free, no obligation. If there&apos;s nothing worth automating, I&apos;ll tell you on the call.
        </p>
      </PageHero>

      <div className="divider-gold" />

      {/* WHAT I ACTUALLY BUILD — outcome-framed, broad. The exact build is
          decided on the free scoping call; these are the most common shapes. */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="WHAT I ACTUALLY BUILD"
            lead="Every business is different, so I don't sell a product off a shelf — I find what's worth automating in YOURS. Common builds:"
          />
          <div
            className="grid-auto-cards"
            style={{
              gap: 22,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {BUILDS.map((b) => (
              <article
                key={b.title}
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
                  {b.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  {b.body}
                </p>
              </article>
            ))}
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
            Not sure which applies to you?{" "}
            <strong style={{ color: "var(--gold)" }}>
              That&apos;s exactly what the free scoping call is for
            </strong>{" "}
            — I figure out the highest-leverage build for your business before you commit to
            building anything.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* HOW IT WORKS — three-step ladder. Free scoping call → Build →
          optional post-build Retainer. Build is the only paid entry point. */}
      <SectionReveal
        id="how-it-works"
        style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}
      >
        <div className="container-vault">
          <SectionHeading
            title="HOW IT WORKS"
            lead="A free call first, so we both know what's worth building. Then I build it. Then I keep it alive — only if you want."
          />
          {/* "1% human review is the load-bearing 1%" callout — preserved from prior PR */}
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
            I use AI to build fast, but a human (me) reviews everything that ships. The
            automation does the volume; the part I check by hand is the part that keeps
            it from embarrassing you — and the part where the legal accountability sits.
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
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--ice)",
                    fontSize: "var(--fs-xs)",
                    letterSpacing: "0.14em",
                    marginBottom: 10,
                    textTransform: "uppercase",
                  }}
                >
                  {s.tag}
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-body)",
                    letterSpacing: "0.08em",
                    marginBottom: 14,
                    lineHeight: 1.4,
                    textTransform: "uppercase",
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

      {/* PRICING — free scoping call leads in (no checkout, no card),
          Build is the only paid entry, Retainer is post-build only. */}
      <SectionReveal id="offer" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="THE LADDER"
            lead="Start with the free call. If there's something worth building, you get a fixed-scope SOW. The Retainer is post-build only — sold once, after I've shipped something."
          />
          {/* Lead with the free scoping call — no price card, just the CTA */}
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto 28px",
              padding: "26px 26px 22px",
              background: "rgb(var(--gold-rgb) / 0.06)",
              border: "1px solid var(--gold-dim)",
              borderLeft: "3px solid var(--gold)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                color: "var(--ice)",
                fontSize: "var(--fs-xs)",
                letterSpacing: "0.18em",
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              START HERE · FREE
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
              Scoping Call — Free
            </h3>
            <p
              style={{
                color: "var(--text)",
                fontSize: "var(--fs-body)",
                lineHeight: 1.7,
                margin: "0 auto 18px",
                maxWidth: "var(--maxw-micro)",
              }}
            >
              {SCOPING_LENGTH_MINUTES}-minute call. I tell you honestly the highest-leverage
              thing worth automating and what it&apos;d cost to build. No charge, no obligation.
            </p>
            <div style={{ display: "inline-flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <AnimatedButton href="/order/ai" variant="primary" ariaLabel="Start AI implementation enquiry">
                START AI ENQUIRY →
              </AnimatedButton>
              <AnimatedButton href={SCOPING_CALL_URL} external variant="secondary" ariaLabel={`Book a free ${SCOPING_LENGTH_MINUTES}-minute scoping call`}>
                {SCOPING_CALL_LABEL}
              </AnimatedButton>
            </div>
          </div>
          <div
            className="grid-auto-cards"
            style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}
          >
            <OfferTile
              tag="BUILD · QUOTED BY SCOPE"
              title="AI Build"
              price={DISPLAY.AI_BUILD_FLOOR}
              priceUnit="fixed-scope SOW from the call · deposit + milestones · delivery date in writing"
              body="I build the thing we picked, ship it working into your business, and document it so your team can use it. Working system, not a slide deck. One accountable contact. No subcontractor chain."
              ctaLabel="START AI ENQUIRY →"
              ctaHref="/order/ai"
            />
            <OfferTile
              tag="MAINTAIN · OPTIONAL · POST-BUILD ONLY"
              title="AI Ops Retainer"
              price={DISPLAY.AI_OPS_RETAINER}
              priceUnit="monthly · sold only after a Build · band reflects depth of dependency"
              body="Once it's live, I can keep it alive — fix it when your tools change, extend it as you grow, improve it monthly. Same accountable contact as the Build. Sold only after a Build, because I won't maintain something I didn't build and don't understand."
              ctaLabel="Discuss after your build"
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
            Build is project-quoted within range.{" "}
            <strong style={{ color: "var(--gold)" }}>
              You see the full SOW with the fixed price before you pay a deposit.
            </strong>
          </p>

          {/* delivered-state-on-pause trust box — preserved from prior PR */}
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
              IF I HAVE TO PAUSE OR STEP AWAY MID-ENGAGEMENT
            </h4>
            <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, margin: 0 }}>
              You keep everything I built to that point, the documentation, and a refund of any
              unearned milestone. It&apos;s written into the agreement.
            </p>
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
            · Australian-owned · single-operator practice · you own everything I build
          </div>
          <div>
            Powered by{" "}
            <strong style={{ color: "var(--gold)", fontFamily: "var(--font-display), Georgia, serif" }}>
              Claude Code
            </strong>{" "}
            — drafted by AI, reviewed and signed off by me on every engagement
          </div>
          <div>
            Compliance is my other practice — see{" "}
            <a href="/compliance" style={{ color: "var(--ice)" }}>
              /compliance
            </a>{" "}
            and{" "}
            <a href="/methodology" style={{ color: "var(--ice)" }}>
              /methodology
            </a>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="THE QUESTIONS I GET FIRST" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <FaqItem question="I don't know what to automate. Is that a problem?">
              No — that&apos;s exactly what the free scoping call is for. Most owners I work
              with come in saying &ldquo;something with AI, I think?&rdquo; and leave the call
              with a shortlist of the things worth doing, ranked by hours-saved-per-dollar, and
              a rough cost for each. You pick. If nothing&apos;s worth building, I&apos;ll tell
              you on the call.
            </FaqItem>
            <FaqItem question="Are you a real consulting firm or a one-person shop?">
              Single-operator practice. I run every engagement personally. The leverage comes
              from using AI to build faster under continuous human review — same pattern good
              engineers use to ship more, applied as a delivery business. One accountable
              contact, no project manager between you and the work, no offshore team you
              never meet.
            </FaqItem>
            <FaqItem question="What about model outputs that are wrong?">
              Every line of code, every prompt, every AI output is reviewed by me before it
              ships. The human review is the part that takes the legal accountability — my ABN
              is on the work. I also write test coverage (where it makes sense) so wrong outputs
              get caught before your customers see them.
            </FaqItem>
            <FaqItem question="What if you disappear mid-engagement?">
              The agreement includes a delivered-state-on-pause clause. If I have to step away
              for any reason, you keep everything built to that point, the documentation, and a
              refund of any unearned milestone. No retainer trap.
            </FaqItem>
            <FaqItem question="How is this different from hiring an AI consultancy?">
              Consultancies sell you a deck. I ship a working system. Their model is hours
              billed; mine is fixed scope with a delivery date in writing. They subcontract
              implementation; I do it. And the scoping call is free — most consultancies charge
              for a discovery workshop and hand you a slide deck. I hand you a quote and a plan.
            </FaqItem>
            <FaqItem question="Do you sign NDAs?">
              Yes, mutual NDA before the scoping call if you want one. Engagement work lives in
              your own systems — I never retain your data after handover.
            </FaqItem>
            <FaqItem question="How fast can we start?">
              Scoping call usually within 3 business days of your enquiry. Fixed-scope SOW
              within 72 hours of the call. Build starts on deposit clearance — typically inside
              10 business days from first email.
            </FaqItem>
            <FaqItem question="Can our procurement do a vendor security review?">
              Yes. I&apos;ve completed external attack-surface DD on myself —{" "}
              <a href="/our-scan" style={{ color: "var(--ice)" }}>see the findings</a>. I&apos;ll
              fill in any vendor risk assessment your procurement requires.
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
          TELL ME WHAT'S EATING YOUR WEEK
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
          Free {SCOPING_LENGTH_MINUTES}-minute scoping call. Plain English. If there&apos;s
          nothing worth automating I&apos;ll tell you on the call — no invoice, no follow-up
          sequence.
        </p>
        <AnimatedButton href="/order/ai" variant="primary" ariaLabel="Start AI implementation enquiry">
          START AI ENQUIRY →
        </AnimatedButton>
        <AnimatedButton href={SCOPING_CALL_URL} external variant="secondary" ariaLabel={`Book a free ${SCOPING_LENGTH_MINUTES}-minute scoping call`}>
          {SCOPING_CALL_LABEL}
        </AnimatedButton>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-sm)",
            letterSpacing: "0.04em",
            marginTop: 12,
            opacity: 0.85,
          }}
        >
          Free, no obligation.
        </p>
      </SectionReveal>

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
      <AnimatedButton href={ctaHref} external={/^https?:\/\//.test(ctaHref)} variant="primary">
        {ctaLabel}
      </AnimatedButton>
    </article>
  );
}
