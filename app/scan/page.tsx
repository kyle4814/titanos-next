import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import ProcessSteps from "./ProcessSteps";

const MAILTO_SCAN =
  "mailto:kyle@titanos.tech?subject=Scan%20request&body=Domain%3A%20%0AYour%20name%3A%20%0ANotes%20%28optional%29%3A%20%0A%0A--%0AI%20consent%20to%20receive%20my%20scan%20report%20and%20occasional%20related%20follow-up.%20Reply%20STOP%20to%20opt%20out.";
const CAL_15 = "https://cal.com/kyle-deligny-msvz6s/15min";

export const metadata: Metadata = {
  title: "Free External Security Scan — TITANOS",
  description:
    "Free external attack-surface scan for AU/NZ/SG operators. nmap, TLS posture, CVE matches, DNS hygiene. Report emailed within 1 business day. ABN 34 318 502 254.",
  alternates: { canonical: "https://titanos.tech/scan" },
  openGraph: {
    title: "Free External Security Scan — Titanos",
    description:
      "See what an attacker sees. No login. We email the report within 1 business day. Expert-reviewed, Australian-owned, ABN-verified.",
    type: "website",
    url: "https://titanos.tech/scan",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const PROCESS = [
  {
    num: "I",
    title: "EMAIL US YOUR DOMAIN",
    body: "Your domain, your name, anything we should know. Under a minute.",
  },
  {
    num: "II",
    title: "WE QUEUE YOUR SCAN",
    body: "You\u2019re placed in the daily scan queue. No payment, no waiting list game.",
  },
  {
    num: "III",
    title: "SCAN RUNS",
    body: "nmap -sV, TLS/SSL validation, public DNS + certificate-transparency lookups, NVD CVE matching by version.",
  },
  {
    num: "IV",
    title: "REPORT DELIVERED",
    body: "Hosted HTML report linked from an email to your inbox — within 1 business day.",
  },
  {
    num: "V",
    title: "YOU DECIDE WHAT\u2019S NEXT",
    body: "Fix it yourself, escalate to your host, or ask us for help. No pressure, no auto-renewal.",
  },
];

const REPORT_ITEMS = [
  "Public-facing services + open ports (the standard 15-port external sweep)",
  "Database exposure flags (any DB port reachable from the public internet)",
  "TLS posture — certificate validity, expiry, signature algorithm, protocol versions",
  "Known CVE matches against reported service versions (NVD-sourced)",
  "DNS hygiene — SPF, DKIM, DMARC, CAA, MX, plus cert-transparency findings",
  "Host classification — what you control vs what your hosting provider controls",
  "Severity ranking (Critical / High / Medium / Low / Info) + remediation step per finding",
  "Reproduction command for every finding — verify it independently in 30 seconds",
];

const WHAT_IT_IS = [
  "External scan of your public attack surface — every finding reproducible with a single nmap command",
  "90-day responsible-disclosure window on every finding",
  "No exploitation, no credential attempts, no DoS — ever",
  "Independently reproducible: every finding ships with the exact nmap command",
  "Expert-reviewed before delivery; no auto-generated noise",
];

const WHO_ITS_FOR = [
  "AU/NZ/SG operators who own a domain and want their actual exposure",
  "CTOs & founders staring down a compliance push or audit",
  "IT leads about to greenlight an AI rollout in production",
  "MSP-buyers about to renew — verify before you sign",
  "Anyone who wants a sober second opinion, not a sales pitch",
];

export default function ScanPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Free External Security Scan",
    provider: { "@type": "Organization", name: "Titanos" },
    serviceType: "Vulnerability Scanning",
    description:
      "Free external attack-surface scan with 90-day responsible-disclosure window. Report emailed within 1 business day.",
    areaServed: ["AU", "NZ", "SG"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        badge="FREE · NO LOGIN · NO CARD"
        title="Free External Attack-Surface Scan"
        tagline="See what an attacker sees. No login. We email the report within 1 business day."
        sub="A real report on what an attacker can see about your business from the public internet. No login. No card. No follow-up sequence."
        trustLine={
          <>
            Expert-reviewed · Australian-owned ·{" "}
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong>
          </>
        }
      >
        <AnimatedButton href={MAILTO_SCAN} variant="primary" ariaLabel="Request your free scan">
          REQUEST YOUR FREE SCAN
        </AnimatedButton>
        <AnimatedButton href={CAL_15} external variant="secondary" ariaLabel="Book a 15-minute call">
          BOOK A 15-MIN
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      {/* WHAT IT IS / WHO IT'S FOR */}
      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="WHAT IT IS · WHO IT’S FOR" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 22,
              maxWidth: 1020,
              margin: "0 auto",
            }}
          >
            <CardCol title="WHAT IT IS" items={WHAT_IT_IS} />
            <CardCol title="WHO IT’S FOR" items={WHO_ITS_FOR} />
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* THE FULL PROCESS */}
      <SectionReveal id="process" style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="THE FULL PROCESS"
            lead="Five steps from form-submit to report-in-inbox. No mystery, no opaque hand-offs."
          />
          <ProcessSteps steps={PROCESS} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHAT'S INSIDE THE REPORT */}
      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="WHAT’S INSIDE THE REPORT"
            lead="One report, every finding ranked, every finding reproducible."
          />
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <ul
              style={{
                listStyle: "none",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "24px 28px",
                margin: 0,
              }}
            >
              {REPORT_ITEMS.map((it) => (
                <li
                  key={it}
                  style={{
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.7,
                    padding: "8px 0 8px 26px",
                    position: "relative",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 0,
                      color: "#4ade80",
                      fontWeight: 700,
                    }}
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

      {/* METHODOLOGY MINI */}
      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="METHODOLOGY · THE SHORT VERSION"
            lead="If a tool would require permission, we don’t use it. Period."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 22,
              maxWidth: 820,
              margin: "0 auto",
            }}
          >
            <MiniCard title="WHAT WE DO">
              <p><Tick /> Banner-grade <code>nmap -sV</code></p>
              <p><Tick /> TLS / SSL validation</p>
              <p><Tick /> Public DNS + cert transparency</p>
              <p><Tick /> NVD CVE matching by version</p>
            </MiniCard>
            <MiniCard title="WHAT WE NEVER DO">
              <p><Cross /> Auth / credential attempts</p>
              <p><Cross /> Exploit attempts</p>
              <p><Cross /> DoS / brute force</p>
              <p><Cross /> Data exfiltration</p>
            </MiniCard>
          </div>
          <p style={{ textAlign: "center", marginTop: 32 }}>
            <AnimatedButton href="/methodology" variant="secondary">
              Full methodology
            </AnimatedButton>
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* REQUEST YOUR FREE SCAN */}
      <SectionReveal id="request" style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="REQUEST YOUR FREE SCAN"
            lead="Two ways to start — both land in Kyle’s inbox and we email your report within 1 business day. No card, no login."
          />
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: 8,
                padding: "36px 32px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: "var(--fs-lg)",
                  color: "var(--text)",
                  marginBottom: 22,
                  lineHeight: 1.7,
                }}
              >
                Email{" "}
                <a
                  href={MAILTO_SCAN}
                  style={{ color: "var(--gold)", fontWeight: 600 }}
                >
                  kyle@titanos.tech
                </a>{" "}
                with your domain, your name, and anything we should know about scope.
              </p>
              <p style={{ fontSize: "var(--fs-body)", color: "var(--dim)", marginBottom: 28 }}>
                Or book a 15-minute call — we’ll capture the same details and get the scan moving
                on the call.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <AnimatedButton href={MAILTO_SCAN} variant="primary" ariaLabel="Email your scan request">
                  EMAIL YOUR SCAN REQUEST →
                </AnimatedButton>
                <AnimatedButton href={CAL_15} external variant="primary" ariaLabel="Book a 15-minute call">
                  BOOK A 15-MIN
                </AnimatedButton>
              </div>
              <p
                style={{
                  fontSize: "var(--fs-sm)",
                  color: "var(--dim)",
                  marginTop: 26,
                  lineHeight: 1.6,
                }}
              >
                By emailing or booking, you're requesting your scan report.
                <br />
                We'll also send up to 3 related follow-ups over 6 months — reply STOP at any point and you're suppressed forever. We never sell your data.
              </p>
            </div>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHAT COMES AFTER THE SCAN */}
      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="WHAT COMES AFTER THE SCAN"
            lead="Most teams use the free scan to decide whether they need the Compliance engagement or an AI build. Here’s where each fits."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 22,
              maxWidth: 820,
              margin: "0 auto",
            }}
          >
            <BridgeCard
              title="PRIVACY ACT + ESSENTIAL EIGHT COMPLIANCE"
              body="If the scan surfaces gaps and the 11 December 2026 Privacy Act deadline matters to you, the compliance engagement is the next step. One done-with-you call where we apply the changes together."
              href="/compliance"
              cta="See the compliance pack"
            />
            <BridgeCard
              title="AI IMPLEMENTATION FOR BUSINESS"
              body="If the scan shows you’re solid on basics and your real bottleneck is an AI capability you can’t free up engineering hours to ship, scope a build with us. Quoted by scope, fixed-price SOW."
              href="/ai-delivery"
              cta="See AI Implementation"
            />
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal id="faq" style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="QUESTIONS WE GET" />
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <FaqItem question="How long does the scan take?">
              Your scan is queued the moment you submit. The report is delivered to your inbox
              within 1 business day. Most run faster than that — the SLA is just the worst-case
              promise.
            </FaqItem>
            <FaqItem question="What if my domain is hosted on Squarespace / Webflow / GitHub Pages?">
              The scan still works. We split findings into what you control vs what your hosting
              provider controls, so you don’t walk away with a list of things you can’t fix.
              Host-controlled findings come with the exact escalation language to send the
              provider.
            </FaqItem>
            <FaqItem question="Is this exploitation?">
              No. External-only — no exploitation, no credential attempts. We probe what the public internet can already see — service
              banners, TLS posture, DNS records, certificate transparency. No authentication
              attempts. No exploit attempts. No DoS. No data exfiltration. Full methodology at{" "}
              <a href="/methodology" style={{ color: "var(--ice)" }}>/methodology</a>.
            </FaqItem>
            <FaqItem question="Do you store my data?">
              Scan results are kept for our scan corpus so we can show longitudinal exposure
              trends. Your email goes only into our lead store — never sold, never shared with
              third parties, suppressed forever if you reply <code>remove</code>.
            </FaqItem>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* FOOTER CTA */}
      <SectionReveal
        style={{
          textAlign: "center",
          padding: "90px 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            fontWeight: 700,
            marginBottom: 14,
            letterSpacing: "0.05em",
          }}
        >
          READY TO SEE WHAT AN ATTACKER SEES?
        </h2>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-body)",
            marginBottom: 32,
            maxWidth: 620,
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          Free, expert-reviewed, delivered within 1 business day. No card, no login, no follow-up
          sequence.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={MAILTO_SCAN} variant="primary">
            REQUEST YOUR FREE SCAN
          </AnimatedButton>
          <AnimatedButton href={CAL_15} external variant="primary">
            BOOK A 15-MIN
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}

