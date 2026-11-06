// Measures the shelf pipeline on 1,000 SYNTHETIC configs + 20 malformed. Test-only; reads/writes nothing in the repo.
// Usage: /usr/bin/time -v node scripts/measure_shelf1000.mjs   (peak RSS also reported by the process itself)
import { makeSynthetic, makeMalformed } from "./gen_synthetic_shelf_configs.mjs";
import { loadConfigs } from "../lib/shop/loader.ts";
import { shelfFromConfig } from "../lib/shop/catalogue.ts";
import { gradeAll, visibleShelves } from "../lib/shop/grader.ts";

const valid = makeSynthetic(1000), bad = makeMalformed(valid);
const raw = [...valid, ...bad.map((b) => b.cfg)];
const t0 = performance.now();
const loaded = loadConfigs(JSON.parse(JSON.stringify(raw))); // round-trip through JSON like the real file
const t1 = performance.now();
const graded = gradeAll(loaded.accepted.map(shelfFromConfig));
const t2 = performance.now();
const ungraded = graded.filter((s) => !s.grade || s.grade.checks.length === 0).length;
const shownAsIs = visibleShelves(graded).length; // synthetic: must be 0
// Scale proof only: the same configs flipped to synthetic:false IN MEMORY (never written) show 1000 through the same grader.
const asReal = gradeAll(loaded.accepted.map((c) => shelfFromConfig({ ...c, synthetic: false })));
const shownIfReal = visibleShelves(asReal).length;
const expectOk = bad.every((b, i) => { const r = loaded.rejected.find((x) => x.index === 1000 + i); return r && r.reasons.some((s) => s.includes(b.expect)); });
const silent = raw.length - loaded.accepted.length - loaded.rejected.length;
const r = {
  label: "SYNTHETIC test data, never public", raw_entries: raw.length, loaded: loaded.accepted.length, rejected: loaded.rejected.length,
  rejected_all_with_expected_reason: expectOk, silently_dropped: silent, graded: graded.length, ungraded,
  shown_as_synthetic: shownAsIs, shown_if_flagged_real_in_memory: shownIfReal,
  load_ms: +(t1 - t0).toFixed(1), grade_ms: +(t2 - t1).toFixed(1), peak_rss_mb: +(process.resourceUsage().maxRSS / 1024).toFixed(1),
};
console.log(JSON.stringify(r, null, 1));
const ok = r.loaded === 1000 && r.rejected === 20 && expectOk && silent === 0 && ungraded === 0 && shownAsIs === 0 && shownIfReal === 1000;
console.log(ok ? "MEASURE OK" : "MEASURE FAILED");
process.exit(ok ? 0 : 1);
