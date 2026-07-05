import HeroEntrance from "@/components/HeroEntrance";
import OfferCard from "@/components/OfferCard";
import SectionReveal from "@/components/SectionReveal";
import NumberCounter from "@/components/NumberCounter";
import AnimatedButton from "@/components/AnimatedButton";
import HeroScrollCue from "@/components/HeroScrollCue";
import { STATS } from "@/lib/stats";
import { SITE } from "@/lib/config";
import { DISPLAY, PRICING } from "@/lib/pricing";

import type { Offer } from "@/components/OfferCard";

const offers: Offer[] = [
  {
    tag: "Door 01 · Free",
    title: "Free Security Check",
    price: "AU$0",
    priceUnit: "no card · report in your inbox within 1 business day",
    body:
      "See what a hacker can see about your business from the internet — open ports, email security gaps, expired certificates, known software weaknesses. Personally reviewed before I send it. No login, no credit card, no sales sequence hounding you afterwards. Just a clear picture of where your business actually stands — the same check I'd run on a paying client, so you can see the quality before you spend a cent.",
    bullets: [
      "Just your website address — any AU/NZ/SG host",
      "Every finding verifiable — I show you the exact check I ran",
      "A plain-English summary — what's exposed, what it means, what to do (no tech degree needed)",
      "No obligation — if everything's fine, I'll tell you that too",
    ],
    footnote:
      "Most businesses are surprised by at least one thing. Better you see it than a hacker does.",
    primary: {
      label: "Get your free scan →",
      href: "/scan#request",
      external: false,
    },
    secondary: { label: "See what's in the free check", href: "/scan" },
    icon: "radar",
    index: 0,
  },
  {
    tag: "Door 02 · Done with you",
    title: "Privacy Act Compliance",
    price: DISPLAY.PACK_PRICE,
    priceUnit: `one-time · all six obligations sorted · ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of monitoring included free`,
    body:
      "One fixed-price engagement covering all six new Privacy Act obligations. On a 90-minute screen-share we apply every change together — no PDF-only hand-off, no jargon. For AU small businesses on Squarespace, WordPress, Microsoft 365, or Google Workspace. Deadline: 11 December 2026.",
    bullets: [
      "All six obligations — privacy policy, breach plan, email security, login security, data mapping, AI disclosure",
      "90-minute working call — we apply every change together, on screen",
      "A plain-English report you can hand straight to your insurer or a big client as proof",
      "Signed compliance letter for a regulator, insurer, or enterprise client",
    ],
    primary: {
      label: `Order compliance · ${DISPLAY.PACK_PRICE} →`,
      href: "/order/compliance",
      external: false,
    },
    secondary: { label: "See what's included", href: "/compliance" },
    icon: "shield",
    index: 1,
  },
  {
    tag: "Door 03 · Project-quoted",
    title: "AI That Does Your Manual Work",
    price: DISPLAY.AI_PILOT_FLOOR,
    priceUnit: `${DISPLAY.AI_LADDER_ENTRY} · free 15-min scoping call`,
    body:
      "Tell me the task someone on your team does manually every day. I build the AI system that does it instead — shipped working into your business and documented for your team.",
    bullets: [
      "The painful manual job, automated",
      "Shipped working, not a slide deck",
      "Documented so your team can use it",
      "Reviewed and signed off by me on every engagement",
    ],
    primary: {
      label: "Order AI implementation →",
      href: "/order/ai",
      external: false,
    },
    secondary: { label: "See AI Implementation", href: "/ai-delivery" },
    icon: "sparkles",
    index: 2,
  },
  {
    tag: "Door 04 · Lists & intelligence",
    title: "Verified AU Contact Lists",
    price: DISPLAY.LEADS_STARTER_FROM,
    priceUnit: `per list · or ${DISPLAY.LEADS_RETAINER} intelligence feed`,
    body:
      "Verified Australian business contacts — sourced from public data and checked deliverable before you get them, named where the owner or decision-maker is publicly listed. Built compliant, because compliance is the other thing I do.",
    bullets: [
      "Verified deliverable · 30-day bounce replacement",
      "Named decision-maker where publicly available",
      "You own the data — no platform lock-in",
    ],
    primary: {
      label: "Order a list →",
      href: "/order/leads",
      external: false,
    },
    secondary: { label: "See Leads & Intelligence", href: "/leads" },
    icon: "users",
    index: 3,
  },
];

