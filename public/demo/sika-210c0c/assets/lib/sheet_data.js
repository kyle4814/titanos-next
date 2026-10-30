// Programme (published cure and wait times) and draft specification text for a tiling system sheet (T21 and T20).
// parseSheet() reads the system sheet HTML that already exists (systems/<slug>/index.html); nothing else is fetched from outside this host.
import { h, icon } from './util.js';
import { loadK, linkOk } from './apply_data.js';
import { breadcrumb } from './components.js';

/** Pure: sheet HTML -> {title, answers:{label:value}, steps:[{n,label,products:[id]}]}. */
export function parseSheet(html) {
  const dec = (s) => String(s || '').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const title = dec((/<h1>([\s\S]*?)<\/h1>/.exec(html) || [])[1]);
  const answers = {};
  for (const m of html.matchAll(/<dt>([^<]*)<\/dt>\s*<dd>([^<]*)<\/dd>/g)) answers[dec(m[1])] = dec(m[2]);
  const steps = [];
  const parts = html.split('<li class="card step"').slice(1);
  for (const part of parts) {
    const hm = /<h3>\s*Step (\d+)\.\s*([^<]*)/.exec(part); if (!hm) continue;
    const products = []; for (const m of part.matchAll(/data-product="([^"]+)"/g)) if (!products.includes(m[1])) products.push(m[1]);
    steps.push({ n: +hm[1], label: dec(hm[2]), products });
  }
  return { title, answers, steps };
}

const srcA = (s) => !s ? null : h('a', { class: 'link link--ext', href: s.u + (s.t === 'PDS' && s.p ? `#page=${s.p}` : ''), target: '_blank', rel: 'noopener noreferrer' }, `${s.t === 'PDS' ? 'Data sheet' : 'Product page'}${s.v ? ', ' + s.v : ''}${s.p ? ', page ' + s.p : ''}`);

