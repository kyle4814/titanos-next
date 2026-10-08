import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";

const META_TITLE = "Parallax: the simplest way to bring AI in | TITANOS";
const META_DESC =
  "Nothing replaced, nothing to learn, nothing to install. One conversation, one approval, one tap per decision. We do the rest beside the systems you already run.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/parallax" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/parallax" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/parallax", baseMetadata);

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 820, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 22, margin: "34px 0 10px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "18px 20px",
};

const YOURS: [string, string][] = [
  ["1", "One conversation. Tell us where the hours go. That is the whole brief."],
  ["2", "One approval. You choose how much we see, starting from nothing at all."],
  ["3", "One tap per decision. Anything that sends, spends or changes something waits for your yes."],
];

const LEVELS: [string, string, string][] = [
  ["Level 0", "Nothing connected", "We work from public records and your filed accounts. You get the analysis before you share a thing."],
  ["Level 1", "Forward and share", "Forward an email or share one spreadsheet. We return the work done."],
  ["Level 2", "Read-only, one system", "Read-only access to one system you choose. Nothing in it can be changed by us."],
  ["Level 3", "Approved actions", "The system drafts and prepares; a person on your side taps yes before anything happens."],
];

const NEVER = [
  "Replace your systems. We sit beside what you already run.",
  "Replace your people. The repetitive work moves to the machine, and their hours go back to the work only they can do.",
  "Ask your team to learn new software. They keep the tools they know.",
  "Take control from your IT team. They stay in charge, and every action we take is logged for them to check.",
  "Act without a yes. Every action that matters waits for one tap.",
];

export default function Parallax() {
  return (
    <div>
      <PageHero
        badge="Parallax"
        title="The simplest way to bring AI into a large organisation."
        sub="Nothing replaced, nothing to learn, nothing to install. You do three things. We do everything else, beside the systems you already run."
      />
      <section style={SECTION}>
        <div style={WRAP}>
          <h2 style={H}>Your part: three things</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {YOURS.map(([n, t]) => (
              <div key={n} style={{ ...CARD, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ color: "var(--gold)", fontSize: 34, fontWeight: 700, minWidth: 30 }}>{n}</div>
                <div style={{ color: "var(--ice)", fontSize: 17, lineHeight: 1.6 }}>{t}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>Our part: everything else</h2>
          <p style={BODY}>
            Finding where the hours go, building the system, testing it end to end, running it, and reporting what it gave
            back. It is 99% code and 1% AI, so it runs for about AU$20 to AU$50 a month on your own accounts, with nothing
            marked up. See the <a href="/costs" style={{ color: "var(--gold)" }}>costs</a> and the{" "}
            <a href="/proof" style={{ color: "var(--gold)" }}>proof</a>.
          </p>

          <h2 style={H}>Go as deep as you like, one step at a time</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {LEVELS.map(([l, n, d]) => (
              <div key={l} style={CARD}>
                <div style={{ color: "var(--gold)", fontWeight: 600 }}>
                  {l}: {n}
                </div>
                <div style={{ color: "var(--ice)", fontSize: 15, lineHeight: 1.6, marginTop: 4 }}>{d}</div>
              </div>
            ))}
          </div>
          <p style={{ ...BODY, marginTop: 12 }}>
            Most organisations start at Level 0 and only move up once the numbers have earned it. Stopping at any level is
            fine.
          </p>

          <h2 style={H}>What we never do</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            {NEVER.map((t) => (
              <li key={t} style={{ marginBottom: 8 }}>
                {t}
              </li>
            ))}
          </ul>

          <p style={{ ...BODY, textAlign: "center", marginTop: 36 }}>
            The first step is a conversation, with no pressure and nothing to sign.
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
