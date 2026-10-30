// T02 test: coverage.json is not hand typed. Recompute the two numbers three ways and compare:
// (1) this file's own JS, (2) the python tool category_coverage.py (independent implementation), (3) the numbers in the file itself.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PORTAL, KNOW, ROOT } from './_env.mjs';
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const cov = rd(path.join(PORTAL, 'data/coverage.json')), products = rd(path.join(PORTAL, 'data/products.json'));
const rates = rd(path.join(KNOW, 'rates.json')).products;
const rej = new Set(fs.readFileSync(path.join(KNOW, 'evidence/verify_rejects.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id));
let fails = 0; const t = (name, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (d ? ' :: ' + d : '')); };
// (1) independent JS: a tile and stone product counts when it has a published consumption fact with a source link, not rejected, page number for data sheets
let n = 0, m = 0;
for (const p of products) {
  if (!p.categoryPath && !p.category) continue; const segs = String(p.category).split('/');
  if (segs[1] !== 'tile-stone-installationsystems') continue; n++;
  const r = rates[p.id]; if (!r || r.rate_status !== 'published') continue;
  const ok = (r.facts?.consumption || []).some((f) => !rej.has(f.id) && f.text && ((f.source?.doc_type === 'PDS' || f.source?.doc_type === 'SDS') ? f.source.url && Number.isInteger(f.source.page) : f.source?.url || f.source?.web_url));
  if (ok) m++;
}
t('tile and stone product count matches coverage.json', n === cov.tileStone.products, `${n} vs ${cov.tileStone.products}`);
t('tile and stone published-rate count matches coverage.json', m === cov.tileStone.ratePublished, `${m} vs ${cov.tileStone.ratePublished}`);
t('product and document totals match the data files', cov.products === products.length && cov.documents === rd(path.join(PORTAL, 'data/documents.json')).length, `${cov.products}/${cov.documents}`);
// (2) python implementation
try {
  execFileSync('python3', ['-I', path.join(ROOT, 'category_coverage.py')], { encoding: 'utf8', env: { ...process.env, PORTAL, KNOW } });
  const rec = rd(path.join(ROOT, 'receipts/category_coverage.json')).tile_stone;
  t('python tool agrees (products, complete)', rec.products === cov.tileStone.products && rec.complete === cov.tileStone.ratePublished, `python ${rec.complete} of ${rec.products}`);
} catch (e) { t('python tool runs', false, String(e.message).slice(0, 120)); }
t('manifest lists coverage.json', rd(path.join(PORTAL, 'data/manifest.json')).files.includes('coverage.json'));
t('panel sentence never says Sika does not have', !/does not have|doesn.t have|hasn.t got/i.test(fs.readFileSync(path.join(PORTAL, 'assets/lib/coverage_panel.js'), 'utf8')));
t('panel only speaks about tile and stone', !/waterproof|flooring|concrete|roofing|sealant/i.test(fs.readFileSync(path.join(PORTAL, 'assets/lib/coverage_panel.js'), 'utf8')));
console.log(fails ? `COVERAGE PANEL ${fails} failed` : 'COVERAGE PANEL GREEN');
process.exit(fails ? 1 : 0);
