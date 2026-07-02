import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import MirrorLists from "@/components/MirrorLists";
import VerifyKeys, { type VerifyKey } from "@/components/VerifyKeys";

// Fix 5g — title/og/twitter aligned. "banner-grade" framing dropped
// site-wide; the long-form description here is the canonical voice.
const META_TITLE = "Methodology — TITANOS";
const META_DESC =
  "How the Titanos security check works. External-only scan of what a hacker can see — no break-in attempts, no credential guessing. Every finding verifiable. ABN 34 318 502 254.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/methodology" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/methodology",
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

const WHAT_WE_SCAN = [
  "Open ports on your domain (standard 15-port sweep — what services are publicly listening)",
  "Service banners (the version information your software announces when a connection is made)",
  "TLS/SSL certificate validity, expiry, and protocol versions (encrypted connection check)",
  "HTTP security headers (HSTS, CSP, X-Frame-Options — browser protection controls)",
  "DNS records (publicly resolvable subdomains and email security records)",
  "Known software vulnerabilities matching the reported service versions (CVE database)",
];

const WHAT_WE_DONT = [
  "Authentication attempts (no password guessing, no credential stuffing)",
  "Exploit attempts (I never try to use a vulnerability I find)",
  "DoS / DDoS / brute force / aggressive scans",
  "Data exfiltration (I never read DB contents, file contents, email contents)",
  "Phishing of staff (I don’t email or call your team to test them)",
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
    title: "Verify with the same tool I used",
    body: (
      <>
        Every finding ships with the exact{" "}
        <code>nmap -sV {"{target}"} -p {"{port}"}</code> command I ran. Copy it, run it yourself,
        and you will get the same result. Independently verifiable in 30 seconds.
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
        directly to confirm any communication is genuine. (This is the footer/about
        contact mention — not a scan request route. Use the form on{" "}
        <a href="/scan#request" style={{ color: "var(--ice)" }}>/scan</a> for that.)
      </>
    ),
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHero
        title="How the Security Check Works"
        tagline="No break-in attempts. No password guessing. I only read what your server already announces to the public internet — the same information a hacker can see from their desk."
      />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SectionHeading
            title="What I Check · What I Never Do"
            lead="Public-facing information only. I read what the open internet can already see — nothing private, nothing that requires a login."
          />
          <MirrorLists
            doTitle="What I Scan"
            doItems={WHAT_WE_SCAN}
            dontTitle="What I Don&apos;t Do"
            dontItems={WHAT_WE_DONT}
          />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* TOOLS USED */}
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SectionHeading
            title="Tools Used"
            lead="Industry-standard open-source security tooling — the same tools your auditors and threat-modellers use."
          />
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
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SectionHeading title="Your 90-Day Window to Fix Before Anything Is Published" />
          <div
            style={{
              background: "var(--card)",
              borderLeft: "3px solid var(--gold)",
              padding: "20px 24px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.75 }}>
              <strong style={{ color: "var(--gold)" }}>
                Every Titanos finding ships with a 90-day responsible disclosure window.
              </strong>{" "}
              If a recipient needs more time to remediate, I extend it. I do not publish, sell,
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
            This is the same 90-day window followed by national security agencies (AustCERT,
            CERT NZ, CSA Singapore) and security researchers worldwide. It gives your business
            time to fix the issue before anyone else knows it exists.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* SCOPE */}
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SectionHeading
            title="Scope"
            lead="I scan organisations across Australia, New Zealand, and Singapore — typically B2B SaaS, mid-market commercial, and listed companies. I do not scan:"
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
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SectionHeading title="What You Get" lead="The standard external scan output:" />
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

      {/* HOW I DELIVER */}
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SectionHeading title="How I Deliver" />
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
            Beyond the free check, two paid engagements:{" "}
            <a href="/compliance" style={{ color: "var(--ice)" }}>
              Privacy Act Compliance (done with you)
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

      {/* HOW TO VERIFY ME — three-key vault interlock */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="How to Verify Me"
            lead="Three independent ways. Every claim I make is one of these checks away from a third-party audit."
          />
          <VerifyKeys keys={VERIFY} />
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* REMOVAL */}
      <SectionReveal style={{ padding: "var(--space-16) 20px var(--space-30)", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SectionHeading title="Removal" />
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.75 }}>
            Reply <code>remove</code> to any email from me and your domain is suppressed
            permanently. I honour the request immediately.
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
          fontFamily: "var(--font-display), Georgia, serif",
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
        borderRadius: "var(--radius-md)",
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
              fontFamily: "var(--font-display), Georgia, serif",
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
