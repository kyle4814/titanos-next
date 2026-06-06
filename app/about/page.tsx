import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";

const CAL_15 = "https://cal.com/kyle-deligny-msvz6s/15min";
const ABR_VERIFY = "https://abr.business.gov.au/ABN/View?id=34318502254";

export const metadata: Metadata = {
  title: "About — Kyle Deligny · TITANOS",
  description:
    "Solo operator. ABN 34 318 502 254 (verifiable). AU Privacy Act + Essential Eight compliance done with you. 1,700+ external scans this month.",
  alternates: { canonical: "https://titanos.tech/about" },
  openGraph: {
    title: "About — Kyle Deligny · Titanos",
    description:
      "Solo operator. ABN-verifiable. AU Privacy Act + Essential Eight compliance done with you.",
    type: "profile",
    url: "https://titanos.tech/about",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        badge="ABOUT THE OPERATOR"
        title="One operator. ABN-verifiable. AU-based."
        tagline="Kyle Deligny — Brisbane, Australia. Solo practice. The same person who scans your domain runs your 90-minute compliance call and writes the email that comes back."
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
        <AnimatedButton href={CAL_15} external variant="primary">
          BOOK A 15-MIN
        </AnimatedButton>
        <AnimatedButton href="/methodology" variant="secondary">
          SEE THE METHODOLOGY
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "'Cinzel', serif",
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
            Three things. A free external scan you don&apos;t pay for and you don&apos;t enter a sales
            funnel for. A fixed AU$5,997 Privacy Act + Essential Eight compliance engagement
            for AU SMBs preparing for the 11 December 2026 ADM disclosure deadline. AI
            implementation projects quoted by scope after a 30-minute call.
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            The work is done by me with Claude Code, Anthropic&apos;s coding model, doing
            the keystroke-level execution. I diagnose, plan, scope, sign off. The model
            ships. If the math is wrong, that&apos;s on me — and I&apos;m the one you talk
            to when it is.
          </p>

          <h2
            style={{
              fontFamily: "'Cinzel', serif",
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
              <strong style={{ color: "var(--gold)" }}>Our own scan:</strong>{" "}
              <a href="/our-scan" style={{ color: "var(--ice)" }}>
                titanos.tech/our-scan
              </a>{" "}
              — every finding from our self-scan, published in full.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>Methodology:</strong>{" "}
              <a href="/methodology" style={{ color: "var(--ice)" }}>
                titanos.tech/methodology
              </a>{" "}
              — exactly what we do, what we never do, and how to reproduce any finding.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--gold)" }}>Email:</strong>{" "}
              <a href="mailto:kyle@titanos.tech" style={{ color: "var(--ice)" }}>
                kyle@titanos.tech
              </a>{" "}
              — DKIM-aligned, SPF strict, DMARC p=reject.
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
          </ul>

          {/*
            TODO when Kyle supplies:
            - Headshot (square, 400×400+, professional-not-corporate). Slot above
              the bio paragraph.
            - LinkedIn URL. Add as another row in "How you verify me".
            - Certifications held (IRAP / ISO 27001 / CySA+ / Essential Eight assessor).
              Add a fourth section if any.
          */}
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
            fontFamily: "'Cinzel', serif",
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
          <AnimatedButton href="/scan" variant="primary">
            FREE SCAN
          </AnimatedButton>
          <AnimatedButton href="/compliance" variant="secondary">
            COMPLIANCE PACK
          </AnimatedButton>
          <AnimatedButton href="/ai-delivery" variant="secondary">
            AI IMPLEMENTATION
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
