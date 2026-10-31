// judge.mjs: classifies one assistant answer against one bank item. ANSWERED / HONEST-NO-DATA / WRONG / UNHANDLED.
//   ANSWERED       the correct product(s) or page, with a cited published sentence
//   HONEST-NO-DATA the answer says the published data does not cover it and offers the hand-off (and the bank expects that, or the data really lacks it)
//   WRONG          a confident answer about the wrong product, a product outside the documented fit, an answer to something the data cannot answer, or a wrong verdict
//   UNHANDLED      an answerable question that got no answer (stock fallback, a clarifying question only, or an overview that does not contain the asked fact)
import { cardText } from '../../../public/demo/sika-210c0c/assets/brain/schema.js';
const norm = (s) => String(s || '').toLowerCase().replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
const GEN = (cls, why) => ({ cls, why });
export function makeSelectors(P) {
  const byId = new Map(P.map((p) => [p.id, p]));
  const test = (sel, p) => { const [k, ...r] = sel.split(':'); const v = r.join(':'); if (k === 'c') return p.c.includes(v); if (k === 'n') return new RegExp(v, 'i').test(p.id + ' ' + p.n); if (k === 'i') return v.split(',').includes(p.id); return false; };
  const allowed = (exp, id) => { const p = byId.get(id); if (!p) return false; const sels = exp.allowed || []; const deny = exp.deny || []; return sels.some((s) => test(s, p)) && !deny.some((s) => test(s, p)); };
  return { byId, allowed };
}
const isUnknown = (c) => c.type === 'unknown' || c.status === 'UNKNOWN';
export function judge(item, a, sel) {
  const cards = a.cards || []; const exp = item.exp || {};
  const real = cards.filter((c) => !isUnknown(c) && c.type !== 'choose');
  const prodCards = real.filter((c) => c.product && !/^ruled out/i.test(c.title));
  const urls = (cs) => cs.flatMap((c) => [...(c.facts || []).map((f) => f.source_url), ...(c.links || []).map((l) => l.url), c.source && c.source.source_url]).filter(Boolean);
  const allUnknown = cards.length > 0 && cards.every((c) => isUnknown(c) && c.type !== 'choose');
  const text = norm(cards.map(cardText).join('\n') + ' ' + cards.flatMap((c) => (c.facts || []).map((f) => f.sentence)).join(' '));
  const cited = (c) => !!(c.source && c.source.sentence && c.source.source_url);
  const t = item.type;
  if (t === 'vague') {
    const ch = cards.find((c) => c.type === 'choose'); const nOpt = ch ? (ch.choices ? ch.choices.length : (ch.followups || []).length) : 0;
    if (ch && nOpt >= 2 && nOpt <= 4) return GEN('ANSWERED', 'one clarifying question with ' + nOpt + ' options');
    if (/assum/i.test(text) && real.length) return GEN('ANSWERED', 'answered with the assumption named');
    return real.length ? GEN('WRONG', 'guessed silently: ' + (real[0].title || '')) : GEN('UNHANDLED', 'no clarifying question');
  }
  if (t === 'nodata' || t === 'oos') return allUnknown ? GEN('HONEST-NO-DATA', 'declined') : cards.some((c) => c.type === 'choose') && !real.length ? GEN('UNHANDLED', 'clarifying question only') : GEN('WRONG', 'answered something the data cannot answer: ' + (real[0] ? real[0].title : '?'));
  if (t === 'product' || t === 'describe') {
    const ids = prodCards.map((c) => c.product.id);
    if (ids.slice(0, 3).some((i) => exp.products.includes(i))) return GEN('ANSWERED', 'product shown');
    return ids.length ? GEN('WRONG', 'showed ' + ids[0]) : GEN('UNHANDLED', 'no product');
  }
  if (t === 'attr' || t === 'rate' || t === 'time' || t === 'doc' || t === 'calc') {
    const okIds = [exp.product, ...(exp.alt || [])];
    const mine = real.filter((c) => c.product && okIds.includes(c.product.id));
    const others = real.filter((c) => c.product && !okIds.includes(c.product.id) && !/^ruled out/i.test(c.title));
    if (exp.has === false) { if (allUnknown) return GEN('HONEST-NO-DATA', 'declined'); if (others.length && !mine.length) return GEN('WRONG', 'other product ' + others[0].product.id); return GEN('UNHANDLED', 'did not say the data lacks it'); }
    const has = exp.has === true;
    if (mine.length) {
      if (has && exp.contains) { const want = norm(exp.contains); const ok = mine.some((c) => norm(cardText(c) + ' ' + c.facts.map((f) => f.sentence).join(' ')).includes(want.slice(0, 40))) ; return ok ? (mine.some(cited) ? GEN('ANSWERED', 'sentence quoted') : GEN('UNHANDLED', 'not cited')) : GEN('UNHANDLED', 'product shown without the asked fact'); }
      return mine.some(cited) || t === 'doc' ? GEN('ANSWERED', 'published card') : GEN('UNHANDLED', 'not cited');
    }
    if (others.length) return GEN('WRONG', 'other product ' + others[0].product.id);
    if (allUnknown) { const named = cards.some((c) => c.product && c.product.id === exp.product); return has ? GEN('UNHANDLED', 'said unknown but data exists') : (named || t === 'calc' ? GEN('HONEST-NO-DATA', 'declined for this product') : GEN('UNHANDLED', 'generic fallback')); }
    return GEN('UNHANDLED', 'no answer');
  }
  if (t === 'compat') {
    const mine = real.filter((c) => c.product && [exp.product, ...(exp.alt || [])].includes(c.product.id)); const head = norm(mine.map((c) => c.headline).join(' '));
    if (exp.verdict === 'no') return mine.length && /^no\b/.test(head) ? GEN('ANSWERED', 'no with sentence') : mine.length && /^yes/.test(head) ? GEN('WRONG', 'said yes') : allUnknown ? GEN('UNHANDLED', 'unknown') : GEN('UNHANDLED', 'no verdict');
    if (mine.length && mine.some(cited)) return GEN('ANSWERED', 'verdict with sentence');
    if (allUnknown && cards.some((c) => c.product && [exp.product, ...(exp.alt || [])].includes(c.product.id))) return GEN('HONEST-NO-DATA', 'declined for this product');
    if (real.some((c) => c.product && c.product.id !== exp.product)) return GEN('WRONG', 'other product');
    return GEN('UNHANDLED', 'no answer');
  }
  if (t === 'job') { // a whole-room job sentence. The v2 brain alone does not build job lists (the actions layer does), so it must say so honestly or answer with cited published cards; never an invented quantity.
    if (allUnknown) return GEN('HONEST-NO-DATA', 'declined');
    return real.length && real.some(cited) ? GEN('ANSWERED', 'cited published card') : cards.some((c) => c.type === 'choose') ? GEN('ANSWERED', 'clarifying question') : GEN('UNHANDLED', 'no cited answer');
  }
  if (t === 'compare') {
    const comp = real.find((c) => c.type === 'comparison' || (c.table && c.table.cols && c.table.cols.length >= 3));
    if (!comp) return real.length && prodCards.length ? GEN('UNHANDLED', 'no comparison') : GEN('UNHANDLED', 'no comparison');
    const tx = norm(cardText(comp)); const ok = exp.products.every((id) => { const p = sel.byId.get(id); return p && tx.includes(norm(p.n)); });
    return ok ? GEN('ANSWERED', 'comparison') : GEN('WRONG', 'comparison of other products');
  }
  if (t === 'list' || t === 'best') {
    const ids = new Set(prodCards.map((c) => c.product.id));
    for (const c of real) for (const l of [...(c.links || []), ...(c.lines || [])]) { const name = norm(l.label); for (const p of sel.byId.values()) if (norm(p.n) === name) ids.add(p.id); }
    const list = [...ids];
    if (!list.length) return allUnknown || cards.some((c) => c.type === 'choose') || !real.length ? GEN('UNHANDLED', 'no products named') : GEN('UNHANDLED', 'no product');
    const bad = list.filter((id) => !sel.allowed(exp, id));
    if (bad.length) return GEN('WRONG', 'outside the documented fit: ' + bad.slice(0, 2).join(','));
    if (t === 'list') { const inCore = exp.core ? list.filter((id) => sel.allowed({ allowed: exp.core }, id)) : list; return inCore.length >= Math.min(exp.min || 3, 4) ? GEN('ANSWERED', inCore.length + ' listed' + (exp.core ? ' from the category' : '')) : GEN('UNHANDLED', 'only ' + inCore.length + ' listed' + (exp.core ? ' from the category' : '')); }
    return real.some(cited) ? GEN('ANSWERED', list.length + ' products with sentences') : GEN('UNHANDLED', 'not cited');
  }
  if (t === 'system') { // a published tiling system sheet: the answer must link the right slug; a link to a different system is WRONG
    const links = cards.flatMap((c) => (c.links || []).map((l) => l.url || '')); const sysLinks = links.filter((u) => /\/systems\/|\b[a-z-]+-on-[a-z-]+-(internal|external)-/.test(u));
    if (links.some((u) => u.includes(exp.slug))) return GEN('ANSWERED', 'system sheet linked');
    if (sysLinks.length) return GEN('WRONG', 'other system: ' + sysLinks[0]);
    return allUnknown ? GEN('UNHANDLED', 'declined but the system sheet exists') : GEN('UNHANDLED', 'no system sheet');
  }
  if (t === 'business') {
    const rx = new RegExp(exp.url, 'i'); const hit = urls(real).some((u) => rx.test(u)) && (!exp.must || text.includes(norm(exp.must)));
    if (real.length && hit && real.some(cited)) return GEN('ANSWERED', 'page cited');
    if (allUnknown && exp.nodata) return GEN('HONEST-NO-DATA', 'declined');
    if (real.length && !hit && prodCards.length && !exp.nodata) return GEN('WRONG', 'product answer to a business question: ' + prodCards[0].title);
    if (real.length && urls(real).some((u) => rx.test(u))) return GEN('UNHANDLED', 'right page, the asked sentence is not on the card');
    if (real.length && !hit) return GEN('WRONG', 'answer without the right page');
    return GEN('UNHANDLED', 'no answer');
  }
  return GEN('UNHANDLED', 'unknown type');
}
