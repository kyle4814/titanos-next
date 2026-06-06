import HeroEntrance from "@/components/HeroEntrance";
import OfferCard from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import NumberCounter from "@/components/NumberCounter";
import AnimatedButton from "@/components/AnimatedButton";
import DeadlineCounter from "@/components/DeadlineCounter";
import { STATS, STAT_LABELS } from "@/lib/stats";

import type { Offer } from "@/components/OfferCard";

const offers: Offer[] = [
  {
    tag: "OFFER 01 · FREE",
    title: "Free Scan",
    price: "$0",
    priceUnit: "no card · delivered within 1 business day",
    body:
      "External attack-surface scan on any AU/NZ/SG domain. Banner-grade evidence, expert-reviewed, with a 90-day responsible-disclosure window. The report you'd want about your own infrastructure.",
    bullets: [
      "Domain-or-ABN intake, any AU/NZ/SG host",
      "Banner-grade evidence, fully reproducible",
      "Expert-reviewed before delivery",
    ],
    primary: {
      label: "REQUEST YOUR FREE SCAN ›",
      href: "mailto:kyle@titanos.tech?subject=Scan%20request&body=Domain%3A%20%0AYour%20name%3A%20%0ANotes%20(optional)%3A",
      external: false,
    },
    secondary: { label: "See the free scan", href: "/scan" },
    icon: "radar",
    index: 0,
  },
  {
    tag: "OFFER 02 · done with you",
    title: "Privacy Act + Essential Eight Compliance",
    price: "AU$5,997",
    priceUnit: "one-time + AU$199/mo monitoring",
    body:
      "For AU SMBs (5-50 staff) on Squarespace / WordPress / Microsoft 365 / Google Workspace. We translate everything into plain English on the call.\n\nOne done-with-you engagement for the 11 December 2026 ADM disclosure deadline. Evidence pack, external scan with you-vs-host split, 90-minute working call where we apply the changes together, and 12 months of regulatory update briefings.",
    bullets: [
      "13-section evidence pack (~17pp)",
      "90-minute implementation working call",
      "Signed compliance attestation letter",
      "Quarterly re-scan + delta report",
    ],
    primary: {
      label: "BOOK A 15-MIN ›",
      href: "https://cal.com/kyle-deligny-msvz6s/15min",
      external: true,
    },
    secondary: { label: "See the compliance pack", href: "/compliance" },
    icon: "shield",
    index: 1,
  },
  {
    tag: "OFFER 03 · PROJECT-QUOTED",
    title: "AI Implementation for Business",
    price: "From AU$4,997",
    priceUnit: "scoping call first · quoted by scope",
    body:
      "AI capabilities shipped into your environment. Working code in your repo, deployed and documented. We diagnose, plan, build, and implement — quoted by scope after a 30-minute call.",
    bullets: [
      "Working code in your repo",
      "Deployed, not \"deployable\"",
      "Documented for handover",
      "99% Claude Code · 1% expert human review",
    ],
    primary: {
      label: "BOOK A SCOPING CALL ›",
      href: "https://cal.com/kyle-deligny-msvz6s/15min",
      external: true,
    },
    secondary: { label: "See AI Implementation", href: "/ai-delivery" },
    icon: "sparkles",
    index: 2,
  },
];

export default function Home() {
  return (
    <>
      {/* ═══ HERO with entrance choreography ═══ */}
      <HeroEntrance
        wordmark="TITANOS"
        tagline="Get Privacy Act + Essential Eight compliant before 11 December 2026 — or start with a free scan."
        trust={
          <>
            Expert-reviewed · Australian-owned · ABN-verified ·{" "}
            <NumberCounter value={STATS.scansThisMonth} suffix="+" /> {STAT_LABELS.scansShort} ·{" "}
            <NumberCounter value={STATS.uniqueBusinesses} suffix="+" /> {STAT_LABELS.businessesShort}
          </>
        }
      />

      {/* Sub-tagline copy from the static site */}
      <section style={{ padding: "0 20px 60px", position: "relative", zIndex: 2 }}>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            fontSize: "var(--fs-body)",
            color: "var(--dim)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto",
            textAlign: "center",
            lineHeight: 1.65,
          }}
        >
          Free security scan for AU/NZ/SG businesses. Privacy Act compliance done together on a 90-minute call. AI builds shipped to your environment. One operator, three doors in.
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
                fontFamily: "'Cinzel', serif",
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
              implementation. No catalogue, no menus, no upsell maze.
            </p>
          </div>

          <div
            className="grid-auto-cards"
            style={{
              gap: 22,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {offers.map((o, i) => (
              <div key={o.tag} style={{ position: "relative" }}>
                <OfferCard {...o} />
                {i === 1 && (
                  <div style={{ textAlign: "center", marginTop: 8 }}>
                    <DeadlineCounter />
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
          <TrustItem
            big={<NumberCounter value={STATS.scansThisMonth} suffix="+" />}
            small={STAT_LABELS.scansShort}
          />
          <TrustItem
            big={<NumberCounter value={STATS.uniqueBusinesses} suffix="+" />}
            small={STAT_LABELS.businessesShort}
          />
          <TrustItem big="90 day" small="responsible disclosure window" />
          <TrustItem big="0%" small="auth attempts · 0% exploits" />
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
            fontFamily: "'Cinzel', serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            fontWeight: 700,
            marginBottom: 14,
            letterSpacing: "0.05em",
          }}
        >
          ONE OPERATOR. THREE WAYS IN.
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
          Start with a free scan, ship the compliance pack before December, or scope an AI build.
          Whichever maps to your problem, the path is the same: tell us what you'd build if
          delivery wasn't the bottleneck.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/scan" variant="primary">
            REQUEST YOUR FREE SCAN
          </AnimatedButton>
          <AnimatedButton
            href="https://cal.com/kyle-deligny-msvz6s/15min"
            external
            variant="secondary"
          >
            BOOK A 15-MIN CALL
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
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: "var(--fs-body)",
                color: "var(--ice)",
                letterSpacing: "0.02em",
                listStyle: "none",
                marginBottom: 32,
              }}
            >
              How we work technically (click to expand)
            </summary>
            <div>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <h2
                  style={{
                    fontFamily: "'Cinzel', serif",
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
                <MethodCard title="What we do">
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>Banner-grade nmap (-sV)</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>TLS / SSL validation</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>Public DNS + cert transparency</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>NVD CVE matching by version</p>
                </MethodCard>
                <MethodCard title="What we never do">
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
          fontFamily: "'Cinzel', serif",
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
          fontFamily: "'Inter', sans-serif",
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
