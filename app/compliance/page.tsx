import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import DeadlineCounter from "@/components/DeadlineCounter";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";

const STRIPE_LINK = "https://buy.stripe.com/3cIfZh017cGd80QgGa1RC43";
const CAL_15 = "https://cal.com/kyle-deligny-msvz6s/15min";

export const metadata: Metadata = {
  title:
    "Privacy Act Compliance for AU SMBs · Dec 2026 | TITANOS",
  description:
    "Australian Privacy Act + Essential Eight compliance done with you. AU$5,997 one-time + AU$199/mo monitoring. Built for the 11 December 2026 ADM disclosure deadline. ABN 34 318 502 254.",
  alternates: { canonical: "https://titanos.tech/compliance" },
  openGraph: {
    title:
      "AU Privacy Act + Essential Eight Compliance — Done With You | Titanos",
    description:
      "Get compliant before 11 December 2026. AU$5,997 one-time + AU$199/mo monitoring. One done-with-you engagement, no tiers. Built for Australian SMBs.",
    type: "website",
    url: "https://titanos.tech/compliance",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

const THREAD_STEPS: ThreadStep[] = [
  {
    num: "I",
    title: "INTAKE + EXTERNAL SCAN",
    body: "You complete a 10-minute intake form (company, hosting, identity provider, MFA + backup state, what's driving compliance). We run an external attack-surface scan on your domain — nmap banner, TLS posture, public DNS, CVE matching. Output: scan JSON plus a documented record of what you affirmed about internal posture.",
  },
  {
    num: "II",
    title: "EVIDENCE PACK",
    body: "Within 3 business days we send your evidence pack (~17pp, 13 sections) — your privacy policy + ADM disclosure draft, NDB breach-response runbook, vendor risk register, scan findings split by what we directly verified vs what you affirmed. Regulator-ready as a single PDF.",
  },
  {
    num: "III",
    title: "90-MIN IMPLEMENTATION CALL",
    body: "Screen-shared working session. We apply changes live: SPF / DKIM / DMARC / CAA records, M365 or Google Workspace security defaults, MFA enabled across team, privacy policy + ADM disclosure deployed to your live site, breach-response runbook saved to your shared drive. You keep admin access throughout — every change is yours.",
  },
  {
    num: "IV",
    title: "WHAT YOU CONTROL VS YOUR HOST",
    body: "Some controls live on Squarespace / Shopify / Xero / Cliniko — not in your hands. We give you a one-page escalation list: exactly what to ask your host to fix, with template wording. Anything they decline gets documented as 'reasonable steps taken' for your attestation.",
  },
  {
    num: "V",
    title: "30-DAY REVIEW CALL + ATTESTATION",
    body: "We audit what shipped: policy is live, MFA is enforced, runbook is shared. Anything that drifted gets re-applied. You receive a signed Essential Eight ML1 self-attestation letter plus a Privacy Act compliance posture letter — both regulator-ready.",
  },
  {
    num: "VI",
    title: "MONTHS 4-12 · $199/MO MONITORING",
    body: "Quarterly re-scan (months 4, 7, 10) with delta report. Monthly regulatory-update briefing tailored to your industry. Ad-hoc questions answered within 1 business day. Cancellable any time.",
  },
];

const TIMELINE = [
  {
    when: "10 JUNE 2025 · LIVE",
    title: "Statutory tort for serious privacy invasions",
    body: "Already in effect. Individuals can sue directly for serious invasions of privacy — no need to wait for the OAIC.",
    state: "live",
  },
  {
    when: "4 MARCH 2026 · LIVE",
    title: "Mandatory IoT security standards take effect",
    body: "Connected-device makers and importers face baseline security requirements. Cascades to any business reselling or operating IoT.",
    state: "live",
  },
  {
    when: "2 AUGUST 2026",
    title: "EU AI Act enforcement begins",
    body: "Applies to AU companies with EU customers. Transparency, risk-classification, and conformity obligations.",
    state: "future",
  },
  {
    when: "11 DECEMBER 2026 · THE ONE",
    title: "ADM disclosure required in all privacy policies",
    body: "Automated Decision-Making used in any business process must be disclosed in your privacy policy with affected-decision categories, types of personal information used, and process explanation. Penalties up to AU$50M.",
    state: "future",
  },
  {
    when: "TRANCHE 2 · COMING",
    title: "Small-business exemption removal",
    body: "Pulls ~2.3M additional AU SMBs into Privacy Act scope. The current AU$3M turnover exemption is expected to be repealed in the second reform tranche.",
    state: "coming",
  },
];

const YOU_CONTROL = [
  "Privacy policy content + ADM disclosure",
  "DNS hygiene (SPF, DKIM, DMARC, CAA records)",
  "Microsoft 365 / Google Workspace security defaults",
  "MFA enablement across team",
  "Breach response process documentation",
  "Vendor risk register",
  "Essential Eight ML1 self-attestation",
  "Staff access management",
];

const HOST_CONTROLS = [
  "TLS/SSL certificate management on hosted sites",
  "HSTS headers on Squarespace / Shopify / Wix",
  "Server-side security configurations",
  "DDoS protection on hosted infrastructure",
  "Database security on SaaS like Xero, Cliniko, Vend",
];

const INCLUDED = [
  "13-section evidence pack (~17pp)",
  "External scan with you-vs-host split",
  "90-minute implementation working call where we apply the changes together",
  "DNS hygiene + M365/Google Workspace hardening done with you",
  "Privacy policy + ADM disclosure deployed",
  "NDB runbook integrated",
  "30-day review call",
  "Signed compliance attestation letter",
  "Quarterly re-scan + delta report",
  "12 months of industry-specific regulatory update briefings",
];

export default function CompliancePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Titanos AU Privacy Act + Essential Eight Compliance — Done With You",
    description:
      "Done-with-you compliance engagement for Australian SMBs facing the 11 December 2026 Privacy Act ADM disclosure deadline. Includes 13-section evidence pack, external scan with you-vs-host split, 90-minute implementation working call, DNS hygiene + M365/Google Workspace hardening done with you, privacy policy + ADM disclosure deployed, NDB runbook integrated, 30-day review call, signed compliance attestation letter, quarterly re-scan + delta report, and 12 months of regulatory update briefings.",
    brand: { "@type": "Organization", name: "Titanos", url: "https://titanos.tech" },
    offers: {
      "@type": "Offer",
      name: "Done With You",
      price: "5997",
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
      url: STRIPE_LINK,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        badge={
          <>
            DEADLINE · 11 DECEMBER 2026 <DeadlineCounter />
          </>
        }
        title="Privacy Act compliant by 11 December 2026 — or face up to AU$50M in penalties."
        tagline="One done-with-you engagement. Evidence pack, scan, 90-minute working call, 12 months of monitoring. AU$5,997."
        sub="We do the diagnostic, give you the evidence pack, and apply the changes together on a 90-minute working call. Built for Australian SMBs on Squarespace, WordPress, Microsoft 365, and Google Workspace."
        trustLine={
          <>
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> · Australian-owned ·
            3,600+ unique AU/NZ/SG businesses in our scan corpus ·{" "}
            <a href="/methodology" style={{ color: "var(--ice)" }}>
              Methodology
            </a>
          </>
        }
      >
        <AnimatedButton href={STRIPE_LINK} external variant="primary" ariaLabel="Buy Compliance for AU$5,997">
          BUY COMPLIANCE · AU$5,997
        </AnimatedButton>
        <AnimatedButton href={CAL_15} external variant="secondary">
          BOOK A 15-MIN
        </AnimatedButton>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12, maxWidth: "var(--maxw-micro)" }}>
          14-day refund if no deliverable has been issued. Monitoring cancellable any time.{" "}
          <a href="/terms" style={{ color: "var(--dim)", textDecoration: "underline" }}>
            Read full terms ›
          </a>
        </p>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 6, maxWidth: "var(--maxw-micro)" }}>
          Stripe checkout · 14-day refund if no work delivered · Kyle responds personally within 1 business day
        </p>
      </PageHero>

      <div className="divider-gold" />

      {/* DEADLINE TIMELINE */}
      <SectionReveal id="timeline" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="FOUR DEADLINES TO KNOW"
            lead="Four legal pressure points stack between now and 11 December 2026. The compliance pack covers them all in one pass."
          />
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto",
              borderLeft: "2px solid var(--gold-dim)",
              padding: "8px 0 8px 30px",
            }}
          >
            {TIMELINE.map((t) => (
              <TimelineRow key={t.when} {...t} />
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHAT THE ENGAGEMENT LOOKS LIKE — gold thread */}
      <SectionReveal id="walkthrough" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="WHAT THE ENGAGEMENT LOOKS LIKE"
            lead="Six steps from scan to signed attestation. No PDF-only deliverable, no opaque hand-offs."
          />
          <GoldThread steps={THREAD_STEPS} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* YOU CONTROL vs HOST CONTROLS */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="YOU CONTROL SOME · YOUR HOST CONTROLS THE REST"
            lead="Your hosting service controls some things. We tell you what to ask them to fix, and document the rest as “reasonable steps taken.”"
          />
          <div
            className="grid-auto-cards"
            style={{
              gap: 22,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            <SplitCol
              title="YOU CONTROL"
              sub="We apply these together on the working call."
              items={YOU_CONTROL}
              accent="gold"
              prefix="✓"
            />
            <SplitCol
              title="YOUR HOSTING PROVIDER CONTROLS"
              sub="We tell you exactly how to escalate."
              items={HOST_CONTROLS}
              accent="ice"
              prefix="→"
            />
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* SINGLE OFFER */}
      <SectionReveal id="offer" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="ONE ENGAGEMENT · DONE WITH YOU"
            lead="No tiers. No PDF-only option. One done-with-you engagement where we apply the changes together on a 90-minute working call — and stay with you for 12 months of regulatory briefings and quarterly re-scans."
          />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <article
              style={{
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: "var(--radius-md)",
                padding: "44px 38px",
                position: "relative",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--ice)",
                  fontSize: "var(--fs-xs)",
                  letterSpacing: "0.18em",
                  marginBottom: 14,
                  textAlign: "center",
                }}
              >
                DONE WITH YOU
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold)",
                  fontSize: "var(--fs-h3)",
                  letterSpacing: "0.04em",
                  lineHeight: 1.3,
                  textAlign: "center",
                  marginBottom: 18,
                }}
              >
                Privacy Act + Essential Eight Compliance — Done With You
              </h3>
              <p
                style={{
                  textDecoration: "line-through",
                  color: "var(--dim)",
                  fontSize: "var(--fs-sm)",
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                Comparable Vanta + DPO contractor: ~AU$18,000+ in year 1
              </p>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold)",
                  fontSize: "var(--fs-h2)",
                  fontWeight: 700,
                  lineHeight: 1.1,
                  textAlign: "center",
                }}
              >
                AU$5,997
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
                  one-time + AU$199/mo monitoring
                </span>
              </div>
              <p
                style={{
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  lineHeight: 1.75,
                  margin: "24px auto 20px",
                  textAlign: "center",
                  maxWidth: "var(--maxw-prose)",
                }}
              >
                Everything you need to demonstrate “reasonable steps” under the Privacy Act and
                Essential Eight Maturity Level 1 (ML1), applied together with you in a single working call — then
                maintained for 12 months.
              </p>
              <ul
                style={{
                  listStyle: "none",
                  margin: "8px auto 28px",
                  maxWidth: "var(--maxw-prose)",
                  padding: 0,
                }}
              >
                {INCLUDED.map((it) => (
                  <li
                    key={it}
                    style={{
                      color: "var(--text)",
                      fontSize: "var(--fs-body)",
                      lineHeight: 1.65,
                      padding: "7px 0 7px 24px",
                      position: "relative",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: 0,
                        color: "var(--ok)",
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                    {it}
                  </li>
                ))}
              </ul>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <AnimatedButton href={STRIPE_LINK} external variant="primary" ariaLabel="Buy Compliance for AU$5,997">
                  BUY COMPLIANCE · AU$5,997
                </AnimatedButton>
                <AnimatedButton href={CAL_15} external variant="secondary">
                  Book a 15-min first
                </AnimatedButton>
              </div>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12, maxWidth: "var(--maxw-micro)", textAlign: "center", margin: "12px auto 0" }}>
                14-day refund if no deliverable has been issued. Monitoring cancellable any time.{" "}
                <a href="/terms" style={{ color: "var(--dim)", textDecoration: "underline" }}>
                  Read full terms ›
                </a>
              </p>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 6, maxWidth: "var(--maxw-micro)", textAlign: "center", margin: "6px auto 0" }}>
                Stripe checkout · 14-day refund if no work delivered · Kyle responds personally within 1 business day
              </p>
            </article>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal id="faq" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="QUESTIONS WE GET" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <FaqItem question="How the working call works">
              A single 90-minute video call where we apply the changes together. You share screen
              for your DNS, your Microsoft 365 or Google Workspace admin console, and your website
              CMS. We walk you through each change as you make it — no opaque hand-offs, no
              “we’ll send you instructions and check back next week.” By the end of the call, the
              privacy policy is deployed, the ADM disclosure is live, the M365/Workspace
              hardening is applied, the DNS records are corrected, and the NDB runbook is
              integrated.
            </FaqItem>
            <FaqItem question="What access you need to grant">
              For the working call, you remain logged into your own admin consoles — we never
              receive credentials. You’ll need owner or admin access to: your DNS provider, your
              Microsoft 365 or Google Workspace tenant, your website CMS for privacy policy
              deployment, and (optionally) your customer-record systems for the vendor risk
              register.
            </FaqItem>
            <FaqItem question="What we do vs what you do on the call">
              We do: the diagnostic, the policy drafting, the specific Essential Eight setting
              list, the DNS record values, the M365/Workspace hardening checklist, the NDB
              runbook, the attestation letter, and the explanation of why each change is needed.
              You do: the actual clicks inside your own admin consoles, the privacy policy
              publish, and the staff communication once changes are live.
            </FaqItem>
            <FaqItem question="I’m too small for this to matter">
              Tranche 2 reforms are positioned to remove the AU$3M small-business turnover
              exemption, pulling roughly 2.3M additional SMBs into Privacy Act scope. Penalties
              already reach AU$50M for serious or repeated interference with privacy.
            </FaqItem>
            <FaqItem question="Our website is on Squarespace — can you even help?">
              Yes. The audit works on any hosting provider. We document what you control (privacy
              policy, DNS records, account-level MFA, vendor register) versus what Squarespace
              controls (TLS, HSTS, server config), and give you the exact escalation language for
              the bits they own.
            </FaqItem>
            <FaqItem question="We use Microsoft 365 — do you cover that?">
              Yes. The pack includes a Microsoft 365 hardening guide with 8 admin-console changes
              that satisfy most Essential Eight ML1 requirements. We apply these together with
              you on the 90-minute working call — typically a 15-minute admin sequence covering
              MFA, conditional access, and audit logging.
            </FaqItem>
            <FaqItem question="What’s the difference between this and Vanta or Drata?">
              Vanta and Drata are US$10–15K/yr enterprise compliance tools shaped for SOC 2.
              We’re an AU$5,997 one-time + AU$199/mo engagement shaped for AU SMBs facing
              Privacy Act + Essential Eight. Different buyer, different price, different
              geography, different framework.
            </FaqItem>
            <FaqItem question="What if my hosting provider won’t fix what you find?">
              We give you the exact escalation language. If they refuse, you have documented
              evidence of having taken “reasonable steps” — the standard the OAIC actually
              assesses against.
            </FaqItem>
            <FaqItem question="Can you guarantee I’ll be compliant?">
              No vendor honestly can — compliance is determined by the regulator on the facts of
              a specific incident. What we give you is the evidence pack regulators expect to see
              when assessing whether you took “reasonable steps.”
            </FaqItem>
            <FaqItem question="How fast can we get this done?">
              External scan within 48 hours of purchase. Working call scheduled inside 7 days.
              30-day review call scheduled at the working call. Quarterly re-scans recur for the
              life of the monitoring subscription.
            </FaqItem>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* CROSS-LINKS */}
      <SectionReveal
        style={{ textAlign: "center", padding: "50px 20px", position: "relative", zIndex: 2 }}
      >
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-body)", marginBottom: 10 }}>
          Want to see your current security exposure first?{" "}
          <a href="/scan" style={{ color: "var(--gold)" }}>
            Free scan →
          </a>
        </p>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-body)" }}>
          Need an AI build instead?{" "}
          <a href="/ai-delivery" style={{ color: "var(--gold)" }}>
            AI Implementation for Business →
          </a>
        </p>
      </SectionReveal>

      {/* FINAL CTA */}
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
          SHIP COMPLIANCE BEFORE THE DEADLINE
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
          One engagement, one outcome: an evidence pack a regulator accepts as “reasonable
          steps,” with the changes already applied together on the working call.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={STRIPE_LINK} external variant="primary">
            BUY COMPLIANCE · AU$5,997
          </AnimatedButton>
          <AnimatedButton href={CAL_15} external variant="secondary">
            BOOK A 15-MIN FIRST
          </AnimatedButton>
        </div>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12, maxWidth: "var(--maxw-micro)", margin: "12px auto 0" }}>
          14-day refund if no deliverable has been issued. Monitoring cancellable any time.{" "}
          <a href="/terms" style={{ color: "var(--dim)", textDecoration: "underline" }}>
            Read full terms ›
          </a>
        </p>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 6, maxWidth: "var(--maxw-micro)", margin: "6px auto 0" }}>
          Stripe checkout · 14-day refund if no work delivered · Kyle responds personally within 1 business day
        </p>
      </SectionReveal>

      {/* Social proof placeholder — hidden until real testimonials land */}
      <section
        className="social-proof-placeholder"
        style={{ display: "none" }}
        aria-hidden="true"
      >
        {/* INSERT REAL testimonials, client names, logos, outcomes here. DO NOT FABRICATE. */}
      </section>
    </>
  );
}

