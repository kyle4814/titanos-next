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
    title: "Free Security Check",
    price: "$0",
    priceUnit: "no card · delivered within 1 business day",
    body:
      "A check of what a hacker can see about your business from the internet — open ports, email security gaps, expired certificates, known software weaknesses. Report in your inbox within 1 business day. Personally reviewed.",
    bullets: [
      "Just your website address — any AU/NZ/SG host",
      "Every finding verifiable — I show you the exact check I ran so you can confirm it yourself",
      "Personally reviewed before delivery",
    ],
    primary: {
      label: "SEE WHAT'S EXPOSED — FREE →",
      href: "/scan#request",
      external: false,
    },
    secondary: { label: "See the free check", href: "/scan" },
    icon: "radar",
    index: 0,
  },
  {
    tag: "OFFER 02 · done with you",
    title: "Privacy Act Compliance",
    price: DISPLAY.PACK_PRICE,
    priceUnit: `one-time · ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of monitoring included free`,
    body:
      "For AU small businesses on Squarespace, WordPress, Microsoft 365, or Google Workspace. Six obligations — privacy policy, breach plan, email security, login security, data mapping, and AI disclosure — sorted together on one 90-minute working call. Nothing left to figure out on your own. Deadline: 11 December 2026.",
    bullets: [
      "17-page evidence document your insurer or regulator can read",
      "90-minute working call — we apply every change together, on screen",
      "Signed letter you can show a regulator, insurer, or enterprise client",
      "Quarterly re-check and report on what's changed",
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
    title: "AI That Does Your Manual Work",
    price: DISPLAY.AI_BUILD_FLOOR,
    priceUnit: "quoted by scope · free 15-min scoping call",
    body:
      "Tell me the task someone on your team does manually every day. I build the AI system that does it instead — shipped working into your business and documented for your team. Quoted by scope after a free call.",
    bullets: [
      "The painful manual job, automated",
      "Shipped working, not a slide deck",
      "Documented so your team can use it",
      "Built by AI, reviewed and signed off by me on every engagement",
    ],
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
    title: "Verified AU Contact Lists",
    price: DISPLAY.LEADS_STARTER_FROM,
    priceUnit: `per list · or ${DISPLAY.LEADS_RETAINER} intelligence feed`,
    body:
      "Verified Australian business contacts — sourced from public data and checked deliverable before you get them, with the named owner or decision-maker wherever it's publicly listed. Built compliant, because compliance is the other thing I do.",
    bullets: [
      "Verified deliverable · 30-day bounce replacement",
      "Named decision-maker where publicly available · every contact verified",
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
      {/* ═══ HERO ═══ */}
      <HeroEntrance
        wordmark="TITANOS"
        tagline="New privacy rules. Real fines. Anyone can sue you today. Does your business know where it stands?"
        trust={
          <>
            Personally reviewed · Australian-owned · ABN-verified ·{" "}
            <NumberCounter value={STATS.scansThisMonth} suffix="+" /> {STAT_LABELS.scansShort} ·{" "}
            <NumberCounter value={STATS.uniqueBusinesses} suffix="+" /> {STAT_LABELS.businessesShort}
          </>
        }
      />

      <HeroScrollCue />

      {/* Fear-first plain-English sub-copy + six obligations */}
      <section style={{ padding: "0 20px 32px", position: "relative", zIndex: 2 }}>
        <p
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "var(--fs-body)",
            color: "var(--ice)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 18px",
            textAlign: "center",
            lineHeight: 1.75,
          }}
        >
          From December 2026, Australian privacy law puts real obligations on small
          businesses for the first time. Fines up to AU$50M. And anyone can already
          take you to court for a serious privacy breach today — no regulator queue needed.
        </p>

        {/* ═══ What's actually changing ═══ */}
        <div
          style={{
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 28px",
            background: "var(--card)",
            border: "1px solid var(--gold-dim)",
            borderRadius: "var(--radius-md)",
            padding: "28px 30px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 700,
              fontSize: "var(--fs-h3)",
              color: "var(--gold)",
              letterSpacing: "0.04em",
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            What&apos;s actually changing (and why it&apos;s more than you think)
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize: "var(--fs-body)",
              color: "var(--text)",
              lineHeight: 1.7,
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            From December 2026, Australian privacy law puts real obligations on small
            businesses for the first time. Most owners think it&apos;s just one thing.
            It&apos;s not &mdash; here&apos;s what you&apos;re now expected to have:
          </p>
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {[
              "A proper privacy policy — not a copy-paste from 2015, but one that actually covers what customer info you hold and what you do with it",
              "A plan for what to do if you get hacked — you're now legally expected to have one",
              "Your email set up so scammers can't impersonate your business",
              "Basic login security so your accounts can't be walked into",
              "Knowing exactly what customer data you hold and where it lives",
              "If you use AI or automated tools on customer info — you have to say so",
            ].map((item, i) => (
              <li
                key={i}
                style={{
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                  fontSize: "var(--fs-body)",
                  color: "var(--text)",
                  lineHeight: 1.65,
                  padding: "7px 0 7px 30px",
                  position: "relative",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    color: "var(--gold)",
                    fontWeight: 700,
                    fontFamily: "var(--font-display), Georgia, serif",
                  }}
                >
                  {i + 1}.
                </span>
                {item}
              </li>
            ))}
          </ol>
          <p
            style={{
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize: "var(--fs-body)",
              color: "var(--ice)",
              lineHeight: 1.7,
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
            }}
          >
            Miss any of it and you could be fined, sued directly, or find your insurer
            won&apos;t cover you after a breach. Most owners have no idea this is coming,
            no time to become an expert, and no clue where to start. That&apos;s exactly
            what I&apos;m for &mdash; I sort all of it with you, plain English, before the deadline.
          </p>
        </div>

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
          I check your digital exposure for free and show you in plain English what
          a hacker can see. If you have gaps, I fix them with you &mdash; all six obligations,
          one working call. I also build AI tools that cut your manual workload, and
          supply verified Australian contact lists that won&apos;t create a compliance problem.
        </p>
      </section>

      {/* Hero CTAs */}
      <section style={{ padding: "0 20px 16px", position: "relative", zIndex: 2, textAlign: "center" }}>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/scan#request" variant="primary">
            SEE WHAT&apos;S EXPOSED — IT&apos;S FREE
          </AnimatedButton>
          <AnimatedButton href="#offers" variant="secondary">
            SEE HOW IT WORKS ↓
          </AnimatedButton>
        </div>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 10 }}>
          No card · No login · Report in your inbox within 1 business day
        </p>
      </section>

      {/* Monitor bridge */}
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
          Already had the free check and just want to know when things change?{" "}
          <a href="/monitor" style={{ color: "var(--gold)" }}>
            Titanos Monitor
          </a>{" "}
          re-checks your business every month and emails you what&apos;s new — {DISPLAY.MONITOR_MONTHLY}, cancel in one click. →
        </p>
      </section>

      <div className="divider-gold" />

      {/* ═══ FOUR OFFERS ═══ */}
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
              FOUR WAYS IN
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
              Start free. Pay only if you need the fix. One operator — no contractor
              chain, no upsell maze.
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
          START WITH A FREE CHECK — NO CARD NEEDED
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
          See what a hacker can see about your business. Takes 1 minute to request.
          Report lands in your inbox within a business day. Then decide what comes next.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/scan#request" variant="primary">
            SEE WHAT&apos;S EXPOSED — IT&apos;S FREE
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

      {/* ═══ How I work (expandable for the curious) ═══ */}
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
              How the security check works technically (click to expand)
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
                <MethodCard title="What I check">
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>Open ports and services (standard port scan)</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>Encrypted connection check (TLS/SSL)</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>Email security records (SPF, DKIM, DMARC)</p>
                  <p><span style={{ color: "var(--ok)", marginRight: 6 }}>✓</span>Known software vulnerabilities, by version</p>
                </MethodCard>
                <MethodCard title="What I never do">
                  <p><span style={{ color: "var(--warn)", marginRight: 6 }}>✗</span>Log in or try passwords</p>
                  <p><span style={{ color: "var(--warn)", marginRight: 6 }}>✗</span>Attempt to break in</p>
                  <p><span style={{ color: "var(--warn)", marginRight: 6 }}>✗</span>Overload your site</p>
                  <p><span style={{ color: "var(--warn)", marginRight: 6 }}>✗</span>Access or extract your data</p>
                </MethodCard>
                <MethodCard title="Verifiable">
                  <p>
                    Every finding comes with the exact command used to find it.
                    You can run the same check yourself and get the same result.
                  </p>
                </MethodCard>
                <MethodCard title="Opt-out">
                  <p>
                    Reply <code>remove</code> to any email and your domain is suppressed
                    forever. Honoured immediately.
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
