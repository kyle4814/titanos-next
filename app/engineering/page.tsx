import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import type { ReactNode } from "react";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import { OperatorNote, OmegaSeal } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";
import Tiles from "@/components/proof/Tiles";
import { int, dec, aud, v, AS_OF_LONG, HERO_STRIP } from "@/lib/ledger";
import Provenance from "@/components/Provenance";

const META_TITLE = "What one engineer built, and the maths | TITANOS";
const META_DESC =
  `${int("estate_sloc")} lines of production code since May 2026, priced by the COCOMO model at ${dec("estate_ey")} engineer-years (MODELLED). The maths, the method and how to re-run it.`;

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

const AUTOMATES = [
  "Email security scanning: SPF, DKIM and DMARC checks from public records (the free scan).",
  "Lead research and verification: contact lists checked for deliverability before anyone sees them.",
  "Daily call lists with a script for every lead, and a log of every call outcome.",
  "Approval-gated email sending: nothing goes out until a person taps approve.",
  "Daily blog publishing: drafted, checked against a copy-rules linter, then shipped on its date after one approval.",
  "Document and dossier production: sourced research packs built and delivered as a set.",
  "Test-gated engineering: every change must pass the automated test gate before it lands.",
];

function Block({ id, title, lead, children }: { id?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pe-page pe-page--narrow">
      <SectionReveal className="pe-section">
        <div id={id} style={{ scrollMarginTop: 96 }}>
          <div className="pe-section__head">
            <h2>{title}</h2>
            {lead ? <p>{lead}</p> : null}
          </div>
          {children}
        </div>
      </SectionReveal>
    </div>
  );
}

