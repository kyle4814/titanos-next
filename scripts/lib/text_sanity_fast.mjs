// C9 FAST text-sanity gate (f384): pure checks + runner. The full sweep (audit_text_sanity.mjs) takes ~6 min; this sweeps a fixed sample.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { sweep, listRoutes } from "./text_sanity.mjs";
import { loadAllowlist, lintAllowlist, evaluate } from "../text_sanity_classify.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(here, "..");
export const FAST_BUDGET_S = 60; // target on a quiet box; a slower run only warns
export const FAST_HARD_S = 150; // a hang or runaway fails the gate (the box runs at load 20-45 on 8 cores, so wall time alone must not flake it)
export const loadSample = (p = path.join(SCRIPTS, "text_sanity_sample.json")) => JSON.parse(fs.readFileSync(p, "utf8")).routes;
export const loadRatchet = (p = path.join(SCRIPTS, "text_sanity_cap_ratchet.json")) => JSON.parse(fs.readFileSync(p, "utf8")).caps;

/** Family of a route: "root", its first segment when 2+ routes share it, else "top" (the single top-level pages). */
export function familyMap(routes) {
  const seg = (r) => r.split("/")[1] || "";
  const n = {}; for (const r of routes) n[seg(r)] = (n[seg(r)] || 0) + 1;
  const m = {}; for (const r of routes) { const s = seg(r); m[r] = s === "" ? "root" : n[s] >= 2 ? s : "top"; }
  return m;
}

/** Problems with the sample against the export's route list: unknown routes, uncovered families, uncovered followup-rule routes. */
export function checkSample(sample, exportRoutes, al) {
  const bad = []; const have = new Set(exportRoutes);
  for (const r of sample) if (!have.has(r)) bad.push(`sample route not in export: ${r}`);
  if (new Set(sample).size !== sample.length) bad.push("sample has duplicate routes");
  const fam = familyMap(exportRoutes); const covered = new Set(sample.filter((r) => have.has(r)).map((r) => fam[r]));
  for (const f of new Set(Object.values(fam))) if (!covered.has(f)) bad.push(`route family not covered by the sample: ${f}`);
  for (const rule of al.textRules.filter((x) => x.class === "followup"))
    for (const r of exportRoutes) if (new RegExp(rule.routes).test(r) && !sample.includes(r)) bad.push(`${rule.id} applies to ${r} but the sample omits it (cap would be under-counted)`);
  return bad;
}

/** Caps may fall, never rise: every followup rule needs a ratchet entry and max <= it. */
export function checkRatchet(al, ratchet) {
  const bad = [];
  for (const r of al.textRules.filter((x) => x.class === "followup")) {
    if (!(r.id in ratchet)) bad.push(`${r.id}: followup rule has no entry in text_sanity_cap_ratchet.json`);
    else if (r.max > ratchet[r.id]) bad.push(`${r.id}: cap ${r.max} rose above the ratchet ${ratchet[r.id]}`);
  }
  return bad;
}

/** Returns {ok, problems[], seconds, renders, skipped?}. */
export async function runFast({ root, sample = loadSample(), al = loadAllowlist(), ratchet = loadRatchet(), exportRoutes = listRoutes(root), sweepFn = sweep }) {
  const t0 = Date.now(); const problems = [];
  problems.push(...lintAllowlist(al).map((x) => "allowlist: " + x), ...checkRatchet(al, ratchet), ...checkSample(sample, exportRoutes, al));
  if (problems.length) return { ok: false, problems, seconds: 0, renders: 0 };
  const sw = await sweepFn({ root, routes: sample });
  if (sw.skipped) return { ok: false, skipped: sw.skipped, problems: [], seconds: (Date.now() - t0) / 1000, renders: 0 };
  const ev = evaluate(sw.results, al);
  for (const e of ev.errors) problems.push("render error " + e);
  for (const d of ev.defects) problems.push(`text defect ${d.route}@${d.width} ${d.token} "${d.text}"`);
  for (const c of ev.ctaDefects) problems.push(`off-centre CTA ${c.route}@${c.width} ${c.offset}px "${c.label}"`);
  for (const o of ev.overCap) problems.push("over cap " + o);
  const seconds = (Date.now() - t0) / 1000;
  if (seconds > FAST_HARD_S) problems.push(`fast sweep took ${seconds.toFixed(1)}s, over the ${FAST_HARD_S}s hard limit`);
  return { ok: problems.length === 0, problems, seconds, overBudget: seconds > FAST_BUDGET_S, renders: sw.results.length, followupCounts: ev.followupCounts };
}
