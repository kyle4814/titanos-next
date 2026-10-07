import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import SavingsCalculator from "@/components/SavingsCalculator";
import { PRICING, LEADS, formatAUD } from "@/lib/pricing";
import { offersByGroup } from "@/lib/offers";
import { GROUP_LABELS, formatOfferPrice, type OfferGroup } from "@/lib/offers/types";

const META_TITLE = "Prices, costs and savings | TITANOS";
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


const HOURLY = 54.83; // ABS AWOTE AU$2,083.70 (May 2026) / 38 hours
const WEEKS = 46;
const TEAM_SIZES = [5, 20, 50, 200];
const HOURS_OPTS = [1, 2, 4];
const yearValue = (staff: number, h: number) => staff * h * WEEKS * HOURLY;

const CORE: [string, string, string][] = [
  ["Free email security scan", "Free", "/scan"],
  ["Free consultation and report", "Free", "/audit"],
  ["TITANOS Monitor", `${formatAUD(PRICING.MONITOR_MONTHLY)} a month, or ${formatAUD(PRICING.MONITOR_ANNUAL)} a year`, "/monitor"],
  ["Job Flow for tradies", `${formatAUD(PRICING.JOB_FLOW_MONTHLY)} a month`, "/tradies"],
  ["Lead lists", `${formatAUD(LEADS.STARTER.price)}, ${formatAUD(LEADS.GROWTH.price)} or ${formatAUD(LEADS.CAMPAIGN.price)} one-off; ${formatAUD(LEADS.RETAINER.price)} a month ongoing`, "/leads"],
  ["Privacy Act and Essential Eight pack", `${formatAUD(PRICING.PACK_PRICE)} one-off, with ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of Monitor included`, "/compliance"],
  ["AI Growth Partner", `${formatAUD(PRICING.AI_GROWTH_PARTNER)} a month`, "/ai-delivery"],
  ["AI Ops Partner", `${formatAUD(PRICING.AI_OPS_PARTNER)} a month`, "/ai-delivery"],
  ["Embedded AI Partner", `From ${formatAUD(PRICING.AI_EMBEDDED_PARTNER)} a month`, "/ai-delivery"],
  ["Board advisory", `${formatAUD(PRICING.BOARD_ADVISORY_MONTHLY)} a month`, "/enterprise"],
  ["Enterprise governance", `From ${formatAUD(PRICING.ENTERPRISE_GOVERNANCE)} a year`, "/enterprise"],
];

const TERMS = [
  "Every price on this page is a starting point. Scope, size and budget are all negotiable, so ask for the version that fits you.",
  "Start free. The scan and the consultation cost nothing, and what you learn is yours to keep whatever you decide.",
  "Start small. A first job can be sized to sit under your sign-off or procurement limit, then grow once it has earned it.",
  "Scale up or down. Move between options as your needs change. AI partner retainers have a 3-month minimum; Monitor cancels any time.",
  "No lock-in. The AI usage and hosting run on your own accounts, you hold the keys, and we add no markup to them.",
  "No pressure, and nobody replaced. The work goes to the machine so your people get their hours back.",
];

export default function Costs() {
  const groups = offersByGroup();
  return (
    <main>
      <PageHero
        badge="How we operate"
        title="Every price, every cost, all the maths."
        sub="What we offer, how we do business, what it costs to run, and what it can save you, with the working shown. 99% code, 1% AI, and you approve what matters."
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


          <h2 style={H}>How we do business</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            {TERMS.map((t) => (
              <li key={t} style={{ marginBottom: 8 }}>
                {t}
              </li>
            ))}
          </ul>

          <h2 style={H}>The main offers</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <tbody>
                {CORE.map(([n, p, href]) => (
                  <tr key={n}>
                    <td style={CELL}>
                      <a href={href} style={{ color: "var(--gold)" }}>
                        {n}
                      </a>
                    </td>
                    <td style={CELL}>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={H}>What it can save you: do the maths yourself</h2>
          <p style={BODY}>
            The biggest number is not what you pay us. It is the hours your team gets back. Change any box below and every
            line of the working updates. The hourly cost starts at AU$54.83: the ABS full-time average of AU$2,083.70 a week
            (May 2026) over a 38-hour week. That is before super and overheads, so the real cost of an hour is higher.
          </p>
          <SavingsCalculator />

          <h3 style={{ ...H, fontSize: 18 }}>Value of hours given back, a year</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={{ ...CELL, color: "var(--gold)", textAlign: "left" }}>Team size</th>
                  {HOURS_OPTS.map((h) => (
                    <th key={h} style={{ ...CELL, color: "var(--gold)", textAlign: "right" }}>
                      {h} hr{h > 1 ? "s" : ""} a week each
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TEAM_SIZES.map((t) => (
                  <tr key={t}>
                    <td style={CELL}>{t} people</td>
                    {HOURS_OPTS.map((h) => (
                      <td key={h} style={{ ...CELL, textAlign: "right" }}>
                        {formatAUD(Math.round(yearValue(t, h)))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ ...BODY, fontSize: 13, opacity: 0.7, marginTop: 8 }}>
            Working: people × hours a week × {WEEKS} working weeks × AU${HOURLY}. For example, 20 people × 2 hours × {WEEKS}{" "}
            weeks = 1,840 hours, worth {formatAUD(Math.round(yearValue(20, 2)))} a year: about five and a half times one{" "}
            {formatAUD(PRICING.AI_GROWTH_PARTNER * 12)} year of the entry AI retainer. These are scenarios you choose, not
            promises.
          </p>

          <h3 style={{ ...H, fontSize: 18 }}>What our research says</h3>
          <p style={BODY}>
            For the large organisations we research, we model the value of time given back from their own filed accounts. Our
            top-down model puts it at 2% to 5% of staff costs (5% central, 2% as the floor). When we model the actual processes
            step by step, the figure comes in lower (in one case about 8% of the top-down number), so we always lead with the
            step-by-step figure and show the top-down one only as the ceiling. Either way, on a staff bill in the millions,
            the hours given back are worth many times the fee.
          </p>

          <h2 style={H}>Every offer, with its price</h2>
          <p style={BODY}>
            The full catalogue, so nothing is hidden. Some are open to buy now; others start with a free first step while we
            finish them. Each one links to its own page.
          </p>
          {(Object.keys(GROUP_LABELS) as OfferGroup[]).map((g) =>
            groups[g].length ? (
              <details key={g} style={{ ...CARD, marginBottom: 10 }}>
                <summary style={{ color: "var(--gold)", cursor: "pointer", fontSize: 17 }}>
                  {GROUP_LABELS[g]} ({groups[g].length})
                </summary>
                <div style={{ marginTop: 10 }}>
                  {groups[g].map((o) => (
                    <div
                      key={o.slug}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                        flexWrap: "wrap",
                      }}
                    >
                      <a href={`/offers/${o.slug}`} style={{ color: "var(--ice)", flex: "1 1 220px" }}>
                        {o.name}
                      </a>
                      <span style={{ color: "var(--gold)", whiteSpace: "nowrap" }}>{formatOfferPrice(o)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null,
          )}

          <p style={{ ...BODY, textAlign: "center", marginTop: 36 }}>
            Want the numbers for your business, or a version that fits your budget? Ask on a free consultation, with no pressure.
          </p>
          <div style={{ textAlign: "center" }}>
            <AnimatedButton href="/audit">Book a free consultation</AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
