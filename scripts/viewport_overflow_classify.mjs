// Pure classification for the C10 viewport overflow sweep (f385). No browser here, so the plants test is fast.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
export const ALLOWLIST_PATH = path.join(here, "viewport_overflow_allowlist.json");
export const loadAllowlist = (p = ALLOWLIST_PATH) => JSON.parse(fs.readFileSync(p, "utf8"));
export const METRICS = ["hscroll", "offender", "footer", "tap"];

export function lintAllowlist(al) {
  const bad = [];
  const rules = al.rules || [];
  const seen = new Set();
  for (const r of rules) {
    const id = r.id || "(no id)";
    if (seen.has(id)) bad.push(`${id}: duplicate id`); seen.add(id);
    for (const k of ["id", "metric", "routes", "class", "reason"]) if (!r[k]) bad.push(`${id}: missing ${k}`);
    if (r.metric && !METRICS.includes(r.metric)) bad.push(`${id}: metric must be one of ${METRICS.join("|")}`);
    if (r.reason && String(r.reason).trim().length < 40) bad.push(`${id}: reason too short to be a reason`);
    if (!["intended", "followup"].includes(r.class)) bad.push(`${id}: class must be intended|followup`);
    if (r.class === "followup" && !(r.max > 0)) bad.push(`${id}: a followup needs a max cap above 0`);
    if (r.class === "followup" && !r.followup) bad.push(`${id}: a followup needs a followup number in the receipt`);
    for (const k of ["routes", "sel"]) if (r[k]) { try { new RegExp(r[k]); } catch { bad.push(`${id}: ${k} is not a valid regex`); } }
    if (r.widths && !Array.isArray(r.widths)) bad.push(`${id}: widths must be an array`);
    if (r.routes === ".*" || r.routes === "^.*$" || r.routes === ".+") if (r.metric !== "tap" || r.class !== "followup") bad.push(`${id}: a catch-all route rule is only allowed as a capped tap followup`);
  }
  return bad;
}

/** hit: {route,width,metric,sel}. Returns {class:"intended"|"followup"|"defect", rule?}. */
export function classifyHit(hit, al) {
  for (const r of al.rules || []) {
    if (r.metric !== hit.metric) continue;
    if (!new RegExp(r.routes).test(hit.route)) continue;
    if (r.widths && !r.widths.includes(hit.width)) continue;
    if (r.sel && !new RegExp(r.sel).test(hit.sel || "")) continue;
    return { class: r.class, rule: r.id };
  }
  return { class: "defect" };
}

/** Flattens sweep().results into findings. Inline links inside text are exempt and never counted. */
export function findings(results) {
  const out = [];
  for (const r of results) {
    if (r.hscroll && r.hscroll.over) out.push({ route: r.route, width: r.width, metric: "hscroll", sel: "document", detail: `scrollWidth ${r.hscroll.scrollW} > viewport ${r.hscroll.vw}` });
    for (const o of r.offenders || []) out.push({ route: r.route, width: r.width, metric: "offender", sel: o.sel, detail: `${o.sel} spans ${o.left}..${o.right}px (${o.over}px outside)` });
    for (const f of r.footer || []) if (!f.info) out.push({ route: r.route, width: r.width, metric: "footer", sel: f.sel, detail: `${f.kind} ${f.sel}` });
    for (const t of r.taps || []) if (!t.inline) out.push({ route: r.route, width: r.width, metric: "tap", sel: `${t.inFooter ? "footer " : t.inNav ? "nav " : ""}${t.sel}`, detail: `${t.sel} ${t.w}x${t.h}px "${t.text}"` });
  }
  return out;
}

export function evaluate(results, al) {
  const errors = results.filter((r) => r.error).map((r) => `${r.route}@${r.width}: ${r.error}`);
  const rows = findings(results).map((f) => ({ ...f, ...classifyHit(f, al) }));
  const counts = {};
  for (const r of rows) if (r.class === "followup") counts[r.rule] = (counts[r.rule] || 0) + 1;
  const overCap = (al.rules || []).filter((r) => r.class === "followup" && (counts[r.id] || 0) > r.max).map((r) => `${r.id}: ${counts[r.id]} hits > cap ${r.max}`);
  return { rows, defects: rows.filter((x) => x.class === "defect"), followupCounts: counts, overCap, errors };
}

/** Caps may fall, never rise: true list of violations when `next` raises any cap or adds a followup that `prev` did not carry. */
export function capsRise(prev, next) {
  const was = new Map((prev.rules || []).filter((r) => r.class === "followup").map((r) => [r.id, r.max]));
  const out = [];
  for (const r of next.rules || []) {
    if (r.class !== "followup") continue;
    if (!was.has(r.id)) out.push(`${r.id}: new followup rule (cap ${r.max}) not in the previous allowlist`);
    else if (r.max > was.get(r.id)) out.push(`${r.id}: cap rose ${was.get(r.id)} -> ${r.max}`);
  }
  return out;
}

/** The committed allowlist at a git ref, or null when it does not exist there. */
export function allowlistAt(ref, cwd = path.join(here, "..")) {
  try { return JSON.parse(execFileSync("git", ["show", `${ref}:scripts/viewport_overflow_allowlist.json`], { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString()); } catch { return null; }
}
