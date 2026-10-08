import { proof } from "@/lib/site-data/proofLive";
import SectionReveal from "@/components/SectionReveal";
import InView from "./InView";
import "./charts.css";

const LINE_H = 40;
type Chart = (typeof proof.charts)[number];

function Bars({ c, big = false }: { c: Pick<Chart, "beforeText" | "afterText" | "beforePct" | "afterPct">; big?: boolean }) {
  return (
    <div className={big ? "w4-bars w4-bars--big" : "w4-bars"}>
      {big && (
        <svg className="w4-line" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline className="w4-draw" pathLength={1} points={[[0, LINE_H - c.beforePct * LINE_H / 100], [100, LINE_H - c.afterPct * LINE_H / 100]].map((q) => q.join(",")).join(" ")} />
        </svg>
      )}
      <div className="w4-bar-row">
        <span className="w4-bar-name">Before</span>
        <span className="w4-bar-track"><span className="w4-bar w4-bar--before" style={{ ["--w" as string]: `${c.beforePct}%` }} /></span>
        <span className="w4-bar-val" data-count>{c.beforeText}</span>
      </div>
      <div className="w4-bar-row">
        <span className="w4-bar-name">Now</span>
        <span className="w4-bar-track"><span className="w4-bar w4-bar--after" style={{ ["--w" as string]: `${c.afterPct}%` }} /></span>
        <span className="w4-bar-val" data-count>{c.afterText}</span>
      </div>
    </div>
  );
}

function Card({ c }: { c: Chart }) {
  return (
    <article className="w4-card" data-phi-reveal data-w4-chart={c.id}>
      <h3>{c.title}</h3>
      <Bars c={c} />
      <p className="w4-factor" data-better={c.improved ? "yes" : "no"}>{c.factorText}</p>
      <p className="w4-meta">
        <span className="w4-chip" data-label={c.label}>{c.label}</span> {c.date} · {c.source}
      </p>
      <details className="w4-method">
        <summary>How this was measured</summary>
        <p>{c.method}</p>
      </details>
    </article>
  );
}

export default function CostCurve() {
  const h = proof.headline;
  const f = proof.fleetCost;
  return (
    <SectionReveal id="cost-curve" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
      <InView className="w4-wrap" >
        <p className="w4-eyebrow">THE COST CURVE</p>
        <h2 className="w4-h2">We did not buy a bigger machine. We changed the system.</h2>

        <div className="w4-hero-chart" data-phi-reveal data-w4-chart={h.id}>
          <p className="w4-hero-title">{h.titleText}</p>
          <Bars c={h} big />
          <p className="w4-factor w4-factor--big" data-count>{h.factorText}</p>
          <p className="w4-note">{h.analogy}</p>
          <p className="w4-meta">
            <span className="w4-chip" data-label={h.label}>{h.label}</span> {h.date} · {h.caption} · {h.source}
          </p>
        </div>

        <aside className="w4-second-look" data-phi-reveal data-w4-chart="fleet_cost">
          <h3>The honest second look</h3>
          <p>
            Across the whole fleet, including the orchestrator, one job cost {f.afterText} over {f.jobsText} jobs, against {f.beforeText} before.
            That is higher, not lower, and {f.todayText} was spent in the day. The matched-job drop above compares the same task text on the old
            and new rule book. Both are real. We show both.
          </p>
          <p className="w4-meta">
            <span className="w4-chip" data-label={f.label}>{f.label}</span> {f.date} · {f.source} · {f.note}
          </p>
        </aside>

        <div className="w4-grid">
          {proof.charts.map((c) => (
            <Card key={c.id} c={c} />
          ))}
        </div>
        <p className="w4-note">Every bar is drawn from one data file generated from our own measurements. No figure on this page is typed by hand.</p>
      </InView>
      <span data-w4-end="cost-curve" hidden />
    </SectionReveal>
  );
}
