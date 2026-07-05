import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import OperatorByline from "@/components/OperatorByline";
import PdfViewer from "@/components/PdfViewer";
import { SITE } from "@/lib/config";
import { PRICING, DISPLAY } from "@/lib/pricing";

const CAL_15 = SITE.CAL_15MIN_URL;
const REQUEST_HREF = "/scan#request";

const META_TITLE = "What's in the Compliance Pack — TITANOS";
const META_DESC =
  "Before you pay for anything, see exactly what you get. This is my own 13-section security and compliance report -- run on my own business, published in full, lightly redacted. ABN 34 318 502 254.";
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

// Three groups make the 13 sections scannable at a glance.
const GROUPS: Array<{
  label: string;
  sub: string;
  accent: "gold" | "ice" | "dim";
  sections: Array<{ num: string; title: string; body: string }>;
}> = [
  {
    label: "FOUNDATION DOCUMENTS",
    sub: "The core documents every business needs -- written for your business, plain English, ready to hand to anyone who asks.",
    accent: "gold",
    sections: [
      {
        num: "01",
        title: "Plain-English summary",
        body: "A one-page overview of what was checked, what was found, what was fixed, and what is still on the list. Written so a bank, insurer, or government contact can understand the whole picture in under two minutes -- no technical knowledge needed.",
      },
      {
        num: "02",
        title: "Privacy policy + AI disclosure",
        body: "A ready-to-publish privacy policy updated for Australia's new privacy laws (December 2026), plus a plain-English section explaining which AI tools the business uses, what decisions they make about customers, and how a customer can ask for those decisions to be reviewed.",
      },
      {
        num: "03",
        title: "What to do if you get hacked",
        body: "A step-by-step action plan for a data breach -- who to call, what to do in the first 24 hours, what to say to affected customers, and how to meet Australia's legal notification deadline (30 days under the Notifiable Data Breaches law). Built so you are not making decisions under pressure.",
      },
      {
        num: "04",
        title: "Third-party services that touch your data",
        body: "A one-page list of every external tool or platform that handles your customer data -- what data they hold, what your agreement with them covers, and when you last reviewed their security. The kind of list a large client or insurer will ask for.",
      },
    ],
  },
  {
    label: "TECHNICAL VERIFICATION",
    sub: "Proof that the security controls are actually in place -- not just claimed on paper, but verified and evidenced.",
    accent: "ice",
    sections: [
      {
        num: "05",
        title: "Security scan results -- every finding, published",
        body: "The full results of an independent external security scan -- every issue found, how serious it is, whether it has been fixed, and the evidence that the fix worked. Nothing hidden, nothing cherry-picked.",
      },
      {
        num: "06",
        title: "Email fraud protection setup",
        body: "Proof that your email domain is locked down so nobody can send fake emails pretending to be your business -- a technique used in most phishing and invoice fraud attacks. Shows the three records (SPF, DKIM, DMARC) that block this, all verified and active.",
      },
      {
        num: "07",
        title: "Email and cloud account security checklist",
        body: "A documented checklist of the security settings applied to your Microsoft 365 or Google Workspace -- things like who can access what, whether logins are logged, and whether two-factor authentication is required. Mapped to the Australian government's recommended security baseline.",
      },
      {
        num: "08",
        title: "Two-factor login -- proof it is actually on",
        body: "Screenshots and written policy showing that two-factor authentication (the 'enter a code from your phone' login step) is switched on and enforced for everyone in the organisation -- not just switched on for some people, not just a policy on paper.",
      },
      {
        num: "09",
        title: "Backup and recovery plan",
        body: "Documentation of what gets backed up, how often, where it is stored, and how quickly data can be restored if something is deleted, corrupted, or locked by ransomware. Answers the question every insurer eventually asks.",
      },
      {
        num: "10",
        title: "Software update schedule",
        body: "Proof that the operating systems, browsers, and applications in your business are kept up to date -- with evidence of the update schedule, not just a claim. Outdated software is the most common entry point for attackers.",
      },
    ],
  },
  {
    label: "LEGAL SIGN-OFFS",
    sub: "The signed documents you hand to a regulator, insurer, or enterprise client when they ask what you have done about security and privacy.",
    accent: "dim",
    sections: [
      {
        num: "11",
        title: "Who has access to what",
        body: "A record of which staff can access which systems, how access is given to new staff, and how access is removed when someone leaves -- plus when this was last reviewed. Stops ex-employees and over-privileged accounts from becoming a problem.",
      },
      {
        num: "12",
        title: "Government security checklist -- signed",
        body: "A signed letter confirming which items from the Australian government's Essential Eight security checklist your business has completed -- the document an enterprise client, government agency, or insurer typically asks for before doing business with you.",
      },
      {
        num: "13",
        title: "Privacy law compliance letter -- signed",
        body: "A signed letter documenting the specific steps taken to comply with the Australian Privacy Act, with each step mapped to the relevant legal requirement. The document a lawyer, regulator, or large client asks to see.",
      },
    ],
  },
];

