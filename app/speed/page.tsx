import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

const META_TITLE = "Speed and precision | TITANOS";
const META_DESC =
  "Fast because it is code, precise because it is checked. Our measured build speeds and test gates, set beside published industry timelines.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/speed" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/speed" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/speed", baseMetadata);

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 820, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 22, margin: "34px 0 10px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "16px 18px",
};
const CELL: CSSProperties = { padding: "10px 8px", borderBottom: "1px solid var(--border)", color: "var(--ice)", fontSize: 15 };
const A: CSSProperties = { color: "var(--gold)" };

const FACTS: [string, string][] = [
  ["3.5 hours", "RECORDED: from idea to a working, tested app with 56 commits (7 October 2026)"],
  ["44", "MODELLED: engineer-years of output in 4 months, priced by the COCOMO model, not a timesheet"],
  ["5,777", "RECORDED: tests in one full pass of our suite, run before any change is accepted"],
  ["2", "RECORDED: layout bugs caught by the phone check before release, after the tests had passed"],
];

const COMPARE: [string, string, string][] = [
  [
    "Software change, idea to live",
    "Elite teams: under a day. Low performers: 1 to 6 months (DORA 2024)",
    "A full app built and tested in 3.5 hours",
  ],
  [
    "Penetration test report",
    "3 to 10 days of testing, plus 2 to 3 days to write the report",
    "Public-record security checks run in seconds, reported in plain English",
  ],
];

const ANGLES: [string, string, string][] = [
  ["Time", "Hours given back to your team every week, with nobody replaced", "/costs"],
  ["Speed", "Weeks of turnaround cut to hours or days", "/case-studies"],
  ["Precision", "Errors caught by tests and checks before they reach you", "/methodology"],
  ["Cost", "Systems that typically run for about AU$20 to AU$50 a month", "/costs"],
  ["Engineering", "The 44 engineer-year model figure, with the maths shown and labelled as a model", "/engineering"],
];

export default function Speed() {
  return (
    <div>
      <PageHero
        badge="Speed and precision"
        title="Fast because it is code. Precise because it is checked."
        sub="Every number here is measured from our own work or taken from a published source, and each one says which."
      />
      <section style={{ ...SECTION, paddingBottom: 0 }}>
        <div style={WRAP}>
          <FlexNumber f={FLEX.fleetJobs} />
          <p style={BODY}>
            Method: counted from the log our own system writes every time it finishes a job, over the last 24 hours. Before you ask:
            this is our own build machine working on our own code. It touches nothing of yours, it replaces nobody, and your IT
            provider stays in charge of anything we build for you.
          </p>
        </div>
      </section>
      <OpenLoop>One finished job every six minutes sounds quick. But is quick any use if it is wrong?</OpenLoop>
      <section style={SECTION}>
        <div style={WRAP}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {FACTS.map(([n, l]) => (
              <div key={l} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 28, fontWeight: 700 }}>{n}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.5 }}>{l}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>Why it is fast</h2>
          <p style={BODY}>Think of a kitchen where the prep is already chopped. Nobody works faster, there is just less to do at the last minute.</p>
          <p style={BODY}>
            Most of what we build is plain code, and code runs in seconds, every time, at any hour. The AI handles only the
            judgement work, and many builds run side by side instead of one after another. That morning&apos;s app was 14
            features built in parallel and merged into one product, about one commit every three minutes. See the{" "}
            <a href="/case-studies/trading-app" style={A}>
              case study
            </a>
            .
          </p>

          <h2 style={H}>How that compares</h2>
          <div tabIndex={0} style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  {["Job", "Typical published timeline", "Our measured speed"].map((h) => (
                    <th key={h} style={{ ...CELL, color: "var(--gold)", textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c) => (
                      <td key={c} style={CELL}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ ...BODY, fontSize: 13, opacity: 0.7, marginTop: 8 }}>
            Sources:{" "}
            <a href="https://octopus.com/blog/2024-devops-performance-clusters" style={A}>
              DORA 2024 performance clusters (Octopus)
            </a>
            ,{" "}
            <a href="https://www.cyberforte.com.au/advanced-penetration-testing/" style={A}>
              CyberForte, penetration testing
            </a>
            . A public-record check is not a full penetration test; the row compares turnaround, not scope.
          </p>

          <h2 style={H}>Why it is precise</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <b>Tests before claims.</b> Our suite runs 5,777 automated tests in one pass, and a change is accepted only when
              every one passes.
            </li>
            <li style={{ marginBottom: 8 }}>
              <b>Checked the way you will use it.</b> Apps are tapped through on real phone screen sizes before release. In
              the trading-app build, that check caught two layout bugs the tests had missed.
            </li>
            <li style={{ marginBottom: 8 }}>
              <b>Every figure sourced or labelled.</b> In our reports a number is either measured, taken from a named public
              source, or clearly marked as a model you can re-run. See the{" "}
              <a href="/methodology" style={A}>
                methodology
              </a>
              .
            </li>
            <li style={{ marginBottom: 8 }}>
              <b>A person approves what matters.</b> Anything that sends, spends or commits waits for a one-tap approval, and
              every change is backed up before it goes live.
            </li>
          </ul>

          <h2 style={H}>Every angle of value, in one place</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {ANGLES.map(([t, d, href]) => (
              <a key={t} href={href} style={{ ...CARD, textDecoration: "none", display: "block" }}>
                <div style={{ color: "var(--gold)", fontSize: 18, fontWeight: 600 }}>{t}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.6, marginTop: 4 }}>{d}</div>
              </a>
            ))}
          </div>

          <p style={{ ...BODY, textAlign: "center", marginTop: 36 }}>
            Want to see how fast this could move for your business? Would it be okay if we looked at one of your slow jobs on a free consultation? A no is welcome.
          </p>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/audit">Book a free consultation</AnimatedButton>
            <AnimatedButton href="/costs" variant="secondary">
              Work out your savings
            </AnimatedButton>
          </div>
        </div>
      </section>
    </div>
  );
}
