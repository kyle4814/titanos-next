import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import type { CSSProperties, ReactNode } from "react";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import AnimatedButton from "@/components/AnimatedButton";
import { OperatorNote, OmegaSeal } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

const META_TITLE = "What one engineer built in 4 months, and the maths | TITANOS";
const META_DESC =
  "170,651 lines of production code since June 2026, priced by the COCOMO model at 44 engineer-years (MODELLED). The maths, the method and how to re-run it.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/engineering" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: "website",
    url: "https://titanos.tech/engineering",
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

export const metadata: Metadata = withSeo("/engineering", baseMetadata);

const SECTION: CSSProperties = { padding: "var(--space-16) 20px", position: "relative", zIndex: 2 };
const PROSE: CSSProperties = { maxWidth: "var(--maxw-prose)", margin: "0 auto" };
const BODY: CSSProperties = {
  color: "var(--ice)",
  fontSize: "var(--fs-body)",
  lineHeight: 1.75,
  margin: "0 auto 16px",
};
const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "22px 24px",
};

const AUTOMATES = [
  "Email security scanning: SPF, DKIM and DMARC checks from public records (the free scan).",
  "Lead research and verification: contact lists checked for deliverability before anyone sees them.",
  "Daily call lists with a script for every lead, and a log of every call outcome.",
  "Approval-gated email sending: nothing goes out until a person taps approve.",
  "Daily blog publishing: drafted, checked against a copy-rules linter, then shipped on its date after one approval.",
  "Document and dossier production: sourced research packs built and delivered as a set.",
  "Test-gated engineering: every change must pass the automated test gate before it lands.",
];

function Tile({ label, value, note, strong }: { label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div style={{ ...CARD, textAlign: "center", borderColor: strong ? "var(--gold)" : "var(--border)" }}>
      <div style={{ fontSize: "var(--fs-xs)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)" }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "var(--fs-h2)",
          color: "var(--gold)",
          margin: "8px 0",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "var(--fs-sm)", color: "var(--dim)" }}>{note}</div>
    </div>
  );
}

