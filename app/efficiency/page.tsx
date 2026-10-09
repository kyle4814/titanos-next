import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { withSeo } from "@/lib/seo";
import data from "@/lib/efficiency/efficiency.json";
import { LEDGER, AS_OF_LONG } from "@/lib/ledger";

const META_TITLE = "Efficiency, measured | TITANOS";
const META_DESC =
  "Every efficiency figure from our own machine and AI workers, before and after, each with its method, date and a MEASURED or MODELLED label.";

export const metadata: Metadata = withSeo("/efficiency", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/efficiency" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/efficiency" },
  robots: { index: true, follow: true },
});

type Val = number | string | null;
type Metric = {
  id: string;
  group: string;
  label: string;
  before: Val;
  after: Val;
  prefix: string;
  suffix: string;
  status: string;
  date: string;
  method: string;
  source: string;
  saved?: number;
  dp?: number;
  note?: string;
};

const METRICS = data.metrics as Metric[];
const BY_ID = new Map(METRICS.map((m) => [m.id, m]));
const GROUPS = Array.from(new Set(METRICS.map((m) => m.group)));

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 980, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 22, margin: "40px 0 10px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "16px 18px",
};
const CELL: CSSProperties = { padding: "10px 8px", borderBottom: "1px solid var(--border)", color: "var(--ice)", fontSize: 15, verticalAlign: "top" };
const MUTED: CSSProperties = { color: "var(--ice)", opacity: 0.7, fontSize: 13, lineHeight: 1.5 };

function fmtNum(m: Metric, n: number): string {
  const s = n.toLocaleString("en-AU", { maximumFractionDigits: m.dp ?? 2 });
  return `${m.prefix}${s}${m.suffix}`;
}

function fmt(m: Metric, v: Val): string {
  if (v === null || v === undefined) return "measuring";
  return typeof v === "number" ? fmtNum(m, v) : v;
}

// Derived, never stored: percent change and the factor between before and after.
function change(m: Metric): { pct: string | null; factor: number | null } {
  if (m.saved !== undefined && (m.before === null || m.after === null)) {
    return { pct: `saves ${fmtNum(m, m.saved)}`, factor: null };
  }
  if (typeof m.before !== "number" || typeof m.after !== "number" || m.before === 0) return { pct: null, factor: null };
  const p = ((m.after - m.before) / m.before) * 100;
  const pct = `${p > 0 ? "+" : ""}${p.toFixed(Math.abs(p) < 10 ? 1 : 0)}%`;
  const factor = m.after > 0 ? m.before / m.after : null;
  return { pct, factor };
}

function factorText(f: number): string {
  return f >= 10 ? f.toFixed(0) : f.toFixed(1);
}