// Six obligations — stripped of the manual "1." that collided with the
// browser's default <ol> counter and produced "1. 1." on the live site.
// Rendered as a grid of numbered cards with a gold pill number.
const SIX_OBLIGATIONS: { title: string; body: string }[] = [
  {
    title: "A proper privacy policy",
    body: "Not a copy-paste from 2015 — one that actually covers what customer info you hold and what you do with it.",
  },
  {
    title: "A plan for if you get hacked",
    body: "You're now legally expected to have a written breach-response plan you can act on the day it happens.",
  },
  {
    title: "Email set up so scammers can't impersonate you",
    body: "SPF, DKIM and DMARC records applied so nobody can send email pretending to be your business.",
  },
  {
    title: "Basic login security",
    body: "Two-factor login across your team so your accounts can't be walked into with a leaked password.",
  },
  {
    title: "Knowing what customer data you hold",
    body: "A one-page record of every third-party tool that touches your customer data, and where it lives.",
  },
  {
    title: "AI + automated tools disclosure",
    body: "If you use AI on customer info, you have to say so in your privacy policy. New rule, 11 December 2026.",
  },
];

export default function Home() {
  return (
    <>
      {/* ═══ HERO ═══ */}
      <HeroEntrance
        wordmark="TITANOS"
        eyebrow="Australian Privacy Law · Deadline 11 December 2026"
        tagline="New privacy rules. Real fines. Anyone can sue you today. Does your business know where it stands?"
        trust={
          <>
            Personally reviewed · Australian-owned · ABN 34 318 502 254 · Own scan &amp; evidence pack published
          </>
        }
      />

      {/* Sub-copy under hero */}
      <section style={{ padding: "0 20px 28px", position: "relative", zIndex: 2 }}>
        <p
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontWeight: 400,
            fontSize: "var(--fs-lg)",
            color: "var(--ice)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 26px",
            textAlign: "center",
            lineHeight: 1.65,
          }}
        >
          Since June 2025, anyone affected can sue your business directly for a serious
          privacy breach — no regulator queue, and your insurer may refuse to cover it.
          From 11 December 2026, six new obligations land on top (with fines up to AU$50M
          for the worst cases). I&apos;ll sort the lot in one call, before the deadline.
        </p>

        {/* ONE primary CTA + one ghost link */}
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <AnimatedButton href="/scan#request" variant="primary">
              Show me what a hacker sees →
            </AnimatedButton>
            <AnimatedButton href="#offers" variant="secondary">
              See how it works
            </AnimatedButton>
          </div>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 12 }}>
            No card · No login · Report in your inbox within 1 business day
          </p>
        </div>
      </section>

      {/* Trust bar — horizontal scannable units with faint dividers */}
      <SectionReveal
        as="div"
        style={{
          padding: "24px 20px 40px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          className="trust-bar"
          style={{
            maxWidth: "var(--maxw-wide)",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 0,
            border: "1px solid rgb(var(--gold-rgb) / 0.15)",
            borderRadius: "var(--radius-md)",
            background: "rgb(var(--gold-rgb) / 0.02)",
          }}
        >
          <TrustUnit
            big={<><NumberCounter value={STATS.scansThisMonth} suffix="+" /></>}
            small="scans this month"
          />
          <TrustUnit
            big={<><NumberCounter value={STATS.uniqueBusinesses} suffix="+" /></>}
            small="AU/NZ/SG businesses in corpus"
          />
          <TrustUnit big="ABN 34 318 502 254" small="Australian-owned" tone="text" />
          <TrustUnit big="Personally reviewed" small="by Kyle before delivery" tone="text" last />
        </div>
      </SectionReveal>

      <HeroScrollCue />

      {/* ═══ Six obligations — the reality check ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px 0", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p
              className="font-mono"
              style={{
                fontSize: "var(--fs-xs)",
                letterSpacing: "0.18em",
                color: "var(--gold-warm)",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              What&apos;s actually changing
            </p>
            <h2
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontWeight: 400,
                fontStyle: "italic",
                fontSize: "var(--fs-h2)",
                color: "var(--gold)",
                letterSpacing: "0.01em",
                lineHeight: 1.2,
                maxWidth: "var(--maxw-content)",
                margin: "0 auto 14px",
              }}
            >
              Six obligations, not one. Most owners only know about one of them.
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body), system-ui, sans-serif",
                fontSize: "var(--fs-body)",
                color: "var(--text)",
                lineHeight: 1.7,
                maxWidth: "var(--maxw-prose)",
                margin: "0 auto",
              }}
            >
              From 11 December 2026, Australian privacy law puts real obligations on
              small businesses for the first time. Here&apos;s what you&apos;re now
              expected to have in place:
            </p>
          </div>

          <div
            className="six-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
              maxWidth: "var(--maxw-wide)",
              margin: "0 auto",
            }}
          >
            {SIX_OBLIGATIONS.map((o, i) => (
              <div
                key={o.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "22px 24px",
                  position: "relative",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 34,
                    height: 24,
                    padding: "0 8px",
                    background: "rgb(var(--gold-rgb) / 0.12)",
                    border: "1px solid var(--gold-dim)",
                    color: "var(--gold)",
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: "var(--fs-xs)",
                    letterSpacing: "0.08em",
                    borderRadius: 999,
                    marginBottom: 12,
                    fontWeight: 700,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  style={{
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                    color: "var(--ice)",
                    fontSize: "var(--fs-lg)",
                    fontWeight: 600,
                    letterSpacing: 0,
                    marginBottom: 6,
                    lineHeight: 1.35,
                  }}
                >
                  {o.title}
                </h3>
                <p
                  style={{
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.65,
                  }}
                >
                  {o.body}
                </p>
              </div>
            ))}
          </div>

          {/* Ember stakes callout */}
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "36px auto 0",
              borderLeft: "3px solid var(--ember)",
              background: "rgba(255, 90, 58, 0.05)",
              padding: "18px 22px",
              borderRadius: "0 var(--radius-md) var(--radius-md) 0",
            }}
          >
            <p
              style={{
                fontSize: "var(--fs-body)",
                color: "var(--text)",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              Miss any of it and you could be <strong style={{ color: "#ff8f78" }}>fined,
              sued directly, or find your insurer won&apos;t cover you</strong> after a breach.
              Since June 2025, anyone can already take you to court for a serious privacy
              breach — no regulator queue needed.
            </p>
          </div>

          {/* Reassurance line */}
          <div
            style={{
              maxWidth: "var(--maxw-prose)",
              margin: "18px auto 0",
              background: "rgb(var(--gold-rgb) / 0.06)",
              border: "1px solid var(--gold-dim)",
              padding: "18px 22px",
              borderRadius: "var(--radius-md)",
            }}
          >
            <p
              style={{
                fontSize: "var(--fs-body)",
                color: "var(--ice)",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              Most owners have no time to become an expert and no clue where to start.
              That&apos;s exactly what I&apos;m for — one operator, one call, all six
              sorted with you in plain English, before the deadline.
            </p>
          </div>
        </div>
      </SectionReveal>

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
            <p
              className="font-mono"
              style={{
                fontSize: "var(--fs-xs)",
                letterSpacing: "0.18em",
                color: "var(--gold-warm)",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Four doors in
            </p>
            <h2
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontWeight: 400,
                fontStyle: "italic",
                fontSize: "var(--fs-h2)",
                color: "var(--gold)",
                letterSpacing: "0.01em",
              }}
            >
              Pick the door that fits where you are today
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
            {offers.map((o) => {
              const isFlagship = o.icon === "shield";
              return (
                <div
                  key={o.tag}
                  style={{
                    position: "relative",
                    height: "100%",
                    boxShadow: isFlagship
                      ? "0 0 0 1px var(--gold-dim), 0 20px 60px -20px rgb(var(--gold-rgb) / 0.25)"
                      : undefined,
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {isFlagship && (
                    <span
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 3,
                        background: "linear-gradient(90deg, var(--gold-warm), var(--gold))",
                        color: "var(--vault-black)",
                        fontFamily: "var(--font-body), system-ui, sans-serif",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        padding: "5px 14px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                        boxShadow: "0 4px 14px rgb(0 0 0 / 0.4)",
                      }}
                    >
                      Most popular · Dec 2026 deadline
                    </span>
                  )}
                  <OfferCard {...o} />
                </div>
              );
            })}
          </div>
        </div>
      </SectionReveal>

      {/* Trust stats strip removed 2026-07-03 — duplicated the hero trust-bar. */}

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

      {/* ═══ Objection FAQ ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p
              className="font-mono"
              style={{
                fontSize: "var(--fs-xs)",
                letterSpacing: "0.18em",
                color: "var(--gold-warm)",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Straight answers
            </p>
            <h2
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontWeight: 400,
                fontStyle: "italic",
                fontSize: "var(--fs-h2)",
                color: "var(--gold)",
                letterSpacing: "0.01em",
              }}
            >
              What owners actually ask me
            </h2>
          </div>
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto", display: "grid", gap: 14 }}>
            {[
              {
                q: "Is my small business even affected?",
                a: "If you hold any customer information — names, emails, phone numbers, health data, payment records — yes. The old $3M turnover exemption is being removed. And the direct-lawsuit right is already live for everyone, regardless of size.",
              },
              {
                q: "I&apos;m not technical — can I actually do this?",
                a: "That&apos;s exactly who I built this for. On the 90-minute call I do the driving in plain English. You click along inside your own admin consoles. If your mum could send an email, you can do this call.",
              },
              {
                q: "Why you and not a lawyer or a big firm?",
                a: "A privacy lawyer will write you a policy for AU$3–5k and won&apos;t touch your DNS, MFA or email records. A big firm like Vanta runs AU$18k+ a year and is shaped for US SOC 2, not the AU Privacy Act. I sort all six obligations, live, for one fixed AU$5,997 — and I personally review every deliverable before it reaches you.",
              },
              {
                q: "What if I do nothing?",
                a: "You&apos;re betting that no customer, ex-employee or contractor ever sues you, and no breach ever forces you to notify. If either happens without documented reasonable steps, your insurer can walk away and the regulator has a clear paper trail against you.",
              },
              {
                q: "Is AU$5,997 worth it versus DIY?",
                a: "DIY is possible if you have the weekends and the stomach for reading the OAIC guidance. Most owners don&apos;t. The pack collapses the reading, drafting, DNS work, admin-console changes and evidence pack into one working call. If you&apos;d rather DIY, my free scan and methodology page give you the map for free — no upsell.",
              },
            ].map((f) => (
              <details
                key={f.q}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 22px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "var(--ice)",
                    fontSize: "var(--fs-body)",
                    fontWeight: 600,
                    listStyle: "revert",
                  }}
                  dangerouslySetInnerHTML={{ __html: f.q }}
                />
                <p
                  style={{
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.7,
                    marginTop: 10,
                  }}
                  dangerouslySetInnerHTML={{ __html: f.a }}
                />
              </details>
            ))}
          </div>
        </div>
      </SectionReveal>

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
            fontWeight: 400,
            fontStyle: "italic",
            marginBottom: 14,
            letterSpacing: "0.01em",
          }}
        >
          Start with a free scan — no card needed
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
            Show me what a hacker sees →
          </AnimatedButton>
          <AnimatedButton
            href={SITE.CAL_15MIN_URL}
            external
            variant="secondary"
          >
            Book a 15-min fit call
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
                    fontWeight: 400,
                    fontStyle: "italic",
                    fontSize: "var(--fs-h2)",
                    color: "var(--gold)",
                    letterSpacing: "0.01em",
                  }}
                >
                  Methodology
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

function TrustUnit({
  big,
  small,
  tone = "gold",
  last,
}: {
  big: React.ReactNode;
  small: string;
  tone?: "gold" | "text";
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "18px 20px",
        textAlign: "center",
        borderRight: last ? "none" : "1px solid rgb(var(--gold-rgb) / 0.10)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: tone === "gold" ? "var(--gold)" : "var(--ice)",
          fontSize: tone === "gold" ? "clamp(1.4rem, 3vw, 1.75rem)" : "var(--fs-lg)",
          fontWeight: 700,
          letterSpacing: "0.02em",
          lineHeight: 1.15,
          marginBottom: 4,
        }}
      >
        {big}
      </div>
      <div
        style={{
          fontSize: "var(--fs-xs)",
          color: "var(--dim)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {small}
      </div>
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
