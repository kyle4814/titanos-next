// C9 figure freshness FORECAST (f395). The figure_freshness gate goes red on a date nobody chose: a figure is STALE once it is
// more than 30 days old, so a figure dated D turns STALE on D + 31 days (day 30 is FRESH, day 31 is STALE, same rule as
// scripts/figure_freshness.mjs, which this imports so the two can never disagree). This lists every dated figure and the exact
// day it turns STALE, so the turn-red is predicted, not discovered. It never raises a cap, never moves a date, and changes no file.
//
// Usage: node scripts/figure_freshness_forecast.mjs [--today YYYY-MM-DD] [--within N] [--json] [--quiet]
//                                                  [--root DIR] [--receipts DIR]
//   --today   the day to forecast from (default: the real date). A fixed date makes the output reproducible.
//   --within  exit 1 when any figure that is still FRESH on --today turns STALE within N days (1..N days ahead). N=0 never fires.
//   --quiet   summary by turn date only, no per-figure lines.
// Exit: 0 nothing turns STALE inside the window (or no --within), 1 something does, 2 usage error.
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scan, parseIsoDay, STALE_DAYS } from "./figure_freshness.mjs";

const DAY_MS = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

/** The first day the figure counts as STALE: date + STALE_DAYS + 1. Null when the date is not a real ISO day. */
export function staleOn(dateStr) {
  const t = parseIsoDay(dateStr);
  return t === null ? null : iso(t + (STALE_DAYS + 1) * DAY_MS);
}

/** Pure forecast over figure records ({file,id,system,date,...}); `today` is an ISO day. */
export function forecast(figures, today) {
  const t0 = parseIsoDay(today);
  if (t0 === null) throw new Error(`--today is not a real ISO date: ${JSON.stringify(today)}`);
  const rows = [];
  const undated = [];
  for (const f of figures) {
    const on = staleOn(f.date);
    if (on === null) { undated.push({ file: f.file, id: f.id, date: f.date ?? null }); continue; }
    const days = Math.round((parseIsoDay(on) - t0) / DAY_MS); // > 0: still fresh today, turns STALE in `days`; <= 0: already STALE
    rows.push({ file: f.file, id: f.id, system: f.system ?? null, date: f.date, staleOn: on, daysUntil: days, status: days > 0 ? "FRESH" : "STALE" });
  }
  rows.sort((a, b) => a.staleOn.localeCompare(b.staleOn) || a.file.localeCompare(b.file) || String(a.id).localeCompare(String(b.id)));
  return { today, staleDays: STALE_DAYS, rows, undated };
}

/** Figures still FRESH on `today` that turn STALE within N days (1..N ahead). */
export const within = (fc, n) => fc.rows.filter((r) => r.status === "FRESH" && r.daysUntil <= n);

function main(argv) {
  const opt = { root: join(dirname(fileURLToPath(import.meta.url)), ".."), receipts: null, today: new Date().toISOString().slice(0, 10), within: null, json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--today") opt.today = argv[++i];
    else if (a === "--within") { const s = argv[++i]; if (!/^\d+$/.test(s ?? "")) { console.error(`--within needs a whole number of days, got ${JSON.stringify(s)}`); return 2; } opt.within = +s; }
    else if (a === "--root") opt.root = argv[++i];
    else if (a === "--receipts") opt.receipts = argv[++i];
    else if (a === "--json") opt.json = true;
    else if (a === "--quiet") opt.quiet = true;
    else { console.error(`unknown argument ${a}`); return 2; }
  }
  if (parseIsoDay(opt.today) === null) { console.error(`--today is not a real ISO date: ${JSON.stringify(opt.today)}`); return 2; }
  if (opt.receipts && !(existsSync(opt.receipts) && statSync(opt.receipts).isDirectory())) { console.error(`--receipts is not a folder: ${opt.receipts}`); return 2; }
  let r;
  try { r = scan({ root: opt.root, receipts: opt.receipts, asOf: opt.today, allowlist: null, kernel: null }); } catch (e) { console.error(e.message); return 2; }
  const fc = forecast(r.figures, opt.today);
  const hits = opt.within === null ? [] : within(fc, opt.within);
  const exit = hits.length ? 1 : 0;
  if (opt.json) { console.log(JSON.stringify({ ...fc, within: opt.within, hits, exitCode: exit }, null, 1)); return exit; }

  const stale = fc.rows.filter((x) => x.status === "STALE"), fresh = fc.rows.filter((x) => x.status === "FRESH");
  console.log(`figure_freshness_forecast from ${fc.today} (a figure is STALE from date + ${STALE_DAYS + 1} days; day ${STALE_DAYS} is FRESH)`);
  console.log(`figures with a date ${fc.rows.length}: already STALE ${stale.length}, FRESH today ${fresh.length}, undated ${fc.undated.length}`);
  const byDay = new Map();
  for (const x of fresh) byDay.set(x.staleOn, (byDay.get(x.staleOn) || 0) + 1);
  for (const [d, n] of byDay) console.log(`TURNS STALE ${d} (in ${Math.round((parseIsoDay(d) - parseIsoDay(fc.today)) / DAY_MS)} day(s)): ${n} figure(s)`);
  if (!opt.quiet) {
    for (const x of fresh) console.log(`WILL TURN STALE ${x.staleOn} (in ${x.daysUntil}d) ${x.file}#${x.id} dated ${x.date}`);
    for (const x of stale) console.log(`ALREADY STALE since ${x.staleOn} ${x.file}#${x.id} dated ${x.date}`);
    for (const u of fc.undated) console.log(`UNDATED ${u.file}#${u.id}`);
  }
  if (opt.within !== null) console.log(hits.length ? `FAIL ${hits.length} figure(s) turn STALE within ${opt.within} day(s) of ${fc.today} (first: ${hits[0].staleOn})` : `PASS no FRESH figure turns STALE within ${opt.within} day(s) of ${fc.today}`);
  return exit;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
