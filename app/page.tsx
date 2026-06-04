import HeroEntrance from "@/components/HeroEntrance";
import OfferCard from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import NumberCounter from "@/components/NumberCounter";
import AnimatedButton from "@/components/AnimatedButton";

const offers = [
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
    secondary: { label: "Learn more", href: "/scan" },
    icon: "radar" as const,
  },
  {
    tag: "OFFER 02 · done with you",
    title: "Privacy Act + Essential Eight Compliance",
    price: "AU$5,997",
    priceUnit: "one-time + AU$199/mo monitoring",
    body:
      "One done-with-you engagement for the 11 December 2026 ADM disclosure deadline. Evidence pack, external scan with you-vs-host split, 90-minute working call where we apply the changes together, and 12 months of regulatory update briefings.",
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
    secondary: { label: "Learn more", href: "/compliance" },
    icon: "shield" as const,
  },
  {
    tag: "OFFER 03 · PROJECT-QUOTED",
    title: "AI Implementation for Business",
    price: "From AU$4,997",
    priceUnit: "scoping call first · quoted by scope",
    body:
      "Full-cycle problem-solving → planning → building → implementation. We diagnose the problem, plan the solution, build it in your repo, and implement it in your environment. One model or many; one workflow or a full system.",
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
    secondary: { label: "Learn more", href: "/ai-delivery" },
    icon: "sparkles" as const,
  },
];

export default function Home() {
  return (
    <>
      {/* JSON-LD organization schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Titanos",
            url: "https://titanos.tech",
            logo: "https://titanos.tech/apple-touch-icon.png",
            description:
              "External attack-surface scanning + Privacy Act compliance + AI Implementation for AU/NZ/SG businesses.",
            areaServed: ["AU", "NZ", "SG"],
            identifier: {
              "@type": "PropertyValue",
              name: "ABN",
              value: "34318502254",
            },
            sameAs: ["https://cal.com/kyle-deligny-msvz6s/15min"],
          }),
        }}
      />

      {/* ═══ HERO with entrance choreography ═══ */}
      <HeroEntrance
        wordmark="TITANOS"
        tagline="Three ways Titanos helps your business."
        trust={
          <>
            Expert-reviewed · Australian-owned · ABN-verified ·{" "}
            <NumberCounter value={1700} suffix="+" /> scans this month ·{" "}
            <NumberCounter value={3600} suffix="+" /> unique businesses in scan corpus
          </>
        }
      />

      {/* Sub-tagline copy from the static site */}
      <section style={{ padding: "0 20px 60px", position: "relative", zIndex: 2 }}>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            fontSize: "0.98rem",
            color: "var(--dim)",
            maxWidth: 760,
            margin: "0 auto",
            textAlign: "center",
            lineHeight: 1.65,
          }}
        >
          Free external attack-surface scans for AU/NZ/SG domains. Privacy Act + Essential Eight
          compliance done with you. AI Implementation for Business, end-to-end. Built, verified,
          and delivered by Claude Code under expert human review.
        </p>
      </section>

      <div className="divider-gold" />

      {/* ═══ THREE OFFERS ═══ */}
      <SectionReveal
        id="offers"
        style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}
      >
        <div className="container-vault">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: "'Cinzel', serif",
                fontWeight: 700,
                fontSize: "clamp(1.5rem, 4vw, 2.4rem)",
                color: "var(--gold)",
                letterSpacing: "0.06em",
              }}
            >
              THREE WAYS WE HELP
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
                color: "var(--ice)",
                fontSize: "1rem",
                maxWidth: 680,
                margin: "18px auto 0",
                lineHeight: 1.7,
              }}
            >
              One free starting point. One fixed compliance engagement. One quoted AI
              implementation. No catalogue, no menus, no upsell maze.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 22,
              maxWidth: 1020,
              margin: "0 auto",
            }}
          >
            {offers.map((o, i) => (
              <OfferCard key={o.tag} {...o} index={i} />
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
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <TrustItem
            big={<NumberCounter value={1700} suffix="+" />}
            small="scans this month"
          />
          <TrustItem
            big={<NumberCounter value={3600} suffix="+" />}
            small="unique businesses in scan corpus"
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

      {/* ═══ Methodology summary ═══ */}
      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2
              style={{
                fontFamily: "'Cinzel', serif",
                fontWeight: 700,
                fontSize: "clamp(1.5rem, 4vw, 2.4rem)",
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
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <MethodCard title="What we do">
              <p><span style={{ color: "#4ade80", marginRight: 6 }}>✓</span>Banner-grade nmap (-sV)</p>
              <p><span style={{ color: "#4ade80", marginRight: 6 }}>✓</span>TLS / SSL validation</p>
              <p><span style={{ color: "#4ade80", marginRight: 6 }}>✓</span>Public DNS + cert transparency</p>
              <p><span style={{ color: "#4ade80", marginRight: 6 }}>✓</span>NVD CVE matching by version</p>
            </MethodCard>
            <MethodCard title="What we never do">
              <p><span style={{ color: "#f87171", marginRight: 6 }}>✗</span>Auth / credential attempts</p>
              <p><span style={{ color: "#f87171", marginRight: 6 }}>✗</span>Exploit attempts</p>
              <p><span style={{ color: "#f87171", marginRight: 6 }}>✗</span>DoS / brute force</p>
              <p><span style={{ color: "#f87171", marginRight: 6 }}>✗</span>Data exfiltration</p>
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
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ Final CTA ═══ */}
      <SectionReveal
        style={{
          textAlign: "center",
          padding: "100px 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            color: "var(--gold)",
            fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
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
            fontSize: "1.05rem",
            marginBottom: 32,
            maxWidth: 600,
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
          <AnimatedButton
            href="https://cal.com/kyle-deligny-msvz6s/15min"
            external
            variant="primary"
          >
            BOOK A 15-MIN CALL
          </AnimatedButton>
          <AnimatedButton href="/scan" variant="primary">
            REQUEST YOUR FREE SCAN
          </AnimatedButton>
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
    <div style={{ fontSize: "0.85rem", color: "var(--dim)" }}>
      <strong
        style={{
          display: "block",
          color: "var(--gold)",
          fontFamily: "'Cinzel', serif",
          fontSize: "1.4rem",
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
        borderRadius: 4,
        padding: 18,
      }}
    >
      <h4
        style={{
          color: "var(--ice)",
          fontSize: "0.95rem",
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
          fontSize: "0.85rem",
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </div>
  );
}
