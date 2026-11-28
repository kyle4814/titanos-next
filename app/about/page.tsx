import { TEAM_SIZE_PHRASE } from "@/lib/ledger";
import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import "@/components/w2a/w2a.css";
import "./about.css";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { SITE, CONTACT, AUDIT_MESSAGE_HREF } from "@/lib/config";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";
import { OperatorSections } from "@/components/home/moved/OperatorSections";

const ABR_VERIFY = "https://abr.business.gov.au/ABN/View?id=34318502254";

const baseMetadata: Metadata = {
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

export const metadata: Metadata = withSeo("/about", baseMetadata);

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
            <strong style={{ color: "var(--pe-gold)" }}>ABN 34 318 502 254</strong> ·{" "}
            <a
              href={ABR_VERIFY}
              target="_blank"
              rel="noopener noreferrer"
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
        TITANOS is one engineer, Kyle Deligny, built to give your business the output of a {TEAM_SIZE_PHRASE} (by the COCOMO estimate), safely, and without replacing anyone.
      </Bluf>
      <Analogy k="department" />

      <SectionReveal className="pe-page pe-page--narrow pe-section">
        <div className="w2a-measure">
          <FlexNumber f={FLEX.engineers} />
          <p className="pe-muted" style={{ lineHeight: 1.75, margin: "18px 0 0" }}>
            Method: the industry COCOMO model, run over the code written since 4 June 2026. It is a model, not a timesheet, and the
            Engineering page shows every step so you can re-run it. Before you ask: it only reads public records, it touches
            nothing inside your business, nobody gets replaced, your IT provider stays in charge, and the first step costs nothing.
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>So who is the one person behind that number, and how would you check him?</OpenLoop>

      <div className="pe-page pe-page--narrow">
        {/* THE ORIGIN: the myth, load-bearing, not decorative. Photo + pull-quote
            give the operator a face and a stance before any service copy runs. */}
        <SectionReveal className="pe-section">
          <p className="pe-eyebrow-line">The operator</p>
          <h2>The origin</h2>
          <div className="pe-origin">
            {SITE.PHOTO_PATH && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={SITE.PHOTO_PATH}
                alt="Kyle Deligny, founder of Titanos, Brisbane"
                decoding="async"
                width={220}
                height={270}
                className="pe-origin__photo"
              />
            )}
            <blockquote className="pe-origin__quote">
              &quot;You don&apos;t need permission to begin.&quot;
            </blockquote>
          </div>
          <div className="pe-prose">
            <p>
              TITANOS started on a phone, with an idea and a decision to stop waiting for someone
              else&apos;s approval. I have no revenue yet and I am raising a small pre-seed
              round so I can do this full-time.
            </p>
            <p>
              Every system live on this site, I built and I run: the free scanner, the
              compliance pipeline, the partner network on live Stripe checkout with an
              append-only audit trail, and the monitoring that pages me directly the second
              something breaks. Nothing here is a mockup. With no paying clients yet, the fair
              thing is to show you my own systems first.
            </p>
            <p>
              Brisbane-based, ABN-verifiable, one person end to end: the audit call, the
              build, the sign-off, and the 3am page if something breaks. Curious how you would
              check any of that? It is all further down, under how you verify me.
            </p>
          </div>
        </SectionReveal>

        <SectionReveal className="pe-section">
          <p className="pe-eyebrow-line">The work</p>
          <h2>What I actually do</h2>
          <div className="pe-prose">
            <p>
              Three things, and no need to pick one now. A free security check: what a hacker
              can see about your business, from public records only, with no payment and no sales
              funnel. A fixed-price Privacy Act compliance engagement for AU small businesses
              preparing for the 10 December 2026 deadline. And AI implementation: I find the manual
              task eating your team&apos;s week and build the system that takes it off their plate,
              quoted by scope after a free call, with your people kept and your IT provider still in
              charge. Which of the three is closest to what is slowing you down right now?
            </p>
            <p>
              I diagnose, plan and scope every job myself. Claude Code, Anthropic&apos;s
              coding tool, does the keystroke-level build. I decide what is
              allowed to ship, and I sign off before anything goes live. If the maths is wrong,
              that is on me, and I am the one you talk to.
            </p>
          </div>
        </SectionReveal>

        <SectionReveal className="pe-section">
          <p className="pe-eyebrow-line">Receipts</p>
          <h2>How you verify me</h2>
          <ul className="pe-verify">
            <li className="pe-card pe-card--pad">
              <strong>ABR:</strong>{" "}
              <a
                href={ABR_VERIFY}
                target="_blank"
                rel="noopener noreferrer"
              >
                abr.business.gov.au/ABN/View?id=34318502254
              </a>
              . Government source of truth for ABN 34 318 502 254.
            </li>
            <li className="pe-card pe-card--pad">
              <strong>My own scan:</strong>{" "}
              <a href="/scan#self-scan">
                titanos.tech/scan
              </a>
              . Every finding from my self-scan, published in full.
            </li>
            <li className="pe-card pe-card--pad">
              <strong>Methodology:</strong>{" "}
              <a href="/methodology">
                titanos.tech/methodology
              </a>
              . Exactly what I do, what I never do, and how to reproduce any finding.
            </li>
            <li className="pe-card pe-card--pad">
              <strong>Email:</strong>{" "}
              <a href="mailto:kyle@titanos.tech">
                kyle@titanos.tech
              </a>
              . Email security verified (DKIM, SPF, DMARC all in place).
            </li>
            <li className="pe-card pe-card--pad">
              <strong>Telegram:</strong>{" "}
              <a href={CONTACT.TELEGRAM_URL}>
                {CONTACT.TELEGRAM_HANDLE}
              </a>
              . {CONTACT.HOURS} A few minutes is enough to know if I&apos;m useful to you.
            </li>
            {/* Fix 2b: LinkedIn row, placeholder-gated. Renders only when SITE.LINKEDIN_URL set. */}
            {SITE.LINKEDIN_URL && (
              <li className="pe-card pe-card--pad">
                <strong>LinkedIn:</strong>{" "}
                <a
                  href={SITE.LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
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

          <p className="pe-muted" style={{ lineHeight: 1.75, marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--pe-line)" }}>
            None of this is a template. It is one person starting without asking
            permission, keeping the receipts, and letting you check every one of them
            before you pay a cent. If you could run a version of this yourself, good. That
            is rather the point.
          </p>
        </SectionReveal>

        <SectionReveal className="pe-section">
          <p className="pe-eyebrow-line">FAQ</p>
          <h2>Questions about working with me</h2>
          <FaqItem question="Why should I trust a solo operator over an agency?">
            No account manager, no junior team you will never meet. The person who takes the audit call is the person who builds and signs off the work. Everything above is how you check that is true before you pay a cent.
          </FaqItem>
          <FaqItem question="What if you're unavailable later?">
            You keep everything delivered. No platform lock-in, no dependency on me staying reachable for what's already built.
          </FaqItem>
          <FaqItem question="Is my data safe with an AI-assisted operator?">
            Privacy-compliant by design is the other half of my practice, not an afterthought. See /compliance for exactly what that covers, and note the free check reads public records only and touches nothing of yours.
          </FaqItem>
        </SectionReveal>

        <SectionReveal className="pe-section" style={{ textAlign: "center" }}>
          <p className="pe-eyebrow-line">Next step</p>
          <h2>Pick your front door</h2>
          <p className="pe-lead" style={{ margin: "0 auto 26px" }}>
            Same operator behind each one. Would it be okay if I started you on the free scan? A no is welcome, and you owe me nothing.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
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
      </div>
      <OperatorSections />
      <FrontLoad
        extra={[
          { q: "Who will I actually deal with?", a: "Me. There is no agency layer and no junior team you will never meet. If you message or call, you get Kyle." },
        ]}
      />
      <FreeStart />
    </>
  );
}
