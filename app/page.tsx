import HeroEntrance from "@/components/HeroEntrance";
import OfferCard from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import NumberCounter from "@/components/NumberCounter";
import AnimatedButton from "@/components/AnimatedButton";
import SlotScarcity from "@/components/SlotScarcity";
import HeroScrollCue from "@/components/HeroScrollCue";
import { STATS, STAT_LABELS } from "@/lib/stats";
import { SCOPING_CALL_URL, SCOPING_CALL_LABEL, SITE } from "@/lib/config";
import { PRICING, DISPLAY } from "@/lib/pricing";

import type { Offer } from "@/components/OfferCard";

const offers: Offer[] = [
  {
    tag: "OFFER 01 · FREE",
    title: "Free Scan",
    price: "$0",
    priceUnit: "no card · delivered within 1 business day",
    body:
      "External attack-surface scan on any AU/NZ/SG domain. Reproducible evidence, personally reviewed, with a 90-day responsible-disclosure window. The report you'd want about your own infrastructure.",
    bullets: [
      "Just your website address — any AU/NZ/SG host",
      "Reproducible evidence, every finding tied to an nmap command",
      "Personally reviewed before delivery",
    ],
    // Fix 1 — mailto killed. Scan CTAs route to the on-page form at /scan#request.
    primary: {
      label: "REQUEST YOUR FREE SCAN ›",
      href: "/scan#request",
      external: false,
    },
    secondary: { label: "See the free scan", href: "/scan" },
    icon: "radar",
    index: 0,
  },
  {
    tag: "OFFER 02 · done with you",
    title: "Privacy Act + Essential Eight Compliance",
    price: DISPLAY.PACK_PRICE,
    priceUnit: `one-time · ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of Monitor free`,
    body:
      "For AU SMBs (5-50 staff) on Squarespace / WordPress / Microsoft 365 / Google Workspace. Plain English on the call, every term translated.\n\nOne done-with-you engagement for the 11 December 2026 ADM disclosure deadline. Evidence pack, external scan with you-vs-host split, 90-minute working call where we apply the changes together, plus 3 months of Titanos Monitor free.",
    bullets: [
      "13-section evidence pack (~17pp)",
      "90-minute implementation working call",
      "Signed attestation letter you can hand to a regulator or insurer",
      "Quarterly re-scan + delta report",
    ],
    primary: {
      label: "BOOK A 15-MIN FIT CALL ›",
      href: SITE.CAL_15MIN_URL,
      external: true,
    },
    secondary: { label: "See the compliance pack", href: "/compliance" },
    icon: "shield",
    index: 1,
  },
  {
    tag: "OFFER 03 · PROJECT-QUOTED",
    title: "AI Implementation for Business",
    price: DISPLAY.AI_BUILD_FLOOR,
    priceUnit: "quoted by scope · free 30-min scoping call",
    body:
      "AI capabilities shipped into your environment. Working code in your repo, deployed and documented. I diagnose, plan, build, and implement — quoted by scope after a free scoping call.",
    bullets: [
      "Working code in your repo",
      "Deployed, not \"deployable\"",
      "Documented for handover",
      "99% Claude Code · 1% expert human review",
    ],
    // Fix 5c — scoping CTA label/URL derived from config (auto-relabels until 30-min event exists).
    primary: {
      label: `${SCOPING_CALL_LABEL} ›`,
      href: SCOPING_CALL_URL,
      external: true,
    },
    secondary: { label: "See AI Implementation", href: "/ai-delivery" },
    icon: "sparkles",
    index: 2,
  },
  {
    tag: "OFFER 04 · LISTS & INTELLIGENCE",
    title: "Leads & Intelligence",
    price: DISPLAY.LEADS_STARTER_FROM,
    priceUnit: `per list · or ${DISPLAY.LEADS_RETAINER} intelligence feed`,
    body:
      "Verified Australian business contacts, decision-maker level, sourced from public data and checked deliverable before you get them. Built compliant, because compliance is the other thing I do.",
    bullets: [
      "Verified deliverable · 30-day bounce replacement",
      "Decision-maker contacts, not generic inboxes",
      "You own the data — no platform lock-in",
    ],
    primary: {
      label: "BOOK A 15-MIN FIT CALL ›",
      href: SITE.CAL_15MIN_URL,
      external: true,
    },
    secondary: { label: "See Leads & Intelligence", href: "/leads" },
    icon: "users",
    index: 3,
  },
];

