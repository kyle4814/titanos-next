// catlist.js: "what sanitary sealants does Sika have", "list the basement sheet membranes products". A list ask whose subject is the published name of a
// category (typos and plurals tolerated) lists the products filed under that category on the Sika site, each with its published one-line description.
// Never a guess: the members are the products' own category path in the published data; no category match returns null and the other routes run.
import { normalise, tokens, dist } from './text.js';
import { card, fact, CHIPS } from './schema.js';

const LEAD = '(?:(?:hi|hey|hello|um|umm|ok|okay|so|righto|quick one|g day|gday|sorry to bug you|mate|yo|thanks|please|pls) )*';
const ASK = [
  new RegExp('^' + LEAD + '(?:what|which|show me|tell me) (.+?) (?:does|do|can) (?:sika|davco|lanko|you|sika australia)(?: australia)? (?:have|make|sell|offer|stock|supply|produce|provide|do)(?: please| pls| thx| thanks| mate| ta)*$'),
  new RegExp('^' + LEAD + '(?:list|show me|give me|name)(?: all)?(?: of)?(?: the)? (.+?)(?: products| range)?(?: please| pls| thx| thanks| mate)?$'),
];
const DROP = new Set(['sika', 'product', 'range', 'all', 'ta', 'thx', 'thanks', 'mate', 'pls', 'please']);
const subjectTokens = (n0) => { for (const rx of ASK) { const m = rx.exec(n0); if (m) { const t = tokens(m[1]).filter((x) => !DROP.has(x)); if (t.length) return t; } } return null; };
const tokEq = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && dist(a, b, 2) <= (a.length >= 8 ? 2 : 1));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let CAT_TOKENS = null;
const catTokens = (core) => CAT_TOKENS || (CAT_TOKENS = (core.cats || []).filter((c) => c.level >= 2 && c.parent).map((c) => ({ c, toks: tokens(c.name) })).filter((x) => x.toks.length));


const pre = (a, b) => a.length >= 6 && b.length >= 6 && (a.startsWith(b) || b.startsWith(a));
const tokEq2 = (a, b) => tokEq(a, b) || pre(a, b);
let ANC = null;
const ancestors = (core, c) => { ANC = ANC || new Map(core.cats.map((x) => [x.id, x])); const out = []; let p = c.parent && ANC.get(c.parent); while (p) { out.push(...tokens(p.name)); p = p.parent && ANC.get(p.parent); } return out; };
/** "precast concrete" (Pre-Cast under Concrete), "automotive sealing and bonding" (Sealing and Bonding under Automotive Aftermarket): the asker adds the parent's name. */
function lenient(core, subj) {
  const merged = [...subj]; for (let i = 0; i + 1 < subj.length; i++) merged.push(subj[i] + subj[i + 1]); // "pre cast" typed as "precast" and the reverse
  const out = [];
  for (const { c, toks } of catTokens(core)) {
    const comp = toks.join(''); const par = ancestors(core, c).concat(tokens(c.id.split('/').pop().replace(/-/g, ' ')));
    const mc = toks.filter((t) => merged.some((s) => tokEq2(s, t)) || (comp.length >= 6 && merged.includes(comp) && toks.length === 2));
    const compJoined = merged.includes(comp) ? toks.length : 0;
    const matched = Math.max(mc.length, compJoined); if (subj.length < 3 && !compJoined) continue; if (matched < Math.min(2, toks.length) || matched / toks.length < 0.6) continue;
    const rest = subj.filter((s) => !toks.some((t) => tokEq2(s, t)) && !(comp.length >= 6 && comp.includes(s)));
    if (!rest.every((s) => par.some((t) => tokEq2(s, t)) || toks.some((t) => tokEq2(s, t)))) continue;
    const anc = ancestors(core, c); if (rest.length && !rest.some((s) => toks.some((t) => tokEq2(s, t))) && !rest.some((s) => anc.some((t) => tokEq2(s, t)))) continue; // the extra words matched only the last piece of the category's address, never a parent the asker named ("sealing and bonding" is not the automotive Sealing section)
    out.push({ c, ratio: matched / toks.length, matched, par: rest.length });
  }
  if (!out.length) return [];
  out.sort((a, b) => b.ratio - a.ratio || b.matched - a.matched || b.par - a.par);
  const top = out.filter((x) => x.ratio === out[0].ratio && x.matched === out[0].matched && x.par === out[0].par);
  return top.length === 1 || new Set(top.map((x) => x.c.name)).size === 1 ? top.slice(0, 1) : [];
}

/** { card } or null. core is the loaded core shard ({ P, cats }). */
export function categoryListCard(q, n0, core) {
  if (!core || !core.P || !core.cats) return null;
  const subj = subjectTokens(normalise(n0)); if (!subj) return null;
  if (subj.some((t) => /^(davco|lanko|schonox|sarnafil|abelflex|sikatile)$/.test(t))) return null;
  const hits = catTokens(core).filter(({ toks }) => toks.length === subj.length && toks.every((t) => subj.some((s) => tokEq(s, t))) && subj.every((s) => toks.some((t) => tokEq(s, t))));
  const found = hits.length ? hits : lenient(core, subj);
  if (!found.length) return null;
  const ids = new Set(found.map((h) => h.c.id));
  // a plain word ("adhesives", "membranes") that names a narrow section here and is part of the name of bigger sections elsewhere is the whole range's word, not that section's: the other routes answer it
  const inFound = (c) => [...ids].some((i) => c.id === i || c.id.startsWith(i + '/'));
  const size = (id) => core.P.filter((p) => p.c && (p.c === id || p.c.startsWith(id + '/'))).length;
  const mine = Math.max(...found.map((h) => size(h.c.id)));
  if (catTokens(core).some(({ c, toks }) => !inFound(c) && subj.every((s) => toks.some((t) => tokEq(s, t))) && size(c.id) > mine)) return null;
  const members = core.P.filter((p) => p.c && [...ids].some((i) => p.c === i || p.c.startsWith(i + '/')));
  if (members.length < 2) return null;
  const used = members.slice(0, 14);
  const facts = used.map((p) => fact({ source_url: p.u, page: null, sentence: String(p.t || p.n).replace(/\s+/g, ' ').trim(), doc_type: 'WEB' }));
  const name = found[0].c.name;
  return card({ type: 'advice', status: 'PUBLISHED', title: `${cap(name.toLowerCase().replace(/\b(sbs|pvc|hvac)\b/g, (m) => m.toUpperCase()))} in the Sika Australia range`,
    headline: `These are the products filed under ${name} on the Sika Australia site${members.length > used.length ? ', the first few listed here' : ''}, each with its published description.`,
    lines: [], facts, source: facts[0], chip: CHIPS.ADVICE, links: used.map((p) => ({ label: p.n, url: p.u })), table: { cols: ['Product', 'What the published text says'], rows: used.map((p, i) => [p.n, facts[i].sentence]) },
    handoff: null, followups: used.slice(0, 3).map((p) => `Data sheet for ${p.n}`) });
}
