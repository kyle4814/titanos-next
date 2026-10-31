// Actions v2, COMPARE MODE: two or three products side by side over the published fields. Every cell is the published wording of ONE source line,
// with that line's link beside it (data sheet page or product page). A field the documentation does not state says "Not published".
// Plain code, no model. The fields come from the advisor's own per-product shard (data/brain/p/<id>.json), the same record its labelled-field answers
// use (brain/attrs.js ATTRS), so a comparison cell and a one-product answer cannot disagree.
import { plain, src } from './core.js';
import { ATTRS } from '../brain/attrs.js';

export const NOT_PUB = 'Not published';
const ABSENT_SENTENCE = (name) => `This is not stated in the published product page or data sheet for ${name}.`;

/** The text a cell shows: plain, whitespace collapsed, cut at a word boundary. Exported so the tests apply the same rule to the raw data. */
export function clipCell(text, n = 200, stripHeading = true) {
  let t = plain(text).replace(/\s+/g, ' ').trim();
  // a data sheet section heading that ran on after the field ("... 20kg bag WHERE TO USE ...") is not part of the field
  const head = /\s(?=[A-Z]{3,}(?:\s+[A-Z&]{2,})+\b)/.exec(t); if (stripHeading && head && head.index > 8) t = t.slice(0, head.index).trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n); const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, '') + '...';
}
const pageUrl = (s) => (s && s.u ? s.u + (/\.pdf/i.test(s.u) && s.p ? '#page=' + s.p : '') : '');
const srcName = (s) => (s ? `${s.t === 'SDS' ? 'Safety data sheet' : s.t === 'PDS' ? 'Data sheet' : 'Product page'}${s.v ? ', ' + plain(s.v) : ''}${s.p && s.t === 'PDS' ? ', page ' + s.p : ''}` : 'Product page');
/** A cell from one fact ({ text, s }) of a shard. */
const fromFact = (f, n = 200) => (f && f.text && plain(f.text) ? { text: plain(f.text), shown: clipCell(f.text, n), source: src(pageUrl(f.s), srcName(f.s), plain(f.text)) } : null);
const fromPage = (sh, text, n = 200) => (text && plain(text) ? { text: plain(text), shown: clipCell(text, n), source: src(sh.u, 'Product page', plain(text)) } : null);
const first = (a) => (Array.isArray(a) && a.length ? a[0] : null);
const firstSentence = (t) => { const s = plain(t).replace(/\s+/g, ' '); const m = /^(.{20,}?[a-z0-9)%][.!?])(\s|$)/.exec(s); return m ? m[1] : s; };

/** The labelled fields of the advisor (brain/attrs.js) worth a column: id -> row label. */
const ATTR_ROWS = [['shelf', 'Shelf life'], ['mixing', 'Mixing ratio'], ['thickness', 'Layer thickness'], ['density', 'Density'], ['service_temp', 'Service temperature'], ['voc', 'VOC content'], ['fire', 'Reaction to fire'], ['overcoat', 'Waiting time to overcoating'], ['chem', 'Chemical resistance']];
const attrOf = (id) => ATTRS.find((a) => a.id === id);

/** Field definitions: { id, label, core, get(shard) -> { text, shown, source } | null }. core rows are always shown; the others only when a product states them. */
export const FIELDS = [
  { id: 'what', label: 'What it is', core: true, get: (sh) => fromPage(sh, firstSentence((sh.d && (sh.d.s || sh.d.t)) || ''), 220) },
  { id: 'pack', label: 'Pack sizes', core: true, get: (sh) => fromFact(first(sh.pk), 160) || fromPage(sh, sh.d && sh.d.pk, 160) },
  { id: 'coverage', label: 'Coverage', core: true, get: (sh) => fromFact(first(sh.r && sh.r.facts && sh.r.facts.consumption), 220) },
  { id: 'open', label: 'Open time', core: true, get: (sh) => fromFact(first(sh.tm && sh.tm.open_time)) },
  { id: 'adjust', label: 'Adjustability time', core: false, get: (sh) => fromFact(first(sh.tm && sh.tm.adjustability_time)) },
  { id: 'pot', label: 'Pot life', core: true, get: (sh) => fromFact(first(sh.tm && sh.tm.pot_life)) },
  { id: 'cure', label: 'Cure time', core: true, get: (sh) => fromFact(first(sh.tm && sh.tm.cure_times)) },
  { id: 'substrates', label: 'Substrates', core: true, get: (sh) => listFrom(sh, 'substrate', 7) },
  { id: 'tiles', label: 'Tile types', core: false, get: (sh) => listFrom(sh, 'tile_type', 5) },
  { id: 'standards', label: 'Standards', core: true, get: (sh) => standards(sh) },
  { id: 'certs', label: 'Certifications', core: false, get: (sh) => { const it = (sh.d && sh.d.sec || []).find((x) => /certificat|approvals/i.test(x.l || '') && x.t); return it ? fromPage(sh, it.t, 200) : null; } },
  ...ATTR_ROWS.map(([id, label]) => ({ id, label, core: false, get: (sh) => { const a = attrOf(id); const it = a && a.labels && (sh.d && sh.d.sec || []).find((x) => a.labels.test(x.l || '') && x.t); return it ? fromPage(sh, it.t, 200) : null; } })),
  { id: 'exclusion', label: 'A stated exclusion', core: true, get: (sh) => { const r = (sh.cp || []).find((x) => x.pol === 'no' && !x.cond && x.text); return r ? fromFact(r, 200) : null; } },
  { id: 'datasheet', label: 'Data sheet', core: true, get: (sh) => { const ds = sh.r && sh.r.ds; if (!ds || !ds.url) return null; const v = ds.doc_version ? `Data sheet, ${plain(ds.doc_version)}` : 'Data sheet'; return { text: v, shown: v, source: src(ds.url, v, v) }; } },
];

