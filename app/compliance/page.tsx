import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import GoldThread, { type ThreadStep } from "@/components/GoldThread";
import SlotScarcity from "@/components/SlotScarcity";
import OperatorByline from "@/components/OperatorByline";
import Testimonials from "@/components/Testimonials";
import { SITE } from "@/lib/config";
import { PRICING, DISPLAY } from "@/lib/pricing";

const STRIPE_LINK = SITE.STRIPE_COMPLIANCE_LINK;
const CAL_15 = SITE.CAL_15MIN_URL;

// Site Fix 3 — Monitor decoupled from the pack. The pack is a one-time
// charge; Monitor is included free for PACK_INCLUDED_MONITOR_MONTHS, then
// continues only on explicit opt-in. PRICING.MONITOR_CONTINUATION_MODE
// governs the server's behaviour at free_until expiry. DEFAULT = "opt_in"
// (no auto-charge; reminder + manual subscribe). Flip to "auto_continue"
// only if attach rate justifies and copy is updated to disclose it.

// Fix 5g — title/og/twitter aligned. Description rewritten to reflect
// the new plain-English hero and the decoupled monitor framing.
const META_TITLE =
  "Privacy Act Compliance Before 11 December 2026 — Done With You | TITANOS";
const META_DESC = `From Dec 2026, AU small businesses face six Privacy Act obligations — privacy policy, breach plan, email security, login security, data mapping, and AI disclosure. I sort all six with you in one working call. ${DISPLAY.PACK_PRICE} one-time.`;

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/compliance" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/compliance",
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

const THREAD_STEPS: ThreadStep[] = [
  {
    num: "I",
    title: "INTAKE + EXTERNAL SCAN",
    body: "You complete a 10-minute intake form (company, hosting, identity provider, MFA + backup state, what’s driving compliance). I run an external scan on your domain — a look at what an attacker can see about your business from the outside, with version-by-version CVE matching against the public NVD database. Output: scan JSON plus a documented record of what you affirmed about internal posture.",
  },
  {
    num: "II",
    title: "EVIDENCE PACK",
    body: "Within 3 business days I send your evidence pack (~17pp, 13 sections) — your privacy policy + ADM disclosure draft, your NDB runbook (the step-by-step plan for the day you get breached, so you hit the mandatory notification deadline instead of panicking), vendor risk register (a one-page record of every third-party service that touches your customer data), and scan findings split by what I directly verified vs what you affirmed. Regulator-ready as a single PDF.",
  },
  {
    num: "III",
    title: "90-MIN IMPLEMENTATION CALL",
    body: "Screen-shared working session. We apply changes live: SPF / DKIM / DMARC / CAA records, Microsoft 365 or Google Workspace security defaults, MFA enabled across team, privacy policy + ADM disclosure deployed to your live site, breach-response runbook saved to your shared drive. You keep admin access throughout — every change is yours.",
  },
  {
    num: "IV",
    title: "WHAT YOU CONTROL VS YOUR HOST",
    body: "Some controls live on Squarespace / Shopify / Xero / Cliniko — not in your hands. You get a one-page escalation list: exactly what to ask your host to fix, with template wording. Anything they decline gets documented as 'reasonable steps taken' for your attestation.",
  },
  {
    num: "V",
    title: "30-DAY REVIEW CALL + ATTESTATION",
    body: "We audit what shipped: policy is live, MFA is enforced, runbook is shared. Anything that drifted gets re-applied. You receive a signed letter you can hand to a regulator, insurer, or enterprise client stating exactly what was checked and fixed against the Australian government’s baseline security checklist (Essential Eight, Maturity Level 1), plus a Privacy Act compliance posture letter.",
  },
  {
    num: "VI",
    title: `MONTHS 1-${PRICING.PACK_INCLUDED_MONITOR_MONTHS} · TITANOS MONITOR FREE`,
    body: `Monthly external scan with delta report, CVE alerts matched to your stack, and a regulatory-update briefing — same product as Titanos Monitor, included free for ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months covering your 30-day review and beyond. After month ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} it continues at ${DISPLAY.MONITOR_MONTHLY} only if you opt in — no silent continuity. I'll email you the exact date before any meter would start.`,
  },
];

