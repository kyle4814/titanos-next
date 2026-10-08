import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { SITE, CONTACT, AUDIT_MESSAGE_HREF } from "@/lib/config";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

const ABR_VERIFY = "https://abr.business.gov.au/ABN/View?id=34318502254";

export const metadata: Metadata = {
  title: "About · Kyle Deligny · TITANOS",
  description:
    "Solo operator, Brisbane. ABN 34 318 502 254 (verifiable). AI systems built for your business, privacy-compliant by design.",
  alternates: { canonical: "https://titanos.tech/about" },
  openGraph: {
    title: "About · Kyle Deligny · Titanos",
    description:
      "Solo operator, Brisbane. ABN-verifiable. AI Growth Partner, privacy-compliant by design. One person, one fixed price.",
    type: "profile",
    url: "https://titanos.tech/about",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Why should I trust a solo operator over an agency?",
        acceptedAnswer: { "@type": "Answer", text: "No account manager, no junior team you'll never meet. The person who takes the audit call is the person who builds and signs off the work." },
      },
      {
        "@type": "Question",
        name: "What if you're unavailable later?",
        acceptedAnswer: { "@type": "Answer", text: "Everything delivered stays kept. No platform lock-in, no dependency on the operator staying reachable for what's already built." },
      },
      {
        "@type": "Question",
        name: "Is my data safe with an AI-assisted operator?",
        acceptedAnswer: { "@type": "Answer", text: "Privacy-compliant by design is the other half of the practice, not an afterthought. See the compliance page for exactly what that covers." },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PageHero
        badge="ABOUT THE OPERATOR"
        title="Built from a phone. Run by one operator."
        tagline="I am Kyle Deligny, founder of TITANOS, the Titan Operating System. Hypersonic Industries and Parallax Industries are its divisions. I work alone, I have no paying clients yet, and I would rather you check me than trust me."
        sub="No agency layer between you and the work, and no junior team you will never meet. If you message me, you get me."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> ·{" "}
            <a
              href={ABR_VERIFY}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--ice)" }}
            >
              Verify on the Australian Business Register ↗
            </a>
          </>
        }
      >
        <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary">
          BOOK YOUR FREE CONSULTATION AND REPORT
        </AnimatedButton>
        <AnimatedButton href="/methodology" variant="secondary">
          SEE THE METHODOLOGY
        </AnimatedButton>
      </PageHero>
      <Bluf replaced>
        TITANOS is one engineer, Kyle Deligny, built to give your business the output of a roughly 20-person team (by the COCOMO estimate), safely, and without replacing anyone.
      </Bluf>
      <Analogy k="department" />

      <SectionReveal style={{ padding: "var(--space-12, 32px) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <FlexNumber f={FLEX.engineers} />
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8, margin: "18px 0 0" }}>
            Method: the industry COCOMO model, run over the code written since 4 June 2026. It is a model, not a timesheet, and the
            Engineering page shows every step so you can re-run it. Before you ask: it only reads public records, it touches
            nothing inside your business, nobody gets replaced, your IT provider stays in charge, and the first step costs nothing.
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>So who is the one person behind that number, and how would you check him?</OpenLoop>

      <div className="divider-gold" />

      {/* THE ORIGIN: the myth, load-bearing, not decorative. Photo + pull-quote
          give the operator a face and a stance before any service copy runs. */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h3)",
              letterSpacing: "0.06em",
              marginBottom: 24,
            }}
          >
            THE ORIGIN
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-8)",
              alignItems: "flex-start",
              marginBottom: 28,
            }}
          >
            {SITE.PHOTO_PATH && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={SITE.PHOTO_PATH}
                alt="Kyle Deligny, founder of Titanos, Brisbane"
                width={220}
                height={270}
                style={{
                  width: 220,
                  height: 270,
                  objectFit: "cover",
                  border: "1px solid var(--gold-dim)",
                  borderRadius: "var(--radius-sm)",
                  flexShrink: 0,
                }}
              />
            )}
            <blockquote
              style={{
                margin: 0,
                flex: "1 1 320px",
                borderLeft: "2px solid var(--gold)",
                paddingLeft: "var(--space-6)",
                fontFamily: "var(--font-display), Georgia, serif",
                fontStyle: "italic",
                fontWeight: 300,
                color: "var(--gold-bright)",
                fontSize: "var(--fs-h4)",
                lineHeight: 1.5,
              }}
            >
              &quot;You don&apos;t need permission to begin.&quot;
            </blockquote>
          </div>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            TITANOS started on a phone, with an idea and a decision to stop waiting for someone
            else&apos;s approval. I have no revenue yet and I am raising a small pre-seed
            round so I can do this full-time.
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            Every system live on this site, I built and I run: the free scanner, the
            compliance pipeline, the partner network on live Stripe checkout with an
            append-only audit trail, and the monitoring that pages me directly the second
            something breaks. Nothing here is a mockup. With no paying clients yet, the fair
            thing is to show you my own systems first.
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
            }}
          >
            Brisbane-based, ABN-verifiable, one person end to end: the audit call, the
            build, the sign-off, and the 3am page if something breaks. Curious how you would
            check any of that? It is all further down, under how you verify me.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h3)",
              letterSpacing: "0.06em",
              marginBottom: 16,
            }}
          >
            WHAT I ACTUALLY DO
          </h2>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            Three things, and no need to pick one now. A free security check: what a hacker
            can see about your business, from public records only, with no payment and no sales
            funnel. A fixed-price Privacy Act compliance engagement for AU small businesses
            preparing for the 10 December 2026 deadline. And AI implementation: I find the manual
            task eating your team&apos;s week and build the system that takes it off their plate,
            quoted by scope after a free call, with your people kept and your IT provider still in
            charge. Which of the three is closest to what is slowing you down right now?
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            I diagnose, plan and scope every job myself. Claude Code, Anthropic&apos;s
            coding tool, does the keystroke-level build. I decide what is
            allowed to ship, and I sign off before anything goes live. If the maths is wrong,
            that is on me, and I am the one you talk to.
          </p>

          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h3)",
              letterSpacing: "0.06em",
              marginBottom: 16,
              marginTop: 32,
            }}
          >
            HOW YOU VERIFY ME
          </h2>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
            }}
          >
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>ABR:</strong>{" "}
              <a
                href={ABR_VERIFY}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--ice)" }}
              >
                abr.business.gov.au/ABN/View?id=34318502254
              </a>
              . Government source of truth for ABN 34 318 502 254.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>My own scan:</strong>{" "}
              <a href="/scan#self-scan" style={{ color: "var(--ice)" }}>
                titanos.tech/scan
              </a>
              . Every finding from my self-scan, published in full.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>Methodology:</strong>{" "}
              <a href="/methodology" style={{ color: "var(--ice)" }}>
                titanos.tech/methodology
              </a>
              . Exactly what I do, what I never do, and how to reproduce any finding.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>Email:</strong>{" "}
              <a href="mailto:kyle@titanos.tech" style={{ color: "var(--ice)" }}>
                kyle@titanos.tech
              </a>
              . Email security verified (DKIM, SPF, DMARC all in place).
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>Telegram:</strong>{" "}
              <a href={CONTACT.TELEGRAM_URL} style={{ color: "var(--ice)" }}>
                {CONTACT.TELEGRAM_HANDLE}
              </a>
              . {CONTACT.HOURS} A few minutes is enough to know if I&apos;m useful to you.
            </li>
            {/* Fix 2b: LinkedIn row, placeholder-gated. Renders only when SITE.LINKEDIN_URL set. */}
            {SITE.LINKEDIN_URL && (
              <li style={{ marginBottom: 10 }}>
                <strong style={{ color: "var(--gold)" }}>LinkedIn:</strong>{" "}
                <a
                  href={SITE.LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--ice)" }}
                >
                  {SITE.LINKEDIN_URL.replace(/^https?:\/\//, "")}
                </a>
                . Work history, recommendations, mutual connections.
              </li>
            )}
          </ul>

          {/*
            OPERATOR_INPUT (Fix 2b, see lib/config.ts):
            - PHOTO_PATH → headshot file in /public, e.g. "/kyle.jpg".
            - LINKEDIN_URL → profile URL. Renders the row above.
            - Certifications held (IRAP / ISO 27001 / CySA+ / Essential Eight assessor)
              still TODO, add a fourth section if any get held.
          */}

          <p
            style={{
              color: "var(--dim)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginTop: 28,
              paddingTop: 24,
              borderTop: "1px solid var(--border)",
            }}
          >
            None of this is a template. It is one person starting without asking
            permission, keeping the receipts, and letting you check every one of them
            before you pay a cent. If you could run a version of this yourself, good. That
            is rather the point.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h3)",
              letterSpacing: "0.06em",
              marginBottom: 16,
            }}
          >
            QUESTIONS ABOUT WORKING WITH ME
          </h2>
          <FaqItem question="Why should I trust a solo operator over an agency?">
            No account manager, no junior team you will never meet. The person who takes the audit call is the person who builds and signs off the work. Everything above is how you check that is true before you pay a cent.
          </FaqItem>
          <FaqItem question="What if you're unavailable later?">
            You keep everything delivered. No platform lock-in, no dependency on me staying reachable for what's already built.
          </FaqItem>
          <FaqItem question="Is my data safe with an AI-assisted operator?">
            Privacy-compliant by design is the other half of my practice, not an afterthought. See /compliance for exactly what that covers, and note the free check reads public records only and touches nothing of yours.
          </FaqItem>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal
        style={{
          textAlign: "center",
          padding: "var(--space-16) 20px var(--space-30)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            letterSpacing: "0.06em",
            marginBottom: 18,
          }}
        >
          PICK YOUR FRONT DOOR
        </h2>
        <p
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-lg)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 26px",
            lineHeight: 1.7,
          }}
        >
          Same operator behind each one. Would it be okay if I started you on the free scan? A no is welcome, and you owe me nothing.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="primary">
            FREE AI AUDIT: MESSAGE KYLE
          </AnimatedButton>
          <AnimatedButton href="/compliance" variant="secondary">
            COMPLIANCE PACK
          </AnimatedButton>
          <AnimatedButton href="/scan" variant="secondary">
            FREE SCAN
          </AnimatedButton>
        </div>
      </SectionReveal>
      <FrontLoad
        extra={[
          { q: "Who will I actually deal with?", a: "Me. There is no agency layer and no junior team you will never meet. If you message or call, you get Kyle." },
        ]}
      />
      <FreeStart />
    </>
  );
}
