import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import MonitorCheckoutButton from "@/components/MonitorCheckoutButton";
import Testimonials from "@/components/Testimonials";
import { PRICING, DISPLAY } from "@/lib/pricing";

// Site Fix 2 — recurring product page. Persona: owner OR IT lead who has
// already seen their exposure and wants ongoing visibility into changes.
// Register: mid (plainer than /scan, less owner-hand-holdy than /compliance).

const META_TITLE = `Titanos Monitor — Monthly Security Check for Your Business | ${DISPLAY.MONITOR_MONTHLY}`;
const META_DESC = `Monthly security check + what changed since last month + alerts for new vulnerabilities in your software + privacy law briefing. ${DISPLAY.MONITOR_MONTHLY}, cancel any time.`;

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/monitor" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/monitor",
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

const WHAT_YOU_GET = [
  "A fresh security check of your domain every month — same engine as the free check, run on the same calendar date each month",
  "A plain-English summary: what changed, what's new, what's been resolved",
  "An alert when a newly published software vulnerability matches something you're running — lands in your inbox the day it's detected",
  "A monthly briefing on privacy law updates relevant to your industry (AU/NZ/SG)",
  "Everything to your inbox — no dashboard, no portal, no login",
];

const WHAT_IT_IS_NOT = [
  "Not a dashboard you'll never log into",
  "Not an annual contract",
  "Not a 6-touch sales sequence dressed up as a product",
  "Not a coupon-pleading retention call when you want to cancel",
  "Just a monthly email worth reading — and one click to stop it forever",
];

