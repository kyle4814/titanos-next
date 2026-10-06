import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";

const META_TITLE = "What it costs to run | TITANOS";
const META_DESC =
  "99% code, 1% AI, and a person only where it matters. How we keep running costs to about AU$20 to AU$50 a month, with the published prices and our own measured numbers.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/costs" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/costs" },
  robots: { index: true, follow: true },
};

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

const SPLIT: [string, string, string][] = [
  ["99%", "plain code", "Anything that repeats becomes ordinary code once it is proven. Code costs nothing to run again."],
  ["1%", "AI", "The AI only does the judgement work: reading, writing and deciding what code cannot."],
  ["One tap", "you", "Anything that sends, spends or commits waits for a person to approve it."],
];

const LEVERS: [string, string, string][] = [
  ["Code first", "Every proven step becomes code", "Zero AI cost for that step, forever"],
  ["Right-sized model", "Claude Sonnet 5.5 for everyday work", "US$2 in / US$10 out per million tokens, half the top model's US$4 / US$20"],
  ["Prompt caching", "Repeated instructions are cached", "Cached reads cost a tenth of the normal input price (US$0.20 per million)"],
  ["Batching", "Non-urgent jobs run in batches", "Half price for anything that can wait a few hours"],
];

export default function Costs() {
  return (
    <main>
      <PageHero
        badge="How we operate"
        title="99% code. 1% AI. You approve what matters."
        sub="That is how the systems we build typically run for about AU$20 to AU$50 a month, on your own accounts, with nothing marked up."
      />
      <section style={SECTION}>
        <div style={WRAP}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {SPLIT.map(([n, l, d]) => (
              <div key={l} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 28, fontWeight: 700 }}>{n}</div>
                <div style={{ color: "var(--ice)", fontWeight: 600, marginBottom: 6 }}>{l}</div>
                <div style={{ color: "var(--ice)", opacity: 0.8, fontSize: 14, lineHeight: 1.6 }}>{d}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>Myelination: why it gets cheaper every week</h2>
          <p style={BODY}>
            Your brain gets faster at a skill by insulating the nerve paths it uses most. We do the same with software. The
            first time a job runs, the AI works it out. Once the steps are proven, we turn them into plain code, so the next
            run costs nothing. Every week, more of the system is code and less of it is AI, so it gets faster and cheaper
            without getting worse.
          </p>

          <h2 style={H}>The four levers that keep the AI bill tiny</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr>
                  {["Lever", "What we do", "What it saves"].map((h) => (
                    <th key={h} style={{ ...CELL, color: "var(--gold)", textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEVERS.map((r) => (
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
            Prices are Anthropic&apos;s published API rates for Claude, in US dollars, checked October 2026.
          </p>

          <h2 style={H}>Our own numbers, measured</h2>
          <p style={BODY}>
            We log the cost of every AI step we run. In October 2026, writing a full 18-section research pack on Claude
            Sonnet 5.5 cost <b>US$0.69 to US$1.03</b>, and an independent review of that pack cost <b>US$0.77 to US$0.80</b>.
            Together, that is less than the price of a coffee.
          </p>
          <p style={BODY}>
            Our own engineering runs on about <b>AU$300 a month</b> in tools. See what that builds on the{" "}
            <a href="/case-studies" style={{ color: "var(--gold)" }}>
              case studies
            </a>{" "}
            and{" "}
            <a href="/engineering" style={{ color: "var(--gold)" }}>
              engineering
            </a>{" "}
            pages.
          </p>

          <h2 style={H}>What that means for you</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <b>Typical running cost: about AU$20 to AU$50 a month</b> for AI usage and hosting, once the system is built
              and settled. Busier systems cost more, and we tell you the expected number before you start.
            </li>
            <li style={{ marginBottom: 8 }}>
              <b>On your own accounts.</b> The AI usage and hosting are billed to you directly by the provider. We add no
              markup, and you hold the keys.
            </li>
            <li style={{ marginBottom: 8 }}>
              <b>For scale:</b> the median Australian employee earns AU$42.90 an hour (ABS, August 2025), so a month of
              running costs is about one hour of one person&apos;s time. A mid-level security contractor charges AU$700 to
              AU$900 a day (Hudson salary guide).
            </li>
            <li style={{ marginBottom: 8 }}>
              <b>Nobody gets replaced.</b> The system takes the repetitive work off your people, so their hours go back into
              the work only they can do.
            </li>
          </ul>

          <p style={{ ...BODY, fontSize: 13, opacity: 0.7 }}>
            The AU$20 to AU$50 range is our typical estimate for a settled system, not a quote; your proposal names the
            expected figure for your setup. Sources:{" "}
            <a href="https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/employee-earnings" style={{ color: "var(--gold)" }}>
              ABS employee earnings
            </a>
            ,{" "}
            <a href="https://au.hudson.com/salary-guide-cyber-security/" style={{ color: "var(--gold)" }}>
              Hudson cyber security salary guide
            </a>
            .
          </p>

          <p style={{ ...BODY, textAlign: "center", marginTop: 36 }}>
            Want to know what your system would cost to run? Ask on a free consultation, with no pressure.
          </p>
          <div style={{ textAlign: "center" }}>
            <AnimatedButton href="/audit">Book a free consultation</AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