function Block({ id, title, lead, children }: { id?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <SectionReveal style={SECTION}>
        <div id={id} style={PROSE}>
          <SectionHeading title={title} lead={lead} />
          {children}
        </div>
      </SectionReveal>
      <div className="divider-gold" />
    </>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "12px 14px", color: "var(--gold)", fontWeight: 600, borderBottom: "1px solid var(--border)" };
const td: CSSProperties = { padding: "12px 14px", color: "var(--ice)", borderBottom: "1px solid var(--border)" };

export default function EngineeringPage() {
  return (
    <>
      <PageHero
        badge="The proof"
        title="20 engineers for 27 months, or one person in about 4."
        tagline="On about US$30 (roughly AU$46) a month."
        sub="That first figure is MODELLED, not a timesheet. One engineer, working around a day job, from the first commit on 4 June 2026 to 4 October 2026. Every figure below has its method at the bottom of the page."
      >
        <AnimatedButton href="#method" variant="secondary">
          Jump to the method ↓
        </AnimatedButton>
      </PageHero>

      <SectionReveal style={{ padding: "var(--space-12, 32px) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={PROSE}>
          <FlexNumber f={FLEX.engineers} />
          <p style={{ ...BODY, marginTop: 18 }}>
            Method in one line: count the lines of code, put them through the published COCOMO formulas, and compare. Before you ask,
            this page is about our own build. Nothing of yours is touched, nobody is replaced, and the whole calculation is at the bottom
            so you can re-run it.
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>How do you get from lines of code to a number of engineers, and is it fair?</OpenLoop>

      <div className="divider-gold" />

      <Block title="The maths, in one line" lead="MODELLED, and labelled as such.">
        <p style={BODY}>
          170,651 lines of production code across four repositories in the four months from 4 June 2026. The industry-standard COCOMO model prices that at
          44 engineer-years, about AU$7.8 million at Australia&apos;s AU$800-a-day contractor rate, which is up
          to AU$23 million a year at this pace.
        </p>
      </Block>

      <Analogy k="department" />

      <Block title="The normal way vs the TITANOS way" lead="A department, or one person with a very good toolbox.">
        <div style={{ ...CARD, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-body)" }}>
            <thead>
              <tr>
                <th style={th} />
                <th style={th}>Normal (per the same model)</th>
                <th style={th}>TITANOS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}>People</td>
                <td style={td}>About 20 engineers</td>
                <td style={td}>1 engineer</td>
              </tr>
              <tr>
                <td style={td}>Time</td>
                <td style={td}>About 27 months</td>
                <td style={td}>About 4 months (4 June to 4 October 2026), around a day job</td>
              </tr>
              <tr>
                <td style={{ ...td, borderBottom: "none" }}>Result</td>
                <td style={{ ...td, borderBottom: "none" }} colSpan={2}>
                  A 20x smaller team, 6.8x faster, about 132x the output for the same people-time.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Counted the hard way"
        lead="AI did much of the typing, so here is the figure with most of it taken off."
      >
        <p style={BODY}>
          Even counting only 10% of the model, that is AU$2.3 million a year of engineering. Even at 2%,
          AU$466,000 a year. The full model says AU$23 million a year.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
          <Tile label="Floor (2%)" value="AU$466k" note="per year" />
          <Tile label="Counted (10%)" value="AU$2.3M" note="per year" strong />
          <Tile label="Full model" value="AU$23M" note="per year" />
        </div>
      </Block>

      <Block title="What a dollar of compute buys">
        <p style={BODY}>
          Counted at 10% (a MODELLED figure), that is AU$2.3 million a year of engineering on about AU$550 a year of compute (about US$30, roughly AU$46, a month): about
          AU$4,200 of engineering per AU$1 on the original build spend, and about AU$650 per AU$1 at
          today&apos;s AU$300 a month. On the full model (AU$7.8 million built on about AU$185 of compute over
          the four months), it is about AU$42,000 per AU$1.
        </p>
      </Block>

      <OpenLoop>A model is only worth something if the work holds up. So does it?</OpenLoop>

      <Analogy k="preflight" />

      <Block title="Built properly">
        <ul style={{ ...PROSE, listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {[
            "5,777 tests in one full pass (RECORDED, 8 October 2026). Nothing ships unless the test gate is green.",
            "1,078 commits in the main repository since 24 August 2026.",
          ].map((t) => (
            <li key={t} style={{ ...CARD, color: "var(--ice)", lineHeight: 1.6 }}>
              {t}
            </li>
          ))}
        </ul>
      </Block>

      <SectionReveal style={SECTION}>
        <div style={PROSE}>
          <OperatorNote>
            I don&apos;t code by hand. I engineer with AI. The proof is the system.
          </OperatorNote>
        </div>
      </SectionReveal>
      <div className="divider-gold" />

      <Block
        title="Imagine what this does with real investment"
        lead="A scenario, not a forecast. Conservative multiples on the same model."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          <Tile label="AU$25k a month" value="~AU$7M" note="a year. Kyle full-time." />
          <Tile label="AU$50k a month" value="~AU$14M" note="a year. Plus 2 to 3 engineers." />
          <Tile label="AU$100k a month" value="~AU$23M" note="a year. Small team and a full agent fleet." />
        </div>
        <p style={{ ...BODY, marginTop: 20 }}>
          AU$10M+ a year of engineering capacity at the right investment. That is the same model with bigger inputs, so treat it as a scenario.
        </p>
      </Block>

      <Block title="Nobody gets replaced">
        <p style={BODY}>
          We&apos;re not here to replace anyone. We make work simpler, give people their hours back, and help
          businesses make more money. If a process runs on a computer, we can automate it.
        </p>
        <p style={{ ...BODY, color: "var(--gold)" }}>Already running in TITANOS:</p>
        <ul style={{ margin: 0, paddingLeft: 22, color: "var(--ice)", lineHeight: 1.7, display: "grid", gap: 8 }}>
          {AUTOMATES.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Block>

      <Block id="method" title="Method and sources">
        <ul style={{ margin: 0, paddingLeft: 22, color: "var(--ice)", lineHeight: 1.75, display: "grid", gap: 10 }}>
          <li>
            Model: Basic COCOMO, organic mode. Effort = 2.4 x KSLOC^1.05 person-months. Schedule = 2.5 x
            effort^0.38 months.
          </li>
          <li>
            Size: KSLOC = 170.651, the non-blank, non-comment lines of .py, .sh, .ts, .tsx and .js across four
            repositories, measured on 4 October 2026. The window is about four months because the first commit
            in the earliest of those repositories (the website) is 4 June 2026.
          </li>
          <li>
            Basic COCOMO on the main repository only (152,293 lines, 1,078 commits since 24 August 2026): about
            39 engineer-years. The 44 and the 39 are the same model on two line counts.
          </li>
          <li>
            Result: 529.6 person-months (44.1 engineer-years) over a 27.1-month schedule, which is about 19.5
            engineers.
          </li>
          <li>
            Cost: AU$800 a day x 220 working days a year, the contractor rate from the Hudson Australia Cyber
            Security Salary Guide. 44.1 years x 220 days x AU$800 is about AU$7.8 million.
          </li>
          <li>
            Per year: that output landed in about four months, so a year at the same pace is three times
            over, about AU$23 million. The 10% and 2% lines are 10% and 2% of that.
          </li>
          <li>
            Compute: about US$30 (roughly AU$46) a month is the cost of the AI tools during the build stage. It is AU$300 a month today.
          </li>
          <li>
            Re-run it yourself: count the non-blank, non-comment lines in your own repositories, put the
            thousands into the two formulas above, and multiply person-months by your own day rate.
          </li>
        </ul>
        <p style={{ ...BODY, marginTop: 18, color: "var(--dim)", fontSize: "var(--fs-sm)" }}>
          COCOMO estimates what a conventional team would take to write this much code. It is a model, not a
          timesheet, and it counts size, not value.
        </p>
      </Block>

      <SectionReveal style={{ ...SECTION, textAlign: "center" }}>
        <div style={PROSE}>
          <p style={BODY}>
            Would it be okay if I ran the free security scan on your business as a first step? It reads public records only
            and touches nothing of yours. If you would rather talk it through, book a call. A no is welcome either way.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
            <AnimatedButton href="/scan" variant="primary">
              Get your free security scan
            </AnimatedButton>
            <AnimatedButton href="mailto:kyle@titanos.tech?subject=Book%20a%20call" variant="secondary">
              Book a call: kyle@titanos.tech
            </AnimatedButton>
          </div>
          <div style={{ marginTop: 32 }}>
            <OmegaSeal />
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
