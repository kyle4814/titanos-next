import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Privacy Policy — TITANOS",
  description:
    "How Titanos (Kyle Deligny, ABN 34 318 502 254) handles personal information collected via titanos.tech. AU Privacy Act 1988 + Spam Act 2003 compliant.",
  alternates: { canonical: "https://titanos.tech/privacy" },
  openGraph: {
    title: "Privacy Policy — Titanos",
    description:
      "How Titanos handles personal information collected via titanos.tech. ABN 34 318 502 254.",
    type: "website",
    url: "https://titanos.tech/privacy",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy Policy" tagline="Effective 2026-06-04" />

      <SectionReveal style={{ padding: "40px 20px 100px", position: "relative", zIndex: 2 }}>
        <article
          style={{
            maxWidth: 780,
            margin: "0 auto",
            color: "var(--text)",
            fontSize: "1rem",
            lineHeight: 1.75,
          }}
        >
          <p style={{ marginBottom: 18 }}>
            Titanos (“we”, “us”) is operated by Kyle Deligny, ABN 34 318 502 254, an Australian
            operator providing external attack-surface scanning, Privacy Act + Essential Eight
            Compliance, and AI Implementation services to businesses in Australia, New Zealand,
            and Singapore. This policy explains how we handle the personal information we collect
            through titanos.tech.
          </p>

          <H2>What we collect</H2>
          <ul style={ulStyle}>
            <Li>
              Email address, name, and the domain you submit when you request a free scan via
              mailto or Cal.com.
            </Li>
            <Li>
              Email address, billing details, and ABN (if applicable) when you purchase a
              Compliance engagement through Stripe.
            </Li>
            <Li>
              Stripe processes your card data directly; we never see or store payment card
              numbers.
            </Li>
            <Li>
              We do not run third-party trackers, fingerprinting, or behavioural advertising
              scripts on titanos.tech.
            </Li>
          </ul>

          <H2>How we use it</H2>
          <ul style={ulStyle}>
            <Li>To deliver the scan or engagement you requested.</Li>
            <Li>
              To send occasional follow-up email about your scan, related findings, or Titanos
              services you have shown interest in.
            </Li>
            <Li>
              To comply with our legal obligations under the Privacy Act 1988 (Cth) and Spam Act
              2003 (Cth).
            </Li>
          </ul>

          <H2>How we store it</H2>
          <ul style={ulStyle}>
            <Li>Email and lead data is held in our own infrastructure on encrypted disks.</Li>
            <Li>
              Stripe holds billing data under their privacy framework (
              <a
                href="https://stripe.com/privacy"
                style={{ color: "var(--ice)" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                stripe.com/privacy
              </a>
              ).
            </Li>
            <Li>
              Cal.com holds booking data under their privacy framework (
              <a
                href="https://cal.com/privacy"
                style={{ color: "var(--ice)" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                cal.com/privacy
              </a>
              ).
            </Li>
          </ul>

          <H2>Your rights</H2>
          <ul style={ulStyle}>
            <Li>
              <strong>Access:</strong> request a copy of the personal data we hold about you.
            </Li>
            <Li>
              <strong>Correction:</strong> ask us to correct anything that is wrong.
            </Li>
            <Li>
              <strong>Erasure:</strong> ask us to delete your data (subject to legal
              record-keeping obligations).
            </Li>
            <Li>
              <strong>Opt out:</strong> reply STOP to any email, or email{" "}
              <a href="mailto:kyle@titanos.tech" style={{ color: "var(--ice)" }}>
                kyle@titanos.tech
              </a>
              .
            </Li>
          </ul>

          <H2>Contact</H2>
          <p>
            Email{" "}
            <a href="mailto:kyle@titanos.tech" style={{ color: "var(--ice)" }}>
              kyle@titanos.tech
            </a>
            . We respond within 30 days per the Australian Privacy Principles. If unsatisfied, you
            can contact the Office of the Australian Information Commissioner at{" "}
            <a
              href="https://oaic.gov.au"
              style={{ color: "var(--ice)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              oaic.gov.au
            </a>
            .
          </p>
        </article>
      </SectionReveal>
    </>
  );
}

const ulStyle: React.CSSProperties = {
  margin: "0 0 18px 24px",
  padding: 0,
  listStyle: "disc",
  color: "var(--text)",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Cinzel', serif",
        color: "var(--gold)",
        fontSize: "1.4rem",
        fontWeight: 700,
        margin: "36px 0 12px",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </h2>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ marginBottom: 6, color: "var(--text)", lineHeight: 1.75 }}>{children}</li>
  );
}