export default function EngineeringPage() {
  return (
    <>
      <PageHero
        badge="The proof"
        title={`${Math.round(v("model_team"))} engineers for ${Math.round(v("model_schedule_months"))} months, or one person in about ${Math.round(v("elapsed_months"))}.`}
        tagline={`On about US$30 (roughly ${aud("compute_build_aud_month")}) a month of AI tools while the main engine was built (operator figure, no receipt on file).`}
        sub={`That first figure is MODELLED, not a timesheet. One engineer, working around a day job, with commits on ${v("active_days")} of ${v("span_days")} days since the first commit on 4 May 2026. ${HERO_STRIP} Every figure below has its method at the bottom of the page.`}
      >
        <AnimatedButton href="#method" variant="secondary">
          Jump to the method ↓
        </AnimatedButton>
      </PageHero>
      <Provenance route="/engineering" />

      <div className="pe-page pe-page--narrow">
        <SectionReveal className="pe-section">
          <Tiles
            label="Measured build figures"
            items={[
              { n: int("estate_sloc"), l: "lines of production code", tag: "MEASURED" },
              { n: int("estate_repos"), l: "repositories", tag: "MEASURED" },
              { n: dec("estate_ey"), l: "engineer-years (COCOMO)", tag: "MODELLED" },
              { n: int("tests_main"), l: "test cases in the main engine", tag: "MEASURED" },
            ]}
          />
          <FlexNumber f={FLEX.engineers} />
          <p className="pe-prose" style={{ marginTop: 18 }}>
            Method in one line: count the lines of code, put them through the published COCOMO formulas, and compare. Before you ask,
            this page is about our own build. Nothing of yours is touched, nobody is replaced, and the whole calculation is at the bottom
            so you can re-run it.
          </p>
        </SectionReveal>
      </div>

      <OpenLoop>How do you get from lines of code to a number of engineers, and is it fair?</OpenLoop>


      <Block title="The maths, in one line" lead="MODELLED, and labelled as such.">
        <p className="pe-prose">
          {int("estate_sloc")} lines of production code across {int("estate_repos")} repositories since 4 May 2026 (measured {AS_OF_LONG}). The industry-standard COCOMO model prices that at{" "}
          {dec("estate_ey")} engineer-years (MODELLED). This page prints no dollar value for that model. The website began on 4 June, the main engine on 24 August and the operating kernel on 29 September.
        </p>
      </Block>

      <Analogy k="department" />

      <Block title="The normal way vs the TITANOS way" lead="A department, or one person with a very good toolbox.">
        <div className="pe-table-wrap">
          <table>
            <thead>
              <tr>
                <th />
                <th>Normal (per the same model)</th>
                <th>TITANOS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>People</td>
                <td>About {Math.round(v("model_team"))} engineers</td>
                <td>1 engineer</td>
              </tr>
              <tr>
                <td>Time</td>
                <td>About {Math.round(v("model_schedule_months"))} months</td>
                <td>About {Math.round(v("elapsed_months"))} months (4 May to 8 October 2026), around a day job</td>
              </tr>
              <tr>
                <td>Result</td>
                <td colSpan={2}>
                  By the model, roughly {Math.round(v("speed_x"))} times faster with a {Math.round(v("team_smaller_x"))}th of the team (both MODELLED).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Block>

      <OpenLoop>A model is only worth something if the work holds up. So does it?</OpenLoop>

      <Analogy k="preflight" />

      <Block title="Built properly">
        <ul className="pe-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {[
            `${int("tests_main")} test cases in the main engine and ${int("suites_now")} automated safety suites on the control layer (MEASURED, ${AS_OF_LONG}). A test gate runs before a change is merged; its latest full reading is on the engine case study.`,
            `From ${v("commits_week_before")} commits a week in May to ${int("commits_week_now")} this week across ${int("estate_repos")} repositories (MEASURED).`,
          ].map((t) => (
            <li key={t} className="pe-card pe-card--pad" style={{ lineHeight: 1.6 }}>
              {t}
            </li>
          ))}
        </ul>
      </Block>

      <div className="pe-page pe-page--narrow">
        <SectionReveal className="pe-section">
          <OperatorNote>
            I don&apos;t code by hand. I engineer with AI. The proof is the system.
          </OperatorNote>
        </SectionReveal>
      </div>

      <Block
        title="Imagine what this does with real investment"
        lead="A scenario, not a forecast."
      >
        <p className="pe-prose">
          Today it is one person on {aud("compute_today_aud_month")} a month of AI tools. More accounts run more work in parallel and investment would add people, but there is no result behind any scale-up number yet, so this page does not print one.
        </p>
      </Block>

      <Block title="Nobody gets replaced">
        <p className="pe-prose">
          We&apos;re not here to replace anyone. We make work simpler, give people their hours back, and help
          businesses make more money. If a process runs on a computer, we can automate it.
        </p>
        <p className="pe-prose pe-eyebrow-line" style={{ marginTop: 24 }}>Already running in TITANOS:</p>
        <ul className="pe-prose" style={{ margin: 0, display: "grid", gap: 8, listStyle: "disc" }}>
          {AUTOMATES.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Block>

      <Block id="method" title="Method and sources">
        <ul className="pe-prose" style={{ margin: 0, display: "grid", gap: 10, listStyle: "disc" }}>
          <li>
            Model: Basic COCOMO, organic mode. Effort = 2.4 x KSLOC^1.05 person-months. Schedule = 2.5 x
            effort^0.38 months.
          </li>
          <li>
            Size: KSLOC = {(v("estate_sloc") / 1000).toFixed(3)}, the non-blank, non-comment lines of production code across {int("estate_repos")} repositories
            (mirrors, clones, worktrees and third-party code excluded), measured {AS_OF_LONG}. The window starts at the first commit on 4 May 2026
            and runs {v("span_days")} days, with commits on {v("active_days")} of them.
          </li>
          <li>
            Result: {int("model_effort_pm")} person-months ({dec("estate_ey")} engineer-years) over a {dec("model_schedule_months")}-month schedule, which is about {dec("model_team")}{" "}
            engineers. The earlier 44 engineer-years figure was the same model on 170,651 lines, measured 4 October.
          </li>
          <li>
            Dollars: this page prints no dollar value for the engineer-years. A day-rate model of that kind is an internal estimate, not a result, and it is not revenue.
          </li>
          <li>
            Compute: about US$30 (roughly {aud("compute_build_aud_month")}) a month of AI tools while the main engine was built (to 29 September), and {aud("compute_today_aud_month")} a month since. Both are operator figures with no receipt on file.
          </li>
          <li>
            Re-run it yourself: count the non-blank, non-comment lines in your own repositories, put the
            thousands into the two formulas above, and multiply person-months by your own day rate.
          </li>
        </ul>
        <p className="pe-prose pe-muted" style={{ marginTop: 18, fontSize: "var(--pe-fs-sm)" }}>
          COCOMO estimates what a conventional team would take to write this much code. It is a model, not a
          timesheet, and it counts size, not value.
        </p>
      </Block>

      <div className="pe-page pe-page--narrow">
        <SectionReveal className="pe-section" style={{ textAlign: "center" }}>
          <p className="pe-lead" style={{ margin: "0 auto 24px", maxWidth: "62ch" }}>
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
        </SectionReveal>
      </div>
    </>
  );
}
