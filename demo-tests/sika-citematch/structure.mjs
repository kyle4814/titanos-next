// structure.mjs: the three places that match what a person types all go through the ONE module, assets/brain/match.js. Grep-based.
import fs from 'node:fs';
import path from 'node:path';
import { t, done } from './_lib.mjs';
import { PORTAL } from './_env.mjs';
const A = path.join(PORTAL, 'assets');
const rd = (rel) => fs.readFileSync(path.join(A, rel), 'utf8');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const js = walk(A).filter((f) => f.endsWith('.js') && !/\/dist\//.test(f));
const imports = (rel, re) => re.test(rd(rel));
t('the matcher module exists', fs.existsSync(path.join(A, 'brain/match.js')));
t('brain.js imports the shared matcher', imports('brain/brain.js', /from '\.\/match\.js'/));
t('lib/search.js (finder text search and the header suggestions) imports the shared matcher', imports('lib/search.js', /from '\.\.\/brain\/match\.js'/));
t('the header search box reaches search.js only through searcher.js', imports('lib/chrome.js', /from '\.\/searcher\.js'/) && !imports('lib/chrome.js', /from '\.\/search\.js'/));
t('searcher.js loads search.js', imports('lib/searcher.js', /import\('\.\/search\.js'\)/));
t('the finder view (views.js) gets its search from searcher.js or search.js, nothing of its own', imports('lib/views.js', /getSearcher/) && !/const SYN\b|SYNONYM_GROUPS|applySlang/.test(rd('lib/views.js')));
// nobody else reads the synonym table or the slang table or keeps a private edit distance
const readers = (re) => js.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(A, f)).sort();
t('only match.js imports syn.js (a module preload string in brain-ui.js is not an import)', readers(/from '[^']*syn\.js'/).join() === 'brain/match.js', readers(/from '[^']*syn\.js'/).join());
t('only match.js imports slang.js', readers(/from '[^']*slang\.js'/).join() === 'brain/match.js', readers(/from '[^']*slang\.js'/).join());
t('search.js has no private synonym map', !/\bSYN\s*=|SYNONYM/.test(rd('lib/search.js')));
t('search.js has no private spelling or distance code', !/function dist\b|const dist\b|Levenshtein/i.test(rd('lib/search.js')));
t('brain.js has no private synonym groups, spelling or alias scan any more', !/SYNONYM_GROUPS|function pickSpans|function spell\(t\) \{[^}]*for \(const v of vocab\)/.test(rd('brain/brain.js')));
t('the matcher has no DOM, no fetch, no model call', !/document\.|window\.|\bfetch\(|XMLHttpRequest|anthropic|openai/i.test(rd('brain/match.js')));
done('STRUCTURE');
