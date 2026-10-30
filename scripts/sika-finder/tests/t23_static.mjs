// T23 ACCEPT: static pages per combination, hub, sitemap, robots, noscript fallback. Run after: node scripts/sika-finder/build_static.mjs
import fs from 'node:fs';
import path from 'node:path';
const P = new URL('../../../public/demo/sika-210c0c/', import.meta.url).pathname;
const S = JSON.parse(fs.readFileSync(P + 'data/finder/systems.json', 'utf8'));
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('PASS ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ' :: ' + e.message.split('\n')[0]); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion'); };
const visible = (h) => h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const slugs = Object.values(S.systems).map((x) => x.slug).sort();
const files = slugs.map((s) => P + 's/' + s + '/index.html');
t('page count equals the number of combinations in the system data (363); coverage-grid SYSTEM+PARTIAL count is not available in this lane', () => {
  ok(slugs.length === 363, 'slugs ' + slugs.length);
  const dirs = fs.readdirSync(P + 's').filter((d) => fs.statSync(P + 's/' + d).isDirectory()).sort();
  ok(dirs.length === slugs.length && dirs.every((d, i) => d === slugs[i]), 'dir mismatch ' + dirs.length);
});
let minText = 1e9, maxBytes = 0, minSrc = 1e9;
t('every page: at least 2,000 visible characters without JavaScript', () => { for (const f of files) { const n = visible(fs.readFileSync(f, 'utf8')).length; minText = Math.min(minText, n); ok(n >= 2000, f + ' ' + n); } console.log('   smallest visible text: ' + minText + ' chars'); });
t('every page is 150 KB or less (own target 60 KB)', () => { for (const f of files) { const n = fs.statSync(f).size; maxBytes = Math.max(maxBytes, n); ok(n <= 150 * 1024, f + ' ' + n); ok(n <= 60 * 1024, 'over own 60 KB target ' + f); } console.log('   largest page: ' + maxBytes + ' bytes'); });
t('every page has at least three source links to aus.sika.com', () => { for (const f of files) { const n = (fs.readFileSync(f, 'utf8').match(/href="https:\/\/aus\.sika\.com\//g) || []).length; minSrc = Math.min(minSrc, n); ok(n >= 3, f + ' ' + n); } console.log('   fewest source links: ' + minSrc); });
t('every page contains noindex, a canonical link, a link into the app, the demo line and the estimate line', () => {
  for (const f of files) { const h = fs.readFileSync(f, 'utf8').replace(/&#39;/g, "'"); ok(/<meta name="robots" content="noindex/.test(h), 'noindex ' + f); ok(/<link rel="canonical" href="[^"]+"/.test(h), 'canonical ' + f); ok(/href="\.\.\/\.\.\/#\/system\?tile=/.test(h), 'app link ' + f);
    ok(h.includes("Built from Sika Australia's public data sheets on 2026-10-30. Not an official Sika document. Technical Services decides suitability."), 'demo line ' + f); ok(h.includes('Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.'), 'estimate ' + f); }
});
t('no prices and no em or en dashes on any page', () => { for (const f of files) { const h = fs.readFileSync(f, 'utf8'); ok(!/\$\s?\d/.test(h), 'price ' + f); ok(!/[–—]/.test(h), 'dash ' + f); } });
t('no script tags and no external requests (no src or stylesheet links off host)', () => { for (const f of files) { const h = fs.readFileSync(f, 'utf8'); ok(!/<script/i.test(h), 'script ' + f); ok(!/<link[^>]+rel="stylesheet"/i.test(h), 'css ' + f); ok(!/(src)="https?:/i.test(h), 'src ' + f); } });
t('sitemap lists the hub and every page of this lane (other lanes entries may sit beside them), as absolute URLs', () => {
  const x = fs.readFileSync(P + 'sitemap.xml', 'utf8'); const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(locs.length >= slugs.length + 1, 'locs ' + locs.length); ok(locs.every((u) => /^https:\/\//.test(u)), 'absolute'); for (const s of slugs) ok(locs.some((u) => u.endsWith('/s/' + s + '/')), s);
});
t('hub links every page and says how many', () => { const h = fs.readFileSync(P + 's/index.html', 'utf8'); for (const s of slugs) ok(h.includes('href="' + s + '/"'), s); ok(/363 combinations/.test(h)); ok(/noindex/.test(h)); });
t('robots.txt disallows everything in the demo', () => { const r = fs.readFileSync(P + 'robots.txt', 'utf8'); ok(/Disallow: \/\s*$/m.test(r) && !/^Allow:/m.test(r)); });
t('index.html has a noscript block linking to the hub, and the shell is under 10 KB', () => { const h = fs.readFileSync(P + 'index.html', 'utf8'); ok(/<noscript>[\s\S]*href="s\/"[\s\S]*<\/noscript>/.test(h)); ok(fs.statSync(P + 'index.html').size < 10 * 1024); ok((h.match(/<noscript>/g) || []).length === 1, 'one noscript'); });
t('a sample page reads as real text (porcelain on concrete, internal floor)', () => { const v = visible(fs.readFileSync(P + 's/porcelain-on-concrete-internal-floor/index.html', 'utf8')); ok(/Davco.{0,20}Ceramaflex/.test(v) && /Ruled out by their own text/.test(v) && /Grey One Pot/.test(v) && /1 x 20 kg/.test(v), v.slice(0, 300)); });
console.log(`\nt23_static: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
