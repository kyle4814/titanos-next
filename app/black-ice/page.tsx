import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { AUDIT_BOOK_HREF } from "@/lib/config";

const META_TITLE = "Black Ice — The Human × AI Operating Doctrine · TITANOS";
const META_DESC =
  "A free field guide to frictionless thinking, compressed knowledge, and governed AI autonomy — the same operating doctrine TITANOS is built and run on.";

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
  { name: "SUBZERO", line: "One quiet pass — state, signal, friction, lever — before acting." },
  { name: "EXPAND", line: "Let the idea get bigger before you judge it." },
  { name: "COMPRESS", line: "Turn what worked into one reusable rule." },
  { name: "QUESTION", line: "Nothing is sacred. Inspect the assumption load-bearing the plan." },
  { name: "RED-TEAM", line: "Attack it to make it stronger, not to win an argument." },
  { name: "CHOOSE", line: "Pick the highest-leverage move under real constraints." },
  { name: "EXECUTE", line: "Ship the decision. Discussion has a deadline." },
  { name: "MEASURE", line: "Confidence isn't evidence. Check what actually happened." },
  { name: "RELEASE", line: "Let go of what didn't survive contact with reality." },
  { name: "REPEAT", line: "The loop is the system. Run it again." },
];

export default function BlackIcePage() {
  return (
    <>
      <PageHero
        badge="TITANOS OPERATING DOCTRINE — FREE"
        title="BLACK ICE"
        tagline="A human × AI operating doctrine for frictionless thinking, compressed knowledge, and governed autonomy."
        sub="Not a productivity gimmick. The actual framework TITANOS is built and operated on — publishing it because it's useful on its own, not because it's bait."
      >
        <AnimatedButton href="/black-ice/doctrine" variant="primary">
          READ THE FIELD GUIDE
        </AnimatedButton>
        <AnimatedButton href={AUDIT_BOOK_HREF} variant="secondary">
          BUILD WITH TITANOS
        </AnimatedButton>
      </PageHero>

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
            WHAT BLACK ICE ACTUALLY IS
          </h2>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8, marginBottom: 14 }}>
            A polished black surface with enormous depth underneath — that&apos;s the whole
            metaphor. Most &quot;AI productivity&quot; content is either empty branding or a
            prompt-hack thread. Black Ice is neither: it&apos;s a small set of reusable
            primitives for observing a situation, cutting the noise out of it, and acting on
            what&apos;s left — with AI doing the keystroke-level work and a human staying at
            the one point that actually needs judgement.
          </p>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8 }}>
            It&apos;s deliberately not mystical. Where the language borrows metaphor —
            ice, depth, stillness — the field guide says so explicitly and never dresses a
            metaphor up as a scientific claim. See the full distinction on the doctrine page.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <SectionHeading title="THE TWELVE PRIMITIVES" lead="The full loop, compressed to one line each. Detail on the field guide page." />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
            maxWidth: "var(--maxw-content)",
            margin: "0 auto",
          }}
        >
          {PRIMITIVES.map((p) => (
            <div
              key={p.name}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "20px 18px",
                background: "var(--card)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  color: "var(--gold)",
                  fontSize: "var(--fs-lg)",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                {p.name}
              </div>
              <div style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>{p.line}</div>
            </div>
          ))}
        </div>
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
          READ THE FULL DOCTRINE
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
          Free. No signup. The same operating framework behind everything else on this site.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="/black-ice/doctrine" variant="primary">
            <span data-analytics="field_guide_open">OPEN THE FIELD GUIDE</span>
          </AnimatedButton>
          <AnimatedButton href={AUDIT_BOOK_HREF} variant="secondary">
            <span data-analytics="cta_click">EXPLORE TITANOS</span>
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