/** Published suitability lines carrying a tag (substrate or tile_type): the wording as written, first source line cited. */
function listFrom(sh, tag, max) {
  const rows = (sh.cp || []).filter((c) => c.pol === 'yes' && !c.cond && c.tags && Array.isArray(c.tags[tag]) && c.tags[tag].length && c.text);
  const seen = new Set(); const picked = [];
  for (const c of rows) { const k = plain(c.text).toLowerCase(); if (seen.has(k) || k.length > 90) continue; seen.add(k); picked.push(c); if (picked.length >= max) break; }
  if (!picked.length) return null;
  const text = picked.map((c) => plain(c.text)).join('; ');
  return { text, shown: clipCell(text, 240, false), source: src(pageUrl(picked[0].s), srcName(picked[0].s), plain(picked[0].text)), also: picked.slice(1).map((c) => src(pageUrl(c.s), srcName(c.s), plain(c.text))) };
}
/** Standards named in the data sheet text (AS ISO 13007, AS 3958, ...). */
function standards(sh) {
  const std = (sh.sp && sh.sp.std) || []; const ds = sh.sp && sh.sp.ds;
  const seen = new Set(); const picked = [];
  for (const s of std) { const k = plain(s.citation).replace(/\s+/g, '').toLowerCase(); if (seen.has(k) || /^scaqmd/i.test(s.citation)) continue; seen.add(k); picked.push(s); if (picked.length >= 5) break; }
  if (!picked.length) { const it = (sh.d && sh.d.sec || []).find((x) => /^product declaration$/i.test(x.l || '') && x.t); return it ? fromPage(sh, it.t, 200) : null; }
  const text = picked.map((s) => plain(s.citation)).join('; ');
  const url = ds && ds.url ? ds.url + (picked[0].page ? '#page=' + picked[0].page : '') : sh.u;
  return { text, shown: clipCell(text, 200, false), source: src(url, ds && ds.url ? `Data sheet${ds.edition ? ', ' + plain(ds.edition) : ''}${picked[0].page ? ', page ' + picked[0].page : ''}` : 'Product page', plain(picked[0].context || picked[0].citation)) };
}

/** The comparison table over 2 or 3 shards: [{ id, name, shard }]. Returns { head, cols, rows:[{ id, label, field, cells:[{ value, source, field, absent? }] }] }. */
export function compareTable(items) {
  const head = ['', ...items.map((x) => x.name)];
  const cols = items.map((x) => ({ id: x.id, name: x.name, href: '#/product/' + encodeURIComponent(x.id), url: x.shard ? x.shard.u : '' }));
  const rows = [];
  for (const f of FIELDS) {
    const got = items.map((x) => (x.shard ? f.get(x.shard) : null));
    if (!f.core && !got.some(Boolean)) continue;
    rows.push({ id: f.id, label: f.label, cells: got.map((g, i) => (g
      ? { value: g.shown, full: g.text, source: g.source, also: g.also || [], field: f.id }
      : { value: NOT_PUB, absent: true, source: src(items[i].shard ? items[i].shard.u : '', 'Product page', ABSENT_SENTENCE(items[i].name)), field: f.id })) });
  }
  return { head, cols, rows };
}
