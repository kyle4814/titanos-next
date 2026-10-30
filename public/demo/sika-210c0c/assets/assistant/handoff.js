// handoff.js (T06): builds the "ask Technical Services" hand-off block whenever an answer is a Not-in-the-published-data answer.
// Demo only: it composes text for the visitor to copy. It submits nothing and makes no promise of a reply. No dependencies.
import { plain } from './answer.js';
import { tokenize, normalise } from './tokenize.js';

const NOT_IN_DATA = /\b(do not|does not|did not|cannot) (hold|have|list|say|name|state)\b|will not guess|no [a-z ]+ statement that i can quote|not in the published|not published/i;
const ALWAYS = new Set(['out_of_scope', 'where_to_buy', 'contact']);
// Words that are part of the question's frame, not a condition the visitor is asking about.
const FRAME = new Set(['tile', 'tiling', 'floor', 'wall', 'over', 'onto', 'adhesive', 'grout', 'sealant', 'product', 'layer', 'apply', 'fix', 'fixing', 'laying', 'lay', 'put', 'make', 'work', 'safe', 'ok', 'okay', 'possible', 'allowed', 'one', 'pot', 'grey', 'davco']);

const plainList = (a) => a.filter(Boolean).map((x) => plain(String(x)));
const textsOf = (blocks) => blocks.flatMap((b) => {
  if (b.type === 'text') return [b.text];
  if (b.type === 'facts') return b.rows.map((r) => r.label + ' ' + r.value);
  if (b.type === 'products') return b.items.map((i) => i.reason || '');
  return [];
});

/** Query words that the answer content never mentions. Only used for compatibility answers, where the quoted sentence may be silent on the visitor's condition. */
export function uncoveredTerms(query, names, blocks) {
  const body = normalise(textsOf(blocks).join(' ') + ' ' + names.join(' '));
  const out = [];
  for (const w of normalise(query).split(/[^a-z0-9]+/)) {
    const t = tokenize(w)[0];
    if (!t || !/^[a-z]{4,}$/.test(t) || FRAME.has(t) || FRAME.has(w)) continue;
    if (!body.includes(t.slice(0, Math.max(4, t.length - 1))) && !out.includes(w)) out.push(w);
  }
  return out;
}

/** Decide and build. Returns a block of type handoff, or null when the answer stands on its own. */
export function handoffFor({ intent, query, blocks, state, byId, config }) {
  if (intent === 'greeting' || intent === 'help' || intent === 'clarify') return null;
  if (blocks.some((b) => b.type === 'handoff')) return null;
  const textual = textsOf(blocks).some((t) => NOT_IN_DATA.test(t));
  const ids = [];
  const st = state || {};
  if (st.productId) ids.push(st.productId);
  for (const id of st.productIds || []) if (!ids.includes(id)) ids.push(id);
  const products = ids.slice(0, 3).map((id) => byId.get(id)).filter(Boolean).map((p) => ({ id: p.id, name: plain(p.name) }));
  let missing = [];
  if (intent === 'compatibility') missing = uncoveredTerms(query, products.map((p) => p.name), blocks);
  if (!(ALWAYS.has(intent) || textual || missing.length)) return null;
  return buildHandoff({ query, products, sel: Object.entries(st.facets || {}).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => `${k}: ${v.join(', ')}`), reason: missing.length ? `The published text I quoted does not mention: ${missing.join(', ')}.` : 'This is not in the published data I hold.', config });
}

/** Shared builder, also used by the problem solver when its tree runs out. */
export function buildHandoff({ query, products = [], sel = [], reason, config }) {
  const links = (config && config.links) || {};
  const lines = (((config || {}).footer || {}).address || {}).lines || [];
  const ph = lines.map((l) => /(\+\d[\d ]{7,})/.exec(l)).find(Boolean);
  const text = plainList([
    `Question: ${query}`,
    products.length ? `Product: ${products.map((p) => p.name).join('; ')}` : null,
    sel.length ? `Selections: ${sel.join('; ')}` : null,
    `What the demo found: ${reason}`,
    'Sent from the Sika demo product advisor (a demonstration, not an official Sika page).',
  ]).join('\n');
  return {
    type: 'handoff', title: 'Ask Technical Services', question: plain(query), products, selections: sel, reason, text,
    contact: { url: links.contact || (config && config.company && config.company.site) || '', phone: ph ? ph[1].trim() : '' },
    note: 'Demo only: this does not send anything. Copy the block below and paste it into the enquiry form on the Sika Australia website. This is not a promise that anyone will reply.',
  };
}
