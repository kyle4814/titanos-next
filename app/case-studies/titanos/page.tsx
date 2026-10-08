import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { withSeo } from "@/lib/seo";
import { TITANOS as T, titanosPath, fact, FACTS_AS_OF } from "@/lib/case-studies/titanos";
import { LEDGER, AS_OF_LONG, TEAM_LINE, ELAPSED_LINE, int } from "@/lib/ledger";

const URL = `https://titanos.tech${titanosPath}`;

export const metadata: Metadata = withSeo(titanosPath, {
  title: `${T.title} | TITANOS`,
  description: T.teaser,
  alternates: { canonical: URL },
  openGraph: { title: T.title, description: T.teaser, type: "article", url: URL },
  robots: { index: true, follow: true },
});

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 900, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 24, margin: "46px 0 12px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "16px 18px",
};
const SMALL: CSSProperties = { color: "var(--ice)", opacity: 0.75, fontSize: 13, lineHeight: 1.5 };
const GRID: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 };

function Tag({ label }: { label: string }) {
  return (
    <span style={{ color: "var(--gold)", fontSize: 12, letterSpacing: 1, fontWeight: 700, border: "1px solid var(--gold-dim)", borderRadius: 4, padding: "1px 6px", marginRight: 8 }}>
      {label}
    </span>
  );
}

function LedgerCard({ k }: { k: string }) {
  const f = fact(k);
  return (
    <div style={CARD}>
      <div style={{ color: "var(--ice)", fontSize: 16, lineHeight: 1.6 }}>{f.text}</div>
      <div style={{ ...SMALL, marginTop: 10 }}>
        <Tag label={f.label} />
        Method: {f.method}. Number ledger as of {FACTS_AS_OF}.
      </div>
    </div>
  );
}

type Fig = { id: string; big: string; text: string; label: string; source: string; date: string };
function FigureCard({ f }: { f: Fig }) {
  return (
    <div style={CARD}>
      <div style={{ color: "var(--gold)", fontSize: 26, fontWeight: 700 }}>{f.big}</div>
      <div style={{ color: "var(--ice)", fontSize: 15, lineHeight: 1.6, marginTop: 4 }}>{f.text}</div>
      <div style={{ ...SMALL, marginTop: 10 }}>
        <Tag label={f.label} />
        {f.source}, {f.date}.
      </div>
    </div>
  );
}

function Paras({ items }: { items: string[] }) {
  return (
    <>
      {items.map((p) => (
        <p key={p} style={BODY}>{p}</p>
      ))}
    </>
  );
}

export default function TitanosCaseStudy() {
  return (
    <main>
      <PageHero badge={`Case study · ${T.sector}`} title={T.title} sub={T.teaser} />
      <section style={SECTION}>
        <div style={WRAP}>
          <h2 style={{ ...H, marginTop: 0 }}>{T.world.heading}</h2>
          <Paras items={T.world.paragraphs} />

          <h2 style={H}>{T.concerns.heading}</h2>
          <div style={GRID}>
            {T.concerns.items.map(([q, a]) => (
              <div key={q} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{q}</div>
                <div style={{ color: "var(--ice)", fontSize: 15, lineHeight: 1.6 }}>{a}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>{T.big.heading}</h2>
          <div style={{ ...CARD, borderColor: "var(--gold-dim)" }}>
            <div style={{ color: "var(--gold)", fontSize: 34, fontWeight: 700 }}>{int("estate_sloc")} lines</div>
            <div style={{ color: "var(--ice)", fontSize: 16, lineHeight: 1.6 }}>
              of production code across {int("estate_repos")} repositories, as of {AS_OF_LONG}.
            </div>
            <div style={{ ...SMALL, marginTop: 8 }}>
              <Tag label={LEDGER.estate_sloc.label} />
              {LEDGER.estate_sloc.method}.
            </div>
          </div>
          <p style={{ ...BODY, marginTop: 14 }}>
            To feel the size: at the industry-standard COCOMO rate, that much code is the output of {TEAM_LINE}. It was built in {ELAPSED_LINE}.
          </p>
          <p style={SMALL}>
            <Tag label={T.big.analogy_label} />
            {T.big.analogy_source}. The team and schedule are estimates, not payroll records.
          </p>
          <div style={{ ...GRID, marginTop: 14 }}>
            {T.big.more_ledger.map((k) => (
              <LedgerCard key={k} k={k} />
            ))}
          </div>

          <h2 style={H}>{T.gold.heading}</h2>
          <Paras items={T.gold.paragraphs} />
          <div style={GRID}>
            {T.gold.figures.map((f) => (
              <FigureCard key={f.id} f={f} />
            ))}
          </div>

          <h2 style={H}>{T.receipts.heading}</h2>
          <div style={GRID}>
            {T.receipts.ledger.map((k) => (
              <LedgerCard key={k} k={k} />
            ))}
            <div style={CARD}>
              <div style={{ color: "var(--gold)", fontSize: 26, fontWeight: 700 }}>{int("suites_now")} suites</div>
              <div style={{ color: "var(--ice)", fontSize: 15, lineHeight: 1.6, marginTop: 4 }}>
                of automated safety checks on the control layer. Nothing is released unless they pass.
              </div>
              <div style={{ ...SMALL, marginTop: 10 }}>
                <Tag label={LEDGER.suites_now.label} />
                Control layer verification run, {AS_OF_LONG}.
              </div>
            </div>
            {T.receipts.figures.map((f) => (
              <FigureCard key={f.id} f={f} />
            ))}
          </div>

          <h2 style={H}>{T.wrong.heading}</h2>
          <Paras items={T.wrong.paragraphs} />
          <p style={SMALL}>
            <Tag label={T.wrong.label} />
            {T.wrong.source}.
          </p>

          <h2 style={H}>{T.unproven.heading}</h2>
          <Paras items={T.unproven.paragraphs} />
          <p style={SMALL}>
            <Tag label={T.unproven.label} />
            {T.unproven.source}. The 336 times ceiling itself is MODELLED.
          </p>

          <h2 style={H}>{T.free.heading}</h2>
          <Paras items={T.free.paragraphs} />
          <p style={BODY}>
            {T.free.links.map(([l, h], i) => (
              <span key={h}>
                {i > 0 ? " · " : ""}
                <a href={h} style={{ color: "var(--gold)" }}>{l}</a>
              </span>
            ))}
          </p>

          <h2 style={H}>{T.close.heading}</h2>
          <Paras items={T.close.paragraphs} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 }}>
            <AnimatedButton href={T.close.cta[1]}>{T.close.cta[0]}</AnimatedButton>
            <AnimatedButton href={T.close.cta_secondary[1]} variant="secondary">{T.close.cta_secondary[0]}</AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
