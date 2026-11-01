// Mutation check: break the code in a temporary COPY and prove the sales tests notice. A control run on the unmutated copy must pass first.
// Fails closed: if the temporary folder cannot be made, nothing is copied or run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'assets');
let tmp; try { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-mut-')); } catch { console.log('FAIL: could not make a temporary folder'); process.exit(1); }
if (!tmp || !path.basename(tmp).startsWith('sales-mut-')) { console.log('FAIL: temporary folder not valid'); process.exit(1); }
let passes = 0, fails = 0; const t = (n, ok, d = '') => { if (ok) passes++; else { fails++; console.log('FAIL ' + n + (d ? ' :: ' + d : '')); } };
const copy = () => { const dst = fs.mkdtempSync(path.join(tmp, 'a-')); for (const f of ['actions', 'lib/projectstore.js', 'lib/finder/calc.js']) { const from = path.join(SRC, f), to = path.join(dst, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(from, to, { recursive: true }); } return dst; };
const run = (test, dst) => spawnSync('node', ['--no-warnings', path.join(HERE, test)], { env: { ...process.env, QUOTE_ASSETS: dst }, encoding: 'utf8', timeout: 240000 });
const mutate = (dst, file, from, to) => { const p = path.join(dst, file); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(from)) throw new Error('mutation anchor missing: ' + from.slice(0, 50)); fs.writeFileSync(p, s.replace(from, to)); };
const MUTS = [
  ['an email check that only looks for @', 't_intake.mjs', 'actions/quote.js', "if (t.length > 120 || /\\s/.test(t)) return false;", "return /@/.test(t);"],
  ['dates in the past accepted', 't_intake.mjs', 'actions/quote.js', "if (d < today) return { ok: false, error: TEMPLATES.invalid.datePast };", ""],
  ['skip allowed on a required step', 't_intake.mjs', 'actions/quote.js', "const SKIPPABLE = new Set(['site', 'needed', 'delivery', 'company', 'phone', 'besttime', 'notes']);", "const SKIPPABLE = new Set(['site', 'needed', 'delivery', 'company', 'phone', 'besttime', 'notes', 'name', 'email', 'who']);"],
  ['the mailto goes to an address that is not in the published shard', 't_quote.mjs', 'actions/quote.js', "mailto:${e.address}?subject", "mailto:sales@sika.com.au?subject"],
  ['the mailto body is cut short', 't_quote.mjs', 'actions/quote.js', "let body = requestText(rec); let level = 'full';", "let body = requestText(rec).slice(0, 300); let level = 'full';"],
  ['a taken reference is reused', 't_quote.mjs', 'actions/quote.js', "if (!used.has(ref)) return ref;", "return ref;"],
  ['the cart signature ignores quantities, so an edit never marks a quote stale', 't_quote.mjs', 'lib/projectstore.js', "`${i.id}:${i.qty}:${i.unit}`", "`${i.id}`"],
  ['the demand signal leaks the email', 't_quote.mjs', 'actions/quote.js', "role: q.role, supply: q.delivery,", "role: q.role, supply: q.delivery, email: q.contact.email,"],
  ['clearing the project keeps the quotes', 't_quote.mjs', 'lib/projectstore.js', "p.items = []; p.quotes = [];", "p.items = [];"],
];
{ const dst = copy(); const r = run('t_intake.mjs', dst); t('control: the unmutated copy passes t_intake', r.status === 0, (r.stdout || '').slice(-200)); const r2 = run('t_quote.mjs', dst); t('control: the unmutated copy passes t_quote', r2.status === 0, (r2.stdout || '').slice(-200)); }
for (const [name, test, file, from, to] of MUTS) { const dst = copy(); try { mutate(dst, file, from, to); } catch (e) { t(`mutation "${name}" could be applied`, false, e.message); continue; } const r = run(test, dst); t(`mutation caught: ${name}`, r.status !== 0 && /FAIL/.test(r.stdout || ''), `status ${r.status}`); }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp only */ }
console.log(`t_mutation: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
