import { NUM } from "@/lib/hud/data";

const mult = (id: string) => NUM.facts[id].text.match(/\d+(?:\.\d+)?x/)?.[0] ?? "";
const r = NUM.rows;

const TILES = [
  { k: "Compute capacity", v: mult("capacity"), s: "two accounts at 20x usage each", t: NUM.facts.capacity.label },
  { k: "Cost per job", v: `${mult("cost_job")} cheaper`, s: "25 matched jobs, before and after", t: NUM.facts.cost_job.label },
  { k: "Worker start", v: `${mult("tokens")} leaner`, s: "29,000 tokens of context instead of 215,000", t: NUM.facts.tokens.label },
  { k: "Fleet jobs, 24 h", v: String(r.fleet_jobs_24h.value), s: `${r.fleet_worker_hours_24h?.value ?? ""} worker-hours`, t: r.fleet_jobs_24h.label },
  { k: "Failure rate, 24 h", v: `${r.fleet_fail_rate_24h.value}%`, s: "failed or stuck of all finished", t: r.fleet_fail_rate_24h.label },
  { k: "Safety suites", v: String(r.gate_suites.value), s: "automated suites in the last green gate", t: r.gate_suites.label },
];

export default function ComputePanel() {
  return (
    <section className="hud-panel" aria-label="Compute panel">
      <div className="hud-label">Compute panel</div>
      <div className="hud-tiles">
        {TILES.map((t) => (
          <div key={t.k} className="hud-tile">
            <div className="hud-tile-k">{t.k}</div>
            <div className="hud-tile-v">{t.v}</div>
            <div className="hud-tile-s">{t.s}</div>
            <span className={`hud-tag ${t.t === "MEASURED" ? "hud-tag-ok" : ""}`}>{t.t}</span>
          </div>
        ))}
      </div>
      <p className="hud-note">Capacity is the vendor&apos;s published usage multiple, so it is modelled. Cost per job, worker start, fleet jobs, failure rate and suites are measured on our own systems. Fleet figures cover the 24 hours before the snapshot.</p>
    </section>
  );
}
