// match_unit.mjs: the shared matcher. Unit checks on the reading of a phrase, the 68 query set against a floor and against the measured baseline,
// and a mutation check: break one synonym (and one slang entry) in a temporary copy of the portal and the hit count must fall.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { t, done, rdj } from './_lib.mjs';
import { PORTAL, HERE } from './_env.mjs';
const M = await import(pathToFileURL(path.join(PORTAL, 'assets/brain/match.js')).href);
const base = rdj(path.join(HERE, 'baseline.json'));
const alias = rdj(path.join(PORTAL, 'data/brain/alias.json')).alias;

// ---- reading a phrase
const vocab = ['porcelain', 'adhesiv', 'waterproof', 'level', 'compound', 'primer', 'sealant', 'viscocrete'];
const has = (w) => vocab.includes(w);
let r = M.interpret('porcelin glue for outside', { vocab, has });
t('typo: "porcelin" is read as porcelain', r.tokens.includes('porcelain'), r.tokens.join(','));
t('synonym: "glue" carries adhesive as an alternative', [...(r.groups.get('glue') || [])].includes('adhesiv'), [...(r.groups.get('glue') || [])].join(','));
r = M.interpret('mud for tiling', { vocab, has });
t('slang: "mud" is read as adhesive', r.tokens.includes('adhesiv'), r.text);
r = M.interpret('sikaflex 11fc', { vocab, has });
t('fused code: "11fc" is split to 11 fc', /11 fc/.test(r.text), r.text);
r = M.interpret('sikaforce 7010', { alias });
t('old name: "sikaforce 7010" is an alias hit for the current product', r.aliasHits.length === 1 && r.aliasHits[0].pis.includes('sikaforce-648-l10f') && r.tokens.length === 0, JSON.stringify(r.aliasHits));
r = M.interpret('constructor', { alias });
t('a word like "constructor" does not hit Object.prototype', r.aliasHits.length === 0);
t('spelling: a known word is left alone', M.spellToken('adhesiv', vocab, has) === 'adhesiv');
t('spelling: a short word is left alone', M.spellToken('tilr', vocab, has) === 'tilr');
t('spelling: a 9+ letter word may be 2 edits away', M.spellToken('visokrete', vocab, has) === 'viscocrete');
t('synonymsByToken: caulk carries sealant', M.synonymsByToken('caulk', ['caulk']).get('caulk').has('sealant'));
const em = M.expandSynonyms('glue for tiles', ['glue', 'tile']);
t('brain form: a synonym is added at weight 0.4, the typed word stays 1', em.get('glue') === 1 && em.get('adhesiv') === 0.4);
t('findAliasSpans: longest phrase wins', M.findAliasSpans('index fidia 4mm please', alias).some((h) => h.key === 'index fidia 4mm' && h.k === 3));

// ---- the query set, through the real search module
const out = spawnSync(process.execPath, [path.join(HERE, 'measure.mjs'), '--json'], { encoding: 'utf8', env: { ...process.env, PORTAL } });
let m; try { m = JSON.parse(out.stdout.trim().split('\n').pop()); } catch { m = null; }
t('the query set measured', !!m && m.n >= 60, out.stderr.split('\n').find((l) => /Error/.test(l)) || (m && m.n));
if (m) {
  t(`query set has 60+ phrasings (n=${m.n}) in 5 kinds`, m.n >= 60 && Object.keys(m.byKind).length >= 5);
  t(`search box top-3 hit rate ${m.box.top3}/${m.n} beats the baseline ${base.search.box.top3}/${base.search.n}`, m.box.top3 > base.search.box.top3 + 10);
  t(`finder top-3 hit rate ${m.finder.top3}/${m.n} beats the baseline ${base.search.finder.top3}/${base.search.n}`, m.finder.top3 > base.search.finder.top3 + 10);
  t('search box top-1 beats the baseline', m.box.top1 > base.search.box.top1);
  t('floor: search box top-3 is at least 80%', m.box.top3 / m.n >= 0.8, (100 * m.box.top3 / m.n).toFixed(1) + '%');
  t('the search box and the finder agree (one matcher)', m.box.top3 === m.finder.top3);
  const bad = m.rows.filter((x) => /^(plain)$/.test(x.kind)); // plain phrasings worked before: none may get worse than the baseline's plain hits
  t('plain phrasings did not regress (14 of 16 or better)', bad.filter((x) => x.box >= 1 && x.box <= 3).length >= 14, bad.filter((x) => !(x.box >= 1 && x.box <= 3)).map((x) => x.q).join(' | '));
  fs.writeFileSync(path.join(os.tmpdir(), 'citematch_measure.json'), JSON.stringify(m));
}

// ---- mutation: break one synonym and one slang entry in a throw-away copy of the portal; the hit count must fall
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'citematch-mut-'));
if (!tmp || !path.basename(tmp).startsWith('citematch-mut-')) { t('mutation fixture dir', false, 'mktemp failed'); done('MATCH UNIT'); }
try {
  const mk = (rel) => fs.mkdirSync(path.join(tmp, rel), { recursive: true });
  mk('assets/brain'); mk('assets/lib'); mk('data/brain');
  for (const f of ['match.js', 'syn.js', 'slang.js', 'text.js']) fs.copyFileSync(path.join(PORTAL, 'assets/brain', f), path.join(tmp, 'assets/brain', f));
  for (const f of ['search.js', 'util.js']) fs.copyFileSync(path.join(PORTAL, 'assets/lib', f), path.join(tmp, 'assets/lib', f));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  for (const f of ['data/index.json', 'data/categories.json', 'data/brain/alias.json']) fs.copyFileSync(path.join(PORTAL, f), path.join(tmp, f));
  const run = () => { const o = spawnSync(process.execPath, [path.join(HERE, 'measure.mjs'), '--json'], { encoding: 'utf8', env: { ...process.env, PORTAL: tmp } }); try { return JSON.parse(o.stdout.trim().split('\n').pop()); } catch { return null; } };
  const clean = run();
  t('mutation control: the copy measures the same as the portal', !!clean && !!m && clean.box.top3 === m.box.top3, clean && clean.box.top3);
  const synF = path.join(tmp, 'assets/brain/syn.js'); const syn0 = fs.readFileSync(synF, 'utf8');
  const syn1 = syn0.replace("['adhesive', 'glue', 'bond', 'bonding', 'stick', 'fix', 'fixing', 'mastic']", "['adhesive', 'bond', 'bonding', 'stick', 'fix', 'fixing', 'mastic']");
  t('mutation: the synonym line was found and changed', syn1 !== syn0);
  fs.writeFileSync(synF, syn1); const mut1 = run();
  t(`mutation: removing "glue" from the adhesive synonyms lowers the hit count (${clean && clean.box.top3} -> ${mut1 && mut1.box.top3})`, !!mut1 && !!clean && mut1.box.top3 < clean.box.top3);
  fs.writeFileSync(synF, syn0);
  const slF = path.join(tmp, 'assets/brain/slang.js'); const sl0 = fs.readFileSync(slF, 'utf8');
  const sl1 = sl0.replace("{ rx: /\\bmud\\b/g, to: 'adhesive',", "{ rx: /\\bmudxx\\b/g, to: 'adhesive',");
  t('mutation: the slang line was found and changed', sl1 !== sl0);
  fs.writeFileSync(slF, sl1); const mut2 = run();
  t(`mutation: breaking the "mud" slang entry lowers the hit count (${clean && clean.box.top3} -> ${mut2 && mut2.box.top3})`, !!mut2 && !!clean && mut2.box.top3 < clean.box.top3);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
done('MATCH UNIT');
