import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import { DISPLAY, PRICING } from "@/lib/pricing";
import { Inscription, SystemLabel, DepthIndex, OperatorNote, OmegaSeal } from "@/components/Myth";

const SECTION_COUNT = 8;

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

      <section aria-label="The commitment" style={{ padding: "0 20px var(--space-10)", position: "relative", zIndex: 2 }}>
        <Inscription
          label="The agreement, in one place"
          sub="Seven sections, no fine print hidden past the end of the page. What the free scan is, what a paid engagement covers, and what happens if it goes wrong."
        >
          Nothing here changes without the date at the top changing with it.
        </Inscription>
      </section>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "40px 20px 40px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SystemLabel style={{ textAlign: "center", marginBottom: 6 }}>
            Governed by Queensland law · Australian Consumer Law applies
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
            These terms govern your use of titanos.tech and any engagement with Titanos (Kyle
            Deligny, ABN 34 318 502 254).
          </p>

          <DepthIndex index={1} total={SECTION_COUNT} />
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

          <DepthIndex index={2} total={SECTION_COUNT} />
          <H2>Paid engagements</H2>
          <p>
            Privacy Act + Essential Eight Compliance ({DISPLAY.PACK_PRICE} one-time, with{" "}
            {PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of Titanos Monitor included; Monitor
            continues at {DISPLAY.MONITOR_MONTHLY} only on explicit opt-in — no auto-charge): a
            single done-with-you engagement that includes the deliverables described on the
            compliance page at the time of purchase. AI Implementation and Leads engagements are
            scoped, quoted in a signed Statement of Work, and billed per that SOW.
          </p>

          <DepthIndex index={3} total={SECTION_COUNT} />
          <H2>Refunds</H2>
          <p>
            Compliance engagements: a full refund is available within 14 days of payment,
            provided no deliverable has been issued. Once any deliverable has been issued,
            the engagement is underway and these standard terms apply. Titanos Monitor:
            cancel any time; no refunds are issued for the current billing period, and no
            further charges are made after cancellation. AI implementation and Leads
            engagements: refund terms are stated in the written scope issued before payment.
          </p>

          <DepthIndex index={4} total={SECTION_COUNT} />
          <H2>Responsible disclosure</H2>
          <p>
            I operate a 90-day responsible-disclosure window for any third-party findings
            surfaced in my scans. I will not publish, exploit, or sell finding data, and I
            will not contact regulators on your behalf without your written instruction.
          </p>

          <OperatorNote>
            In plain terms: if a scan turns something up, you get first and only crack at fixing
            it before anyone else finds out. That is not a courtesy I extend selectively — it is
            how every finding is handled, every time.
          </OperatorNote>

          <DepthIndex index={5} total={SECTION_COUNT} />
          <H2>Liability</H2>
          <p>
            Titanos provides services on a reasonable-skill-and-care basis. My maximum
            aggregate liability for any single engagement is limited to the fees paid by you
            under that engagement. Nothing in these terms excludes liability where it cannot
            legally be excluded under Australian Consumer Law.
          </p>

          <DepthIndex index={6} total={SECTION_COUNT} />
          <H2>Governing law</H2>
          <p>
            Governed by the laws of Queensland, Australia. Disputes are subject to the
            non-exclusive jurisdiction of the Queensland courts.
          </p>

          <DepthIndex index={7} total={SECTION_COUNT} />
          <H2>Changes</H2>
          <p>
            I may update these terms. The effective date at the top will reflect the most
            recent revision.
          </p>

          <DepthIndex index={8} total={SECTION_COUNT} />
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

      <section aria-label="The seal" style={{ padding: "0 20px var(--space-16)", position: "relative", zIndex: 2 }}>
        <OmegaSeal
          caption="Eight sections. Every liability limit and disclosure window stated plainly above."
          style={{ margin: "0 auto" }}
        />
      </section>
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
