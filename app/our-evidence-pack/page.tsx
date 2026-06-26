import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import PdfViewer from "@/components/PdfViewer";
import { SITE } from "@/lib/config";
import { PRICING, DISPLAY } from "@/lib/pricing";

const CAL_15 = SITE.CAL_15MIN_URL;
const REQUEST_HREF = "/scan#request";

// Self-evidence-pack page. The redacted sample PDF (external-scan
// excerpt) is generated from a real scan of titanos.tech and ships
// in /public; the 13-section index below frames the full deliverable.

const META_TITLE = "What's in the Compliance Pack — TITANOS";
const META_DESC =
  "Before you pay for anything, see exactly what you get. This is our own 13-section security and compliance report — run on our own business, published in full, lightly redacted. ABN 34 318 502 254.";
const SAMPLE_PDF = "/sample-evidence-pack-excerpt.pdf";

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
// The externally-verifiable sections (01, 02, 04, 05, 06, 11, 12, 13)
// ship in the redacted sample PDF linked at the top of this page —
// generated from a real scan of titanos.tech. The operational sections
// (privacy policy, NDB runbook, vendor risk register, M365 / MFA
// evidence, attestations) are regenerated per engagement from the
// client's own operational data and are not in the sample.
const SECTIONS: Array<{ num: string; title: string; body: string }> = [
  {
    num: "01",
    title: "Plain-English summary",
    body: "A one-page overview of what we checked, what we found, what we fixed, and what's still on the list. Written so a bank, insurer, or government contact can understand the whole picture in under two minutes — no technical knowledge needed.",
  },
  {
    num: "02",
    title: "Privacy policy + AI disclosure",
    body: "A ready-to-publish privacy policy updated for Australia's new privacy laws (December 2026), plus a plain-English section explaining which AI tools the business uses, what decisions they make about customers, and how a customer can ask for those decisions to be reviewed.",
  },
  {
    num: "03",
    title: "What to do if you get hacked",
    body: "A step-by-step action plan for a data breach — who to call, what to do in the first 24 hours, what to say to affected customers, and how to meet Australia's legal notification deadline (30 days under the Notifiable Data Breaches law). Built so you're not making decisions under pressure.",
  },
  {
    num: "04",
    title: "Third-party services that touch your data",
    body: "A one-page list of every external tool or platform that handles your customer data — what data they hold, what your agreement with them covers, and when you last reviewed their security. The kind of list a large client or insurer will ask for.",
  },
  {
    num: "05",
    title: "Security scan results — every finding, published",
    body: "The full results of an independent external security scan — every issue found, how serious it is, whether it's been fixed, and the evidence that the fix worked. Nothing hidden, nothing cherry-picked.",
  },
  {
    num: "06",
    title: "Email fraud protection setup",
    body: "Proof that your email domain is locked down so nobody can send fake emails pretending to be your business — a technique used in most phishing and invoice fraud attacks. Shows the three records (SPF, DKIM, DMARC) that block this, all verified and active.",
  },
  {
    num: "07",
    title: "Email and cloud account security checklist",
    body: "A documented checklist of the security settings applied to your Microsoft 365 or Google Workspace — things like who can access what, whether logins are logged, and whether two-factor authentication is required. Mapped to the Australian government's recommended security baseline.",
  },
  {
    num: "08",
    title: "Two-factor login — proof it's actually on",
    body: "Screenshots and written policy showing that two-factor authentication (the 'enter a code from your phone' login step) is switched on and enforced for everyone in the organisation — not just switched on for some people, not just a policy on paper.",
  },
  {
    num: "09",
    title: "Backup and recovery plan",
    body: "Documentation of what gets backed up, how often, where it's stored, and how quickly data can be restored if something is deleted, corrupted, or locked by ransomware. Answers the question every insurer eventually asks.",
  },
  {
    num: "10",
    title: "Software update schedule",
    body: "Proof that the operating systems, browsers, and applications in your business are kept up to date — with evidence of the update schedule, not just a claim. Outdated software is the most common entry point for attackers.",
  },
  {
    num: "11",
    title: "Who has access to what",
    body: "A record of which staff can access which systems, how access is given to new staff, and how access is removed when someone leaves — plus when this was last reviewed. Stops ex-employees and over-privileged accounts from becoming a problem.",
  },
  {
    num: "12",
    title: "Government security checklist — signed",
    body: "A signed letter confirming which items from the Australian government's Essential Eight security checklist your business has completed — the document an enterprise client, government agency, or insurer typically asks for before doing business with you.",
  },
  {
    num: "13",
    title: "Privacy law compliance letter — signed",
    body: "A signed letter documenting the specific steps taken to comply with the Australian Privacy Act, with each step mapped to the relevant legal requirement. The document a lawyer, regulator, or large client asks to see.",
  },
];

export default function OurEvidencePackPage() {
  return (
    <>
      <PageHero
        badge="SEE WHAT YOU GET — OUR OWN REPORT, PUBLISHED IN FULL"
        title="Before you pay for anything, see exactly what you get."
        tagline="This is our own security and compliance report — run on our own business, published in full, with only customer names removed. Nothing glossy. Nothing hidden."
        sub="17 pages covering our privacy policy, breach response plan, security scan results, third-party data list, email fraud protection, and the signed government security checklist. The same report template every client receives — applied to us first."
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

      {/* Real, redacted sample PDF — external-scan excerpt generated from
          a live scan of titanos.tech's own infrastructure. */}
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            padding: "26px 28px",
            background: "var(--card)",
            border: "1px solid var(--gold-dim)",
            borderLeft: "3px solid var(--gold)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontSize: "var(--fs-sm)",
            lineHeight: 1.7,
            color: "var(--text)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--ice)",
              fontSize: "var(--fs-xs)",
              letterSpacing: "0.18em",
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            SAMPLE · REDACTED · REAL SCAN OF TITANOS.TECH
          </div>
          <p style={{ margin: "0 0 14px" }}>
            This is a real security and compliance report run against our own
            website and business. It&apos;s the same format every client
            receives — so you can see exactly what you&apos;re paying for before
            committing to anything.
          </p>
          <p style={{ margin: "0 0 18px", color: "var(--dim)", fontSize: "var(--fs-xs)" }}>
            The scan results, privacy policy, email security records, and signed
            checklists are all included. The sections that are built from your
            own data — like your staff access list, your specific software
            screenshots, or your signed attestation — aren&apos;t in this
            sample, because those can only be written using your information.
            They are produced during the engagement.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <AnimatedButton href={SAMPLE_PDF} variant="primary" external>
              VIEW THE SAMPLE PDF →
            </AnimatedButton>
            <AnimatedButton
              href={SAMPLE_PDF}
              variant="secondary"
              external
              ariaLabel="Download the sample external evidence pack PDF"
            >
              Download
            </AnimatedButton>
          </div>
        </div>
        <div
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "18px auto 0",
            border: "1px solid var(--gold-dim)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          <PdfViewer
            src={SAMPLE_PDF}
            label="Sample external evidence pack PDF preview"
            fallbackHref={SAMPLE_PDF}
          />
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
            WHAT'S INSIDE — ALL 13 SECTIONS
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
          READY TO BUILD YOURS?
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
          {DISPLAY.PACK_PRICE} one-time. Includes {PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of Titanos Monitor at no extra charge
          (optional to continue at {DISPLAY.MONITOR_MONTHLY} after that — no automatic billing).
          One working session together — all 13 sections completed, written for
          your specific business, ready to hand to a client, insurer, or regulator.
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
