// spelling.mjs: the vocabulary corrector (match.js spellToken) against the old rule, on two-letter errors in rare catalogue words. Deterministic.
import { makeBrain } from '../sika-brain/harness.mjs';
import { spellToken } from '../../public/demo/sika-210c0c/assets/brain/match.js';
import { dist } from '../../public/demo/sika-210c0c/assets/brain/text.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const brain = makeBrain(); await brain.boot(); const post = brain.core().post; const vocab = Object.keys(post); const has = (w) => !!post[w]; const df = (w) => post[w].length;
// the rule before this lane: one letter wrong (two for words of 9+)
function oldSpell(t) { if (has(t) || t.length < 5 || /\d/.test(t)) return t; const max = t.length >= 9 ? 2 : 1; let best = null, bd = 9, bdf = -1; for (const v of vocab) { if (Math.abs(v.length - t.length) > max || v.length < 5) continue; const d = dist(t, v, max); if (d > max) continue; const f = df(v); if (d < bd || (d === bd && f > bdf)) { best = v; bd = d; bdf = f; } } return best || t; }
const V = 'aeiou';
// a seeded generator, so the set is the same on every run
let seed = 20261101; const rnd = (n) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
const words = vocab.filter((w) => /^[a-z]{6,8}$/.test(w) && df(w) >= 2 && df(w) <= 40).sort();
const cases = [];
for (const w of words) {
  if (cases.length >= 600) break;
  const vi = [...w].map((c, i) => (V.includes(c) ? i : -1)).filter((i) => i >= 0); if (vi.length < 2) continue;
  // two vowel errors: swap one vowel for another and drop another (the usual phone typo)
  const i = vi[rnd(vi.length)]; let j = vi[rnd(vi.length)]; if (j === i) j = vi.find((x) => x !== i);
  const sub = V[(V.indexOf(w[i]) + 1 + rnd(4)) % 5]; const arr = [...w]; arr[i] = sub; arr.splice(j, 1); const t = arr.join('');
  if (has(t) || t === w || dist(t, w, 3) !== 2) continue;
  cases.push({ w, t });
}
const rate = (f) => cases.filter((c) => f(c.t) === c.w).length / cases.length;
const before = rate(oldSpell), after = rate((t) => spellToken(t, vocab, has, df));
console.log(`spelling: ${cases.length} two-letter errors in 6 to 8 letter catalogue words: hit rate before ${(100 * before).toFixed(1)}% after ${(100 * after).toFixed(1)}%`);
ok(cases.length >= 300, 'at least 300 error cases generated');
ok(after >= before + 0.2, 'the corrector lifts the two-letter hit rate by at least 20 points');
// one letter wrong: the new rule is never worse than the old
{ const one = []; for (const w of words.slice(0, 600)) { const i = 1 + rnd(w.length - 2); const t = w.slice(0, i) + w.slice(i + 1); if (!has(t)) one.push({ w, t }); } const r1 = (f) => one.filter((c) => f(c.t) === c.w).length / one.length; const b1 = r1(oldSpell), a1 = r1((t) => spellToken(t, vocab, has, df)); console.log(`spelling: one dropped letter (${one.length} cases): before ${(100 * b1).toFixed(1)}% after ${(100 * a1).toFixed(1)}%`); ok(a1 >= b1, 'one-letter hit rate is not worse'); }
// no harm: a word that is already in the vocabulary is never changed, and a correct query word is never rewritten
ok(words.every((w) => spellToken(w, vocab, has, df) === w), 'known words are never rewritten');
// the corrected query still returns something: end-to-end on rare words
const E2E = [['waterprofing membrane for a balcony', /waterproof|membrane|balcony|sika/i], ['screed levelng compound', /level/i], ['epxy grout for a commercial kitchen', /grout|epoxy/i]];
for (const [q, rx] of E2E) { const r = await brain.ask(q, null); const t = r.cards.map((c) => c.title + ' ' + c.headline).join(' '); ok(r.cards.length && rx.test(t), 'typo query still answered: ' + q + ' -> ' + (r.cards[0] && r.cards[0].title)); }
console.log(`spelling: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
