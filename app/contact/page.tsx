import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import { SITE, AUDIT_BOOK_HREF } from "@/lib/config";

const META_TITLE = "Contact — Kyle Deligny · TITANOS";
const META_DESC =
  "Email kyle@titanos.tech or book a free AI audit call. Solo operator, Brisbane, Australia. ABN 34 318 502 254.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/contact" },
  openGraph: { title: META_TITLE, description: META_DESC },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        badge="CONTACT"
        title="Talk to Kyle directly."
        sub="No contact form maze, no support ticket queue. Email or book a call — you'll hear back from the same person who does the work."
        trustLine={<>ABN 34 318 502 254 · Brisbane, Australia</>}
      />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2, textAlign: "center" }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "28px 26px",
              marginBottom: 24,
            }}
          >
            <p style={{ color: "var(--ice)", fontSize: "var(--fs-lg)", margin: "0 0 16px" }}>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${SITE.KYLE_EMAIL}`} style={{ color: "var(--gold)" }}>
                {SITE.KYLE_EMAIL}
              </a>
            </p>
            <p style={{ color: "var(--ice)", fontSize: "var(--fs-lg)", margin: 0 }}>
              <strong>ABN:</strong> 34 318 502 254 ·{" "}
              <a
                href="https://abr.business.gov.au/ABN/View?id=34318502254"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--gold)" }}
              >
                verify on the ABR ↗
              </a>
            </p>
          </div>

          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", marginBottom: 24 }}>
            Prefer to talk it through? Book the free AI audit call — no obligation, no pitch deck.
          </p>
          <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">
            Book your free AI audit call →
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