export async function sheetPanels(parsed, names) {
  const [{ programmeOf, STEPS, PROGRAMME_CAVEAT }, { supplyClause, referencesLines, DRAFT_LABEL, STANDARDS_NOTE }, { plain }] = await Promise.all([import('../assistant/times.js'), import('../assistant/clause.js'), import('../assistant/answer.js')]);
  const ids = [...new Set(parsed.steps.flatMap((s) => s.products))];
  const K = new Map();
  await Promise.all(ids.map(async (id) => { K.set(id, await loadK(id)); }));
  const nm = (id) => plain(names.get(id) || id);
  // Programme
  const rows = [];
  for (const st of parsed.steps) for (const id of st.products) {
    const k = K.get(id); const prog = k ? programmeOf(k).filter((x) => !x.notPublished) : [];
    if (!prog.length) { rows.push(h('tr', null, h('td', null, `Step ${st.n}. ${st.label}`), h('td', null, nm(id)), h('td', { colspan: '3' }, 'Time not published'))); continue; }
    for (const s of prog) for (const it of s.items) rows.push(h('tr', null, h('td', null, `Step ${st.n}. ${st.label}`), h('td', null, nm(id)), h('td', null, s.label), h('td', null, h('blockquote', null, it.text), it.conditions && it.conditions.length ? h('span', { class: 'src' }, it.conditions.join(' ')) : null), h('td', null, srcA(it.s))));
  }
  const programme = h('section', { class: 'data-tab' }, h('h2', null, 'Programme from published times'),
    h('p', { class: 'notice' }, icon('info'), 'Each time is the data sheet sentence. A step with no published time says so; nothing is added up or estimated.'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['System step', 'Product', 'Time for', 'The data sheet says', 'Source'].map((x) => h('th', { scope: 'col' }, x)))), h('tbody', null, rows))),
    h('p', { class: 'blk-note' }, PROGRAMME_CAVEAT));
  // Draft specification: one clause per step (first listed product; the sheet lists alternatives), references, bundle
  const substrate = parsed.answers.Substrate || null;
  const lines = ['Draft specification text', DRAFT_LABEL, ''];
  const stds = [];
  const bundle = [];
  for (const st of parsed.steps) {
    const id = st.products[0]; if (!id) { lines.push(`${st.n}. ${st.label}: not stated in the published documentation.`); continue; }
    const k = K.get(id); const sp = k && k.spec;
    const ds = sp && sp.ds ? { title: sp.ds.title, version: sp.ds.edition || (sp.ds.version ? 'Version ' + sp.ds.version : null), date: null } : (k && k.rates && k.rates.ds ? { title: nm(id), version: k.rates.ds.doc_version, date: k.rates.ds.listed_version_date } : null);
    if (!ds) { lines.push(`${st.n}. ${st.label}: ${nm(id)}. Data sheet version not available in the published data I hold.`); continue; }
    lines.push(`${st.n}. ${st.label}. ` + supplyClause({ product: nm(id), substrate, title: ds.title, version: ds.version, date: ds.date }));
    if (sp) { stds.push(...(sp.std || [])); const u = sp.ds && sp.ds.url; if (u && !bundle.some((b) => b.url === u)) bundle.push({ title: `${nm(id)} data sheet`, url: u }); }
    const sds = k && k.safety && (k.safety.sds || []).find((x) => x.latest_for_name && x.name_matches_product); if (sds && sds.url && !bundle.some((b) => b.url === sds.url)) bundle.push({ title: `${nm(id)} safety data sheet`, url: sds.url });
  }
  const refs = referencesLines(stds);
  if (refs.length) { lines.push('', 'References cited in the data sheets', ...refs.map((r) => '- ' + r), STANDARDS_NOTE); }
  const box = h('textarea', { class: 'spec-box', id: 'sheet-spec-text', 'aria-label': 'Draft specification text, editable' }); box.value = lines.join('\n') + '\n';
  const status = h('span', { role: 'status', 'aria-live': 'polite', class: 'src' });
  const copy = h('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(box.value); status.textContent = 'Copied to the clipboard.'; } catch { box.select(); status.textContent = 'Select the text and copy it.'; } } }, 'Copy');
  const okBundle = []; for (const b of bundle) if (await linkOk(b.url)) okBundle.push(b);
  const spec = h('section', { class: 'data-tab' }, h('h2', null, 'Draft specification text'), h('p', { class: 'notice' }, icon('info'), DRAFT_LABEL), h('div', { class: 'spec-tools' }, copy, status), box,
    okBundle.length ? h('div', null, h('h3', null, 'Data sheet bundle (links)'), h('ul', null, okBundle.map((b) => h('li', null, h('a', { class: 'link link--ext', href: b.url, target: '_blank', rel: 'noopener noreferrer' }, plain(b.title)))))) : null);
  return { programme, spec, specText: box.value };
}

/** Route #/system-data/<slug>: the programme and draft specification for one system sheet. */
export async function systemDataView(ctx) {
  const slug = ctx.slug; const { data } = await import('./data.js');
  const r = await fetch(new URL(`../../systems/${encodeURIComponent(slug)}/index.html`, import.meta.url)).catch(() => null);
  if (!r || !r.ok) return { el: h('div', { class: 'container section' }, h('h1', null, 'System not found'), h('p', null, 'There is no system sheet with that name.')), title: 'System not found', nav: 'selector' };
  const parsed = parseSheet(await r.text());
  const names = new Map((await data.index()).map((p) => [p.id, p.n]));
  const P = await sheetPanels(parsed, names);
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'System selector', href: '#/selector' }, { label: parsed.title }]),
    h('h1', null, parsed.title), h('p', null, h('a', { class: 'link', href: `systems/${slug}/` }, 'Back to the system sheet')), P.programme, P.spec);
  return { el, title: parsed.title + ': programme and draft specification', nav: 'selector' };
}
