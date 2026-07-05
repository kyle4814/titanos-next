import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { SITE } from "@/lib/config";

const CAL_15 = SITE.CAL_15MIN_URL;
const ABR_VERIFY = "https://abr.business.gov.au/ABN/View?id=34318502254";

export const metadata: Metadata = {
  title: "About — Kyle Deligny · TITANOS",
  description:
    "Solo operator. ABN 34 318 502 254 (verifiable). AU privacy law compliance done with you. Free business security checks. 1,700+ automated corpus scans this month.",
  alternates: { canonical: "https://titanos.tech/about" },
  openGraph: {
    title: "About — Kyle Deligny · Titanos",
    description:
      "Solo operator. ABN-verifiable. AU privacy law compliance done with you. One person, one fixed price.",
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
        {/* Fix 2b — photo slot. Renders only when SITE.PHOTO_PATH is set. */}
        {SITE.PHOTO_PATH && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={SITE.PHOTO_PATH}
            alt="Kyle Deligny, Titanos, Brisbane"
            width={120}
            height={120}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--gold-dim)",
              marginBottom: 18,
            }}
          />
        )}
        <AnimatedButton href={CAL_15} external variant="primary">
          BOOK A 15-MIN FIT CALL
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
            engagement for AU small businesses preparing for the 11 December 2026 deadline.
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
              <a href="/our-scan" style={{ color: "var(--ice)" }}>
                titanos.tech/our-scan
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
