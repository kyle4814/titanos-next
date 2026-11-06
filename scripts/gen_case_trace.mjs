// Freezes lib/case-studies/trace.json `fields` from the live case-study text: every figure-bearing field, the figures in it, and
// the source ids chosen by the manifest's `rules` (first regex that matches the field key wins). Run with --write to update,
// --check to fail when the file is stale. The test recomputes figures itself, so a hand edit of `fields` cannot hide a figure.
import { readFileSync, writeFileSync } from "node:fs";
import { allFields, figures } from "./case_trace_lib.mjs";

const root = new URL("..", import.meta.url).pathname;
const path = root + "lib/case-studies/trace.json";
const man = JSON.parse(readFileSync(path, "utf8"));
const fields = {};
const unruled = [];
for (const [key, text] of Object.entries(allFields(root))) {
  const figs = figures(text);
  if (!figs.length) continue;
  const rule = (man.rules || []).find((r) => new RegExp(r.match).test(key));
  if (!rule) unruled.push(key);
  fields[key] = { figs, src: rule ? rule.src : [] };
}
man.fields = fields;
const out = JSON.stringify(man, null, 2) + "\n";
if (process.argv.includes("--write")) {
  writeFileSync(path, out);
  console.log(`wrote ${Object.keys(fields).length} fields; ${unruled.length} without a rule`);
  for (const k of unruled) console.log("  NO RULE " + k);
} else {
  const same = readFileSync(path, "utf8") === out;
  console.log(same ? "case-study trace manifest is current" : "case-study trace manifest is STALE: run node scripts/gen_case_trace.mjs --write");
  process.exit(same ? 0 : 1);
}