// Fix 3c — reordered by believability-to-an-SMB, not chronologically.
// (1) live tort = anyone can sue you today; (2) insurance denial; (3)
// ADM disclosure 11 Dec; (4) Tranche 2 small-business exemption removal.
// IoT + EU AI Act items demoted to the compact "also on the calendar"
// row rendered after TIMELINE.
const TIMELINE = [
  {
    when: "LIVE NOW",
    title: "Anyone can sue you directly",
    body: "The statutory tort for serious invasions of privacy is in effect. A customer or ex-employee can take you to court for a serious privacy breach today — no regulator needed, no OAIC queue.",
    state: "live",
  },
  {
    when: "LIVE NOW",
    title: "Your insurer can refuse the claim",
    body: "Cyber insurers increasingly deny breach claims when baseline controls weren’t in place — things like two-factor login and keeping software up to date (the Australian government’s Essential Eight checklist). Policies commonly condition cover on documented security hygiene. Without a signed record, you’re relying on goodwill at the worst possible moment.",
    state: "live",
  },
  {
    when: "11 DECEMBER 2026",
    title: "ADM disclosure required in your privacy policy",
    body: "Automated decision-making — including AI tools your business uses — must be disclosed in your privacy policy with affected-decision categories, types of personal information used, and process explanation. Penalties up to AU$50M for serious or repeated interference.",
    state: "future",
  },
  {
    when: "TRANCHE 2 · COMING",
    title: "Small-business exemption disappears",
    body: "The second reform tranche is positioned to remove the AU$3M turnover exemption, pulling roughly 2.3M additional AU SMBs into Privacy Act scope. If you’re currently exempt, that protection has a sunset on it.",
    state: "coming",
  },
];

// Compact "also on the calendar" row — non-headline deadlines.
const ALSO_ON_CALENDAR = [
  "4 March 2026 — Mandatory IoT security standards live. Cascades to any business reselling or operating connected devices.",
  "2 August 2026 — EU AI Act enforcement begins. Applies to AU companies with EU customers.",
];

const YOU_CONTROL = [
  "Privacy policy — written plain English, covering what you hold, why, who sees it, plus the AI/automated tools disclosure",
  "Breach-response runbook — a step-by-step plan for the day you get hacked (legally required under NDB)",
  "DNS hygiene (SPF, DKIM, DMARC, CAA records) — so scammers can't impersonate your domain",
  "Microsoft 365 / Google Workspace security defaults + MFA enabled across your team",
  "Vendor risk register — one page mapping every third-party service that touches customer data",
  "Signed government security checklist (Essential Eight, Maturity Level 1)",
  "Staff access management",
];

const HOST_CONTROLS = [
  "TLS/SSL certificate management on hosted sites",
  "HSTS headers on Squarespace / Shopify / Wix",
  "Server-side security configurations",
  "DDoS protection on hosted infrastructure",
  "Database security on SaaS like Xero, Cliniko, Vend",
];

