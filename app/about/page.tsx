import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { SITE, AUDIT_BOOK_HREF } from "@/lib/config";

const CAL_15 = SITE.CAL_15MIN_URL;
const ABR_VERIFY = "https://abr.business.gov.au/ABN/View?id=34318502254";

export const metadata: Metadata = {
  title: "About — Kyle Deligny · TITANOS",
  description:
    "Solo operator, Brisbane. ABN 34 318 502 254 (verifiable). AI systems built for your business, privacy-compliant by design. 1,700+ automated scans run this month.",
  alternates: { canonical: "https://titanos.tech/about" },
  openGraph: {
    title: "About — Kyle Deligny · Titanos",
    description:
      "Solo operator, Brisbane. ABN-verifiable. AI Growth Partner — privacy-compliant by design. One person, one fixed price.",
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
        acceptedAnswer: { "@type": "Answer", text: "Everything delivered stays kept — no platform lock-in, no dependency on the operator staying reachable for what's already built." },
      },
      {
        "@type": "Question",
        name: "Is my data safe with an AI-assisted operator?",
        acceptedAnswer: { "@type": "Answer", text: "Privacy-compliant by design is the other half of the practice, not an afterthought — see the compliance page for exactly what that covers." },
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
        tagline="Kyle Deligny — Brisbane, Australia. No funding, no team, no permission asked. Just a decision to start, and a standard for what's allowed to ship."
        sub="No agency layer between you and the work. No junior 'managed services' team you'll never meet. If you book the call, you book me."
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
        <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">
          BOOK YOUR FREE AI AUDIT CALL
        </AnimatedButton>
        <AnimatedButton href="/methodology" variant="secondary">
          SEE THE METHODOLOGY
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      {/* THE ORIGIN — the myth, load-bearing, not decorative. Photo + pull-quote
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
            TITANOS didn&apos;t start with a pitch deck, a round of funding, or a co-founder
            to argue the plan with. It started on a phone, with an idea and the decision to
            stop waiting for someone else&apos;s approval to act on it. No investors to brief
            before a decision. No hiring plan to justify before shipping something. No
            committee standing between a judgement call and the thing going live.
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            That&apos;s not a sympathy story — it&apos;s a resourcefulness one. Fewer
            resources meant every decision had to earn its place: build systems instead of
            headcount, let the machine carry the repeatable work, and keep human judgement
            concentrated exactly where it&apos;s worth the most. The constraint became the
            method.
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            Every system live on this site, I built and I run — the free scanner, the
            compliance pipeline, the partner network processing real Stripe payments with an
            append-only audit trail, the monitoring that pages me directly the second
            something breaks, at any hour. Not a portfolio of case studies from a team I
            manage. Production infrastructure I operate personally, every day, right now, for
            real clients and real money — the scan is real, the compliance pack is real, the
            audit trail is real. Nothing on this page is a mockup.
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
            }}
          >
            Brisbane-based, ABN-verifiable, one person end to end — the audit call, the
            build, the sign-off, the 3am page if something goes wrong. If that&apos;s the
            kind of operator you want on your systems, keep reading — or skip straight to
            how you check any of it.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* THE CHILD AND THE OPERATOR — how the work actually gets done: the
          division of labour between the AI doing the building and the human
          deciding what's allowed to ship. */}
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
            THE CHILD AND THE OPERATOR
          </h2>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            Claude Code does the keystroke-level building — fast, tireless, willing to try
            the thing that hasn&apos;t been tried yet. Left to itself, that instinct just
            keeps asking &quot;what if?&quot; That&apos;s exactly what you want from a system
            that builds. It is not what you want deciding whether the build ships.
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            That&apos;s where I sit. Before anything goes live, it answers four questions:
            Does it work? Is it safe? Can it be repeated? Can I reverse it if I&apos;m wrong?
            The machine proposes. The human decides. That&apos;s not a slogan for this page —
            it&apos;s the actual workflow, every day, on every system this site claims to
            run.
          </p>
          <blockquote
            style={{
              margin: "24px 0",
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
            &quot;The machine handles the complexity. The human decides what
            matters.&quot;
          </blockquote>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
            }}
          >
            Nothing here requires you to trust that division blindly. It&apos;s the same
            standard the rest of this page is built to survive — check it below.
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
            Three things. A free security check that shows what a hacker can see about your
            business — no payment, no sales funnel. A fixed-price Privacy Act compliance
            engagement for AU small businesses preparing for the 10 December 2026 deadline.
            And AI implementation projects — I find the manual task eating your team&apos;s
            week and build the system that does it instead, quoted by scope after a free call.
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            The work is done by me with Claude Code, Anthropic&apos;s agentic coding tool, doing
            the keystroke-level execution. I diagnose, plan, scope, sign off. The tool
            ships. If the math is wrong, that&apos;s on me — and I&apos;m the one you talk
            to when it is.
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
              </a>{" "}
              — government source of truth for ABN 34 318 502 254.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>My own scan:</strong>{" "}
              <a href="/scan#self-scan" style={{ color: "var(--ice)" }}>
                titanos.tech/scan
              </a>{" "}
              — every finding from my self-scan, published in full.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>Methodology:</strong>{" "}
              <a href="/methodology" style={{ color: "var(--ice)" }}>
                titanos.tech/methodology
              </a>{" "}
              — exactly what I do, what I never do, and how to reproduce any finding.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>Email:</strong>{" "}
              <a href="mailto:kyle@titanos.tech" style={{ color: "var(--ice)" }}>
                kyle@titanos.tech
              </a>{" "}
              — email security verified (DKIM, SPF, DMARC all in place).
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>Calendar:</strong>{" "}
              <a
                href={CAL_15}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--ice)" }}
              >
                cal.com/kyle-deligny-msvz6s/15min
              </a>{" "}
              — 15 minutes is enough to know if I&apos;m useful to you.
            </li>
            {/* Fix 2b — LinkedIn row, placeholder-gated. Renders only when SITE.LINKEDIN_URL set. */}
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
                </a>{" "}
                — work history, recommendations, mutual connections.
              </li>
            )}
          </ul>

          {/*
            OPERATOR_INPUT (Fix 2b — see lib/config.ts):
            - PHOTO_PATH → headshot file in /public, e.g. "/kyle.jpg".
            - LINKEDIN_URL → profile URL. Renders the row above.
            - Certifications held (IRAP / ISO 27001 / CySA+ / Essential Eight assessor)
              still TODO — add a fourth section if any get held.
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
            None of this is a template. It&apos;s one person starting without asking
            permission, keeping the receipts, and letting you check every one of them
            before you pay a cent. If there&apos;s a version of that you could run yourself,
            good — that&apos;s the point.
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
            No account manager, no junior team you'll never meet. The person who takes the audit call is the person who builds and signs off the work — and everything above is how you check that's true before you pay a cent.
          </FaqItem>
          <FaqItem question="What if you're unavailable later?">
            You keep everything delivered — no platform lock-in, no dependency on me staying reachable for what's already built.
          </FaqItem>
          <FaqItem question="Is my data safe with an AI-assisted operator?">
            Privacy-compliant by design is the other half of my practice, not an afterthought — see /compliance for exactly what that covers.
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
          Same operator behind each one.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">
            FREE AI AUDIT CALL
          </AnimatedButton>
          <AnimatedButton href="/compliance" variant="secondary">
            COMPLIANCE PACK
          </AnimatedButton>
          <AnimatedButton href="/scan" variant="secondary">
            FREE SCAN
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