/* ─── helpers ────────────────────────────────────────────── */
function CardCol({ title, items }: { title: string; items: string[] }) {
  return (
    <article
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: 6,
        padding: "30px 26px",
      }}
    >
      <h3
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "var(--fs-lg)",
          letterSpacing: "0.06em",
          marginBottom: 14,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li
            key={item}
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
                color: "var(--gold)",
                fontFamily: "'Cinzel', serif",
              }}
            >
              ›
            </span>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Tick() {
  return <span style={{ color: "#4ade80", marginRight: 8, fontWeight: 700 }}>✓</span>;
}
function Cross() {
  return <span style={{ color: "#f87171", marginRight: 8, fontWeight: 700 }}>✗</span>;
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "24px 22px",
      }}
    >
      <h4
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "var(--fs-body)",
          letterSpacing: "0.06em",
          marginBottom: 12,
        }}
      >
        {title}
      </h4>
      <div style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function BridgeCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <article
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: 6,
        padding: "26px 24px",
      }}
    >
      <h4
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "var(--fs-body)",
          letterSpacing: "0.06em",
          marginBottom: 10,
        }}
      >
        {title}
      </h4>
      <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, marginBottom: 14 }}>
        {body}
      </p>
      <AnimatedButton href={href} variant="secondary">
        {cta}
      </AnimatedButton>
    </article>
  );
}
