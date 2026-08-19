import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import MirrorLists from "@/components/MirrorLists";
import { AUDIT_BOOK_HREF } from "@/lib/config";

const META_TITLE = "The Black Ice Field Guide — Human × AI Operating Doctrine · TITANOS";
const META_DESC =
  "The full Black Ice field guide: Sub-Zero Murmur, Child/Operator, Web Slider, Demon Blade, the 99/1 principle, Pareto Frontier, Scientific Loop, and governed autonomy — free, no signup.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/black-ice/doctrine" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "article",
    url: "https://titanos.tech/black-ice/doctrine",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="divider-gold" />
      <SectionReveal id={id} style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2, scrollMarginTop: 90 }}>
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
            {title}
          </h2>
          {children}
        </div>
      </SectionReveal>
    </>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8, marginBottom: 14 }}>
      {children}
    </p>
  );
}

const TOC = [
  ["sub-zero", "The Sub-Zero Murmur"],
  ["child-operator", "Child + Operator"],
  ["web-slider", "The Web Slider"],
  ["demon-blade", "Demon Blade — Red-Team for Preservation"],
  ["99-1", "The 99/1 Principle"],
  ["zero-dependency", "Zero-Dependency Thinking"],
  ["pareto", "The Pareto Frontier"],
  ["scientific-loop", "The Scientific Loop"],
  ["compression", "Compression"],
  ["governed-autonomy", "Governed Autonomy"],
  ["core-loop", "The Core Loop"],
  ["integrity", "Metaphor vs. Mechanism"],
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Black Ice a productivity system, a prompt, or a philosophy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "All three, in that order of usefulness: a small set of reusable primitives (productivity system), applied through AI collaboration (the prompt/framework), resting on a stated worldview about where human judgement has the most leverage (the philosophy).",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to use AI to use this?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Every primitive works as a solo thinking tool. It gets more leverage with an AI collaborator doing execution, which is why it's published by an AI systems business — but the doctrine doesn't require one.",
      },
    },
    {
      "@type": "Question",
      name: "Is any of this scientifically proven?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Parts of it are engineering practice with a long track record (OODA-style loops, red-teaming, Pareto prioritisation). Parts of it are metaphor used deliberately as a discovery tool, not a proven mechanism — see the Metaphor vs. Mechanism section, which draws that line explicitly rather than blurring it.",
      },
    },
  ],
};

