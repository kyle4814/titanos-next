// SIMULATED-USER SUITE (sika-bughunt): eight personas doing realistic multi-step journeys in a real Chrome at four sizes,
// plus an inventory sweep (every category, 140 products incl. the top 40, sampled system sheets), seeded and deterministic.
// usage (Windows node, the only Chrome here): node.exe bughunt.mjs <baseUrl> <outDir> [seed=20261031] [sizes=1440x900,1920x1080,390x844,768x1024] [quick=0]
// Output: <outDir>/bughunt_results.json, one line per finding, exit 1 when any P1/P2 finding is open (known, accepted ones live in known_issues.json).
import fs from 'node:fs';
import { rng, pick, sample, launch, Sim, Findings } from './lib.mjs';
import { journeys } from './journeys.mjs';
import { sweeps } from './sweeps.mjs';

const [, , base0, outDir = './bughunt_out', seedArg = '20261031', sizesArg = '1440x900,1920x1080,390x844,768x1024', quick = '0'] = process.argv;
const base = base0.endsWith('/') ? base0 : base0 + '/';
fs.mkdirSync(outDir, { recursive: true });
const seed = Number(seedArg); const t0 = Date.now();
const get = async (p) => (await fetch(base + p)).json();
const D = { index: await get('data/index.json'), cats: await get('data/categories.json'), cfg: await get('data/config.json'), specsIdx: null, docs: null };
const F = new Findings();
const browser = await launch();
const sizes = sizesArg.split(',');
const swText = await (await fetch(base + 'sw.js')).text(); const tileProduct = ((/data\/p\/([a-z0-9-]+)\.json/.exec(swText)) || [])[1];
const ctx = { sizes, tileProduct, base, outDir, seed, D, F, browser, quick: quick === '1', get, rng, pick, sample };

// Phase 1: sweeps (inventory). Desktop sizes get the full sweep, phone and tablet get a seeded sample.
const sweepJobs = [];
for (const sz of sizes) sweepJobs.push((async () => { const s = await new Sim(browser, base, sz, 'sweep', F, outDir + '/shots').init(); await sweeps(s, ctx, rng(seed ^ sz.length ^ Number(sz.split('x')[0])), sz); await s.close(); })());
await Promise.all(sweepJobs);
const t1 = Date.now();
// Phase 2: personas, each at every size it applies to (all personas run on all four sizes; the keyboard and phone personas pin theirs).
const jobs = [];
for (const sz of sizes) jobs.push((async () => { await journeys(ctx, sz, rng(seed + Number(sz.split('x')[0]))); })());
await Promise.all(jobs);
await browser.close();

const slow = F.stepLog.filter((s) => s.slow);
const bySev = { P1: 0, P2: 0, P3: 0 }; F.list.forEach((f) => { bySev[f.sev]++; });
const personas = [...new Set(F.stepLog.map((s) => s.persona))].filter((p) => p !== 'sweep');
const known = fs.existsSync(new URL('./known_issues.json', import.meta.url)) ? JSON.parse(fs.readFileSync(new URL('./known_issues.json', import.meta.url), 'utf8')) : [];
const open = F.list.filter((f) => ['P1', 'P2'].includes(f.sev) && !known.some((k) => f.kind === k.kind && (!k.match || f.detail.includes(k.match))));
const summary = { seed, sizes, steps: F.steps, personas, journeyStepsByPersona: Object.fromEntries(personas.map((p) => [p, F.stepLog.filter((s) => s.persona === p).length])), slowSteps: slow.length, slowestMs: Math.max(0, ...F.stepLog.map((s) => s.ms)), findingsBySeverity: bySev, openP1P2: open.length, sweepSeconds: Math.round((t1 - t0) / 1000), totalSeconds: Math.round((Date.now() - t0) / 1000), controlsClicked: ctx.controlsClicked || 0, routesVisited: ctx.routesVisited ? ctx.routesVisited.size : 0 };
fs.writeFileSync(outDir + '/bughunt_results.json', JSON.stringify({ summary, advisorLog: ctx.advisorLog || [], findings: F.list, slow: slow.sort((a, b) => b.ms - a.ms).slice(0, 40) }, null, 1));
for (const f of F.list.sort((a, b) => a.sev.localeCompare(b.sev))) console.log(`${f.sev} ${f.kind} x${f.count} [${f.sizes.join(',')}] ${f.persona}/${f.step} ${f.route} :: ${f.detail}`.slice(0, 330));
console.log('SUMMARY ' + JSON.stringify(summary));
console.log(open.length ? `BUGHUNT FAIL ${open.length} open P1/P2 finding(s)` : `BUGHUNT PASS ${F.steps} steps, 0 open P1/P2`);
process.exit(open.length ? 1 : 0);
