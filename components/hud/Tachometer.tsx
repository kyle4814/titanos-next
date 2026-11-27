import { NUM } from "@/lib/hud/data";

// 2026-11-27 (site truth pass): the dial used to show a vendor-multiple "ceiling" (336x) that is an internal model, not a result.
// The public panel now shows only the measured jobs-per-day multiple, dated. The modelled ceiling stays in lib/hud/numbers.json
// (internal) and is not rendered.
const DAY = NUM.ledger_as_of.slice(0, 10);
const LONG = new Date(`${DAY}T00:00:00+10:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane" });

export default function Tachometer() {
  return (
    <figure className="hud-panel" aria-label={`Realised output ${NUM.needle.realised} times, measured jobs per day`} style={{ margin: 0 }}>
      <div className="hud-label">Realised output <span className="hud-tag">MEASURED</span></div>
      <div className="hud-big hud-big-gold" style={{ textAlign: "center", margin: "12px 0 4px" }}>{NUM.needle.realised}x</div>
      <figcaption style={{ textAlign: "center", marginTop: 6 }}>
        <p className="hud-note" style={{ margin: "6px 0 0" }}>
          Jobs finished per day, measured from our own job log: 184 to 548, as of {LONG}. This is a count of finished jobs, not revenue, and it is not a forecast.
        </p>
      </figcaption>
    </figure>
  );
}