export default function OurEvidencePackPage() {
  return (
    <>
      <PageHero
        badge="SEE WHAT YOU GET -- MY OWN REPORT, PUBLISHED IN FULL"
        title="Before you pay for anything, see exactly what you get."
        tagline="This is my own security and compliance report -- run on my own business, published in full, with only customer names removed. Nothing glossy. Nothing hidden."
        sub="The single PDF an insurer, regulator, or enterprise procurement team asks for as proof of reasonable steps -- privacy policy, breach response plan, security scan results, third-party data list, email fraud protection, and the signed government security checklist. 17 pages. Same template every client receives -- applied to my own business first."
        trustLine={
          <>
            Source:{" "}
            <a href="/our-scan" style={{ color: "var(--ice)" }}>
              titanos.tech/our-scan
            </a>{" "}
            &middot;{" "}
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

      {/* Framing line — plain-English benefit before technical detail */}
      <SectionReveal style={{ padding: "var(--space-12) 20px 0", position: "relative", zIndex: 2, textAlign: "center" }}>
        <p style={{ color: "var(--ice)", fontSize: "var(--fs-lg)", lineHeight: 1.7, maxWidth: "var(--maxw-prose)", margin: "0 auto", fontFamily: "var(--font-display), Georgia, serif", fontStyle: "italic" }}>
          A plain-English report you can hand straight to your insurer or a big client as proof — here&apos;s exactly what it looks like.
        </p>
      </SectionReveal>

      <div className="divider-gold" />

      {/* WHY WE PUBLISHED IT */}
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {[
            {
              icon: "01",
              heading: "It is a real report",
              body: "Not a mock-up. Not a template with fake data. A real scan of a real domain, with the actual findings, run on the date shown. The only thing removed is names.",
            },
            {
              icon: "02",
              heading: "You know what you are buying",
              body: "Most security consultants describe the deliverable in bullet points. I publish the actual document so there is no gap between what you expect and what you receive.",
            },
            {
              icon: "03",
              heading: "I hold myself to the same standard",
              body: "If I ask clients to get their privacy policy right, their email fraud protection set up, and their breach plan documented -- I should be able to show mine first.",
            },
          ].map((card) => (
            <article
              key={card.icon}
              style={{
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderLeft: "3px solid var(--gold)",
                borderRadius: "var(--radius-md)",
                padding: "22px 20px",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--ice)",
                  fontSize: "var(--fs-body)",
                  letterSpacing: "0.04em",
                  marginBottom: 8,
                  lineHeight: 1.3,
                }}
              >
                {card.heading}
              </h3>
              <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7, margin: 0 }}>
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* SAMPLE PDF */}
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
            SAMPLE &middot; REDACTED &middot; REAL SCAN OF TITANOS.TECH
          </div>
          <p style={{ margin: "0 0 14px" }}>
            This is a real security and compliance report run against my own
            website and business. It is the same format every client receives --
            so you can see exactly what you are paying for before committing to
            anything.
          </p>
          <p style={{ margin: "0 0 18px", color: "var(--dim)", fontSize: "var(--fs-xs)" }}>
            The scan results, privacy policy, email security records, and signed
            checklists are all included. The sections that are built from your
            own data -- like your staff access list, your specific software
            screenshots, or your signed attestation -- are not in this sample,
            because those can only be written using your information. They are
            produced during the engagement.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <AnimatedButton href={SAMPLE_PDF} variant="primary" external>
              VIEW THE SAMPLE PDF &rarr;
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

      {/* 13 SECTIONS -- grouped */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-wide)" }}>
          <SectionHeading
            title="What&apos;s Inside — All 13 Sections"
            lead="Grouped into three categories so you can see at a glance what the report covers. Every section is plain English — no assumed technical knowledge."
          />

          {GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 48 }}>
              {/* Group header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 20,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${group.accent === "gold" ? "var(--gold-dim)" : "var(--border)"}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: group.accent === "gold" ? "var(--gold)" : group.accent === "ice" ? "var(--ice)" : "var(--dim)",
                    fontSize: "var(--fs-sm)",
                    letterSpacing: "0.14em",
                    fontWeight: 600,
                  }}
                >
                  {group.label}
                </span>
                <span style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", lineHeight: 1.5, flex: 1 }}>
                  {group.sub}
                </span>
              </div>

              {/* Section cards -- 2-col grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: 14,
                }}
              >
                {group.sections.map((s) => (
                  <article
                    key={s.num}
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "20px 22px",
                      display: "grid",
                      gridTemplateColumns: "44px 1fr",
                      gap: 14,
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
                          fontSize: "var(--fs-body)",
                          letterSpacing: "0.03em",
                          marginBottom: 6,
                          lineHeight: 1.35,
                        }}
                      >
                        {s.title}
                      </h3>
                      <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7, margin: 0 }}>
                        {s.body}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Questions People Usually Have"
            lead="If you have never seen a compliance report before, these are the things most people want to know first."
          />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <FaqItem question="Is this a real report or a made-up example?">
              It is a real report, run on a real domain (titanos.tech) on the date shown in the
              document. Every finding is genuine -- the issues that were found, the severity
              ratings, and the evidence of what was fixed are all from the actual scan. The only
              thing changed is that any customer names have been removed.
            </FaqItem>
            <FaqItem question="What does 'redacted' mean -- what has been removed?">
              Only customer names and contact details have been removed from this sample. The
              scan results, technical findings, policy text, and security records are all shown
              exactly as they appear in the delivered document. Nothing has been
              softened, edited for presentation, or cherry-picked.
            </FaqItem>
            <FaqItem question="Will I understand it without a security background?">
              Yes -- that is the point of the report. Every section is written in plain English.
              If something technical comes up, it is explained in terms of what it means for the
              business: what the risk is, what was done about it, and what an insurer or regulator
              would make of it. You do not need to know what SPF or DMARC stands for -- the report
              explains it in context.
            </FaqItem>
            <FaqItem question="Will my report look exactly like this?">
              Same structure, same 13 sections, same format -- but all the content will be specific
              to your business. The privacy policy will be written for your business. The scan
              findings will be from your domain. The vendor list will cover the tools you use.
              The signed letters will have your business name and ABN. This sample shows you the
              shape and quality of the deliverable -- not a generic template you receive and fill
              in yourself.
            </FaqItem>
            <FaqItem question="Why show your own report instead of a past client's?">
              Two reasons. First, client confidentiality -- publishing a client's security findings
              without their consent would be a privacy problem in itself. Second, credibility -- if
              I ask clients to get their security and privacy right, showing that I have done it
              for myself first is more honest than just claiming it.
            </FaqItem>
            <FaqItem question="What happens after I see this and decide I want one for my business?">
              You book a 15-minute call to confirm the engagement is a fit, or you go straight to
              the compliance page and buy directly. After purchase: your domain gets scanned within
              48 hours, the evidence pack is delivered within 3 business days, and I schedule the
              90-minute working call where I apply every change with you.
            </FaqItem>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* CLOSING CTA */}
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
          Ready to Build Yours?
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
          (optional to continue at {DISPLAY.MONITOR_MONTHLY} after that -- no automatic billing).
          One working session together -- all 13 sections completed, written for
          your specific business, ready to hand to a client, insurer, or regulator.
        </p>
        <div style={{ marginBottom: 24 }}>
          <OperatorByline />
        </div>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/compliance" variant="primary">
            SEE THE COMPLIANCE PACK
          </AnimatedButton>
          <AnimatedButton href={CAL_15} external variant="secondary">
            BOOK A 15-MIN FIT CALL
          </AnimatedButton>
        </div>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 16 }}>
          <strong style={{ color: "var(--gold)" }}>ABN 34 318 502 254</strong> &middot;
          Every document reviewed and signed off by Kyle Deligny personally &middot;{" "}
          <a href="/terms" style={{ color: "var(--dim)", textDecoration: "underline" }}>
            Terms
          </a>
        </p>
      </SectionReveal>
    </>
  );
}