// Six obligations first (matches the six-part framing on homepage),
// then engagement mechanics, then evidence deliverables.
const INCLUDED = [
  "A proper privacy policy written and deployed live — covers what customer data you hold, why, how it's stored, who it's shared with (not a copy-paste from 2015)",
  "A breach-response runbook integrated into your shared drive — the step-by-step plan for the day you get hacked, so you hit the mandatory NDB notification deadline instead of panicking",
  "Email security records applied on the call (SPF, DKIM, DMARC) — so scammers can't impersonate your business domain",
  "Login security hardening applied with you (Microsoft 365 / Google Workspace security defaults + MFA across your team)",
  "Vendor risk register — a one-page record of every third-party service touching your customer data, so you know exactly what you hold and where it lives",
  "AI + automated tools disclosure added to your privacy policy — the new rule: if you use AI on customer info, you have to say so",
  "90-minute implementation working call — we apply all six together on a screen-share, no PDF-only hand-off",
  "Signed letter documenting the reasonable steps you've taken under the Privacy Act and the Australian government's security checklist (Essential Eight, Maturity Level 1) — the evidence trail a regulator, insurer, or enterprise client looks for (not a guarantee against complaints — those are decided on the facts of an incident)",
  "30-day review call to re-audit anything that drifted, then sign the attestation",
  "13-section evidence pack documenting all of the above (~17pp) — proof of work for your insurer or regulator",
  "External scan with you-vs-host responsibility split (same engine as the free scan)",
  "Sample of the pack shape — my own, published in full at /our-evidence-pack",
  `${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of Titanos Monitor included free (then optional at ${DISPLAY.MONITOR_MONTHLY} — opt-in, no auto-charge)`,
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
      price: String(PRICING.PACK_PRICE),
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
            DEADLINE · 11 DECEMBER 2026 <SlotScarcity variant="pill" />
          </>
        }
        // Fix 3a — plain-English SMB-owner hero. The audit moved the
        // Vanta price anchor INTO the hero so anchoring lands before the
        // price does (it’s repeated in the pricing card below).
        title="From December 2026, Australian privacy law puts six obligations on your business — and most owners only know about one of them. I sort all six with you in one working call, before the deadline."
        tagline={`One fixed-price engagement: I diagnose your gaps, write your documents, and we apply every change together on a 90-minute screen-share. ${DISPLAY.PACK_PRICE} one-time, with ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of Titanos Monitor included free — versus ~AU$18,000+ for a comparable Vanta-plus-consultant setup in year one.`}
        sub="Built for Australian SMBs (5–50 staff) on Squarespace, WordPress, Microsoft 365, and Google Workspace. Plain English on the call. No jargon, no PDF-only hand-off."
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
        {/*
          Fix 2d — CTA prominence FLIPPED while testimonials.ts is empty.
          Cal first (primary, filled), Stripe second (secondary, outline).
          FLIP back to buy-primary once testimonials.ts has 3+ entries.
        */}
        <AnimatedButton href="/order/compliance" variant="primary" ariaLabel="Start compliance order">
          GET COMPLIANT · {DISPLAY.PACK_PRICE}
        </AnimatedButton>
        <AnimatedButton href={CAL_15} external variant="secondary" ariaLabel="Book a 15-minute fit call">
          BOOK A FIT CALL FIRST
        </AnimatedButton>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12, maxWidth: "var(--maxw-micro)" }}>
          14-day refund if no deliverable has been issued. Monitoring cancellable any time.{" "}
          <a href="/terms" style={{ color: "var(--dim)", textDecoration: "underline" }}>
            Read full terms ›
          </a>
        </p>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 6, maxWidth: "var(--maxw-micro)" }}>
          Stripe checkout · 14-day refund if no work delivered · I respond personally within 1 business day
        </p>
      </PageHero>

      {/* Fix 2a + 3d — evidence-pack link + middle-rung scan routing line */}
      <SectionReveal style={{ padding: "var(--space-12) 20px 0", position: "relative", zIndex: 2, textAlign: "center" }}>
        <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.7, maxWidth: "var(--maxw-prose)", margin: "0 auto 10px" }}>
          See the kind of documentation this engagement produces —{" "}
          <a href="/our-evidence-pack" style={{ color: "var(--gold)", fontWeight: 600 }}>
            my own evidence pack, published in full →
          </a>
        </p>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6, maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          Not sure you have a problem? The free scan doubles as a compliance gap
          snapshot — start there, no card, no commitment.{" "}
          <a href="/scan" style={{ color: "var(--ice)" }}>
            Free scan →
          </a>
        </p>
      </SectionReveal>

      {/* Fix 4 — slot-based scarcity block under the hero */}
      <SectionReveal style={{ padding: "var(--space-8) 20px 0", position: "relative", zIndex: 2 }}>
        <SlotScarcity variant="block" />
      </SectionReveal>

      <div className="divider-gold" />

      {/* FOUR PRESSURE POINTS — Fix 3c reorder by believability, not date */}
      <SectionReveal id="timeline" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="FOUR LEGAL PRESSURE POINTS"
            lead="Ordered by what hits an SMB owner soonest, not chronologically. The compliance pack covers all four in one pass."
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
              <TimelineRow key={t.title} {...t} />
            ))}
          </div>
          {/* Compact "also on the calendar" row — Fix 3c demotion of IoT + EU AI Act */}
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "28px auto 0",
              padding: "16px 18px",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--dim)",
              fontSize: "var(--fs-sm)",
              lineHeight: 1.65,
            }}
          >
            <strong style={{ color: "var(--ice)", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>
              Also on the calendar
            </strong>
            {ALSO_ON_CALENDAR.map((line) => (
              <div key={line} style={{ padding: "2px 0" }}>
                · {line}
              </div>
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
            lead="Your hosting service controls some things. I give you exactly what to ask them to fix, and document the rest as “reasonable steps taken.”"
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
              sub="I give you exactly how to escalate."
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
            lead="No tiers. No PDF-only option. One done-with-you engagement where we apply the changes together on a 90-minute working call — and I stay with you for 12 months of regulatory briefings and quarterly re-scans."
          />
          {/* Fix 2b — operator byline (photo + name + tagline) — renders only when SITE.PHOTO_PATH set */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <OperatorByline />
          </div>
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
                Privacy Act + Government Security Checklist — Done With You
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
                {DISPLAY.PACK_PRICE}
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
                  one-time · {PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of{" "}
                  <a href="/monitor" style={{ color: "var(--ice)" }}>Monitor</a> included free
                </span>
                <span
                  style={{
                    color: "var(--ice)",
                    fontSize: "var(--fs-sm)",
                    display: "block",
                    marginTop: 14,
                    fontWeight: 400,
                    letterSpacing: "0.02em",
                    lineHeight: 1.55,
                    fontStyle: "italic",
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                  }}
                >
                  Drafting before the call · 90-min implementation working call ·
                  30-day review + attestation signed · 12 months of regulatory
                  briefings + quarterly re-scans. Not 90 minutes total — 90 minutes
                  is the central session.
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
                Six obligations sorted in one pass: privacy policy, breach plan,
                email security, login security, data mapping, and AI disclosure.
                Everything you need to demonstrate &ldquo;reasonable steps&rdquo; under the
                Privacy Act and the Australian government&apos;s baseline security
                checklist (Essential Eight, Maturity Level 1), applied together
                with you in a single working call — then maintained for 12 months.
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
              {/*
                Fix 2d — pricing-card CTAs FLIPPED (cal=primary, buy=secondary)
                while testimonials.ts is empty. FLIP back to buy-primary once
                testimonials.ts has 3+ entries.
              */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <AnimatedButton href="/order/compliance" variant="primary" ariaLabel="Start compliance order">
                  GET COMPLIANT · {DISPLAY.PACK_PRICE}
                </AnimatedButton>
                <AnimatedButton href={CAL_15} external variant="secondary" ariaLabel="Book a 15-minute fit call">
                  BOOK A FIT CALL FIRST
                </AnimatedButton>
              </div>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12, maxWidth: "var(--maxw-micro)", textAlign: "center", margin: "12px auto 0" }}>
                14-day refund if no deliverable has been issued. Monitoring cancellable any time.{" "}
                <a href="/terms" style={{ color: "var(--dim)", textDecoration: "underline" }}>
                  Read full terms ›
                </a>
              </p>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 6, maxWidth: "var(--maxw-micro)", textAlign: "center", margin: "6px auto 0" }}>
                Stripe checkout · 14-day refund if no work delivered · I respond personally within 1 business day
              </p>
            </article>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* Site Fix 3 — how monitoring works after the pack (explicit opt-in) */}
      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="HOW THE MONITORING WORKS AFTER THE PACK"
            lead={`The first ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of Titanos Monitor ship with the pack — automatic, no extra charge. What happens at the end of month ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} is the part most vendors get wrong.`}
          />
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto",
              display: "grid",
              gap: 14,
            }}
          >
            <MonitorTimelineRow
              when={`Months 1–${PRICING.PACK_INCLUDED_MONITOR_MONTHS}`}
              title="Free + automatic"
              body={`Monthly external scan, delta report, CVE alerts matched to your stack, and a regulatory briefing land in your inbox. Same product as Titanos Monitor — included with the pack.`}
            />
            <MonitorTimelineRow
              when={`7 days before month ${PRICING.PACK_INCLUDED_MONITOR_MONTHS + 1}`}
              title="I email you the exact date the meter would start"
              body={`Plain-English email: "Your ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} included months end on {date}. If you want it to continue at ${DISPLAY.MONITOR_MONTHLY}, subscribe here. If you do nothing, it simply stops — no charge, no action needed."`}
            />
            <MonitorTimelineRow
              when={`After month ${PRICING.PACK_INCLUDED_MONITOR_MONTHS}`}
              title="Opt-in continues, silence stops it"
              body={`Default mode: ${PRICING.MONITOR_CONTINUATION_MODE === "opt_in" ? "no charge unless you affirmatively subscribe" : `auto-continue at ${DISPLAY.MONITOR_MONTHLY} with one-click cancel in the portal`}. No auto-charge unless you choose to keep it. No retention sequence. No coupon games.`}
            />
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* FAQ */}
      <SectionReveal id="faq" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="QUESTIONS I GET" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <FaqItem question="How the working call works">
              A single 90-minute video call where we apply the changes together. You share screen
              for your DNS, your Microsoft 365 or Google Workspace admin console, and your website
              CMS. I walk you through each change as you make it — no opaque hand-offs, no
              “I’ll send you instructions and check back next week.” By the end of the call, the
              privacy policy is deployed, the ADM disclosure is live, the M365/Workspace
              hardening is applied, the DNS records are corrected, and the NDB runbook is
              integrated.
            </FaqItem>
            <FaqItem question="What access you need to grant">
              For the working call, you remain logged into your own admin consoles — I never
              receive credentials. You’ll need owner or admin access to: your DNS provider, your
              Microsoft 365 or Google Workspace tenant, your website CMS for privacy policy
              deployment, and (optionally) your customer-record systems for the vendor risk
              register.
            </FaqItem>
            <FaqItem question="What I do vs what you do on the call">
              I do: the diagnostic, the policy drafting, the specific Essential Eight setting
              list, the DNS record values, the M365/Workspace hardening checklist, the NDB
              runbook, the attestation letter, and the explanation of why each change is needed.
              You do: the actual clicks inside your own admin consoles, the privacy policy
              publish, and the staff communication once changes are live.
            </FaqItem>
            <FaqItem question="I’m too small for this to matter">
              {/* Fix 3c — answer reordered to match the new fear hierarchy:
                  live tort, then insurance, then ADM penalties, then Tranche 2. */}
              The statutory tort is live now — a customer or ex-employee can take you to court
              for a serious privacy breach today, no regulator needed. Cyber insurers
              increasingly deny breach claims when baseline controls weren’t in place. Penalties
              already reach AU$50M for serious or repeated interference. And Tranche 2 reforms
              are positioned to remove the AU$3M small-business turnover exemption, pulling
              roughly 2.3M additional SMBs into Privacy Act scope.
            </FaqItem>
            <FaqItem question="My website is on Squarespace — can you even help?">
              Yes. The audit works on any hosting provider. I document what you control (privacy
              policy, DNS records, account-level MFA, vendor register) versus what Squarespace
              controls (TLS, HSTS, server config), and you get the exact escalation language for
              the bits they own.
            </FaqItem>
            <FaqItem question="I use Microsoft 365 — do you cover that?">
              Yes. The pack includes a Microsoft 365 hardening guide with 8 admin-console changes
              that satisfy most Essential Eight Maturity Level 1 requirements. We apply these
              together on the 90-minute working call — typically a 15-minute admin sequence
              covering MFA, conditional access, and audit logging.
            </FaqItem>
            <FaqItem question="Is the monthly fee mandatory?">
              {/* Site Fix 3 — explicit opt-in framing, no silent continuity */}
              No. The pack is a one-time {DISPLAY.PACK_PRICE}. The first{" "}
              {PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of{" "}
              <a href="/monitor" style={{ color: "var(--ice)" }}>Titanos Monitor</a> are
              included free. After that it’s entirely optional —{" "}
              {DISPLAY.MONITOR_MONTHLY} if you want ongoing scans and briefings, nothing if
              you don’t. I’ll email you the exact date before any meter would start, and
              it’s one click to decline or cancel. No auto-charge unless you affirmatively
              subscribe.
            </FaqItem>
            <FaqItem question="What’s the difference between this and Vanta or Drata?">
              Vanta and Drata are US$10–15K/yr enterprise compliance tools shaped for SOC 2.
              This is a {DISPLAY.PACK_PRICE} one-time engagement (Monitor optional at{" "}
              {DISPLAY.MONITOR_MONTHLY} after the included{" "}
              {PRICING.PACK_INCLUDED_MONITOR_MONTHS} months) shaped for AU SMBs facing
              Privacy Act + Essential Eight. Different buyer, different price, different
              geography, different framework.
            </FaqItem>
            <FaqItem question="What if my hosting provider won’t fix what you find?">
              You get the exact escalation language. If they refuse, you have documented
              evidence of having taken “reasonable steps” — the standard the OAIC actually
              assesses against.
            </FaqItem>
            <FaqItem question="Can you guarantee I’ll be compliant?">
              No vendor honestly can — compliance is determined by the regulator on the facts of
              a specific incident. What you get is the evidence pack regulators expect to see
              when assessing whether you took “reasonable steps.”
            </FaqItem>
            <FaqItem question="What happens if you’re unavailable later?">
              You keep everything I produce — the signed self-attestation, the 13-section evidence
              pack, your privacy policy + ADM disclosure as deployed, your NDB runbook, the
              vendor risk register, and your DNS/M365 hardening notes. The attestation remains
              valid as a dated record of the reasonable steps taken at that point in time
              (compliance is always a snapshot — refresh annually). I also hand over a one-page
              continuity sheet so another consultant can pick up the file without re-doing the
              diagnostic. The delivered-state-on-pause clause covers mid-engagement: you keep
              everything built to that point plus a refund of any unearned milestone. You are
              never left holding a half-finished pack.
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

      {/* Render-only-if-non-empty testimonials block — Fix 2c */}
      <Testimonials offer="compliance" heading="WHAT COMPLIANCE CUSTOMERS SAID" />

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
          One engagement, one outcome: all six obligations sorted together — privacy policy,
          breach plan, email security, login security, data mapping, and AI disclosure —
          with every change applied on the 90-minute working call, a signed Privacy Act +
          Essential Eight ML1 attestation letter, and the 13-section evidence pack as proof of work.
        </p>
        {/*
          Fix 2d — final-CTA cluster FLIPPED while testimonials.ts is empty.
          FLIP back to buy-primary once testimonials.ts has 3+ entries.
        */}
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/order/compliance" variant="primary" ariaLabel="Start compliance order">
            GET COMPLIANT · {DISPLAY.PACK_PRICE}
          </AnimatedButton>
          <AnimatedButton href={CAL_15} external variant="secondary" ariaLabel="Book a 15-minute fit call">
            BOOK A FIT CALL FIRST
          </AnimatedButton>
        </div>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12, maxWidth: "var(--maxw-micro)", margin: "12px auto 0" }}>
          14-day refund if no deliverable has been issued. Monitoring cancellable any time.{" "}
          <a href="/terms" style={{ color: "var(--dim)", textDecoration: "underline" }}>
            Read full terms ›
          </a>
        </p>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 6, maxWidth: "var(--maxw-micro)", margin: "6px auto 0" }}>
          Stripe checkout · 14-day refund if no work delivered · I respond personally within 1 business day
        </p>
        <p
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--dim)",
            marginTop: 22,
            maxWidth: "var(--maxw-prose)",
            margin: "22px auto 0",
            lineHeight: 1.65,
          }}
        >
          Built with AI assistance. Every document, every scan finding, and every
          attestation is reviewed and signed off by{" "}
          <strong style={{ color: "var(--gold)" }}>Kyle Deligny (ABN 34 318 502 254)</strong>{" "}
          before it reaches you. My ABN is on every page — the accountability is mine.
        </p>
      </SectionReveal>
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

function MonitorTimelineRow({ when, title, body }: { when: string; title: string; body: string }) {
  return (
    <article
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold-dim)",
          fontSize: "var(--fs-xs)",
          letterSpacing: "0.16em",
          marginBottom: 6,
          textTransform: "uppercase",
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
      <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>{body}</p>
    </article>
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
