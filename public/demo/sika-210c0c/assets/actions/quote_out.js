// quote_out.js: the sales engine's output side (split from quote.js to keep each module under the 40 KB budget, no behaviour change): the request reference, the saved record,
// the plain-text request, the email link to a PUBLISHED address, the printable sheet model and the anonymous demand signal. Plain code: no DOM, no network.
import { plain, ESTIMATE_LINE } from './core.js';
import { sigOf, cleanQuote, unitLabel, clip } from '../lib/projectstore.js';

export const DEMO_BANNER = "Demo: this prepares the request; it is not sent to Sika's systems from here.";
export const MAILTO_MAX = 4000; // encoded characters of body kept in the email link: long enough for a normal project, short enough for mail programs that cap the link
export const DELIVERY_TEXT = { delivery: 'Delivery to site', pickup: 'I will pick it up', unsure: 'Not sure yet' };
export const pad = (n) => String(n).padStart(2, '0');
export function validEmail(s) {
  const t = String(s || '').trim(); if (t.length > 120 || /\s/.test(t)) return false;
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(t); if (!m) return false;
  const [, l, d] = m; if (/^\.|\.$|\.\./.test(l) || /^\.|\.$|\.\.|^-|-$/.test(d)) return false;
  return /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(l) && /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(d);
}

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // no I, L, O, U: a reference read down the phone cannot be misheard as a digit
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
/** SQ-YYYYMMDD-XXXX, deterministic from its seed, never one already in `taken`. */
export function makeRef(now, seed, taken = []) {
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`; const used = new Set(taken);
  for (let salt = 0; salt < 5000; salt++) { let h = fnv(`${seed}|${salt}`); let s = ''; for (let i = 0; i < 4; i++) { s += ALPHA[h & 31]; h = (h >>> 5) | (fnv(seed + i) << 27); } const ref = `SQ-${day}-${s}`; if (!used.has(ref)) return ref; }
  throw new Error('no free quote reference');
}

export const lineOf = (it) => `${it.qty} ${unitLabel(it.unit, it.qty)}${it.packs ? ' (' + it.packs + ')' : ''}`;
/** One stored calculation (projectStore.calculations()) as the short, cited line the request carries. */
export const calcLine = (c) => ({ id: c.id, title: c.title || c.productName || c.kind, answer: c.answer || c.summary || '', formula: c.formula || '', source: c.citation ? c.citation.text : '', url: c.citation ? c.citation.url : '', estimate: c.estimate || '' });
/** The saved record from a project, the answers, the time and the document links. */
export function buildRecord({ project, answers, now = new Date(), taken = [], docs = [], supersedes = '', calcs = [] }) {
  const items = project.items || []; const a = answers || {};
  const created = now.toISOString(); const sig = sigOf(items);
  const ref = makeRef(now, `${created}|${sig}|${a.email || ''}|${project.name}`, taken);
  const rec = cleanQuote({
    ref, status: 'prepared', created, project: project.name, sig, supersedes,
    lines: items.map((i) => ({ id: i.id, name: i.name || i.id, qty: i.qty, unit: i.unit, packs: i.packs, need: i.need, basis: i.basis, url: i.url, phrase: i.phrase })),
    site: a.site || {}, needed: a.needed || {}, delivery: a.delivery || '', role: a.role || '', company: a.company || '',
    contact: { name: a.name, email: a.email, phone: a.phone, best: a.best }, notes: a.notes || '', docs, calcs: (calcs || []).map(calcLine),
  });
  return rec;
}
/** Has the cart changed since this request was prepared? */
export const isStale = (rec, items) => !rec || rec.status === 'stale' || rec.sig !== sigOf(items || []);

/** The plain-text request: what is copied, downloaded and put in the email. Quantities only, every quantity cited to its coverage line when there is one. */
export function requestText(rec, { compact = false } = {}) {
  const L = [`Quote request ${rec.ref}`, 'Prepared with the Sika product advisor demo. Demo: this was not sent to Sika\'s systems from the demo; it is an enquiry written by the sender.', '', `Project: ${rec.project}`, `Prepared: ${(rec.created || '').slice(0, 10)}`, '', 'Products and quantities:'];
  rec.lines.forEach((l, i) => {
    L.push(`${i + 1}. ${l.name}: ${lineOf(l)}${l.need ? `, need about ${l.need}` : ''}`);
    if (!compact) {
      if (l.basis) L.push(`   Basis: ${l.basis}`);
      if (l.phrase) L.push(`   Published coverage line: "${l.phrase}"${l.url ? ' ' + l.url : ''}`);
      else L.push('   No published coverage line was used: this quantity was set by the sender.');
    }
  });
  L.push('', 'Job:');
  L.push(`- Site: ${rec.site.text || 'not given'}`);
  L.push(`- Needed by: ${rec.needed.text || 'not given'}`);
  L.push(`- Supply: ${DELIVERY_TEXT[rec.delivery] || 'not given'}`);
  L.push(`- Sender: ${rec.role || 'not given'}${rec.company ? ', ' + rec.company : ''}`);
  L.push('', 'Contact:', `- Name: ${rec.contact.name}`, `- Email: ${rec.contact.email}`, `- Phone: ${rec.contact.phone || 'not given'}`, `- Best time: ${rec.contact.best || 'not given'}`);
  if (rec.notes) L.push('', `Notes: ${rec.notes}`);
  if (!compact && (rec.calcs || []).length) { L.push('', 'Calculations behind the quantities (estimates, with their working):'); rec.calcs.forEach((k, i) => { L.push(`${i + 1}. ${k.title}: ${k.answer}`); if (k.formula) L.push(`   Working: ${k.formula}`); if (k.source) L.push(`   Source: ${k.source}${k.url ? ' ' + k.url : ''}`); }); }
  if (!compact && rec.docs.length) { L.push('', 'Data sheets and safety data sheets for these products:'); rec.docs.forEach((d) => L.push(`- ${d.product} | ${d.kind} | ${d.title}`, `  ${d.url}`)); }
  L.push('', 'Please reply with a quote. No prices were requested or shown by the advisor.', '', ESTIMATE_LINE);
  return plain(L.join('\n')).replace(/ +\n/g, '\n') + '\n';
}

/* ------------------------------------------------------------------ the contact route (published addresses only) */
/** The email link. Uses ONLY the address in the published-contacts shard; with no published address it gives the published contact form instead and says so. */
export function buildMailto(routes, rec, { max = MAILTO_MAX } = {}) {
  const e = routes && routes.email && validEmail(routes.email.address) ? routes.email : null;
  if (!e) {
    const f = routes && Array.isArray(routes.forms) && routes.forms.find((x) => /^https:\/\/aus\.sika\.com\//.test(x.url));
    return f ? { kind: 'form', url: f.url, label: f.label, reason: 'Sika publishes no email address for this on the pages this demo holds, so use the published contact form and paste the copied request into it.' } : { kind: 'none', reason: 'No published contact route is available in this demo.' };
  }
  const subject = `Quote request ${rec.ref} from the Sika product advisor demo`;
  let body = requestText(rec); let level = 'full';
  if (encodeURIComponent(body).length > max) { body = requestText(rec, { compact: true }); level = 'compact'; }
  let truncated = false;
  if (encodeURIComponent(body).length > max) { truncated = true; level = 'cut'; while (encodeURIComponent(body + '\n[cut: use Copy the request for the full text]\n').length > max && body.length > 200) body = body.slice(0, Math.floor(body.length * 0.9)); body = body.replace(/[^\n]*$/, '') + '[cut: use Copy the request for the full text]\n'; }
  const href = `mailto:${e.address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { kind: 'mailto', href, to: e.address, label: e.label, subject, body, level, truncated, source: e.source, note: e.kind === 'technical' ? `${e.label} is the only email address Sika publishes on the pages this demo holds. There is no published sales address, so the request goes to the published address and says what it is.` : '' };
}

/* ------------------------------------------------------------------ the printable sheet model, the demand signal */
export function sheetModel(rec) {
  // the page holds more lines by setting them smaller; the documents list gives way first (every link stays in the copied request text)
  const n = rec.lines.length; const density = n <= 5 ? 'normal' : n <= 10 ? 'dense' : n <= 18 ? 'tight' : 'long'; // 19 or more lines: normal type, the sheet may run to a second page (no more squeezing to 5 pt)
  const docsShown = rec.docs.slice(0, { normal: 12, dense: 4, tight: 0, long: 12 }[density]);
  return {
    ref: rec.ref, title: 'Quote request', project: rec.project, prepared: (rec.created || '').slice(0, 10), density, banner: DEMO_BANNER, estimate: ESTIMATE_LINE,
    lines: rec.lines.map((l) => ({ name: l.name, qty: lineOf(l), need: l.need ? `about ${l.need}` : '', basis: l.basis, cite: l.phrase ? { text: l.phrase, url: l.url } : null })),
    job: [['Site', rec.site.text || 'Not given'], ['Needed by', rec.needed.text || 'Not given'], ['Supply', DELIVERY_TEXT[rec.delivery] || 'Not given'], ['Sender', (rec.role || 'Not given') + (rec.company ? ', ' + rec.company : '')]],
    contact: [['Name', rec.contact.name], ['Email', rec.contact.email], ['Phone', rec.contact.phone || 'Not given'], ['Best time', rec.contact.best || 'Not given']],
    calcs: (rec.calcs || []).map((k) => ({ title: k.title, answer: k.answer, formula: k.formula, source: k.source, url: k.url })),
    notes: rec.notes, docs: docsShown, docsMore: rec.docs.length - docsShown.length,
  };
}

export const STATE_RANGES = [['ACT', 200, 299], ['NT', 800, 999], ['NSW', 1000, 1999], ['ACT', 2600, 2618], ['NSW', 2000, 2599], ['NSW', 2619, 2899], ['ACT', 2900, 2920], ['NSW', 2921, 2999], ['VIC', 3000, 3999], ['QLD', 4000, 4999], ['SA', 5000, 5999], ['WA', 6000, 6999], ['TAS', 7000, 7999], ['VIC', 8000, 8999], ['QLD', 9000, 9999]];
/** The state a postcode belongs to by Australia Post's published ranges, or ''. */
export const stateOf = (pc) => { const n = +pc; if (!/^\d{4}$/.test(String(pc || ''))) return ''; const r = STATE_RANGES.find(([, a, b]) => n >= a && n <= b); return r ? r[0] : ''; };

/** What a demand signal would look like, with no personal data: no name, email, phone, company, notes or suburb ever enters it. */
export function demandSignal(quotes, now = new Date()) {
  const rows = (quotes || []).map((q) => ({
    ref: q.ref, date: (q.created || '').slice(0, 10), status: q.status, postcode: q.site && q.site.postcode || '', state: stateOf(q.site && q.site.postcode), role: q.role, supply: q.delivery, needed_by: q.needed && q.needed.iso || '',
    products: q.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit })),
  }));
  const by = new Map(); for (const r of rows) for (const p of r.products) { const x = by.get(p.id) || { id: p.id, name: p.name, requests: 0, lines: 0 }; x.requests++; x.lines += p.qty; by.set(p.id, x); }
  return { note: 'Demo only. Anonymous: no name, email, phone, company, notes or street address. Made in this browser from the quote requests prepared here; nothing was sent anywhere.', exported: now.toISOString(), requests: rows.length, by_product: [...by.values()].sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name)), by_state: Object.entries(rows.reduce((m, r) => { const s = r.state || 'Unknown'; m[s] = (m[s] || 0) + 1; return m; }, {})).map(([state, requests]) => ({ state, requests })), rows };
}