/* ─── local helpers ─────────────────────────────────────── */
function TimelineRow({
  when,
  title,
  body,
  state,
}: {
  when: string;
  title: string;
  body: string;
  state: string;
}) {
  const dotStyle: React.CSSProperties = {
    position: "absolute",
    left: -38,
    top: 18,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: state === "live" ? "var(--gold)" : "var(--card)",
    border:
      state === "live"
        ? "2px solid var(--gold)"
        : state === "future"
        ? "2px solid var(--ice)"
        : "2px dashed var(--dim)",
  };
  return (
    <div style={{ position: "relative", padding: "14px 0 22px" }}>
      <span aria-hidden="true" style={dotStyle} />
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: state === "coming" ? "var(--dim)" : "var(--gold)",
          fontSize: "var(--fs-sm)",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {when}
      </div>
      <h4
        style={{
          color: "var(--ice)",
          fontSize: "var(--fs-body)",
          fontWeight: 600,
          marginBottom: 6,
          fontFamily: "var(--font-body), system-ui, sans-serif",
          letterSpacing: 0,
        }}
      >
        {title}
      </h4>
      <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

function SplitCol({
  title,
  sub,
  items,
  accent,
  prefix,
}: {
  title: string;
  sub: string;
  items: string[];
  accent: "gold" | "ice";
  prefix: string;
}) {
  return (
    <article
      style={{
        background: "var(--card)",
        border: `1px solid ${accent === "gold" ? "var(--gold-dim)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        padding: "30px 26px",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: accent === "gold" ? "var(--gold)" : "var(--ice)",
          fontSize: "var(--fs-lg)",
          letterSpacing: "0.06em",
          marginBottom: 6,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-sm)",
          marginBottom: 18,
          lineHeight: 1.5,
        }}
      >
        {sub}
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((it) => (
          <li
            key={it}
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.7,
              padding: "6px 0 6px 22px",
              position: "relative",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                color: accent === "gold" ? "var(--ok)" : "var(--ice)",
                fontWeight: 700,
              }}
            >
              {prefix}
            </span>
            {it}
          </li>
        ))}
      </ul>
    </article>
  );
}
