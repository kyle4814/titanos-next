import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";

const META_TITLE = "Case studies | TITANOS";
const META_DESC =
  "Real builds with real receipts: what was built, how fast, and how it was tested. Screenshots from the working product, counts from the git log.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/case-studies" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/case-studies" },
  robots: { index: true, follow: true },
};

const SECTION: CSSProperties = { padding: "var(--space-16) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 960, margin: "0 auto" };
const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "22px 24px",
};
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };

const FACTS: [string, string][] = [
  ["56", "commits in one morning (05:41 to 08:40, 7 October 2026)"],
  ["250 / 250", "automated tests passing"],
  ["14", "features built on separate branches, then merged"],
  ["200", "course lessons, each fact-checked by a second agent"],
];

const BUILT = [
  "A 200-lesson trading course with server-scored quizzes, progress and badges.",
  "An AI tutor that answers questions in plain words, on every screen, from a floating chat bubble.",
  "Live charts with drawings, indicators and a practice-money trade journal.",
  "A Telegram bot: account linking, lesson reminders and signal alerts with one-tap practice trades.",
  "A gamified garden that grows from learning habits, with levels, seasons and streaks.",
];

const SHOTS = [
  { src: "/case-studies/garden-home.png", alt: "Home screen: trading sessions in local time and a practice equity chart" },
  { src: "/case-studies/garden-trade.png", alt: "Trade hub: charts, replay drills, simulated coins and the trade log" },
  { src: "/case-studies/garden-petal.png", alt: "The AI tutor answering what a pip is, in plain words" },
];

export default function CaseStudies() {
  return (
    <main>
      <PageHero
        badge="Case studies"
        title="Built in a morning. Tested like it matters."
        sub="Real builds, shown with screenshots from the working product and counts taken straight from the git log. Client names stay private."
      />

      <section style={SECTION}>
        <div style={WRAP}>
          <div style={CARD}>
            <h2 style={{ color: "var(--gold)", margin: "0 0 6px" }}>A full trading-education app, in one morning</h2>
            <p style={{ ...BODY, opacity: 0.8 }}>Private client, education and practice trading, October 2026</p>
            <p style={BODY}>
              The brief: a phone-first app to learn trading safely, with practice money only, a course, live charts, an AI
              tutor and a Telegram bot, all simple enough to use on a lunch break.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, margin: "18px 0" }}>
              {FACTS.map(([n, l]) => (
                <div key={l} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
                  <div style={{ color: "var(--gold)", fontSize: 28, fontWeight: 700 }}>{n}</div>
                  <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.5 }}>{l}</div>
                </div>
              ))}
            </div>

            <h3 style={{ color: "var(--ice)", margin: "18px 0 8px" }}>What was built</h3>
            <ul style={{ ...BODY, paddingLeft: 20 }}>
              {BUILT.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>

            <h3 style={{ color: "var(--ice)", margin: "18px 0 8px" }}>How it was checked</h3>
            <p style={BODY}>
              Every change passed the test gate before it landed. Then a headless phone browser tapped through every tab at
              two screen sizes, opened the tutor and checked for a real answer. That pass caught a layout bug (overlapping
              buttons in the chat) before the client ever saw it.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 18 }}>
              {SHOTS.map((s) => (
                <figure key={s.src} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.src}
                    alt={s.alt}
                    loading="lazy"
                    style={{ width: "100%", height: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}
                  />
                  <figcaption style={{ color: "var(--ice)", opacity: 0.75, fontSize: 13, marginTop: 6 }}>{s.alt}</figcaption>
                </figure>
              ))}
            </div>
          </div>

          <p style={{ ...BODY, textAlign: "center", marginTop: 28 }}>
            Want something like this for your business? A free consultation is the first step, with no pressure.
          </p>
          <div style={{ textAlign: "center" }}>
            <AnimatedButton href="/audit">Book a free consultation</AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
