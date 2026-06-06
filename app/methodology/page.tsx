import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import MirrorLists from "@/components/MirrorLists";
import VerifyKeys, { type VerifyKey } from "@/components/VerifyKeys";

export const metadata: Metadata = {
  title: "Methodology — TITANOS",
  description:
    "How Titanos Security scans external attack surfaces. Banner-grade nmap, no exploits, 90-day responsible disclosure window. ABN 34 318 502 254.",
  alternates: { canonical: "https://titanos.tech/methodology" },
  openGraph: {
    title: "Methodology — Titanos Security",
    description:
      "How Titanos scans external attack surfaces. Banner-grade nmap, no exploits, 90-day responsible disclosure window.",
    type: "website",
    url: "https://titanos.tech/methodology",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

const WHAT_WE_SCAN = [
  "Open ports on the customer’s domain (standard 15-port sweep)",
  "Service banners (returned voluntarily by your services on connect)",
  "TLS / SSL certificate validity, expiry, signature",
  "HTTP security headers (HSTS, CSP, X-Frame-Options)",
  "DNS records (publicly resolvable subdomains via standard zone walks)",
  "Known CVEs matching reported service versions",
];

const WHAT_WE_DONT = [
  "Authentication attempts (no password guessing, no credential stuffing)",
  "Exploit attempts (we never try to use a vulnerability we find)",
  "DoS / DDoS / brute force / aggressive scans",
  "Data exfiltration (we never read DB contents, file contents, email contents)",
  "Phishing of staff (we don’t email or call your team to test them)",
  "Physical / social engineering tests",
];

const VERIFY: VerifyKey[] = [
  {
    num: "I",
    title: "Verify the ABN",
    body: (
      <>
        Confirm <strong style={{ color: "var(--gold)" }}>34 318 502 254</strong> at{" "}
        <a
          href="https://abr.business.gov.au/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--ice)" }}
        >
          abr.business.gov.au
        </a>
        .
      </>
    ),
  },
  {
    num: "II",
    title: "Reproduce with nmap",
    body: (
      <>
        Every finding ships with the exact{" "}
        <code>nmap -sV {"{target}"} -p {"{port}"}</code> command. Verify any claim in 30 seconds.
      </>
    ),
  },
  {
    num: "III",
    title: "Email Kyle directly",
    body: (
      <>
        Email{" "}
        <a href="mailto:kyle@titanos.tech" style={{ color: "var(--ice)" }}>
          kyle@titanos.tech
        </a>{" "}
        directly to confirm any communication is genuine.
      </>
    ),
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHero
        title="Methodology"
        tagline="How Titanos Security scans external attack surfaces. No exploits. No auth attempts. Banner-grade evidence only."
      />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "60px 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <SectionHeading
            title="WHAT WE SCAN · WHAT WE DON’T DO"
            lead="External, publicly-reachable network surfaces only. We probe what the open internet can already see — nothing private, nothing authenticated."
          />
          <MirrorLists
            doTitle="WHAT WE SCAN"
            doItems={WHAT_WE_SCAN}
            dontTitle="WHAT WE DON’T DO"
            dontItems={WHAT_WE_DONT}
          />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* TOOLS USED */}
      <SectionReveal style={{ padding: "60px 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <SectionHeading
            title="TOOLS USED"
            lead="We use industry-standard open-source security tooling — the same tools your auditors and threat-modellers use."
          />
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
            <ToolItem>
              <code>nmap</code> with banner detection (<code>-sV</code>) — port + service
              identification
            </ToolItem>
            <ToolItem>
              <code>openssl s_client</code> — TLS validation
            </ToolItem>
            <ToolItem>
              <code>curl</code> with custom headers — HTTP response inspection
            </ToolItem>
            <ToolItem>
              <code>dig</code> + <code>crt.sh</code> — DNS + certificate-transparency lookups
            </ToolItem>
            <ToolItem>
              NVD CVE database (publicly licensed) for version → known-vuln mapping
            </ToolItem>
          </ul>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* RESPONSIBLE DISCLOSURE */}
      <SectionReveal style={{ padding: "60px 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <SectionHeading title="RESPONSIBLE DISCLOSURE" />
          <div
            style={{
              background: "var(--card)",
              borderLeft: "3px solid var(--gold)",
              padding: "20px 24px",
              borderRadius: 2,
            }}
          >
            <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.75 }}>
              <strong style={{ color: "var(--gold)" }}>
                Every Titanos finding ships with a 90-day responsible disclosure window.
              </strong>{" "}
              If a recipient needs more time to remediate, we extend it. We do not publish, sell,
              or share findings with third parties during that window.
            </p>
          </div>
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.75,
              marginTop: 18,
            }}
          >
            This is the same practice followed by national CERTs (AustCERT, CERT NZ, CSA
            Singapore) and by responsible security researchers. The window exists so the affected
            business has time to act.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* SCOPE */}
      <SectionReveal style={{ padding: "60px 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <SectionHeading
            title="SCOPE"
            lead="We scan organisations across Australia, New Zealand, and Singapore — typically B2B SaaS, mid-market commercial, and listed companies. We do not scan:"
          />
          <SimpleList
            items={[
              "Government domains (.gov.au, .gov.nz, .gov.sg, .govt.nz, .edu.au)",
              "Critical infrastructure operators",
              "Companies that have asked to be removed (suppression list honoured forever)",
              "Domains that don’t resolve or have no public services",
            ]}
          />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHAT YOU GET */}
      <SectionReveal style={{ padding: "60px 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <SectionHeading title="WHAT YOU GET" lead="Our standard external scan output:" />
          <SimpleList
            items={[
              "Findings ranked by severity (Critical, High, Medium, Low, Info)",
              "For each finding: the evidence, the affected port/service, and a remediation step",
              "For each finding: reproduction command (so your engineering team can verify independently)",
              "Summary suitable for sharing with auditors, insurers, or your board",
            ]}
          />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* HOW WE DELIVER */}
      <SectionReveal style={{ padding: "60px 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <SectionHeading title="HOW WE DELIVER" />
          <p
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.75,
              marginBottom: 16,
            }}
          >
            Free protective disclosure: a plain-text report emailed direct to your inbox from{" "}
            <code>kyle@titanos.tech</code> within one business day. No signup. No portal to log
            into. Reply to the email if you need the findings in a different format for your
            auditor.
          </p>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.75 }}>
            Beyond the free scan, Titanos offers two paid engagements:{" "}
            <a href="/compliance" style={{ color: "var(--ice)" }}>
              AU Privacy Act + Essential Eight Compliance
            </a>{" "}
            (done with you) and{" "}
            <a href="/ai-delivery" style={{ color: "var(--ice)" }}>
              AI Implementation for Business
            </a>{" "}
            (project-quoted). Both are listed at{" "}
            <a href="/" style={{ color: "var(--ice)" }}>
              titanos.tech
            </a>
            .
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* HOW TO VERIFY US — three-key vault interlock */}
      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="HOW TO VERIFY US"
            lead="Three independent ways. Every claim we make is one of these checks away from a third-party audit."
          />
          <VerifyKeys keys={VERIFY} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* REMOVAL */}
      <SectionReveal style={{ padding: "60px 20px 100px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <SectionHeading title="REMOVAL" />
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.75 }}>
            Reply <code>remove</code> to any email from us and your domain is suppressed
            permanently. We honour the request immediately.
          </p>
        </div>
      </SectionReveal>
    </>
  );
}

function ToolItem({ children }: { children: React.ReactNode }) {
  return (
    <li
      style={{
        color: "var(--text)",
        fontSize: "var(--fs-body)",
        lineHeight: 1.75,
        padding: "8px 0 8px 26px",
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
      {children}
    </li>
  );
}

function SimpleList({ items }: { items: string[] }) {
  return (
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
      {items.map((it) => (
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
              color: "var(--gold)",
              fontFamily: "'Cinzel', serif",
            }}
          >
            ›
          </span>
          {it}
        </li>
      ))}
    </ul>
  );
}
