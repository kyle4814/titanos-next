// plan_props.mjs: independent checks for plan cards (lane D). It does not import rules.js or rulex.mjs.
//   P1-plan  every derived number a plan card shows (a total, a time budget, the days form of an hour figure) is recomputed here from the published
//            windows the card carries (the raw wording of each wait), and must equal what the card says.
//   P7       a plan that shows a total has no missing window; a plan that names a window as missing shows no total.
import { numbersIn } from '../../public/demo/sika-210c0c/assets/brain/text.js';
const UNIT = { min: 1 / 60, mins: 1 / 60, minute: 1 / 60, minutes: 1 / 60, hour: 1, hours: 1, hr: 1, hrs: 1, day: 24, days: 24, week: 168, weeks: 168 };
const r1 = (x) => Math.round(x * 10) / 10;
/** "1-2 hours / 2-3 hours", "~3 hours", "3 to 7 days", "12+ hours", "50min+": every figure in hours, merged to the longer ({ min: biggest minimum, max: biggest maximum }) */
export function windowHours(raw) {
  const parts = String(raw).split(' / '); let min = 0, max = 0;
  for (const p of parts) {
    const m = /(\d+(?:\.\d+)?)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*\+?\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)/i.exec(p);
    if (!m) return null; const k = UNIT[m[3].toLowerCase()]; const a = Number(m[1]) * k, b = (m[2] != null ? Number(m[2]) : Number(m[1])) * k;
    min = Math.max(min, a); max = Math.max(max, b);
  }
  return { min, max };
}
/** the totals of a card's timeline, worked out from the raw wordings alone */
export function recompute(tl) {
  if (!tl) return null;
  let min = 0, max = 0;
  for (const p of tl.parts) {
    if (p.k === 'seq') { const w = windowHours(p.raw); if (!w) return null; min += w.min * (p.mult || 1); max += w.max * (p.mult || 1); }
    else {
      if (!p.a || !p.g || !p.w) return { min: null, max: null };
      const a = windowHours(p.a.raw), g = windowHours(p.g.raw), w = windowHours(p.w.raw); if (!a || !g || !w) return null;
      min += Math.max(a.min, w.min + g.min); max += Math.max(a.max, w.max + g.max);
    }
  }
  return { min, max };
}
export const fmtNums = (h) => [String(r1(h)), String(r1(h / 24)), String(Math.round(h * 60))];
const near = (a, b) => Math.abs(a - b) < 1e-4;
/** extra numbers a plan card may show, plus the violations found. Returns { allowed:Set, bad:[] } */
export function planCheck(c, question = '') {
  const allowed = new Set(); const bad = [];
  const p = c.plan; if (!p) return { allowed, bad };
  for (const n of p.names || []) for (const x of numbersIn(n)) allowed.add(x);
  for (const s of p.steps || []) { if (s.product) for (const x of numbersIn(s.product.name)) allowed.add(x); for (const a of s.alts || []) for (const x of numbersIn(a.name)) allowed.add(x); for (const e of s.excluded || []) for (const x of numbersIn(e.name)) allowed.add(x); }
  if (p.K) for (const r of p.K.raw || []) for (const x of numbersIn(r)) allowed.add(x);
  if (p.zone && p.zone.loc) for (const x of numbersIn(p.zone.loc)) allowed.add(x);
  const tl = p.timeline;
  if (tl) {
    const rc = recompute(tl);
    if (tl.ok) {
      if (!rc || rc.min == null) bad.push(['P1-plan', 'a total is shown but a window cannot be recomputed']);
      else { if (!near(rc.min, tl.min)) bad.push(['P1-plan', `total min ${tl.min} vs recomputed ${rc.min}`]); if (!near(rc.max, tl.max)) bad.push(['P1-plan', `total max ${tl.max} vs recomputed ${rc.max}`]); }
      if (tl.missing && tl.missing.length) bad.push(['P7', 'a total with missing windows']);
      if (rc && rc.min != null) { for (const h of [rc.min, rc.max]) for (const x of fmtNums(h)) allowed.add(x); }
    } else if (tl.min != null) bad.push(['P7', 'no ok flag but a total']);
    if (tl.budget) for (const x of fmtNums(tl.budget.hours)) allowed.add(x);
    for (const pt of tl.parts || []) for (const r of [pt.raw, pt.a && pt.a.raw, pt.g && pt.g.raw, pt.w && pt.w.raw]) if (r) for (const x of numbersIn(r)) allowed.add(x);
  }
  return { allowed, bad };
}
