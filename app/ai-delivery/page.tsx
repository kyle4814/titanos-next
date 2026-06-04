import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";

const CAL_15 = "https://cal.com/kyle-deligny-msvz6s/15min";

export const metadata: Metadata = {
  title: "AI Implementation for Business — TITANOS",
  description:
    "Titanos AI Implementation for Business: full-cycle problem-solving → planning → building → implementation. From AU$4,997, scoping call first, project-quoted. 99% Claude Code, 1% expert human review. ABN 34 318 502 254.",
  alternates: { canonical: "https://titanos.tech/ai-delivery" },
  openGraph: {
    title: "Titanos AI Implementation for Business — problem solved, built, shipped",
    description:
      "Full-cycle AI implementation: diagnose, plan, build, ship. From AU$4,997. Scoping call first. Project-quoted by scope. Powered by Claude Code.",
    type: "website",
    url: "https://titanos.tech/ai-delivery",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

const PROBLEMS = [
  {
    title: "The deck is done. The thing isn’t built.",
    body: "Strategy consultants delivered the AI roadmap eight months ago. The engineering team still hasn’t found a free quarter to ship the first prototype. Momentum dies.",
  },
  {
    title: "The big-four quote is 12 months and $2M.",
    body: "Procurement-grade SOWs scale to procurement-grade pricing. Most of what you actually want built doesn’t justify either the calendar or the budget.",
  },
  {
    title: "Internal teams are at capacity.",
    body: "Your AI/ML engineers exist. They are fully booked on the current roadmap. New capabilities have to wait or get outsourced to whoever shows up first.",
  },
];

const DELIVERABLES = [
  {
    title: "Working code in your repo",
    body: "The deliverable is committed code in your own GitHub or GitLab — not a sandbox we control. You own it from day one. Reviewed by your engineers before merge.",
  },
  {
    title: "Deployed, not “deployable”",
    body: "The capability runs in your staging environment by mid-engagement and your production by close. Live behind your auth, your DNS, your logging.",
  },
  {
    title: "Documented for handover",
    body: "Runbook, architecture diagram, threat model, test coverage, and a two-page README written for the engineer who inherits the system next quarter.",
  },
  {
    title: "Optional ongoing operations",
    body: "If you want it monitored, tuned, and incident-responded post-delivery, we offer a separate operations retainer. Most clients run it themselves; we are not your dependency.",
  },
];

const STEPS = [
  {
    num: "I",
    title: "SCOPING CALL · 30 MIN",
    body: "You tell us what you’d build if delivery wasn’t the bottleneck. We tell you whether it’s a 4-week thing, a 12-week thing, or a “this needs to be three engagements” thing. No pitch. No slides.",
  },
  {
    num: "II",
    title: "FIXED-SCOPE SOW + DEPOSIT",
    body: "Within 72 hours of the call you receive a written SOW: scope, milestones, fixed price, delivery date. Approve, sign, pay 30% deposit. The remaining 70% is milestone-billed.",
  },
  {
    num: "III",
    title: "SHIP IN YOUR ENVIRONMENT",
    body: "Kyle launches a Claude Code instance scoped to your engagement. Daily commits to a branch in your repo. Mid-engagement demo. Final delivery against SOW acceptance criteria. Done.",
  },
];

export default function AiDeliveryPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "AI Implementation for Business",
    provider: { "@type": "Organization", name: "Titanos" },
    serviceType: "AI System Implementation",
    description:
      "Bespoke AI implementation — problem-solving, planning, building, deployment. Scoping call first, project-quoted.",
    areaServed: ["AU", "NZ", "SG"],
    offers: {
      "@type": "Offer",
      price: "4997",
      priceCurrency: "AUD",
      priceSpecification: {
        "@type": "PriceSpecification",
        valueAddedTaxIncluded: false,
        description: "From AU$4,997, project-quoted",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        badge="TITANOS · AI IMPLEMENTATION FOR BUSINESS"
        title="AI Implementation, Delivered"
        tagline="Not consulted. Not slide-ware. Shipped."
        sub="You don’t need another deck telling you AI matters. You need the capability built, integrated, and live in production. We diagnose the problem, plan the solution, build it in your repo, and implement it in your environment — 99% Claude Code, 1% expert human review."
        trustLine="Scoping → SOW → ship. Projects priced by scope. No retainer trap."
      >
        <AnimatedButton href={CAL_15} external variant="primary" ariaLabel="Book a 30-minute scoping call">
          BOOK A 30-MIN SCOPING CALL
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="WHY ENTERPRISE AI PROJECTS STALL" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 22,
              maxWidth: 1020,
              margin: "0 auto",
            }}
          >
            {PROBLEMS.map((p) => (
              <article
                key={p.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: 28,
                }}
              >
                <h4
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: "var(--gold)",
                    fontSize: "0.95rem",
                    letterSpacing: "0.06em",
                    marginBottom: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {p.title}
                </h4>
                <p style={{ color: "var(--text)", fontSize: "0.9rem", lineHeight: 1.7 }}>
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="WHAT SHIPS"
            lead="Four things show up in your environment, not in a slide deck."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 22,
              maxWidth: 1020,
              margin: "0 auto",
            }}
          >
            {DELIVERABLES.map((d) => (
              <article
                key={d.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: 28,
                }}
              >
                <h4
                  style={{
                    color: "var(--ice)",
                    fontSize: "1rem",
                    fontWeight: 600,
                    marginBottom: 10,
                    lineHeight: 1.35,
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: 0,
                  }}
                >
                  <span style={{ color: "#4ade80", marginRight: 8, fontWeight: 400 }}>✓</span>
                  {d.title}
                </h4>
                <p style={{ color: "var(--text)", fontSize: "0.9rem", lineHeight: 1.7 }}>
                  {d.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="HOW IT WORKS" lead="Three steps, no surprises." />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 22,
              maxWidth: 1020,
              margin: "0 auto",
            }}
          >
            {STEPS.map((s) => (
              <article
                key={s.num}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--gold-dim)",
                  borderRadius: 6,
                  padding: "32px 26px 26px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: "var(--gold)",
                    fontSize: "2.2rem",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  {s.num}
                </div>
                <h4
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: "var(--gold)",
                    fontSize: "0.95rem",
                    letterSpacing: "0.08em",
                    marginBottom: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {s.title}
                </h4>
                <p style={{ color: "var(--text)", fontSize: "0.88rem", lineHeight: 1.7 }}>
                  {s.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal id="offer" style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="ONE ENGAGEMENT · PROJECT-QUOTED"
            lead="No tiers, no menus, no fixed-band pricing. One engagement shape, quoted after a 30-minute scoping call."
          />
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <article
              style={{
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: 8,
                padding: "44px 38px",
                position: "relative",
                boxShadow: "0 0 0 1px rgba(212,175,55,0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: "'Cinzel', serif",
                  color: "var(--ice)",
                  fontSize: "0.78rem",
                  letterSpacing: "0.18em",
                  marginBottom: 14,
                  textAlign: "center",
                }}
              >
                AI IMPLEMENTATION FOR BUSINESS
              </div>
              <h3
                style={{
                  fontFamily: "'Cinzel', serif",
                  color: "var(--gold)",
                  fontSize: "clamp(1.3rem, 3vw, 1.7rem)",
                  letterSpacing: "0.04em",
                  lineHeight: 1.3,
                  textAlign: "center",
                  marginBottom: 14,
                }}
              >
                AI Implementation for Business — problem solved, built, shipped
              </h3>
              <div
                style={{
                  fontFamily: "'Cinzel', serif",
                  color: "var(--gold)",
                  fontSize: "clamp(1.6rem, 3.5vw, 2.1rem)",
                  fontWeight: 700,
                  lineHeight: 1.15,
                  textAlign: "center",
                }}
              >
                From AU$4,997
                <span
                  style={{
                    color: "var(--dim)",
                    fontSize: "0.92rem",
                    display: "block",
                    marginTop: 8,
                    fontWeight: 400,
                    letterSpacing: "0.02em",
                  }}
                >
                  scoping call first · project-quoted by scope
                </span>
              </div>
              <p
                style={{
                  color: "var(--text)",
                  fontSize: "0.95rem",
                  lineHeight: 1.75,
                  margin: "24px auto 28px",
                  textAlign: "center",
                  maxWidth: 620,
                }}
              >
                The arc: we diagnose the problem, plan the solution, build it in your repo, and
                implement it in your environment. One model or many; one workflow or a full
                system. Quoted after a 30-minute scoping call.
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <AnimatedButton href={CAL_15} external variant="primary" ariaLabel="Book a 30-minute scoping call">
                  BOOK A 30-MIN SCOPING CALL
                </AnimatedButton>
              </div>
            </article>
            <p
              style={{
                textAlign: "center",
                color: "var(--ice)",
                fontSize: "0.95rem",
                lineHeight: 1.7,
                maxWidth: 640,
                margin: "32px auto 0",
              }}
            >
              Project-quoted within range.{" "}
              <strong style={{ color: "var(--gold)" }}>
                You see the full SOW with the fixed price before you pay a deposit.
              </strong>
            </p>
          </div>
        </div>
      </SectionReveal>

      {/* TRUST STRIP */}
      <SectionReveal
        as="div"
        style={{
          background: "var(--card)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "50px 20px",
          textAlign: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: 780,
            margin: "0 auto",
            color: "var(--text)",
            fontSize: "0.95rem",
            lineHeight: 2,
          }}
        >
          <div>
            <strong style={{ color: "var(--gold)", fontFamily: "'Cinzel', serif" }}>
              ABN 34 318 502 254
            </strong>{" "}
            · AU jurisdiction · single-operator practice
          </div>
          <div>
            Powered by{" "}
            <strong style={{ color: "var(--gold)", fontFamily: "'Cinzel', serif" }}>
              Claude Code
            </strong>{" "}
            — Anthropic’s flagship reasoning model, AI-native delivery end-to-end
          </div>
          <div>
            Sister capability{" "}
            <strong style={{ color: "var(--gold)", fontFamily: "'Cinzel', serif" }}>
              Titanos Security
            </strong>{" "}
            runs 1,700+ external scans per month
          </div>
          <div>
            Methodology:{" "}
            <a href="/methodology" style={{ color: "var(--ice)" }}>
              titanos.tech/methodology
            </a>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal style={{ padding: "80px 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="THE QUESTIONS EVERY CTO ASKS FIRST" />
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <FaqItem question="Are you a real consulting firm or a one-person shop running an AI agent?">
              Single-operator practice. Kyle Deligny runs every engagement. The leverage comes
              from Claude Code doing the implementation work under continuous human review — the
              same pattern senior engineers use to ship faster, applied as a delivery business
              model. You get one accountable contact, no subcontractor chain, no project manager
              between you and the code.
            </FaqItem>
            <FaqItem question="How do you handle our IP and source code?">
              Mutual NDA before scoping call if you want one. Engagement work happens in a branch
              on your own repository — we never hold your source. All Claude Code runs are scoped
              to the engagement; no training, no cross-client reuse, no retained context after
              handover.
            </FaqItem>
            <FaqItem question="What about model outputs that are wrong?">
              Every line of code, every prompt, every model invocation is reviewed by Kyle before
              commit. The 1% human review is the load-bearing 1%. We also write test coverage and
              (where applicable) evals — so wrongness is caught by the test suite, not by your
              users.
            </FaqItem>
            <FaqItem question="What if you disappear mid-engagement?">
              SOW includes a “delivered-state-on-pause” clause. If the engagement halts for any
              reason, you get the current branch state, the documentation written to date, and a
              refund of unearned milestone billing. No retainer trap.
            </FaqItem>
            <FaqItem question="Can our procurement do a vendor security review?">
              Yes. We have completed external attack-surface DD on ourselves. We will fill in any
              vendor risk assessment your procurement requires.
            </FaqItem>
            <FaqItem question="How fast can we start?">
              Scoping call usually within 3 business days of your enquiry. SOW within 72 hours of
              the scoping call. Engagement starts on deposit clearance — typically inside 10
              business days from first email.
            </FaqItem>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal
        style={{
          textAlign: "center",
          padding: "90px 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            color: "var(--gold)",
            fontSize: "clamp(1.5rem, 4vw, 2.3rem)",
            fontWeight: 700,
            marginBottom: 14,
            letterSpacing: "0.05em",
          }}
        >
          READY TO SCOPE A BUILD?
        </h2>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "1.05rem",
            marginBottom: 32,
            maxWidth: 600,
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          Tell us what you’d build if delivery wasn’t the bottleneck. 30-minute scoping call. No
          deck. No salespeople. One operator.
        </p>
        <AnimatedButton href={CAL_15} external variant="primary">
          BOOK THE SCOPING CALL
        </AnimatedButton>
      </SectionReveal>
    </>
  );
}
