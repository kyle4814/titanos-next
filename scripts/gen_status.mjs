// Builds public/data/status.json from lib/site-data/status-sample.json (synthetic, labelled) plus, when present, monitor
// output (jsonl lines {component, at, ok}) passed as --monitor <file> or STATUS_MONITOR_FILE. `--check` fails if the committed
// file differs from a fresh build (evaluated at the committed generatedAt, so it is deterministic).
// Rules: no samples = UNKNOWN ("no data yet"); a percentage exists only with a denominator; data older than 24h is STALE and
// is never shown as UP.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
export const STALE_MS = 24 * 3600 * 1000;

export function buildStatus(sample, monitorLines, now) {
  const comps = sample.components.map((c) => ({ ...c }));
  const monitorUsed = monitorLines && monitorLines.length > 0;
  if (monitorUsed) {
    for (const c of comps) {
      const rows = monitorLines.filter((l) => l.component === c.id && Number.isFinite(Date.parse(l.at)));
      if (!rows.length) continue;
      rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      c.total = rows.length; c.up = rows.filter((r) => r.ok === true).length;
      c.lastChecked = rows[rows.length - 1].at; c.lastResult = rows[rows.length - 1].ok ? "UP" : "DOWN";
    }
  }
  const out = comps.map((c) => {
    const hasData = c.total > 0 && c.lastChecked && (c.lastResult === "UP" || c.lastResult === "DOWN");
    const stale = hasData ? now - Date.parse(c.lastChecked) > STALE_MS : false;
    const state = !hasData ? "UNKNOWN" : stale ? "UNKNOWN" : c.lastResult;
    return {
      id: c.id, name: c.name, measures: c.measures, state, stale,
      lastKnown: hasData && stale ? c.lastResult : null,
      window: sample.window, up: hasData ? c.up : 0, total: hasData ? c.total : 0,
      pct: hasData ? Math.round((c.up / c.total) * 1000) / 10 : null,
      lastChecked: hasData ? c.lastChecked : null,
      note: hasData ? (stale ? "STALE: last check is more than 24 hours old" : "") : "no data yet",
    };
  });
  return {
    dataset: "Status", synthetic: monitorUsed ? false : !!sample.synthetic, generatedAt: new Date(now).toISOString(),
    system: monitorUsed ? "TITANOS monitor output (jsonl) merged over the sample layout" : sample.system,
    window: sample.window,
    monitorInput: monitorUsed ? { present: true, rows: monitorLines.length } : { present: false, reason: "no monitor output supplied; the f14 C3 monitor branch logs scan runs only and writes no uptime samples" },
    staleAfterHours: 24, components: out,
  };
}

function readMonitor(path) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv, mi = a.indexOf("--monitor");
  const mon = readMonitor(mi > 0 ? a[mi + 1] : process.env.STATUS_MONITOR_FILE);
  const sample = JSON.parse(readFileSync(new URL("lib/site-data/status-sample.json", root), "utf8"));
  const target = new URL("public/data/status.json", root);
  if (a.includes("--check")) {
    const cur = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
    const fresh = cur && JSON.stringify(buildStatus(sample, mon, Date.parse(cur.generatedAt)), null, 1) + "\n";
    if (!cur || readFileSync(target, "utf8") !== fresh) { console.log("STALE public/data/status.json"); process.exit(1); }
    process.exit(0);
  }
  const ni = a.indexOf("--now");
  const now = ni > 0 ? Date.parse(a[ni + 1]) : Date.now();
  mkdirSync(new URL("public/data/", root), { recursive: true });
  writeFileSync(target, JSON.stringify(buildStatus(sample, mon, now), null, 1) + "\n");
  console.log("wrote public/data/status.json");
}
