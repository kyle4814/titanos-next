// validate_bank.mjs: every expectation in a bank file must be backed by the published data. Fails (exit 1) on any unsupported expectation.
//   node validate_bank.mjs [bank.json ...]     default: every bank file in this folder
import fs from 'node:fs';
import path from 'node:path';
import { products, shard, kb, PORTAL, HERE_DIR } from './_bankkit.mjs';
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['bank.json', 'blind4.json', 'wave2b.json', 'wave2c.json'].filter((f) => fs.existsSync(path.join(HERE_DIR, f)));
const pagesJson = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data/pages.json'), 'utf8')); const cfg = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data/config.json'), 'utf8'));
const allKb = JSON.stringify(kb).toLowerCase(); const allPages = JSON.stringify(pagesJson).toLowerCase();
const ids = new Set(products.map((p) => p.id)); const bad = []; let n = 0;
const norm = (s) => String(s || '').toLowerCase().replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
for (const f of files) {
  const rows = JSON.parse(fs.readFileSync(path.isAbsolute(f) ? f : path.join(HERE_DIR, f), 'utf8')); const seen = new Set();
  for (const r of rows) {
    n++; const e = r.exp || {}; const w = (m) => bad.push(`${f} ${r.id} "${r.q}" :: ${m}`);
    if (!r.q || !r.type) w('missing q or type'); if (r.id && seen.has(r.id)) w('duplicate id'); seen.add(r.id);
    if (r.src === undefined && /^(a|d)\d/.test(r.id || '')) w('no source note');
    for (const id of [e.product, ...(e.alt || []), ...(e.products || [])].filter(Boolean)) if (!ids.has(id)) w('unknown product ' + id);
    if (e.product && ids.has(e.product)) {
      const sh = shard(e.product);
      if (r.type === 'attr' && e.has === true && e.contains) { const hay = norm(JSON.stringify(sh.d)); if (!hay.includes(norm(e.contains).slice(0, 40))) w('expected text not in data: ' + e.contains.slice(0, 40)); }
      if (r.type === 'attr' && e.has === false && e.label && new RegExp(e.label.replace(/^\/|\/[a-z]*$/g, ''), 'i').test(JSON.stringify(sh.d))) w('data has the field the bank says is absent: ' + e.label);
      if (r.type === 'rate' && !(sh.r && sh.r.facts && (sh.r.facts.consumption || []).length) && e.has !== false) w('no consumption facts');
      if (r.type === 'calc' && !(sh.r && sh.r.facts && (sh.r.facts.consumption || []).length) && e.has !== false) w('no consumption facts for calc');
      if (r.type === 'time' && e.has !== false) { const any = sh.tm && Object.values(sh.tm).some((v) => v && v.length); const sec = (sh.d.sec || []).some((x) => /time|pot life|cure|open|skin|tack|waiting|curing/i.test(x.l)); if (!any && !sec) w('no time data'); if (e.key && !(sh.tm && sh.tm[e.key] && sh.tm[e.key].length) && !(e.alt && e.alt.length)) w('tm.' + e.key + ' empty'); }
      if (r.type === 'doc' && e.docType && !(sh.dc || []).some((d) => d.ty === e.docType && d.ok)) w('no ' + e.docType);
      if (r.type === 'doc' && !e.docType && !(sh.dc || []).some((d) => d.ok) && e.has !== false) w('no documents');
    }
    if (r.type === 'business' && e.url) { const rx = new RegExp(e.url, 'i'); const pg = kb.pages.filter((p) => rx.test(p.u)); const pj = pagesJson.filter((p) => rx.test(p.url || '')); const cl = Object.values(cfg.links || {}).filter((u) => rx.test(u)); if (!pg.length && !pj.length && !cl.length && !e.nodata) w('no page for ' + e.url); if (e.must && !(pg.concat(pj).some((p) => norm(JSON.stringify(p)).includes(norm(e.must))) || allKb.includes(norm(e.must)) || allPages.includes(norm(e.must)))) w('no page text has "' + e.must + '"'); }
    if (r.type === 'system' && !fs.existsSync(path.join(PORTAL, 'systems', e.slug))) w('no system sheet ' + e.slug);
    if ((r.type === 'best' || r.type === 'list') && !(e.allowed && e.allowed.length)) w('no allowed set');
    if (r.type === 'compare' && !(e.products && e.products.length >= 2)) w('compare needs 2 products');
  }
}
console.log(`validate_bank: ${n} rows in ${files.join(', ')}; ${bad.length} unsupported`);
bad.slice(0, 60).forEach((x) => console.log('  ' + x));
process.exit(bad.length ? 1 : 0);
