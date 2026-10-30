// build_problems.mjs (T22): derives data/knowledge/problems.json from the published product pages in data/p (tile and stone range).
// Every item is a verbatim passage cut from one product page, with that page as its source. It does not diagnose: it shows what the
// published text says about the words of each symptom. A chip with no passage hands off (T06) in the UI.
// usage: node build_problems.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = process.argv[2] || path.join(HERE, '..', 'public', 'demo', 'sika-210c0c');
const DATA = path.join(PORTAL, 'data');

export const CHIPS = [
  { id: 'hollow', ask: /hollow|drumm|sounds? empty/, label: 'Tiles sound hollow', rx: /\bhollow\b|\bdrumm|\bvoids?\b|sufficient coverage|full(y)? (bed|contact)|back.?butter(ing)? (is )?(required|recommended)/i, no: /\|/ },
  { id: 'lifting', ask: /(tiles?).{0,25}(lift|lifting|popping|coming (off|loose|up)|loose|debond)|(lifting|loose|popping) tiles?/, label: 'Tiles lifting', rx: /\bdebond|delaminat|bond failure|\bloose tiles?\b|firmly (fixed|bonded)|tiles? (lift|lifting|come loose)/i, no: /\|/ },
  { id: 'not-setting', ask: /(adhesive|grout|tile fix\w*).{0,30}(not|won't|isn't|hasn't|wont|never).{0,15}(set|dry|cure|harden)|still (wet|soft|tacky)|not (setting|curing|drying)/, label: 'Adhesive not setting', rx: /(humidity|temperature|cold|weather|site conditions|climate).{0,70}\b(setting|curing|cure|set)\b|\b(setting|curing|cure)\b.{0,40}(prolong|longer|slower|slow|retard|affected)|\btacky\b/i, no: /\|/, notWhere: /^Usage/ },
  { id: 'grout-cracking', ask: /grout.{0,20}crack|crack\w*.{0,12}(in )?(the )?grout/, label: 'Grout cracking', rx: /\bcrack(s|ing|ed)?\b|movement joints?|control joints?|expansion joints?/i, no: /\||subject to movement|bond breaker|polyethylene/i, bonus: /\bcrack/i },
  { id: 'colour', ask: /grout.{0,25}(colou?r|shade).{0,25}(uneven|patchy|different|vary|varies|inconsistent)|(uneven|patchy|blotchy).{0,15}grout|patchy grout/, label: 'Grout colour uneven', rx: /colou?r (variation|consisten|difference|match)|shade variation|even colou?r|colou?r.{0,20}(vary|varies|may differ)/i, no: /\|/ },
  { id: 'white-marks', ask: /white (marks?|stains?|powder|haze|film|residue|deposits?)|efflorescence/, label: 'White marks on grout', rx: /efflorescence|white (marks?|stains?|deposits?|powder|haze|residue)|grout haze|cement haze/i, no: /\||laitance and efflorescence must|free (from|of)/i },
  { id: 'staining', ask: /(grout|tiles?).{0,20}stain|stain\w*.{0,12}(on|in) (the )?(grout|tiles?)/, label: 'Staining', rx: /\bstain(s|ing|ed)?\b|discolou?r/i, no: /\|/ },
  { id: 'dusting', ask: /grout.{0,20}(dust|powder|crumbl)|dusting grout|dusty grout/, label: 'Grout dusting', rx: /\bdusting\b|\bcrumbl|\bpowdery\b|\bpowdering\b|surface (dust|powder)/i, no: /\|/ },
  { id: 'mould', ask: /(silicone|sealant|shower|grout).{0,20}(mou?ld|mildew|black spots?)|mou?ldy/, label: 'Silicone mould', rx: /mou?ld\b|mildew|fung(i|al|us)/i, no: /\|/, scope: 'tile' },
  { id: 'water', ask: /water.{0,15}(getting|coming|leaking|seeping) (through|in)|leak(s|ing)? through|water.{0,20}through (the )?(tiles?|floor|wall|grout)/, label: 'Water getting through', rx: /\bleak(s|ing|age)?\b|water ?tight|water ingress/i, no: /\||leak flange/i, scope: 'tile' },
];

const sentences = (t) => String(t || '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 25 && s.length <= 420);
const stripMarks = (s) => s; // passages are kept verbatim; the UI runs plain() for display only

export function build() {
  const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
  const tile = idx.filter((p) => /tile-stone/.test(p.c || p.category || '') || /tile-stone/.test(JSON.stringify(p).slice(0, 400)));
  const ids = fs.readdirSync(path.join(DATA, 'p')).map((f) => f.replace(/\.json$/, ''));
  const prods = [];
  for (const id of ids) {
    const p = JSON.parse(fs.readFileSync(path.join(DATA, 'p', id + '.json'), 'utf8'));
    if (/tile-stone/.test(p.category)) prods.push(p);
  }
  const chips = CHIPS.map((c) => {
    const items = [];
    for (const p of prods) {
      if (c.scope !== 'all' && !/tile-stone/.test(p.category)) continue;
      if (c.cat && !c.cat.test(p.category)) continue;
      const places = [];
      for (const s of p.sections || []) for (const it of s.items || []) places.push({ where: s.title + (it.label ? ' / ' + it.label : ''), text: it.text });
      for (const u of p.usage || []) places.push({ where: 'Usage', text: u });
      for (const a of p.attributes || []) places.push({ where: 'Product features', text: a });
      let best = null;
      for (const pl of places) for (const s of sentences(pl.text)) {
        if (!c.rx.test(s) || (c.no && c.no.test(s)) || (c.notWhere && c.notWhere.test(pl.where))) continue;
        const score = (s.match(c.rx) || [''])[0].length + (s.length < 200 ? 5 : 0) + (c.bonus && c.bonus.test(s) ? 30 : 0);
        if (!best || score > best.score) best = { score, where: pl.where, text: s };
      }
      if (best) items.push({ product: p.id, name: p.name, url: p.url, where: best.where, quote: best.text, score: best.score });
    }
    items.sort((a, b) => b.score - a.score || a.product.localeCompare(b.product));
    const kept = items.slice(0, 5).map(({ score, ...r }) => r);
    return { id: c.id, label: c.label, askRx: c.ask.source, items: kept, products: [...new Set(kept.map((i) => i.product))].map((id) => ({ id, name: kept.find((i) => i.product === id).name })) };
  });
  return { generated: new Date().toISOString().slice(0, 10), source: 'Product pages on aus.sika.com in the tile and stone range, read 2026-10-30. Passages are verbatim.', products: prods.length, chips };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = build();
  fs.mkdirSync(path.join(DATA, 'knowledge'), { recursive: true });
  fs.writeFileSync(path.join(DATA, 'knowledge', 'problems.json'), JSON.stringify(out, null, 1));
  console.log('problems.json:', out.products, 'products;', out.chips.map((c) => c.id + '=' + c.items.length).join(' '));
}
