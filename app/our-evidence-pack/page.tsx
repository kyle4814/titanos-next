import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { SITE } from "@/lib/config";

const CAL_15 = SITE.CAL_15MIN_URL;
const REQUEST_HREF = "/scan#request";

// Fix 2a — Self-evidence-pack page. Mirrors /our-scan: published
// self-attestation, every section listed, linked PDF placeholder gated
// on OPERATOR_INPUT. Closing CTA into /compliance.

const META_TITLE = "My Own Evidence Pack — TITANOS";
const META_DESC =
  "I sell a 13-section compliance evidence pack. Here is the one I produced for my own business, published in full. ABN 34 318 502 254.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/our-evidence-pack" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/our-evidence-pack",
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

// The 13-section shape mirrored from the actual evidence pack template.
// Section copy is summary-only here; the full content lives in the PDF
// linked below once Kyle publishes the redacted self-pack.
const SECTIONS: Array<{ num: string; title: string; body: string }> = [
  {
    num: "01",
    title: "Executive summary",
    body: "What was checked, what was found, what was fixed, what was deferred and why. Suitable for an insurer or regulator to read in 90 seconds.",
  },
  {
    num: "02",
    title: "Privacy policy + ADM disclosure draft",
    body: "Policy text aligned to 11 December 2026 obligations, including the automated-decision-making (ADM) disclosure clause — covering which AI tools touch customer data, what they decide, and how to opt out where applicable.",
  },
  {
    num: "03",
    title: "NDB breach-response runbook",
    body: "Step-by-step plan for the day you get breached, so you hit the mandatory notification deadline (NDB scheme) instead of panicking. Roles, deadlines, statement templates.",
  },
  {
    num: "04",
    title: "Vendor risk register",
    body: "One-page record of every third-party service that touches my customer data — what they hold, the contract terms that govern it, the last security check I did on them.",
  },
  {
    num: "05",
    title: "External scan findings",
    body: "Six findings from the 2026-06-01 external scan against titanos.tech — every finding republished verbatim, with status (resolved / partial / open) and remediation evidence. Mirror of /our-scan.",
  },
  {
    num: "06",
    title: "DNS hygiene record",
    body: "SPF, DKIM, DMARC, CAA records as deployed. DKIM-aligned, SPF strict, DMARC p=reject — enterprise-grade email auth on a single-operator practice.",
  },
  {
    num: "07",
    title: "Microsoft 365 / Google Workspace hardening checklist",
    body: "Applied changes for the workspace (MFA, conditional access, audit logging, mailbox controls). Maps to Essential Eight Maturity Level 1 (ML1) controls one-by-one.",
  },
  {
    num: "08",
    title: "MFA enforcement evidence",
    body: "Screenshots of MFA enforcement state across the workspace, plus the policy text that requires it. Shows the control is configured, not just claimed.",
  },
  {
    num: "09",
    title: "Backup and recovery posture",
    body: "What is backed up, how often, where to, last restore-test date, recovery time objective. The Essential Eight backup mitigation in one page.",
  },
  {
    num: "10",
    title: "Patching cadence",
    body: "Operating system, browser, application patching cadence with evidence. Ties to the Essential Eight patching mitigation.",
  },
  {
    num: "11",
    title: "Staff access management",
    body: "Who has access to what, the joiner-mover-leaver process, last access review date.",
  },
  {
    num: "12",
    title: "Essential Eight Maturity Level 1 self-attestation",
    body: "Signed attestation letter that I can hand to a regulator, insurer, or enterprise client stating exactly what was checked and what was fixed against the Australian government’s baseline security checklist.",
  },
  {
    num: "13",
    title: "Privacy Act posture letter",
    body: "Signed statement of the “reasonable steps” taken under the Privacy Act, with appendix mapping each step to the relevant Australian Privacy Principle.",
  },
];

export default function OurEvidencePackPage() {
  return (
    <>
      <PageHero
        badge="SELF-EVIDENCE PACK · PUBLISHED IN FULL"
        title="I sell a 13-section evidence pack. Here is the one I produced for my own business."
        tagline="Same 13 sections. Same shape. Nothing redacted except customer names. Published so you can inspect the deliverable before you buy."
        sub="A 17-page redacted version of the compliance evidence pack — including the privacy policy, the ADM disclosure, the breach runbook, the vendor risk register, and the signed Essential Eight ML1 self-attestation. Same template you receive on your engagement."
        trustLine={
          <>
            Source:{" "}
            <a href="/our-scan" style={{ color: "var(--ice)" }}>
              titanos.tech/our-scan
            </a>{" "}
            ·{" "}
            <a href="/methodology" style={{ color: "var(--ice)" }}>
              Methodology
            </a>
          </>
        }
      >
        <AnimatedButton href="/compliance" variant="primary">
          SEE THE COMPLIANCE PACK
        </AnimatedButton>
        <AnimatedButton href={REQUEST_HREF} variant="secondary">
          REQUEST YOUR FREE SCAN
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      {/* PDF placeholder — OPERATOR_INPUT gated */}
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            padding: "26px 28px",
            background: "var(--card)",
            border: "1px dashed var(--gold-dim)",
            borderRadius: "var(--radius-md)",
            color: "var(--dim)",
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontSize: "var(--fs-sm)",
            lineHeight: 1.7,
          }}
        >
          {/* OPERATOR_INPUT: drop the redacted self evidence pack PDF into
              /public/our-evidence-pack.pdf and replace this placeholder with
              an <embed> or download link. */}
          <strong style={{ color: "var(--ice)", display: "block", marginBottom: 6 }}>
            PDF placeholder
          </strong>
          The redacted self evidence pack PDF will appear here once Kyle uploads it.
          Until then, the section index below describes the shape and substance of
          every section. Same template ships on every compliance engagement.
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* 13-section index */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-content)" }}>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h2)",
              letterSpacing: "0.06em",
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            THE 13 SECTIONS
          </h2>
          {SECTIONS.map((s) => (
            <article
              key={s.num}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "22px 24px",
                marginBottom: 14,
                display: "grid",
                gridTemplateColumns: "60px 1fr",
                gap: 18,
                alignItems: "start",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold-dim)",
                  fontSize: "var(--fs-h3)",
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                {s.num}
              </span>
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--ice)",
                    fontSize: "var(--fs-lg)",
                    letterSpacing: "0.03em",
                    marginBottom: 6,
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
                  {s.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* CLOSING CTA → /compliance */}
      <SectionReveal style={{ padding: "var(--space-16) 20px var(--space-30)", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            letterSpacing: "0.06em",
            marginBottom: 18,
          }}
        >
          YOUR PACK. SAME SHAPE. APPLIED TO YOUR BUSINESS.
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
          AU$5,997 one-time + AU$199/mo monitoring. One done-with-you engagement —
          the same 13 sections, written for your business, applied together on a
          90-minute working call.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/compliance" variant="primary">
            SEE THE COMPLIANCE PACK
          </AnimatedButton>
          <AnimatedButton href={CAL_15} external variant="secondary">
            BOOK A 15-MIN FIT CALL
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
