// Pure classification for the C9 rendered-text sweep (f373). No browser here, so the plants test is fast.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
export const CTA_TOLERANCE_PX = 2;
const here = path.dirname(fileURLToPath(import.meta.url));
export const loadAllowlist = (p = path.join(here, "text_sanity_allowlist.json")) => JSON.parse(fs.readFileSync(p, "utf8"));

export function lintAllowlist(al) {
  const bad = [];
  for (const r of [...al.textRules, ...(al.ctaRules || [])]) {
    for (const k of ["id", "routes", "class", "reason"]) if (!r[k]) bad.push(`${r.id || "(no id)"}: missing ${k}`);
    if (r.reason && r.reason.length < 40) bad.push(`${r.id}: reason too short to be a reason`);
    if (!["intended", "followup"].includes(r.class)) bad.push(`${r.id}: class must be intended|followup`);
    if (r.class === "followup" && !(r.max > 0)) bad.push(`${r.id}: a followup needs a max cap`);
  }
  return bad;
}

/** hit: {token,text}; returns {class:"intended"|"followup"|"defect", rule?} */
export function classifyHit(hit, route, al) {
  for (const r of al.textRules) {
    if (r.token && r.token !== hit.token) continue;
    if (!new RegExp(r.routes).test(route)) continue;
    if (r.text && !new RegExp(r.text).test(hit.text)) continue;
    return { class: r.class, rule: r.id };
  }
  return { class: "defect" };
}

/** cta: the in-page measurement. Returns null when not applicable (left-aligned hero or no CTA), else {offset, off}. */
export function ctaOffset(cta) {
  if (!cta || cta.h1Align !== "center") return null;
  const offset = Math.round((cta.groupCx - cta.heroCx) * 10) / 10;
  return { offset, off: Math.abs(offset) > CTA_TOLERANCE_PX };
}

export function classifyCta(route, width, cta, al) {
  const o = ctaOffset(cta); if (!o || !o.off) return null;
  const rule = (al.ctaRules || []).find((r) => new RegExp(r.routes).test(route) && (!r.width || r.width === width));
  return { offset: o.offset, class: rule ? rule.class : "defect", rule: rule && rule.id };
}

/** results: sweep().results. Returns {rows, defects, followupCounts, overCap, ctaRows, ctaDefects, errors}. */
export function evaluate(results, al) {
  const rows = [], ctaRows = [], errors = []; const counts = {};
  for (const r of results) {
    if (r.error) errors.push(`${r.route}@${r.width}: ${r.error}`);
    for (const h of r.hits) { const c = classifyHit(h, r.route, al); rows.push({ route: r.route, width: r.width, token: h.token, text: h.text, ...c }); if (c.class === "followup") counts[c.rule] = (counts[c.rule] || 0) + 1; }
    for (const e of r.counters || []) rows.push({ route: r.route, width: r.width, token: "empty-counter", text: e.where, class: "defect" });
    const c = classifyCta(r.route, r.width, r.cta, al); if (c) ctaRows.push({ route: r.route, width: r.width, label: r.cta.label, ...c });
  }
  const overCap = al.textRules.filter((r) => r.class === "followup" && (counts[r.id] || 0) > r.max).map((r) => `${r.id}: ${counts[r.id]} hits > cap ${r.max}`);
  return { rows, defects: rows.filter((x) => x.class === "defect"), followupCounts: counts, overCap, ctaRows, ctaDefects: ctaRows.filter((x) => x.class === "defect"), errors };
}