export default function BlackIceDoctrinePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <PageHero
        badge="THE FIELD GUIDE"
        title="BLACK ICE"
        tagline="A field guide to frictionless thinking, recursive learning, AI-assisted execution, and governed autonomy."
        sub="Free. No signup. Read it top to bottom or jump to the section you need."
      />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <nav aria-label="Field guide contents">
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 8,
              }}
            >
              {TOC.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} style={{ color: "var(--ice)", fontSize: "var(--fs-sm)", textDecoration: "none" }}>
                    → {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </SectionReveal>

      <Section id="sub-zero" title="THE SUB-ZERO MURMUR">
        <P>
          A minimum-friction course-correction loop you can run silently, mid-task, without
          stopping to journal. Ask, in order, and move on:
        </P>
        <ol style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.9, paddingLeft: 20 }}>
          <li><strong style={{ color: "var(--gold)" }}>STATE</strong> — what is actually happening right now?</li>
          <li><strong style={{ color: "var(--gold)" }}>OBJECTIVE</strong> — what am I actually trying to achieve?</li>
          <li><strong style={{ color: "var(--gold)" }}>SIGNAL</strong> — what information actually matters here?</li>
          <li><strong style={{ color: "var(--gold)" }}>FRICTION</strong> — what&apos;s unnecessarily slowing this down?</li>
          <li><strong style={{ color: "var(--gold)" }}>LEVER</strong> — what single action moves this the most?</li>
          <li><strong style={{ color: "var(--gold)" }}>NEXT</strong> — what happens immediately after that?</li>
        </ol>
        <P>
          The point isn&apos;t depth — it&apos;s speed. A 15-second pass beats a 20-minute
          reflection you never actually do. Failure mode: turning it into a ritual you perform
          instead of a correction you make.
        </P>
      </Section>

      <Section id="child-operator" title="CHILD + OPERATOR">
        <P>
          Two modes, deliberately kept separate so neither one contaminates the other.
        </P>
        <P>
          <strong style={{ color: "var(--gold)" }}>Child</strong> generates: curiosity, play,
          unconventional hypotheses, unusual connections, &quot;what if.&quot; No constraints,
          no judging.{" "}
          <strong style={{ color: "var(--gold)" }}>Operator</strong> selects: evidence,
          prioritisation, risk, accountability, &quot;does it work.&quot; No creativity
          allowed to bypass reality.
        </P>
        <P>
          Failure mode: running both at once. An idea judged while it&apos;s still being
          generated dies early; a decision made with the Child still in the room never
          actually ships.
        </P>
      </Section>

      <Section id="web-slider" title="THE WEB SLIDER">
        <P>
          Move deliberately between four levels when you&apos;re stuck at one of them:
        </P>
        <ul style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.9, paddingLeft: 20 }}>
          <li><strong style={{ color: "var(--gold)" }}>Micro</strong> — the function, the bug, the variable.</li>
          <li><strong style={{ color: "var(--gold)" }}>Meso</strong> — the component, the workflow, the service.</li>
          <li><strong style={{ color: "var(--gold)" }}>Macro</strong> — the system, the business, the architecture.</li>
          <li><strong style={{ color: "var(--gold)" }}>Meta</strong> — the principle, the pattern, the reusable doctrine.</li>
        </ul>
        <P>
          Trapped in implementation? Go up a level and check the architecture is even right.
          Overwhelmed by the macro? Drop down and ship one real function. The level you&apos;re
          stuck at is rarely the level the fix lives on.
        </P>
      </Section>

      <Section id="demon-blade" title="DEMON BLADE — RED-TEAM FOR PRESERVATION">
        <P>
          Nothing is sacred — assumptions, dependencies, abstractions, claims all get
          inspected. But the goal is never to win an argument against your own idea. It&apos;s
          to find the version of it that survives contact.
        </P>
        <P>
          The question that keeps it constructive: <em>&quot;what can be changed without
          destroying the core function?&quot;</em> Cut the unnecessary material, keep the
          load-bearing structure, reforge — don&apos;t demolish and call it rigour.
        </P>
      </Section>

      <Section id="99-1" title="THE 99/1 PRINCIPLE">
        <P>
          Target roughly 99% automated, 1% human judgement — a design heuristic, not a
          religious law. It tells you which direction to lean, not a ratio to hit on every
          project regardless of context.
        </P>
        <P>
          Push automation up when behaviour is predictable, rules are stable, outcomes are
          measurable, and failure is recoverable. Pull human judgement in when uncertainty is
          high, consequences are irreversible, or the decision is genuinely strategic — not
          because automating it would be hard, but because that&apos;s where a human&apos;s
          attention is actually worth the most.
        </P>
      </Section>

      <Section id="zero-dependency" title="ZERO-DEPENDENCY THINKING">
        <P>
          Not &quot;never use external services&quot; — that&apos;s not realistic and isn&apos;t
          the point. The actual rule: never depend on something without understanding its
          role, its failure mode, and your replacement path if it disappears.
        </P>
        <P>
          Before adding a dependency, ask what happens if it vanishes tomorrow, whether a
          free or local alternative exists, and whether the interface can be isolated so
          swapping it later doesn&apos;t mean a rewrite. Use external infrastructure when it
          gives you real leverage — just go in with eyes open.
        </P>
      </Section>

      <Section id="pareto" title="THE PARETO FRONTIER">
        <P>
          You cannot optimise every variable at once. Find the highest-value configuration
          available right now under real constraints — leverage, reliability, speed,
          maintainability, cost, reversibility — instead of chasing a theoretically perfect
          version of all of them simultaneously.
        </P>
        <P>
          A robust 80–95% solution shipped today, then improved with real feedback, beats a
          hypothetically perfect one that never ships.
        </P>
      </Section>

      <Section id="scientific-loop" title="THE SCIENTIFIC LOOP">
        <P>
          Treat implementation as an experiment: hypothesis → build → measure → observe →
          compare → update → repeat. Be as imaginative as you want generating the hypothesis.
          Be rigorous checking it against what actually happened.
        </P>
        <P>
          The discipline is in never letting confidence stand in for evidence, or a good
          metaphor stand in for a mechanism you haven&apos;t actually verified.
        </P>
      </Section>

      <Section id="compression" title="COMPRESSION">
        <P>
          After a problem is solved, compress the solution: explanation becomes a principle,
          the principle becomes a reusable pattern, the pattern becomes an implementation
          primitive. The finished system should be easier to understand than the reasoning
          it took to build it.
        </P>
        <P>
          One clear rule beats ten paragraphs of explanation. One reusable function beats
          the same logic written five times. This field guide is itself an attempt at that —
          22 sections of source doctrine compressed to what actually earns a reader&apos;s
          time.
        </P>
      </Section>

      <Section id="governed-autonomy" title="GOVERNED AUTONOMY">
        <P>
          Autonomous doesn&apos;t mean uncontrolled. Every autonomous system — human-built or
          AI-run — should have an explicit objective, defined permissions, resource limits,
          observable output, a known failure state, and a way to escalate to a human or shut
          down.
        </P>
        <P>
          The 99/1 principle and Governed Autonomy are the same idea from two angles: push
          automation hard, but never past the point where it can act somewhere irreversible
          without a human in the loop.
        </P>
      </Section>

      <Section id="core-loop" title="THE CORE LOOP">
        <P>
          Everything above compresses to one loop, run continuously rather than restarted
          from scratch each time:
        </P>
        <p
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-lg)",
            letterSpacing: "0.08em",
            textAlign: "center",
            margin: "18px 0",
          }}
        >
          OBSERVE → ORIENT → COMPRESS → DECIDE → ACT → MEASURE → CORRECT → REPEAT
        </p>
        <P>
          The purpose isn&apos;t maximum activity. It&apos;s maximum useful trajectory — move
          fast when the path is clear, slow down when uncertainty or consequence rises, and
          rest when continuing would make the work worse, not better.
        </P>
      </Section>

      <Section id="integrity" title="METAPHOR VS. MECHANISM">
        <P>
          Black Ice borrows physical and mythological language — ice, depth, stillness,
          &quot;quiet power.&quot; That language is a discovery tool, not a scientific claim.
          Here&apos;s the line, held deliberately:
        </P>
        <MirrorLists
          doTitle="WHAT THIS IS"
          doItems={[
            "A metaphor for thinking about possibility and depth",
            "An engineering principle with a real track record (OODA loops, red-teaming, Pareto prioritisation)",
            "A hypothesis worth testing against your own work",
            "A framing that may feel calming or energising — genuinely, for you, subjectively",
          ]}
          dontTitle="WHAT THIS ISN'T"
          dontItems={[
            "A claim that ice/frequency/quantum language is literal physics",
            "A neuroscience claim about dopamine, brainwaves, or specific neurochemistry",
            "Proof, just because the metaphor feels powerful",
            "A medical claim, or a treatment for fatigue, anxiety, or any clinical condition",
          ]}
        />
      </Section>

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
          SEE IT APPLIED
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
          This isn&apos;t theory published by a marketing team — it&apos;s the doctrine
          TITANOS itself runs on. See it applied on a real audit, or bring it to your own
          systems.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">
            <span data-analytics="titanos_visit">BUILD WITH TITANOS</span>
          </AnimatedButton>
          <AnimatedButton href="/black-ice" variant="secondary">
            BACK TO BLACK ICE
          </AnimatedButton>
        </div>
        <div style={{ marginTop: 40 }}>
          <FaqItem question="Is Black Ice a productivity system, a prompt, or a philosophy?">
            All three, in that order of usefulness: a small set of reusable primitives, applied through AI collaboration, resting on a stated worldview about where human judgement has the most leverage.
          </FaqItem>
          <FaqItem question="Do I need to use AI to use this?">
            No. Every primitive works as a solo thinking tool — it gets more leverage with an AI collaborator doing execution, which is why an AI systems business is publishing it, but nothing here requires one.
          </FaqItem>
          <FaqItem question="Is any of this scientifically proven?">
            Parts are engineering practice with a real track record. Parts are deliberate metaphor, marked as such above, not disguised as mechanism.
          </FaqItem>
        </div>
      </SectionReveal>
    </>
  );
}
