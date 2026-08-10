import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import TerminalSnippet from "@/components/TerminalSnippet";
import ScanRequestForm from "@/components/ScanRequestForm";
import Testimonials from "@/components/Testimonials";
import ProcessSteps from "./ProcessSteps";
import { SITE } from "@/lib/config";
import { DISPLAY } from "@/lib/pricing";

const CAL_15 = SITE.CAL_15MIN_URL;
// Internal anchor — the on-page form section. No mailto in the primary
// flow; the form's error state carries the only fallback link.
const REQUEST_ANCHOR = "#request";

export const metadata: Metadata = {
  title: "Free Business Security Check — TITANOS",
  description:
    "Free check of what a hacker can see about your AU/NZ/SG business. Open ports, email security, certificates, known software vulnerabilities. Report in your inbox within 2 business days. ABN 34 318 502 254.",
  alternates: { canonical: "https://titanos.tech/scan" },
  openGraph: {
    title: "Free Business Security Check — Titanos",
    description:
      "See what a hacker can see about your business. No login. Report in your inbox within 2 business days. Personally reviewed, Australian-owned, ABN-verified.",
    type: "website",
    url: "https://titanos.tech/scan",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free External Security Scan — Titanos",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const PROCESS = [
  {
    num: "I",
    title: "Tell me your domain",
    body: "Your domain, your name, anything I should know. Under a minute.",
  },
  {
    num: "II",
    title: "I queue your scan",
    body: "You\u2019re placed in the daily scan queue. No payment, no waiting-list game.",
  },
  {
    num: "III",
    title: "Scan runs",
    body: "Standard port scan, encrypted-connection check (TLS/SSL), email security records (SPF/DKIM/DMARC), certificate lookups, and known software vulnerability matching by version.",
  },
  {
    num: "IV",
    title: "Report delivered",
    body: "Hosted HTML report linked from an email to your inbox — within 2 business days.",
  },
  {
    num: "V",
    title: "You decide what\u2019s next",
    body: "Fix it yourself, escalate to your host, or ask me for help. No pressure, no auto-renewal.",
  },
];

const REPORT_ITEMS = [
  "Services visible from the internet — what ports are open and what software is running on them",
  "Database exposure flags — any database port reachable from the public internet (a serious risk)",
  "Encrypted connection check — certificate validity, expiry, and protocol versions (TLS/SSL)",
  "Known software vulnerability matches — any published weakness in the software versions you're running",
  "Email security records — SPF, DKIM, DMARC, CAA (the records that stop hackers spoofing your domain)",
  "Host split — what you control vs what your hosting provider controls (so you know who needs to fix what)",
  "Severity ranking (Critical / High / Medium / Low / Info) with a plain-English remediation step per finding",
  "Verification command for every finding — run the same check yourself in 30 seconds",
];

type SelfScanStatus = "RESOLVED" | "OPEN" | "PARTIAL";
type SelfScanRow = { title: string; status: SelfScanStatus; resolution: string };

const SELF_SCAN_FINDINGS: SelfScanRow[] = [
  {
    title: "Missing Content-Security-Policy",
    status: "RESOLVED",
    resolution:
      "CSP shipped via <meta http-equiv> in app/layout.tsx. default-src 'self' + script/style 'unsafe-inline' for Next.js inline blocks + /cdn-cgi/scripts/ for Cloudflare. connect-src extended to https://api.titanos.tech so the /scan-request form can POST cross-origin.",
  },
  {
    title: "Missing X-Frame-Options",
    status: "RESOLVED",
    resolution: "X-Frame-Options: SAMEORIGIN now served by Cloudflare Managed Transform ‘Add security headers’.",
  },
  {
    title: "Missing X-XSS-Protection",
    status: "OPEN",
    resolution:
      "Header is deprecated in modern browsers (Chrome/Edge ignore it). CSP covers the same threat model in 2026 browsers. Not planning to add.",
  },
  {
    title: "Missing Referrer-Policy",
    status: "RESOLVED",
    resolution:
      "Referrer-Policy: same-origin (stricter than recommendation) served by Cloudflare Managed Transform. Belt-and-braces <meta name='referrer'> in app/layout.tsx.",
  },
  {
    title: "Missing Permissions-Policy",
    status: "PARTIAL",
    resolution:
      "Site uses none of those APIs. Cloudflare Transform Rule to deny them is queued. No functional risk in the interim.",
  },
  {
    title: "Information disclosure — Server header",
    status: "OPEN",
    resolution:
      "Trade-off: keeping Server: cloudflare lets clients debug DNS/CDN issues. The disclosure is harmless because Cloudflare's role here is verifiable from any whois / DNS lookup anyway.",
  },
];

const SELF_SCAN_STATUS_COLOR: Record<SelfScanStatus, string> = {
  RESOLVED: "var(--ok)",
  PARTIAL: "#f59e0b",
  OPEN: "var(--dim)",
};

const WHAT_IT_IS = [
  "A check of what a hacker can see about your business from the public internet — every finding reproducible with one command",
  "90-day window before any finding is published — your time to fix it first",
  "No break-in attempts, no password guessing, no overloading your site — ever",
  "Every finding verifiable: I show you the exact check I ran so you can confirm it yourself",
  "Personally reviewed before delivery — no auto-generated noise",
];

const WHO_ITS_FOR = [
  "Any AU/NZ/SG business with a website that wants to know what a hacker can see",
  "Business owners who have heard about the December 2026 privacy deadline and want to understand their gaps",
  "IT leads or founders about to roll out new software and want an outside check first",
  "Businesses about to renew a managed IT contract — verify what you're actually getting",
  "Anyone who wants a plain-English report, not a sales pitch",
];

export default function ScanPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Free Business Security Check",
    provider: { "@type": "Organization", name: "Titanos" },
    serviceType: "Security Assessment",
    description:
      "Free check of what a hacker can see about your business from the public internet. Report emailed within 2 business days.",
    areaServed: ["AU", "NZ", "SG"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
  };

  // Mirrors the FaqItem content below verbatim — FaqItem answers are JSX
  // (can contain links), so this is authored alongside rather than
  // extracted from it. Same pattern as the Service schema above: one
  // hand-maintained JSON-LD block per page, matching the visible copy.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How long does the scan take?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Your scan is queued the moment you submit. The report is delivered to your inbox within 2 business days. Most run faster than that — the SLA is just the worst-case promise.",
        },
      },
      {
        "@type": "Question",
        name: "What if my domain is hosted on Squarespace / Webflow / GitHub Pages?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The scan still works. Findings are split into what you control vs what your hosting provider controls, so you don't walk away with a list of things you can't fix. Host-controlled findings come with the exact escalation language to send the provider.",
        },
      },
      {
        "@type": "Question",
        name: "Is this a hacking attempt?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Only what the public internet can already see is read — service names and versions, certificate details, email security records. No login attempts, no break-in attempts, no overloading the site, no data access.",
        },
      },
      {
        "@type": "Question",
        name: "Do you store my data?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Scan results are kept in the database to track how exposure patterns change across AU businesses over time. Your email goes only into the contact list — never sold, never shared with third parties, suppressed forever if you reply remove.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <PageHero
        badge="FREE · NO LOGIN · NO CARD"
        title="Free Security Check for Your Business"
        tagline="See what a hacker can see about your business. No login. Report in your inbox within 2 business days."
        sub="A plain-English report on every security gap visible from the public internet — open ports, expired certificates, email spoofing risks, known software weaknesses. No card. No drip campaign — at most 3 relevant emails over 6 months, and STOP kills it forever."
        trustLine={
          <>
            Personally reviewed · Australian-owned ·{" "}
            <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong>
          </>
        }
      >
        <AnimatedButton href={REQUEST_ANCHOR} variant="primary" ariaLabel="Request your free scan">
          REQUEST YOUR FREE SCAN
        </AnimatedButton>
        <AnimatedButton href={CAL_15} external variant="secondary" ariaLabel="Book a 15-minute fit call">
          BOOK A 15-MIN FIT CALL
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      {/* AES-19 — terminal-snippet product-evidence visual */}
      <SectionReveal style={{ padding: "var(--space-16) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
          <TerminalSnippet />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* SELF-SCAN — merged from /our-scan (consolidated 2026-07-05).
          Source: /home/userland/clawd/products/vuln_scanner/results/titanos.tech.json
          Scan ID 40e4f6c4db8b · timestamp 2026-06-01T02:46:25Z */}
      <SectionReveal id="self-scan" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-content)" }}>
          <SectionHeading
            title="I Ran This Check on Myself First"
            lead="If my own business's check had come back clean before I published it, I'd have been the only compliance operator with no story to tell. It didn't. Six findings, all published verbatim. Four resolved or accepted with reasoning since; two remain open."
          />
          {SELF_SCAN_FINDINGS.map((f) => (
            <article
              key={f.title}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "20px 22px",
                marginBottom: 14,
              }}
            >
              <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: SELF_SCAN_STATUS_COLOR[f.status],
                    fontSize: "var(--fs-xs)",
                    letterSpacing: "0.12em",
                    border: `1px solid ${SELF_SCAN_STATUS_COLOR[f.status]}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "2px 8px",
                  }}
                >
                  {f.status}
                </span>
                <h3
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--ice)",
                    fontSize: "var(--fs-body)",
                    letterSpacing: "0.04em",
                    margin: 0,
                    flex: "1 1 100%",
                  }}
                >
                  {f.title}
                </h3>
              </header>
              <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>{f.resolution}</p>
            </article>
          ))}
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.7, marginTop: 20, textAlign: "center" }}>
            Full scan run 2026-06-01 · TLS 1.3 · 0 open ports (Cloudflare-fronted) · 0 cleartext services · 0 DB exposure.
            Last re-verified 11 July 2026 — TLS 1.3 confirmed, certificate valid through 30 August 2026.
          </p>
          <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.7, marginTop: 16, textAlign: "center" }}>
            Want to see what a full evidence pack looks like?{" "}
            <a href="/our-evidence-pack" style={{ color: "var(--gold)" }}>
              See my own evidence pack, published in full →
            </a>
          </p>
        </div>
      </SectionReveal>

      {/* WHAT IT IS / WHO IT'S FOR */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="What It Is · Who It&apos;s For" />
          <div
            className="grid-auto-cards"
            style={{
              gap: 22,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            <CardCol title="What It Is" items={WHAT_IT_IS} />
            <CardCol title="Who It&apos;s For" items={WHO_ITS_FOR} />
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* THE FULL PROCESS */}
      <SectionReveal id="process" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="The Full Process"
            lead="Five steps from form-submit to report-in-inbox. No mystery, no opaque hand-offs."
          />
          <ProcessSteps steps={PROCESS} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHAT'S INSIDE THE REPORT */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="What&apos;s Inside the Report"
            lead="One report, every finding ranked, every finding reproducible."
          />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <ul
              style={{
                listStyle: "none",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
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
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* METHODOLOGY MINI */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="How the Check Works"
            lead="I only read what your server already broadcasts to the public internet — the same information a hacker sees. Nothing invasive."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 22,
              maxWidth: "var(--maxw-content)",
              margin: "0 auto",
            }}
          >
            <MiniCard title="What I Check">
              <p><Tick /> Open ports and services (standard port scan)</p>
              <p><Tick /> Encrypted connection check (TLS/SSL)</p>
              <p><Tick /> Email security records + certificate lookups</p>
              <p><Tick /> Known software vulnerabilities, by version</p>
            </MiniCard>
            <MiniCard title="What I Never Do">
              <p><Cross /> Log in or try passwords</p>
              <p><Cross /> Attempt to break in</p>
              <p><Cross /> Overload your site</p>
              <p><Cross /> Access or extract your data</p>
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

      {/* REQUEST YOUR FREE SCAN — Fix 1: real form replaces mailto card */}
      <SectionReveal id="request" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Request Your Free Scan"
            lead="Fill the form. Report lands in your inbox within 2 business days, sent personally. Prefer a call? Book a 15-min instead."
          />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <ScanRequestForm />
            <p
              style={{
                fontSize: "var(--fs-sm)",
                color: "var(--dim)",
                marginTop: 18,
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              Prefer a call?{" "}
              <a href={CAL_15} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ice)" }}>
                Book a 15-min fit call →
              </a>
            </p>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHAT COMES AFTER THE SCAN */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="What Comes After the Scan"
            lead="Most teams use the free scan to decide whether they need the Compliance engagement or an AI build. Here’s where each fits."
          />
          <div
            className="grid-auto-cards"
            style={{
              gap: 22,
              maxWidth: "var(--maxw-content)",
              margin: "0 auto",
            }}
          >
            <BridgeCard
              title="Titanos Monitor"
              body={`If the check is clean today but you want to know when something changes, Monitor re-checks your business every month and emails you what’s new — plus a briefing on any privacy law updates relevant to your industry. ${DISPLAY.MONITOR_MONTHLY}. Cancel in one click.`}
              href="/monitor"
              cta="See Monitor"
            />
            <BridgeCard
              title="Privacy Act Compliance"
              body="If the check finds gaps and the 10 December 2026 privacy law deadline matters to you, the compliance engagement is the next step. One done-with-you call where I apply every change with you — privacy policy, email security, login security, the works."
              href="/compliance"
              cta="See the compliance pack"
            />
            <BridgeCard
              title="AI That Does Your Manual Work"
              body="If the security check is clean and your real bottleneck is a manual task eating your team’s week, scope an AI build with me. Free call first, fixed-price quote, shipped working."
              href="/ai-delivery"
              cta="See AI Implementation"
            />
          </div>
        </div>
      </SectionReveal>

      {/* Render-only-if-non-empty testimonials block — Fix 2c */}
      <Testimonials offer="scan" heading="What Scan Customers Said" />

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal id="faq" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Questions I Get" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <FaqItem question="How long does the scan take?">
              Your scan is queued the moment you submit. The report is delivered to your inbox
              within 2 business days. Most run faster than that — the SLA is just the worst-case
              promise.
            </FaqItem>
            <FaqItem question="What if my domain is hosted on Squarespace / Webflow / GitHub Pages?">
              The scan still works. I split findings into what you control vs what your hosting
              provider controls, so you don’t walk away with a list of things you can’t fix.
              Host-controlled findings come with the exact escalation language to send the
              provider.
            </FaqItem>
            <FaqItem question="Is this a hacking attempt?">
              No. I only read what the public internet can already see — service names and
              versions, certificate details, email security records. No login attempts. No
              break-in attempts. No overloading your site. No data access. Full methodology at{" "}
              <a href="/methodology" style={{ color: "var(--ice)" }}>/methodology</a>.
            </FaqItem>
            <FaqItem question="Do you store my data?">
              Scan results are kept in my database so I can track how exposure patterns
              change across AU businesses over time. Your email goes only into my contact list —
              never sold, never shared with third parties, suppressed forever if you reply{" "}
              <code>remove</code>.
            </FaqItem>
          </div>
        </div>
      </SectionReveal>

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
          See What a Hacker Can See — for Free
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
          Personally reviewed, delivered within 2 business days. No card, no login required.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={REQUEST_ANCHOR} variant="primary">
            REQUEST YOUR FREE SCAN
          </AnimatedButton>
          <AnimatedButton href={CAL_15} external variant="primary">
            BOOK A 15-MIN FIT CALL
          </AnimatedButton>
        </div>
        <p
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--dim)",
            marginTop: 26,
            maxWidth: "var(--maxw-prose)",
            lineHeight: 1.65,
          }}
        >
          Built with AI assistance. Every scan finding is reviewed and signed off
          by <strong style={{ color: "var(--gold)" }}>Kyle Deligny (ABN 34 318 502 254)</strong>{" "}
          before delivery. My ABN is on every page — the accountability is mine.
        </p>
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
        borderRadius: "var(--radius-md)",
        padding: "30px 26px",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
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
                fontFamily: "var(--font-display), Georgia, serif",
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
  return <span style={{ color: "var(--ok)", marginRight: 8, fontWeight: 700 }}>✓</span>;
}
function Cross() {
  return <span style={{ color: "var(--warn)", marginRight: 8, fontWeight: 700 }}>✗</span>;
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "24px 22px",
      }}
    >
      <h4
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
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
        borderRadius: "var(--radius-md)",
        padding: "26px 24px",
      }}
    >
      <h4
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
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
