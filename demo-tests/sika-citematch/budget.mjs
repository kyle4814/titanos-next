// budget.mjs: this change must not make the first screen or the offline cache heavier than the tree it started from (baseline.json, measured before the change).
// The absolute budgets (80 KB home, 8 MB cache) were already exceeded at the baseline: speed_budget.mjs reports those; this test only guards "no worse".
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { t, done, rdj } from './_lib.mjs';
import { PORTAL, HERE } from './_env.mjs';
const base = rdj(path.join(HERE, 'baseline.json')).speed;
const gz = (rel) => zlib.gzipSync(fs.readFileSync(path.join(PORTAL, rel)), { level: 6 }).length;
const home = ['index.html', 'dist/main.js', 'data/config.json', 'data/cats.lite.json'].reduce((a, r) => a + gz(r), 0);
t(`home first screen gzip ${home} B is not above the baseline ${base.home_first_screen_gzip} B`, home <= base.home_first_screen_gzip);
t(`dist/main.js gzip ${gz('dist/main.js')} B is not above the baseline ${base.main_js_gzip} B (search.js and the matcher load on first use, the source panel on first press)`, gz('dist/main.js') <= base.main_js_gzip);
const sw = fs.readFileSync(path.join(PORTAL, 'sw.js'), 'utf8'); const bytes = Number(/const BYTES = (\d+)/.exec(sw)[1]);
t(`service worker precache ${bytes} B grew by ${bytes - base.sw_bytes} B (limit 20000 B over the baseline ${base.sw_bytes} B)`, bytes - base.sw_bytes <= 20000);
t('the precache lists the new modules and stylesheet (offline works)', ['assets/brain/match.js', 'assets/lib/cite.js', 'assets/cite.css'].every((f) => sw.includes('"' + f + '"')));
t('alias.json is optional and not precached (a missing file only means plain name matching)', !sw.includes('alias.json'));
t('main.js does not carry the matcher (it is lazy)', !/spellToken/.test(fs.readFileSync(path.join(PORTAL, 'dist/main.js'), 'utf8')));
done('BUDGET');
