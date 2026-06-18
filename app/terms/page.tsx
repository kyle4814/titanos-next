import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Terms of Service — TITANOS",
  description:
    "Terms governing use of titanos.tech and engagements with Titanos (Kyle Deligny, ABN 34 318 502 254). Free scans, paid engagements, responsible disclosure, liability, governing law.",
  alternates: { canonical: "https://titanos.tech/terms" },
  openGraph: {
    title: "Terms of Service — Titanos",
    description:
      "Terms governing use of titanos.tech and engagements with Titanos. ABN 34 318 502 254.",
    type: "website",
    url: "https://titanos.tech/terms",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <>
      <PageHero title="Terms of Service" tagline="Last updated 2026-06-04 · effective from this date" />

      <SectionReveal style={{ padding: "40px 20px 100px", position: "relative", zIndex: 2 }}>
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
            These terms govern your use of titanos.tech and any engagement with Titanos (Kyle
            Deligny, ABN 34 318 502 254).
          </p>

          <H2>Free scans</H2>
          <p>
            The free scan is an external view of publicly-accessible attack-surface
            signals on a domain you submit — limited to information your server already
            announces to the public internet. It is not a penetration test, not an audit, not a
            legal compliance assessment, and not a substitute for one. The report is delivered on
            a reasonable-effort basis, typically within one business day. I may decline
            requests I deem out of scope (government, military, infrastructure operators, or
            domains where you cannot demonstrate operational authority).
          </p>

          <H2>Paid engagements</H2>
          <p>
            Privacy Act + Essential Eight Compliance (AU$5,997 one-time, with 3 months of
            Titanos Monitor included; Monitor continues at AU$149/mo only on explicit
            opt-in — no auto-charge): a single done-with-you engagement that includes the
            deliverables described on the compliance page at the time of purchase. AI
            Implementation engagements are scoped, quoted in a signed Statement of Work, and
            billed per that SOW. Refunds for one-time engagements are available for 14 days
            after purchase if no deliverable has been issued; Monitor is cancellable any
            time from the Stripe billing portal.
          </p>

          <H2>Responsible disclosure</H2>
          <p>
            I operate a 90-day responsible-disclosure window for any third-party findings
            surfaced in my scans. I will not publish, exploit, or sell finding data, and I
            will not contact regulators on your behalf without your written instruction.
          </p>

          <H2>Liability</H2>
          <p>
            Titanos provides services on a reasonable-skill-and-care basis. Our maximum
            aggregate liability for any single engagement is limited to the fees paid by you
            under that engagement. Nothing in these terms excludes liability where it cannot
            legally be excluded under Australian Consumer Law.
          </p>

          <H2>Governing law</H2>
          <p>
            Governed by the laws of Queensland, Australia. Disputes are subject to the
            non-exclusive jurisdiction of the Queensland courts.
          </p>

          <H2>Changes</H2>
          <p>
            I may update these terms. The effective date at the top will reflect the most
            recent revision.
          </p>

          <H2>Contact</H2>
          <p>
            Email{" "}
            <a href="mailto:kyle@titanos.tech" style={{ color: "var(--ice)" }}>
              kyle@titanos.tech
            </a>
            .
          </p>
        </article>
      </SectionReveal>
    </>
  );
}

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
