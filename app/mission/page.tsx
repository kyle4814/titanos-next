import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import "./mission.css";
import "@/components/w2a/w2a.css";
import AnimatedButton from "@/components/AnimatedButton";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

const META_TITLE = "The mission: why TITANOS exists | TITANOS";
const META_DESC =
  "Give people their time back instead of taking their jobs, and build the company that proves it worldwide. Early profits go back into TITANOS; giving grows as the company does.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/mission" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/mission" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/mission", baseMetadata);

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
    <div>
      <PageHero
        badge="The mission"
        title="Give people their time back, and build the company that proves it."
        sub="TITANOS exists to prove AI can hand people their hours back instead of taking their jobs, and to grow fast enough to prove it in every country."
      />
      <div className="pe-page pe-page--narrow">
        <section className="pe-section">
          <div className="w2a-measure">
            <FlexNumber f={FLEX.market} />
            <p className="pe-muted" style={{ lineHeight: 1.75, margin: "14px 0 0" }}>
              Method: the ABS count of actively trading Australian businesses with 5 to 19 staff, June 2026. Each one is carrying hours of
              repetitive work, and that is the time we want to hand back. We only use public records, we touch nothing without being asked,
              nobody is replaced, and your IT provider stays in charge.
            </p>
          </div>
        </section>
      </div>
      <OpenLoop>If that much time could come back, where should the money we earn go?</OpenLoop>
      <div className="pe-page pe-page--narrow">
        <section className="pe-section">
          <p className="pe-eyebrow-line">The plan</p>
          <h2>Where the money goes as we grow</h2>
          <p className="pe-prose">
            For the first two years, about <b>90% of what TITANOS earns goes straight back into the company</b> (PROPOSED: the founder&apos;s stated plan, not a result and not a guarantee): compute,
            people, products and new countries, so the mission arrives years sooner. The founder lives on the rest. Once
            TITANOS is established as a global company, a growing share goes to the people below.
          </p>
        </section>

        <OpenLoop>And who is it for, exactly?</OpenLoop>
        <section className="pe-section">
          <p className="pe-eyebrow-line">The giving</p>
          <h2>Who it goes to</h2>
          <div className="pe-grid" style={{ marginTop: 20 }}>
            {GIVE.map(([t, d]) => (
              <div key={t} className="pe-card pe-card--pad">
                <h3 style={{ color: "var(--pe-gold-hi)", fontSize: 18, margin: 0 }}>{t}</h3>
                <p className="pe-muted" style={{ fontSize: 15, lineHeight: 1.6, margin: "8px 0 0" }}>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pe-section">
          <p className="pe-eyebrow-line">The numbers</p>
          <h2>Why the numbers can get this big</h2>
          <p className="pe-prose">
            The world economy is about US$110 trillion a year (ESTIMATE, IMF World Economic Outlook, nominal world GDP). At 3% growth it
            doubles in about 23 years; at 7%, in about 10 (MODELLED arithmetic). Every extra point of productivity growth, held over time, is worth more than US$1 trillion a year.
            AI that gives people their hours back moves that growth rate, and that is the engine behind the giving.
          </p>
        </section>

        <section className="pe-section">
          <p className="pe-eyebrow-line">Our rules</p>
          <h2>The rules we hold ourselves to</h2>
          <ul className="pe-prose" style={{ marginTop: 14 }}>
            {RULES.map((r) => (
              <li key={r} style={{ marginBottom: 10 }}>
                {r}
              </li>
            ))}
          </ul>
          <p className="pe-muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
            This is the founder&apos;s stated plan and direction, not a promise of any amount by any date. What has
            actually been given will be listed here, with receipts, as it happens.
          </p>
        </section>

        <section className="pe-section" style={{ textAlign: "center" }}>
          <p className="pe-lead" style={{ margin: "0 auto 24px" }}>
            Would it be okay if we started with a conversation, whether you want to help, partner, or point us at a cause that needs it? Or <a href="/audit">book a free consultation</a>. A no is welcome.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/contact">Start a conversation</AnimatedButton>
            <AnimatedButton href="/trust" variant="secondary">
              Trust
            </AnimatedButton>
          </div>
        </section>
      </div>
    </div>
  );
}