export default function Home() {
  return (
    <>
      {/* ═══ HERO with entrance choreography ═══ */}
      {/* Fix 6 — single-spine H1 + sub. The three offer cards below carry routing. */}
      <HeroEntrance
        wordmark="TITANOS"
        tagline="One operator. Four doors in."
        trust={
          <>
            Personally reviewed · Australian-owned · ABN-verified ·{" "}
            <NumberCounter value={STATS.scansThisMonth} suffix="+" /> {STAT_LABELS.scansShort} ·{" "}
            <NumberCounter value={STATS.uniqueBusinesses} suffix="+" /> {STAT_LABELS.businessesShort}
          </>
        }
      />

      {/* MOT-06 — gold chevron scroll cue, suppresses on scroll>50 + reduce */}
      <HeroScrollCue />

      {/* Sub-tagline copy from the static site */}
      <section style={{ padding: "0 20px 60px", position: "relative", zIndex: 2 }}>
        <p
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontWeight: 300,
            fontSize: "var(--fs-body)",
            color: "var(--dim)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            textAlign: "center",
            lineHeight: 1.65,
          }}
        >
          A free security scan that shows you what an attacker sees. A fixed-price
          Privacy Act compliance engagement done with you before the 11 December
          2026 deadline. AI builds shipped into your environment, quoted by scope.
          And verified Australian lead lists, built by the compliance practice — so
          the data you buy doesn&apos;t become a compliance problem.
        </p>
      </section>

      {/* Fix 3d — middle-rung routing line: free scan as the start-here door */}
      <section style={{ padding: "0 20px 12px", position: "relative", zIndex: 2, textAlign: "center" }}>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-sm)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Not sure which door?{" "}
          <a href="/scan#request" style={{ color: "var(--gold)" }}>
            Start with the free scan
          </a>{" "}
          — it tells you which one you need.
        </p>
      </section>

      {/* Site Fix 5 — recurring bridge line (Monitor surfaced from the three-door spine, not promoted to a 4th card) */}
      <section style={{ padding: "0 20px 28px", position: "relative", zIndex: 2, textAlign: "center" }}>
        <p
          style={{
            color: "var(--dim)",
            fontSize: "var(--fs-sm)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Already know your exposure and just want to stay ahead of it?{" "}
          <a href="/monitor" style={{ color: "var(--gold)" }}>
            Titanos Monitor
          </a>{" "}
          watches your attack surface for {DISPLAY.MONITOR_MONTHLY} — cancel in one click. →
        </p>
      </section>

      <div className="divider-gold" />

      {/* ═══ THREE OFFERS ═══ */}
      <SectionReveal
        id="offers"
        style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}
      >
        <div className="container-vault">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontWeight: 700,
                fontSize: "var(--fs-h2)",
                color: "var(--gold)",
                letterSpacing: "0.06em",
              }}
            >
              PICK YOUR FRONT DOOR
            </h2>
            <div
              aria-hidden="true"
              style={{
                width: 60,
                height: 2,
                background:
                  "linear-gradient(90deg, transparent, var(--ice), transparent)",
                margin: "18px auto 0",
              }}
            />
            <p
              style={{
                color: "var(--text)",
                fontWeight: 400,
                fontSize: "var(--fs-body)",
                maxWidth: "var(--maxw-prose)",
                margin: "18px auto 0",
                lineHeight: 1.7,
              }}
            >
              One free starting point. One fixed compliance engagement. One quoted AI
              implementation. One verified-leads channel. No catalogue, no menus,
              no upsell maze.
            </p>
          </div>

          <div
            className="grid-doors"
            style={{
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {offers.map((o, i) => (
              <div key={o.tag} style={{ position: "relative" }}>
                <OfferCard {...o} />
                {/* Fix 4 — Offer 02 sub-line now slot-based scarcity (capacity), not day countdown */}
                {i === 1 && (
                  <div style={{ textAlign: "center", marginTop: 8 }}>
                    <SlotScarcity variant="pill" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SectionReveal>

      {/* ═══ Trust stats strip ═══ */}
      <SectionReveal
        as="div"
        style={{
          background: "var(--card)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "40px 20px",
          textAlign: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 24,
            maxWidth: "var(--maxw-content)",
            margin: "0 auto",
          }}
        >
          {/* Fix 5e — strip cleanup: drop the methodology-as-traction-metric cells.
              Methodology block already carries 90-day disclosure window + zero-exploit claim.
              Replaced with a real activity metric: scan-report SLA. */}
          <TrustItem
            big={<NumberCounter value={STATS.scansThisMonth} suffix="+" />}
            small={STAT_LABELS.scansShort}
          />
          <TrustItem
            big={<NumberCounter value={STATS.uniqueBusinesses} suffix="+" />}
            small={STAT_LABELS.businessesShort}
          />
          <TrustItem big="1 business day" small="scan report SLA" />
        </div>
      </SectionReveal>

      {/*
        SOCIAL PROOF PLACEHOLDER — Kyle to fill.
        INSERT REAL testimonials, client names, logos, outcomes here.
        DO NOT FABRICATE. Leave hidden until real content available.
      */}
      <section
        className="social-proof-placeholder"
        style={{ display: "none" }}
        aria-hidden="true"
      >
        {/* testimonial cards go here when real content lands */}
      </section>

      <div className="divider-gold" />

      {/* ═══ Final CTA ═══ */}
      <SectionReveal
        style={{
          textAlign: "center",
          padding: "var(--space-30) 20px",
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
          ONE OPERATOR. FOUR DOORS IN.
        </h2>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-lg)",
            marginBottom: 32,
            maxWidth: "var(--maxw-prose)",
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.6,
          }}
        >
          Start with a free scan, ship the compliance pack before December, scope
          an AI build, or order a verified leads list. Whichever maps to your
          problem, the path is the same: one accountable contact, work shipped
          not consulted.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/scan#request" variant="primary">
            REQUEST YOUR FREE SCAN
          </AnimatedButton>
          <AnimatedButton
            href={SITE.CAL_15MIN_URL}
            external
            variant="secondary"
          >
            BOOK A 15-MIN FIT CALL
          </AnimatedButton>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ Methodology summary ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <details>
            <summary
              style={{
                cursor: "pointer",
                textAlign: "center",
                fontFamily: "var(--font-body), system-ui, sans-serif",
                fontWeight: 500,
                fontSize: "var(--fs-body)",
                color: "var(--ice)",
                letterSpacing: "0.02em",
                listStyle: "none",
                marginBottom: 32,
              }}
            >
              How I work technically (click to expand)
            </summary>
            <div>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <h2
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontWeight: 700,
                    fontSize: "var(--fs-h2)",
                    color: "var(--gold)",
                    letterSpacing: "0.06em",
                  }}
                >
                  METHODOLOGY
                </h2>
                <div
                  aria-hidden="true"
                  style={{
                    width: 60,
                    height: 2,
                    background:
                      "linear-gradient(90deg, transparent, var(--ice), transparent)",
                    margin: "18px auto 0",
                  }}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  maxWidth: "var(--maxw-content)",
                  margin: "0 auto",
                }}
              >
                <MethodCard title="What I do">
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>External nmap (-sV)</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>TLS / SSL validation</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>Public DNS + cert transparency</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>NVD CVE matching by version</p>
                </MethodCard>
                <MethodCard title="What I never do">
                  <p><span style={{ color: "var(--warn)", marginRight: 6 }}>✗</span>Auth / credential attempts</p>
                  <p><span style={{ color: "var(--warn)", marginRight: 6 }}>✗</span>Exploit attempts</p>
                  <p><span style={{ color: "var(--warn)", marginRight: 6 }}>✗</span>DoS / brute force</p>
                  <p><span style={{ color: "var(--warn)", marginRight: 6 }}>✗</span>Data exfiltration</p>
                </MethodCard>
                <MethodCard title="Verifiable">
                  <p>
                    Every finding ships with the exact <code>nmap</code> command to reproduce it.
                    Independently confirm any claim before acting on it.
                  </p>
                </MethodCard>
                <MethodCard title="Removal">
                  <p>
                    Reply <code>remove</code> to any email and your domain is suppressed forever.
                    Honoured immediately.
                  </p>
                </MethodCard>
              </div>
              <p style={{ textAlign: "center", marginTop: 32 }}>
                <AnimatedButton href="/methodology" variant="secondary">
                  See full methodology
                </AnimatedButton>
              </p>
            </div>
          </details>
        </div>
      </SectionReveal>
    </>
  );
}

function TrustItem({
  big,
  small,
}: {
  big: React.ReactNode;
  small: string;
}) {
  return (
    <div style={{ fontSize: "var(--fs-sm)", color: "var(--dim)" }}>
      <strong
        style={{
          display: "block",
          color: "var(--gold)",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "var(--fs-h3)",
          marginBottom: 4,
          letterSpacing: "0.04em",
          fontWeight: 700,
        }}
      >
        {big}
      </strong>
      {small}
    </div>
  );
}

function MethodCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: 18,
      }}
    >
      <h4
        style={{
          color: "var(--ice)",
          fontSize: "var(--fs-body)",
          fontWeight: 600,
          marginBottom: 8,
          fontFamily: "var(--font-body), system-ui, sans-serif",
          letterSpacing: 0,
        }}
      >
        {title}
      </h4>
      <div
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-sm)",
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </div>
  );
}
