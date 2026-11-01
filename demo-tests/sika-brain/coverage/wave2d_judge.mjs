// wave2d_judge.mjs: judges one lane D answer (type 'w2d') against its expectation. Called from judge.mjs.
//   ANSWERED       the right kind of answer, with the asked rule quoted, the right system and products, and (for timelines) the right total
//   HONEST-NO-DATA a trap that was refused or referred, or a rule the documents do not state, said plainly
//   WRONG          a plan where a refusal was due (or the reverse), a wrong system or product, a wrong total, or a total shown where a window is missing
//   UNHANDLED      the right kind of answer without the asked fact, or no answer
import { cardText } from '../../../public/demo/sika-210c0c/assets/brain/schema.js';
const norm = (s) => String(s || '').toLowerCase().replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
const GEN = (cls, why) => ({ cls, why });
export function modeOf(cards) {
  const c0 = cards[0]; if (!c0) return 'none';
  if (c0.type === 'unknown' || c0.status === 'UNKNOWN') return 'refuse';
  if (c0.type === 'choose') return 'ask';
  if (c0.type === 'plan' && c0.plan) { if (c0.plan.status === 'blocked') return 'blocked'; if (c0.plan.mode === 'plan') return c0.plan.status === 'void' ? 'void' : 'plan'; return c0.plan.mode === 'refusal' ? 'refuse' : 'rule'; }
  return 'other';
}
export function judge2d(item, a) {
  const E = item.exp; const cards = a.cards || []; const c0 = cards[0]; const got = modeOf(cards);
  const txt = norm(cards.map((c) => cardText(c) + ' ' + (c.facts || []).map((f) => f.sentence).join(' ')).join(' | '));
  if (E.mode === 'refuse') return ['refuse', 'blocked', 'void'].includes(got) ? GEN('HONEST-NO-DATA', 'declined: ' + got) : ['plan', 'rule'].includes(got) ? GEN('WRONG', 'answered a question that needs a refusal: ' + (c0 ? c0.title : '')) : GEN('UNHANDLED', 'neither answered nor refused: ' + got);
  if (E.mode === 'none') return got === 'refuse' && txt.includes('no system') ? GEN('ANSWERED', 'no published system, said so') : ['plan', 'rule'].includes(got) ? GEN('WRONG', 'invented a system') : GEN('UNHANDLED', 'got ' + got);
  if (got !== E.mode) {
    if (['plan', 'void', 'blocked', 'rule'].includes(got) && ['plan', 'void', 'blocked', 'rule'].includes(E.mode)) return GEN('WRONG', `expected ${E.mode}, got ${got}: ${c0 ? c0.title : ''}`);
    return GEN('UNHANDLED', `expected ${E.mode}, got ${got}`);
  }
  for (const h of E.has || []) if (!txt.includes(norm(h))) return GEN('UNHANDLED', 'the asked rule is not quoted: ' + h);
  if (E.hasAny && !E.hasAny.some((h) => txt.includes(norm(h)))) return GEN('UNHANDLED', 'none of the asked rules is quoted: ' + E.hasAny.join(' / '));
  for (const h of E.ours || []) if (!txt.includes(norm(h))) return GEN('UNHANDLED', 'missing: ' + h);
  if (E.textHas && !txt.includes(norm(E.textHas))) return GEN('UNHANDLED', 'missing: ' + E.textHas);
  if (E.alt && !txt.includes(norm(E.alt))) return GEN('UNHANDLED', 'no published way forward: ' + E.alt);
  if (E.mode === 'plan' || E.mode === 'void') {
    const p = c0.plan;
    if (E.slug && (!p.commit || p.commit.slug !== E.slug)) return GEN('WRONG', 'system ' + (p.commit && p.commit.slug) + ' not ' + E.slug);
    if (E.roles) for (const [role, r] of Object.entries(E.roles)) {
      const st = p.steps.find((s) => s.role === role);
      if (!r.stated) { if (st && st.product) return GEN('WRONG', role + ' named where the system names none'); continue; }
      if (st && !st.product && st.excluded && st.excluded.length) continue; // every named product ruled out by the customer's own conditions, said so
      if (!st || !st.product || !r.ids.includes(st.product.id)) return GEN('WRONG', role + ' product ' + (st && st.product && st.product.id) + ' is not one the system names');
    }
    if (E.totalMin != null) { const tl = p.timeline; if (!tl || !tl.ok || Math.abs(tl.min - E.totalMin) > 1e-3 || Math.abs(tl.max - E.totalMax) > 1e-3) return GEN('WRONG', `total ${tl && tl.min}..${tl && tl.max} not ${E.totalMin}..${E.totalMax}`); }
    if (E.noTotal) { const tl = p.timeline; if (!tl || tl.ok || tl.min != null) return GEN('WRONG', 'a total is shown where a window is missing'); if (!/not published/.test(txt)) return GEN('UNHANDLED', 'does not say a window is not published'); }
    if (E.budget) { const want = { over: 'does not fit', fits: 'even the longest published windows fit', maybe: 'may not' }[E.budget]; if (!txt.includes(want)) return GEN('WRONG', 'budget verdict: wanted ' + want); }
    if (E.calc && !cards.some((c) => c.type === 'calculation')) return GEN('UNHANDLED', 'no quantity card');
    if (E.mode === 'plan' && !(c0.followups || []).some((f) => /add the plan to my project/i.test(f))) return GEN('UNHANDLED', 'no add-to-project step');
    if (E.mode === 'plan' && !(c0.links || []).some((l) => l.url.startsWith('systems/'))) return GEN('UNHANDLED', 'no system sheet link');
  }
  return GEN('ANSWERED', 'cited ' + got);
}