export default function MonitorPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Titanos Monitor",
    description:
      "Monthly external attack-surface scan, delta report, CVE alerts matched to your stack, and a regulatory-update briefing. Delivered to your inbox.",
    brand: { "@type": "Organization", name: "Titanos", url: "https://titanos.tech" },
    offers: [
      {
        "@type": "Offer",
        name: "Monthly",
        price: String(PRICING.MONITOR_MONTHLY),
        priceCurrency: PRICING.MONITOR_CURRENCY,
        availability: "https://schema.org/InStock",
        url: "https://titanos.tech/monitor",
      },
      {
        "@type": "Offer",
        name: "Annual",
        price: String(PRICING.MONITOR_ANNUAL),
        priceCurrency: PRICING.MONITOR_CURRENCY,
        availability: "https://schema.org/InStock",
        url: "https://titanos.tech/monitor",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        badge="TITANOS MONITOR · RECURRING"
        title="Your business's security gaps change every month. Most owners find out when something breaks."
        tagline={`Titanos Monitor finds out first — a fresh check every month, a plain-English summary of what changed, and an alert the moment a new software vulnerability matches what you're running. ${DISPLAY.MONITOR_MONTHLY}. Cancel in one click, guilt-free, any time.`}
        sub="Same engine as the free check, run on a schedule, with a month-over-month summary and vulnerability alerts matched to your software versions. Plain-English email to your inbox. No dashboard. No contract. No retention call."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · Australian-owned ·
            3,600+ unique AU/NZ/SG businesses in the scan corpus ·{" "}
            <a href="/methodology" style={{ color: "var(--ice)" }}>
              Methodology
            </a>
          </>
        }
      >
        <MonitorCheckoutButton
          plan="monthly"
          label={`SUBSCRIBE · ${DISPLAY.MONITOR_MONTHLY}`}
          ariaLabel={`Subscribe to Titanos Monitor at ${DISPLAY.MONITOR_MONTHLY}`}
          variant="primary"
        />
        <MonitorCheckoutButton
          plan="annual"
          label={`OR ANNUAL · ${DISPLAY.MONITOR_ANNUAL}`}
          ariaLabel={`Subscribe annually at ${DISPLAY.MONITOR_ANNUAL}`}
          variant="secondary"
        />
        <AnimatedButton href="/order/monitor" variant="secondary" ariaLabel="Enquire about Monitor">
          ENQUIRE FIRST →
        </AnimatedButton>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12, maxWidth: "var(--maxw-micro)" }}>
          Cancel any time from the billing portal — one click, guilt-free. No email, no retention call.
        </p>
      </PageHero>

      <div className="divider-gold" />

      {/* WHAT YOU GET */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="What Lands in Your Inbox Each Month"
            lead="One email a month. Same date each month. Worth reading or you stop it."
          />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <ul
              style={{
                listStyle: "none",
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: "var(--radius-md)",
                padding: "26px 28px",
                margin: 0,
              }}
            >
              {WHAT_YOU_GET.map((it) => (
                <li
                  key={it}
                  style={{
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.7,
                    padding: "10px 0 10px 26px",
                    position: "relative",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ position: "absolute", left: 0, color: "var(--ok)", fontWeight: 700 }}
                  >
                    ✓
                  </span>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHAT IT IS NOT */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="What It Is Not"
            lead="The opt-out is built in. The product is the email — not a sales funnel wrapped around it."
          />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <ul
              style={{
                listStyle: "none",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "26px 28px",
                margin: 0,
              }}
            >
              {WHAT_IT_IS_NOT.map((it) => (
                <li
                  key={it}
                  style={{
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.7,
                    padding: "10px 0 10px 26px",
                    position: "relative",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ position: "absolute", left: 0, color: "var(--warn)", fontWeight: 700 }}
                  >
                    ✗
                  </span>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* PRICING CARD */}
      <SectionReveal id="pricing" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="One Price. Cancel in One Click."
            lead="Monthly or annual — annual saves about two months. No contract either way."
          />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <article
              style={{
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: "var(--radius-md)",
                padding: "44px 38px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--ice)",
                  fontSize: "var(--fs-xs)",
                  letterSpacing: "0.18em",
                  marginBottom: 14,
                }}
              >
                TITANOS MONITOR
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold)",
                  fontSize: "var(--fs-h2)",
                  fontWeight: 700,
                  lineHeight: 1.15,
                }}
              >
                {DISPLAY.MONITOR_MONTHLY}
                <span
                  style={{
                    color: "var(--dim)",
                    fontSize: "var(--fs-body)",
                    display: "block",
                    marginTop: 8,
                    fontWeight: 400,
                    letterSpacing: "0.02em",
                  }}
                >
                  or {DISPLAY.MONITOR_ANNUAL} annual (~2 months free)
                </span>
              </div>
              <p
                style={{
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  lineHeight: 1.75,
                  margin: "24px auto 28px",
                  maxWidth: "var(--maxw-prose)",
                }}
              >
                Recurring AUD subscription via Stripe. First scan within 2 business days of
                subscribing. Same calendar date every month after that. Cancel any time
                from the Stripe-hosted billing portal — one click, no retention call.
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 14,
                }}
              >
                <MonitorCheckoutButton
                  plan="monthly"
                  label={`SUBSCRIBE MONTHLY · ${DISPLAY.MONITOR_MONTHLY}`}
                  variant="primary"
                />
                <MonitorCheckoutButton
                  plan="annual"
                  label={`SUBSCRIBE ANNUAL · ${DISPLAY.MONITOR_ANNUAL}`}
                  variant="secondary"
                />
                <AnimatedButton href="/order/monitor" variant="secondary" ariaLabel="Enquire about Monitor">
                  ENQUIRE FIRST →
                </AnimatedButton>
              </div>
            </article>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ROUTING — back to scan */}
      <SectionReveal
        style={{ textAlign: "center", padding: "var(--space-12) 20px var(--space-20)", position: "relative", zIndex: 2 }}
      >
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-body)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            lineHeight: 1.7,
          }}
        >
          Haven&apos;t had the free check yet?{" "}
          <a href="/scan#request" style={{ color: "var(--gold)" }}>
            Start with the free security check
          </a>{" "}
          — then decide if monthly monitoring is worth {DISPLAY.MONITOR_MONTHLY} to you. →
        </p>
      </SectionReveal>

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal id="faq" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Questions I Get" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <FaqItem question="What's actually in the monthly email?">
              A plain-English summary with three sections: what&apos;s new since last month
              (newly visible services, new software vulnerabilities matched to your versions,
              certificate changes), what&apos;s resolved (anything you fixed), and a
              one-paragraph update on any privacy law changes relevant to your industry. If
              nothing has changed, the email says so honestly — I&apos;d rather you stop
              subscribing than pad findings.
            </FaqItem>
            <FaqItem question="How does the first month work?">
              The first scan runs within 2 business days of you subscribing. That scan is your
              baseline — the email tells you what you have exposed today, not a delta yet.
              From month two onward, every email is the delta.
            </FaqItem>
            <FaqItem question="How do I cancel?">
              One click from the billing portal — link is in every monthly email and on your
              success page after checkout. The portal is Stripe-hosted; no retention coupons,
              no &ldquo;wait, let me transfer you,&rdquo; no email loops. The subscription
              ends immediately, no further charges.
            </FaqItem>
            <FaqItem question="What if I bought the compliance pack — do I need this on top?">
              No. The {DISPLAY.PACK_PRICE} pack includes the first{" "}
              {PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of Monitor free, covering your
              30-day review and beyond. After month {PRICING.PACK_INCLUDED_MONITOR_MONTHS}{" "}
              it continues at {DISPLAY.MONITOR_MONTHLY} only if you opt in — no silent
              charge. I&apos;ll email you the exact date before any meter would start.
            </FaqItem>
            <FaqItem question="Does this replace a real audit or pen-test?">
              No. Monitor is external-only — what an attacker can see from the public
              internet. It catches drift, new exposure, and freshly-published CVEs that match
              your stack. For internal posture, controls, and policy compliance, you want the
              compliance pack at {DISPLAY.PACK_PRICE} or a separate engagement.
            </FaqItem>
            <FaqItem question="Can I add more domains?">
              Yes — subscribe once per domain. If you operate multiple, email me and I&apos;ll
              set up a single invoice instead of separate subscriptions.
            </FaqItem>
          </div>
        </div>
      </SectionReveal>

      {/* Render-only-if-non-empty testimonials block */}
      <Testimonials offer="scan" heading="What Customers Said" />

      <div className="divider-gold" />

      {/* FOOTER CTA */}
      <SectionReveal
        style={{
          textAlign: "center",
          padding: "var(--space-20) 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            fontWeight: 700,
            marginBottom: 14,
            letterSpacing: "0.05em",
          }}
        >
          A Monthly Security Update Worth Reading
        </h2>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-body)",
            marginBottom: 32,
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          {DISPLAY.MONITOR_MONTHLY} or {DISPLAY.MONITOR_ANNUAL} annual. First scan within
          2 business days. Cancel any time — one click.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <MonitorCheckoutButton
            plan="monthly"
            label={`SUBSCRIBE · ${DISPLAY.MONITOR_MONTHLY}`}
            variant="primary"
          />
          <AnimatedButton href="/order/monitor" variant="secondary" ariaLabel="Enquire about Monitor">
            ENQUIRE FIRST →
          </AnimatedButton>
          <AnimatedButton href="/scan#request" variant="secondary">
            FREE SCAN FIRST
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