function Badge({ status }: { status: string }) {
  const measured = status === "MEASURED";
  return (
    <span
      style={{
        fontSize: 12,
        letterSpacing: 1,
        padding: "2px 7px",
        borderRadius: 4,
        border: "1px solid var(--border)",
        color: measured ? "var(--gold)" : "var(--ice)",
        opacity: measured ? 1 : 0.8,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function Cell({ m, v }: { m: Metric; v: Val }) {
  const pending = v === null || v === undefined;
  return <span style={pending ? { opacity: 0.55, fontStyle: "italic" } : undefined}>{fmt(m, v)}</span>;
}

export default function Efficiency() {
  const head = BY_ID.get(data.headline.metric);
  const headFactor = head ? change(head).factor : null;
  const headTitle = data.headline.title.replace("{factor}", headFactor ? factorText(headFactor) : "many");
  const inCount = METRICS.filter((m) => m.before !== null || m.after !== null || m.saved !== undefined).length;
  const complete = METRICS.filter((m) => m.before !== null && m.after !== null).length;

  return (
    <main>
      <PageHero
        badge="Efficiency, measured"
        title={headTitle}
        tagline={data.headline.analogy}
        sub={`${data.headline.caption} Updated ${data.updated}.`}
      />
      <section style={SECTION}>
        <div style={WRAP}>
          <p style={BODY}>{data.intro}</p>
          <p style={MUTED}>
            {complete} figures have both a before and an after, {inCount} have at least one side filed, {METRICS.length} are tracked. Round {data.round}.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: "22px 0" }}>
            {data.highlights.map((id) => {
              const m = BY_ID.get(id);
              if (!m) return null;
              const c = change(m);
              return (
                <div key={id} style={CARD}>
                  <div style={{ color: "var(--gold)", fontSize: 28, fontWeight: 700 }}>
                    {c.factor ? `${factorText(c.factor)}x` : (c.pct ?? "measuring")}
                  </div>
                  <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.5 }}>{m.label}</div>
                  <div style={MUTED}>
                    {fmt(m, m.before)} to {fmt(m, m.after)}
                    {c.pct && c.factor ? ` (${c.pct})` : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <h2 style={H}>Before and after, every vector</h2>
          {GROUPS.map((g) => (
            <div key={g} style={{ marginBottom: 22 }}>
              <h3 style={{ color: "var(--ice)", fontSize: 17, margin: "18px 0 6px" }}>{g}</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr>
                      {["Figure", "Before", "After", "Change", "Label"].map((h) => (
                        <th key={h} style={{ ...CELL, color: "var(--gold)", textAlign: "left" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.filter((m) => m.group === g).map((m) => {
                      const c = change(m);
                      return (
                        <tr key={m.id} id={m.id}>
                          <td style={CELL}>
                            {m.label}
                            {m.note ? <div style={MUTED}>{m.note}</div> : null}
                          </td>
                          <td style={CELL}>
                            <Cell m={m} v={m.before} />
                          </td>
                          <td style={CELL}>
                            <Cell m={m} v={m.after} />
                          </td>
                          <td style={CELL}>
                            {c.pct ?? "measuring"}
                            {c.factor && c.factor >= 1.5 ? <div style={MUTED}>{factorText(c.factor)}x</div> : null}
                          </td>
                          <td style={CELL}>
                            <Badge status={m.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <h2 style={H}>How each figure was taken</h2>
          <p style={BODY}>
            MEASURED means read from a dated record or a timed run. MODELLED means real measured quantities repriced under a stated
            scenario, which is a what-if and never a result. Where a before or after is not in yet, the table says measuring.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {METRICS.map((m) => (
              <div key={m.id} style={CARD}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ color: "var(--ice)", fontSize: 15 }}>{m.label}</strong>
                  <Badge status={m.status} />
                  <span style={MUTED}>{m.date}</span>
                </div>
                <p style={{ ...MUTED, margin: "6px 0 2px" }}>How: {m.method}</p>
                <p style={{ ...MUTED, margin: 0 }}>Source: {m.source}</p>
              </div>
            ))}
          </div>

          <h2 style={H}>Timeline</h2>
          <div style={{ borderLeft: "2px solid var(--gold)", paddingLeft: 16, display: "grid", gap: 14 }}>
            {data.timeline.map((t) => (
              <div key={t.time + t.text}>
                <div style={{ color: "var(--gold)", fontSize: 14 }}>{t.time}</div>
                <div style={{ color: "var(--ice)", fontSize: 15, lineHeight: 1.6 }}>{t.text}</div>
                <div style={MUTED}>Source: {t.source}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>Hardening</h2>
          <p style={BODY}>Speed means nothing if it breaks things. These are the counts of the checks that stand behind the figures above.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {data.hardening.map((raw) => {
              const h = raw.label.startsWith("Tests passing")
                ? { ...raw, label: "Test cases in the main codebase", value: LEDGER.tests_main.value, source: LEDGER.tests_main.source, method: `${LEDGER.tests_main.method}, ${AS_OF_LONG}. ${LEDGER.suites_now.value} automated safety suites guard the control layer.` }
                : raw;
              return (
              <div key={h.label} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 28, fontWeight: 700, ...(h.value === null ? { opacity: 0.55, fontStyle: "italic", fontSize: 20 } : {}) }}>
                  {h.value === null ? "measuring" : h.value.toLocaleString("en-AU")}
                </div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.5 }}>{h.label}</div>
                <div style={MUTED}>{h.method}</div>
                <div style={MUTED}>Source: {h.source}</div>
              </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 36 }}>
            <AnimatedButton href="/speed" variant="primary">
              See the speed page →
            </AnimatedButton>
            <AnimatedButton href="/proof" variant="secondary">
              See the proof →
            </AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
