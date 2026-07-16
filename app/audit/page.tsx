import type { Metadata } from "next";
import { Suspense } from "react";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import AnimatedButton from "@/components/AnimatedButton";
import { SITE } from "@/lib/config";
import AuditRequestClient from "./client";

const META_TITLE = "Free AI Audit Call for Australian Businesses | Titanos";
const META_DESC =
  "A free call with Kyle — tell him what's eating your week, and work out together what's automatable in your business and what it's worth. No cost, no obligation.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/audit" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/audit",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: META_TITLE,
    description: META_DESC,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const STEPS = [
  { num: "01", title: "You tell me how your business actually runs day to day" },
  { num: "02", title: "We find the repetitive work that's costing you time and money" },
  { num: "03", title: "I tell you straight what's automatable, what it'd take, and what it's worth" },
  { num: "04", title: "If it makes sense, we start with your first system in month 1 — if it doesn't, I'll say so" },
];

export default function AuditPage() {
  return (
    <>
      <PageHero
        badge="FREE · NO OBLIGATION · NO PITCH DECK"
        title="Get your free AI audit call."
        sub="We get on a call, you tell me what's eating your week, and we work out together exactly what's automatable in your business and what it's worth. No cost, no pitch deck, no obligation — just a straight conversation about your business."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · Kyle takes the call personally
          </>
        }
      />

      <section style={{ padding: "0 20px 28px", position: "relative", zIndex: 2, textAlign: "center" }}>
        <AnimatedButton href={SITE.AUDIT_CALL_URL} external variant="primary">
          Book your free AI audit call →
        </AnimatedButton>
      </section>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="What happens on the call" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 18,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {STEPS.map((s) => (
              <div
                key={s.num}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "22px 24px",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 34,
                    height: 24,
                    padding: "0 8px",
                    background: "rgb(var(--gold-rgb) / 0.12)",
                    border: "1px solid var(--gold-dim)",
                    color: "var(--gold)",
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: "var(--fs-xs)",
                    letterSpacing: "0.08em",
                    borderRadius: 999,
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  {s.num}
                </span>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.65, margin: 0 }}>
                  {s.title}
                </p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 28, maxWidth: "var(--maxw-prose)", marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
            No cost. No obligation. No pitch deck. If there&apos;s nothing worth automating yet,
            I&apos;ll tell you that too.
          </p>
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <AnimatedButton href={SITE.AUDIT_CALL_URL} external variant="primary">
              Book your free AI audit call →
            </AnimatedButton>
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }} id="request">
        <div className="container-vault">
          <details>
            <summary
              style={{
                cursor: "pointer",
                textAlign: "center",
                fontFamily: "var(--font-body), system-ui, sans-serif",
                fontWeight: 500,
                fontSize: "var(--fs-body)",
                color: "var(--ice)",
                listStyle: "none",
                marginBottom: 24,
              }}
            >
              Prefer to write first instead of booking a call?
            </summary>
            <Suspense>
              <AuditRequestClient />
            </Suspense>
          </details>
        </div>
      </SectionReveal>
    </>
  );
}
