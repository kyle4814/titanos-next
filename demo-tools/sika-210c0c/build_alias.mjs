// build_alias.mjs: writes data/brain/alias.json, the small alias table the header search box and the finder load (the brain's own table lives in
// the 1 MB core.json, which the search box must not download). Derived from core.json only: a key is kept when it is a way of naming a product that
// the product's own name does not already spell out (old names, "formerly" names, nicknames), keyed by product id.
// usage: node build_alias.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const { tokens } = await import(pathToFileURL(path.join(PORTAL, 'assets/brain/text.js')).href);
const core = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data/brain/core.json'), 'utf8'));
const alias = {};
for (const [key, pis] of Object.entries(core.alias).sort(([a], [b]) => (a < b ? -1 : 1))) {
  if (!key.includes(' ')) continue; // one-word keys are the fused spellings the query reader already splits (sikadur33 -> sikadur 33) or words too common to boost
  const ids = pis.map((i) => core.P[i]).filter((p) => p && !(tokens(key).every((t) => tokens(p.n + ' ' + p.id.replace(/-/g, ' ')).includes(t))));
  if (ids.length) alias[key] = ids.map((p) => p.id).sort();
}
for (const [key, a] of Object.entries(core.aka || {})) { const p = core.P[a.pi]; if (p) alias[key] = [...new Set([...(alias[key] || []), p.id])].sort(); } // "formerly" and "also known as" names the data sheets state
const out = JSON.stringify({ v: 1, source: 'data/brain/core.json', alias });
fs.writeFileSync(path.join(PORTAL, 'data/brain/alias.json'), out + '\n');
console.log(`alias.json: ${Object.keys(alias).length} keys, ${out.length} bytes`);
