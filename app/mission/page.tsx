import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";

const META_TITLE = "The mission: why TITANOS exists | TITANOS";
const META_DESC =
  "Give people their time back instead of taking their jobs, and put most of what we earn back into the world: children first, then jobs, housing, health and education.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/mission" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/mission" },
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
const A: CSSProperties = { color: "var(--gold)" };

const GIVE: [string, string][] = [
  ["Children", "First in line: support for kids who need it, through registered charities and programs."],
  ["Jobs", "A global network that gives people displaced by AI the leads, tools and training to earn."],
  ["Housing and health", "Housing, mental health support and healing, funded through organisations that already do it well."],
  ["Education", "Free tools, free guides and free training, so the know-how spreads further than the money can."],
];

const RULES = [
  "Grow the pie, never take it. Money poured into people's time, skills and energy compounds; money that only chases goods drives prices up.",
  "Nobody replaced. Every system we build gives hours back to the people who already do the work.",
  "Counted only when real. A pledge is reported when the money has actually gone out, with the receipt.",
  "Through official channels. Giving to governments and charities goes through their own programs and rules.",
];

export default function Mission() {
  return (
    <main>
      <PageHero
        badge="The mission"
        title="Give people their time back, then give the money back too."
        sub="TITANOS exists to prove AI can hand people their hours back instead of taking their jobs, and to put most of what it earns back into the world."
      />
      <section style={SECTION}>
        <div style={WRAP}>
          <h2 style={H}>Where the money goes as we grow</h2>
          <p style={BODY}>
            Once the founder&apos;s living is covered, the plan at scale is about <b>80% back to the world</b>,{" "}
            <b>15% back into the system</b> (compute, people, the next product) and <b>5% to the founder</b>. At AU$1
            million a month in revenue, that is about <b>AU$800,000 a month, AU$9.6 million a year</b>, going back out.
            The full ladder is on the <a href="/investors" style={A}>investors page</a>.
          </p>

          <h2 style={H}>Who it goes to</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {GIVE.map(([t, d]) => (
              <div key={t} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 18, fontWeight: 600 }}>{t}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.6, marginTop: 4 }}>{d}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>Why the numbers can get this big</h2>
          <p style={BODY}>
            The world economy is about US$110 trillion a year. At the usual 3% growth it doubles in about 23 years; at 7%,
            in about 10. Every extra point of productivity growth, held over time, is worth more than US$1 trillion a year.
            AI that gives people their hours back moves that growth rate, and that is the engine behind the giving.
          </p>

          <h2 style={H}>The rules we hold ourselves to</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            {RULES.map((r) => (
              <li key={r} style={{ marginBottom: 8 }}>
                {r}
              </li>
            ))}
          </ul>

          <p style={{ ...BODY, fontSize: 13, opacity: 0.75 }}>
            This is the founder&apos;s stated plan and direction, not a promise of any amount by any date. What has
            actually been given will be listed here, with receipts, as it happens.
          </p>

          <p style={{ ...BODY, textAlign: "center", marginTop: 30 }}>
            Want to help, partner, or point us at a cause that needs it? Start with a conversation. Or <a href="/audit" style={{ color: "var(--gold)" }}>book a free consultation</a>.
          </p>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/contact">Start a conversation</AnimatedButton>
            <AnimatedButton href="/investors" variant="secondary">
              Investors
            </AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
