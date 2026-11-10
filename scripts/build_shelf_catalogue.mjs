// C5 build step (f305 + f312 + f316 + f317): stored graded runs -> runCatalogueBuild (promote, RETRACT, cap, assert) -> shelf_catalogue.json + retractions.json.
// Usage: node --experimental-strip-types scripts/build_shelf_catalogue.mjs [--source memory | --source file:<path>] [--out <path>]
//        [--now <iso>] [--max-age-days <n>] [--max-retract-fraction <0..1>] [--active-clusters a,b,c] [--allow-empty-shelf]
//   file:<path> is JSON {"records":[StoredGraded...],"expect":[ids]} (the graded run store) or the f305 drained batch {"shelves":[...],"runs":{...},"graded_at":{id:iso}}.
//   Retraction is ALWAYS on: runCatalogueBuild owns the policy, maxAgeDays defaults to DEFAULT_MAX_AGE_DAYS (lib/shop/catalogue_build_entry.ts), there is no flag to turn it off.
//   retractions.json is written NEXT TO the catalogue (same directory as --out), via tmp+rename, retractions first.
// Exit 0 = written. 1 = ungraded/held-integrity shelf or assert throw. 2 = retraction cap tripped. 3 = a retraction would empty a live shelf without --allow-empty-shelf.
// On any non-zero exit NOTHING is written. No model call, no network, no deploy. Applying to live D1 is GATE5 (CARD NEEDED).
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCatalogueBuild, exitCodeFor, StaticGradedStore, storedFromDrainedBatch, DEFAULT_MAX_AGE_DAYS } from "../lib/shop/catalogue_build_entry.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt; };
const flag = (name) => args.includes(name);
const die = (m, code = 1) => { console.error("BUILD FAILED: " + m); process.exit(code); };
const source = opt("--source", "memory");
const out = resolve(opt("--out", join(root, "lib/shop/shelf_catalogue.json")));
const now = opt("--now", new Date().toISOString());
const num = (name) => { const v = opt(name, undefined); if (v === undefined) return undefined; const n = Number(v); if (!Number.isFinite(n)) die(name + " is not a number: " + v); return n; };
let maxAgeDays, maxRetractFraction;
try { maxAgeDays = num("--max-age-days"); maxRetractFraction = num("--max-retract-fraction"); } catch (e) { die(e.message); }
const activeClusterIds = opt("--active-clusters", undefined)?.split(",").filter(Boolean);

let rows = [], expectIds = [], missing = [];
if (source === "memory") { /* empty store */ }
else if (source.startsWith("file:")) {
  let batch;
  try { batch = JSON.parse(readFileSync(source.slice(5), "utf8")); } catch (e) { die("cannot read source: " + e.message); }
  if (Array.isArray(batch.records)) { rows = batch.records; expectIds = batch.expect ?? []; }
  else { const c = storedFromDrainedBatch({ shelves: batch.shelves ?? [], runs: batch.runs ?? {}, graded_at: batch.graded_at }, now); rows = c.rows; missing = c.missing; expectIds = (batch.shelves ?? []).map((s) => s.cluster_id); }
} else die("unknown --source " + source);

let base = { entries: [] };
if (existsSync(out)) { try { base = JSON.parse(readFileSync(out, "utf8")); } catch (e) { die("existing catalogue unreadable: " + e.message); } }

let outcome;
try { outcome = await runCatalogueBuild(new StaticGradedStore(rows), { now, base, expectIds, maxAgeDays, maxRetractFraction, activeClusterIds, allowEmptyShelf: flag("--allow-empty-shelf") }); }
catch (e) { die(e.message); }
if (!outcome.ok) {
  for (const o of outcome.offenders) console.error(`OFFENDER ${o.cluster_id}: ${o.reason}`);
  console.error(`BUILD FAILED (${outcome.kind}): ${outcome.message}`);
  process.exit(exitCodeFor(outcome));
}
mkdirSync(dirname(out), { recursive: true });
const side = join(dirname(out), "retractions.json");
for (const [path, text] of [[side, outcome.files["retractions.json"]], [out, outcome.files["shelf_catalogue.json"]]]) { writeFileSync(path + ".tmp", text); renameSync(path + ".tmp", path); }
const r = outcome.result;
for (const h of r.held) console.log(`HELD ${h.cluster_id}: ${h.reason}`);
for (const x of r.retractions) console.log(`RETRACTED ${x.id}: ${x.reason} (${x.detail})`);
console.log(`BUILD OK: ${r.catalogue.entries.length} shelves live (${r.published.length} new, ${r.retractions.length} retracted, maxAgeDays ${maxAgeDays ?? DEFAULT_MAX_AGE_DAYS}) -> ${out} + ${side}`);
