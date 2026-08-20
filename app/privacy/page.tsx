import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import { Inscription, SystemLabel, DepthIndex, OperatorNote, OmegaSeal } from "@/components/Myth";

const SECTION_COUNT = 7;

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
      <PageHero title="Privacy Policy" tagline="Last updated 2026-06-04 · effective from this date" />

      <section aria-label="The commitment" style={{ padding: "0 20px var(--space-10)", position: "relative", zIndex: 2 }}>
        <Inscription
          label="Where the edges are written down"
          sub="Everything below is that rule, spelled out section by section — what we collect, why, how long we keep it, and how you get it corrected or removed."
        >
          You can ask what we hold on you, and get a straight answer.
        </Inscription>
      </section>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "40px 20px 40px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SystemLabel style={{ textAlign: "center", marginBottom: 6 }}>
            Privacy Act 1988 (Cth) · Spam Act 2003 (Cth)
          </SystemLabel>
        </div>
      </SectionReveal>

      <SectionReveal style={{ padding: "0 20px 100px", position: "relative", zIndex: 2 }}>
        <article
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            color: "var(--text)",
            fontSize: "var(--fs-body)",
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

          <DepthIndex index={1} total={SECTION_COUNT} />
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

          <DepthIndex index={2} total={SECTION_COUNT} />
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

          <DepthIndex index={3} total={SECTION_COUNT} />
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

          <DepthIndex index={4} total={SECTION_COUNT} />
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

          <DepthIndex index={5} total={SECTION_COUNT} />
          <H2>How long we keep it</H2>
          <p>
            Lead data is retained for 24 months after your last engagement with us, then deleted.
            Stripe and Cal.com retain their portions per their own privacy frameworks.
          </p>

          <DepthIndex index={6} total={SECTION_COUNT} />
          <H2>Cookies + analytics</H2>
          <p>
            We do not use cookies for analytics, advertising, or tracking. The site uses
            first-party session storage only (for UI continuity — e.g. so the hero animation only
            plays once per session). No third-party trackers are loaded.
          </p>

          <OperatorNote>
            In plain terms: no ad trackers, no data broker deals, no fine print that undoes the
            list above. If you ask what we hold on you, you get an answer — not a form to fill
            out first.
          </OperatorNote>

          <DepthIndex index={7} total={SECTION_COUNT} />
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

      <section aria-label="The seal" style={{ padding: "0 20px var(--space-16)", position: "relative", zIndex: 2 }}>
        <OmegaSeal
          caption="Seven sections. Every right above is checkable — write to kyle@titanos.tech."
          style={{ margin: "0 auto" }}
        />
      </section>
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
        fontFamily: "var(--font-display), Georgia, serif",
        color: "var(--gold)",
        fontSize: "var(--fs-h3)",
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
