import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";

const MAILTO_SCAN =
  "mailto:kyle@titanos.tech?subject=Scan%20request&body=Domain%3A%20%0AYour%20name%3A%20%0ANotes%20(optional)%3A";
const CAL_15 = "https://cal.com/kyle-deligny-msvz6s/15min";

export const metadata: Metadata = {
  title: "Our Own External Scan — TITANOS",
  description:
    "We scanned titanos.tech and published every finding. AU Privacy Act + Essential Eight compliance vendor walking its own talk. ABN 34 318 502 254.",
  alternates: { canonical: "https://titanos.tech/our-scan" },
  openGraph: {
    title: "Our Own External Scan — Titanos",
    description:
      "We scanned ourselves and published every finding — before and after fix.",
    type: "website",
    url: "https://titanos.tech/our-scan",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

// Source: /home/userland/clawd/products/vuln_scanner/results/titanos.tech.json
// Scan ID 40e4f6c4db8b · timestamp 2026-06-01T02:46:25Z
type Severity = "HIGH" | "MEDIUM" | "LOW";
type Row = {
  title: string;
  severity: Severity;
  detail: string;
  remediation: string;
  // post-W1+W2 state
  status: "RESOLVED" | "OPEN" | "PARTIAL";
  resolution?: string;
};

const FINDINGS: Row[] = [
  {
    title: "Missing Content-Security-Policy",
    severity: "MEDIUM",
    detail: "No CSP header — broader XSS injection surface than required.",
    remediation: "Add Content-Security-Policy header to all responses.",
    status: "RESOLVED",
    resolution:
      "CSP shipped via <meta http-equiv> in app/layout.tsx (2026-06-06). default-src 'self' + script/style 'unsafe-inline' for Next.js inline blocks + /cdn-cgi/scripts/ for Cloudflare.",
  },
  {
    title: "Missing X-Frame-Options",
    severity: "MEDIUM",
    detail: "No X-Frame-Options — clickjacking via iframe embed possible.",
    remediation: "Set X-Frame-Options: DENY or SAMEORIGIN.",
    status: "RESOLVED",
    resolution:
      "X-Frame-Options: SAMEORIGIN now served by Cloudflare Managed Transform 'Add security headers' (enabled 2026-06-06).",
  },
  {
    title: "Missing X-XSS-Protection",
    severity: "LOW",
    detail: "Legacy XSS filter disabled.",
    remediation: "Add X-XSS-Protection: 1; mode=block.",
    status: "OPEN",
    resolution:
      "Header is deprecated in modern browsers (Chrome/Edge ignore it). CSP covers the same threat model in 2026 browsers. Not planning to add.",
  },
  {
    title: "Missing Referrer-Policy",
    severity: "LOW",
    detail: "Outbound clicks leak full URL info to third parties.",
    remediation: "Add Referrer-Policy: strict-origin-when-cross-origin.",
    status: "RESOLVED",
    resolution:
      "Referrer-Policy: same-origin (stricter than recommendation) served by Cloudflare Managed Transform. Belt-and-braces <meta name='referrer'> in app/layout.tsx.",
  },
  {
    title: "Missing Permissions-Policy",
    severity: "LOW",
    detail: "Browser feature APIs (camera, mic, geolocation, payment) unrestricted.",
    remediation: "Add Permissions-Policy denying unused features.",
    status: "PARTIAL",
    resolution:
      "Site uses none of those APIs. Cloudflare Transform Rule to deny them queued — dashboard step pending (see audit/STAGED_CLOUDFLARE_RULES.md). No functional risk in interim.",
  },
  {
    title: "Information disclosure — Server header",
    severity: "LOW",
    detail: "Server: cloudflare reveals fronting CDN.",
    remediation: "Remove or obfuscate the Server header.",
    status: "OPEN",
    resolution:
      "Trade-off: keeping Server: cloudflare lets clients debug DNS/CDN issues. The disclosure is harmless because Cloudflare's role here is verifiable from any whois / DNS lookup anyway.",
  },
];

const SEV_COLOR: Record<Severity, string> = {
  HIGH: "var(--warn)",
  MEDIUM: "#f59e0b" /* amber-500 — single use, status badge only */,
  LOW: "var(--dim)",
};

const STATUS_COLOR: Record<Row["status"], string> = {
  RESOLVED: "var(--ok)",
  PARTIAL: "#f59e0b",
  OPEN: "var(--dim)",
};

export default function OurScanPage() {
  return (
    <>
      <PageHero
        badge="SELF-ATTESTATION · NOTHING HIDDEN"
        title="We scanned ourselves and published every finding."
        tagline="If our own external attack surface had been clean before audit, we'd have been the only AU compliance vendor with no story to tell. It wasn't. So here's the story."
        sub="Scan run 2026-06-01 against titanos.tech. Six findings, all published verbatim. Four have been resolved or accepted with reasoning since; two remain open (one trivially blocked on a dashboard click, one a deliberate trade-off)."
        trustLine={
          <>
            Source: <code style={{ color: "var(--ice)" }}>vuln_scanner</code> ·
            scan_id <code>40e4f6c4db8b</code> ·{" "}
            <a href="/methodology" style={{ color: "var(--ice)" }}>
              Methodology
            </a>
          </>
        }
      >
        <AnimatedButton href={MAILTO_SCAN} variant="primary" ariaLabel="Request your free scan">
          REQUEST YOUR FREE SCAN
        </AnimatedButton>
        <AnimatedButton href={CAL_15} external variant="secondary">
          BOOK A 15-MIN
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      {/* Findings table */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-content)" }}>
          <h2
            style={{
              fontFamily: "'Cinzel', serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h2)",
              letterSpacing: "0.06em",
              marginBottom: 28,
              textAlign: "center",
            }}
          >
            FINDINGS · 2026-06-01 → 2026-06-06
          </h2>
          {FINDINGS.map((f) => (
            <article
              key={f.title}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "22px 24px",
                marginBottom: 16,
              }}
            >
              <header
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: SEV_COLOR[f.severity],
                    fontSize: "var(--fs-xs)",
                    letterSpacing: "0.12em",
                    border: `1px solid ${SEV_COLOR[f.severity]}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "2px 8px",
                  }}
                >
                  {f.severity}
                </span>
                <span
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: STATUS_COLOR[f.status],
                    fontSize: "var(--fs-xs)",
                    letterSpacing: "0.12em",
                    border: `1px solid ${STATUS_COLOR[f.status]}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "2px 8px",
                  }}
                >
                  {f.status}
                </span>
                <h3
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: "var(--ice)",
                    fontSize: "var(--fs-lg)",
                    letterSpacing: "0.04em",
                    margin: 0,
                    flex: "1 1 100%",
                  }}
                >
                  {f.title}
                </h3>
              </header>
              <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, marginBottom: 6 }}>
                <strong>What it means: </strong>
                {f.detail}
              </p>
              {f.resolution && (
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
                  <strong>What we did: </strong>
                  {f.resolution}
                </p>
              )}
            </article>
          ))}
          <p
            style={{
              color: "var(--dim)",
              fontSize: "var(--fs-sm)",
              lineHeight: 1.7,
              marginTop: 24,
              textAlign: "center",
            }}
          >
            TLS 1.3 · cert valid through 2 July 2026 · 0 open ports
            (Cloudflare-fronted) · 0 cleartext services · 0 DB exposure.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-16) 20px var(--space-30)", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            letterSpacing: "0.06em",
            marginBottom: 18,
          }}
        >
          THE SAME SCAN. FREE. FOR YOU.
        </h2>
        <p
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-lg)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 26px",
            lineHeight: 1.7,
          }}
        >
          Email us your domain. We run the scan. Report lands in your inbox within
          1 business day. No card. No login. No follow-up sequence unless you reply.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={MAILTO_SCAN} variant="primary">
            REQUEST YOUR FREE SCAN
          </AnimatedButton>
          <AnimatedButton href={CAL_15} external variant="secondary">
            BOOK A 15-MIN
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
