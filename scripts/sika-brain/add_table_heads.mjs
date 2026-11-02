// add_table_heads.mjs: give every published table-row fact in the brain shards its table's header row (and the line above it, the unit/basis caption).
//   node scripts/sika-brain/add_table_heads.mjs [portalDir]      Idempotent. Run after build_brain.mjs (build_brain flattens line breaks, so the header is lost there).
// A rate or time fact such as "300x100x10mm | 14m2 | 7m2 | 4m2" is one row of a table. The header row ("TILE SIZE | 1.5mm Joint | ...") and caption
// ("Grout coverage based on 2 Litre pail") are on the lines above it in data/p/<id>.json (which keeps its line breaks). Shard fact gets h = { c: header row, k: caption? }.
// Nothing is invented: when the first row of the table block is itself a row (no header line above it), or the cell counts do not fit, the fact gets no h.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const ws = (s) => String(s).replace(/\s+/g, ' ').trim();
const bare = (s) => ws(String(s).replace(/[®™©]/g, ''));
const cells = (s) => String(s).split(' | ').length;
/** Header (and caption) for one row fact, from the item texts (line breaks kept) of the product. Returns null when the data has none. */
export function headerFor(factText, itemTexts, factRows) {
  const want = ws(factText), wantB = bare(factText);
  if (!want.includes(' | ')) return null;
  const found = []; // one entry per place the same row text occurs: a row that sits in two different tables has no certain header, so it gets none
  for (const item of itemTexts) {
    const lines = String(item).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (ws(lines[i]) !== want && bare(lines[i]) !== wantB) continue;
      let j = i; while (j > 0 && lines[j - 1].includes(' | ')) j--;
      let out = null;
      if (j < i) {
        const head = ws(lines[j]); const n = cells(want), hn = cells(head);
        if (!factRows.has(head) && !factRows.has(bare(head)) && (hn === n || hn === n - 1)) {
          out = { c: head }; const cap = j > 0 ? ws(lines[j - 1]) : '';
          if (cap && !cap.includes(' | ') && cap.length <= 100 && !/^[*\u2020]/.test(cap)) out.k = cap;
        }
      }
      found.push(out);
    }
  }
  if (!found.length || found.some((x) => !x)) return null;
  return found.every((x) => x.c === found[0].c && x.k === found[0].k) ? found[0] : null;
}
export function run(portal) {
  const bdir = path.join(portal, 'data/brain/p'); let facts = 0, withHead = 0, files = 0, changed = 0;
  for (const f of fs.readdirSync(bdir)) {
    if (!f.endsWith('.json')) continue;
    const raw = fs.readFileSync(path.join(bdir, f), 'utf8'); const sh = JSON.parse(raw);
    const pf = path.join(portal, 'data/p', sh.id + '.json'); if (!fs.existsSync(pf)) continue;
    const prod = JSON.parse(fs.readFileSync(pf, 'utf8'));
    const items = (prod.sections || []).flatMap((s) => (s.items || []).map((it) => it.text)).filter(Boolean);
    const all = [...Object.values((sh.r && sh.r.facts) || {}), ...Object.values(sh.tm || {})].flat();
    const rows = new Set(all.map((x) => ws(x.text)).concat(all.map((x) => bare(x.text))));
    for (const x of all) {
      if (!x.text || !x.text.includes(' | ')) continue; facts++;
      delete x.h; const h = headerFor(x.text, items, rows); if (h) { x.h = h; withHead++; }
    }
    files++; const next = JSON.stringify(sh); if (next !== raw) { fs.writeFileSync(path.join(bdir, f), next); changed++; }
  }
  return { files, facts, withHead, changed };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(run(PORTAL)));
