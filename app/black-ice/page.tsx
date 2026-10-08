import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { AUDIT_MESSAGE_HREF } from "@/lib/config";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

const META_TITLE = "Black Ice: The Human × AI Operating Doctrine · TITANOS";
const META_DESC =
  "A free field guide to frictionless thinking, compressed knowledge, and governed AI autonomy. The same operating doctrine TITANOS is built and run on.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/black-ice" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/black-ice",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

const PRIMITIVES: { name: string; line: string }[] = [
  { name: "OBSERVE", line: "See what's actually happening before reacting to it." },
  { name: "ORIENT", line: "Place it against the objective that actually matters right now." },
  { name: "SUBZERO", line: "One quiet pass, state, signal, friction, lever, before acting." },
  { name: "EXPAND", line: "Let the idea get bigger before you judge it." },
  { name: "COMPRESS", line: "Turn what worked into one reusable rule." },
  { name: "QUESTION", line: "Nothing is sacred. Inspect the assumption load-bearing the plan." },
  { name: "RED-TEAM", line: "Attack it to make it stronger, not to win an argument." },
  { name: "CHOOSE", line: "Pick the one move that matters most under real constraints." },
  { name: "EXECUTE", line: "Ship the decision. Discussion has a deadline." },
  { name: "MEASURE", line: "Confidence isn't evidence. Check what actually happened." },
  { name: "RELEASE", line: "Let go of what didn't survive contact with reality." },
  { name: "REPEAT", line: "The loop is the system. Run it again." },
];

export default function BlackIcePage() {
  return (
    <>
      <PageHero
        badge="TITANOS OPERATING DOCTRINE · FREE"
        title="BLACK ICE"
        tagline="A human × AI operating doctrine for frictionless thinking, compressed knowledge, and governed autonomy."
        sub="Not a productivity gimmick. It is the working framework TITANOS runs on, shared here because it is useful on its own, and free."
      >
        <AnimatedButton href="/black-ice/doctrine" variant="primary">
          READ THE FIELD GUIDE
        </AnimatedButton>
        <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="secondary">
          BOOK A FREE CONSULTATION
        </AnimatedButton>
      </PageHero>
      <Bluf replaced>
        Black Ice is the free thinking guide TITANOS runs on: automate the known, keep human judgement for the unknown.
      </Bluf>
      <Analogy k="twokeys" />

      <SectionReveal style={{ padding: "var(--space-8) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <FlexNumber f={FLEX.startTokens} />
          <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "18px 0 0", textAlign: "center" }}>
            That is what compressing knowledge looks like in practice. Before you ask: I am Kyle Deligny, a sole trader
            (ABN 34 318 502 254). Reading the guide touches nothing of yours, nobody is replaced by it, and it costs
            nothing.
          </p>
        </div>
      </SectionReveal>
      <OpenLoop>So what is Black Ice, in plain words, and why is a polished black surface a good picture of it?</OpenLoop>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h3)",
              letterSpacing: "0.06em",
              marginBottom: 16,
            }}
          >
            What Black Ice actually is
          </h2>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8, marginBottom: 14 }}>
            A polished black surface, enormous depth underneath. That&apos;s the whole idea.
            Most &quot;AI productivity&quot; content is either empty branding or a
            prompt-hack thread. Black Ice is neither. It&apos;s a small set of reusable
            habits for seeing a situation clearly, cutting the noise out of it, and acting on
            what&apos;s left, with AI doing the keystroke work and a human holding the one
            decision that actually needs judgement.
          </p>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8 }}>
            A fair thing to ask of your own week: how much of it is work an AI could already
            do, and how much is the one call only you should make? The language here
            borrows metaphor on purpose, ice, depth, stillness. The field guide is plain about
            where it is a metaphor and where it is a mechanism, and never dresses one up as
            the other.
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>What does the loop look like when you shrink it to one line a step?</OpenLoop>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <SectionHeading title="The twelve primitives" lead="The full loop, compressed to one line each. The detail lives on the field guide page." />
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            maxWidth: "var(--maxw-content)",
            marginLeft: "auto",
            marginRight: "auto",
            borderLeft: "1px solid rgb(var(--gold-rgb) / 0.18)",
          }}
        >
          {PRIMITIVES.map((p, i) => {
            // Depth cue: darker undertone and dimmer gold the further
            // into the loop you read, mimicking a descent.
            const depth = i / (PRIMITIVES.length - 1);
            return (
              <li
                key={p.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "clamp(40px, 6vw, 56px) 1fr",
                  gap: "clamp(14px, 2.5vw, 24px)",
                  alignItems: "baseline",
                  padding: "var(--space-4) clamp(16px, 3vw, 28px)",
                  background: i % 2 === 1 ? "rgb(var(--gold-rgb) / 0.03)" : "transparent",
                  borderBottom:
                    i === PRIMITIVES.length - 1 ? "none" : "1px solid var(--border)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "var(--fs-sm)",
                    color: `rgb(var(--gold-rgb) / ${(0.85 - depth * 0.45).toFixed(2)})`,
                    letterSpacing: "0.05em",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display), Georgia, serif",
                      color: "var(--gold)",
                      fontSize: "var(--fs-lg)",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
                    {p.line}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal
        style={{
          textAlign: "center",
          padding: "var(--space-16) 20px var(--space-30)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            letterSpacing: "0.06em",
            marginBottom: 18,
          }}
        >
          Would it be okay if you had a read?
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
          Free, no signup, and nothing to buy afterwards. It is the same working framework behind everything else on this site. If it is not your cup of tea, a no is welcome.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/black-ice/doctrine" variant="primary">
            <span data-analytics="field_guide_open">OPEN THE FIELD GUIDE</span>
          </AnimatedButton>
          <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="secondary">
            <span data-analytics="cta_click">MESSAGE KYLE</span>
          </AnimatedButton>
        </div>
      </SectionReveal>
      <FrontLoad
        extra={[
          { q: "Is this a sales pitch?", a: "No. It is the real operating framework behind every build, shared because it is useful on its own. Read it, use it, and take nothing from us." },
        ]}
      />
      <FreeStart />
    </>
  );
}
