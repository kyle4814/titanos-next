// Correction loop (client side). A rep's correction becomes a rule: it carries who, when and a source, and it beats the index
// when the asked question overlaps the rule's pattern by 0.75 (Jaccard) or more. Matching mirrors lanes/corrections/correction_loop.py.
const STOP = new Set('a an the is are was were be to of in on at for and or what whats which how do does did can could i you it this that with my our your me we there their about tell please'.split(/\s+/));
export function tokens(text) {
  const out = new Set();
  for (let t of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
    if (!t || STOP.has(t)) continue;
    if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
    out.add(t);
  }
  return [...out].sort();
}
export function jaccard(a, b) {
  const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
/** best matching rule (score >= threshold), newest wins ties; null when nothing matches */
export function matchRule(rules, question, threshold = 0.75) {
  if (!rules || !rules.length) return null;
  const q = tokens(question); let best = null;
  for (const r of rules) {
    const s = jaccard(q, r.pattern || tokens(r.question));
    if (s >= threshold && (!best || s > best.s || (s === best.s && String(r.corrected_at) > String(best.r.corrected_at)))) best = { r, s };
  }
  return best ? best.r : null;
}
/** the rule a correction would create (shown in the demo-only "Suggest a correction" preview; never saved or sent) */
export function previewRule({ question, answer, source, who }) {
  return { pattern: tokens(question), question, answer, source_url: source, who, corrected_at: new Date().toISOString().slice(0, 10), supersedes: 0 };
}
export const validSource = (u) => /^https?:\/\/[^\s]+\.[^\s]+/.test(String(u || '').trim());
