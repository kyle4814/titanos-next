// brain_golden.mjs: the brain golden rate must be at or above the baseline measured before the matcher moved (baseline.json).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { t, done, rdj } from './_lib.mjs';
import { HERE } from './_env.mjs';
const base = rdj(path.join(HERE, 'baseline.json')).golden;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'citematch-golden-')); if (!tmp || !path.basename(tmp).startsWith('citematch-golden-')) { t('temp dir', false, 'mktemp failed'); done('BRAIN GOLDEN'); }
try {
  const out = path.join(tmp, 'last_run.json');
  const r = spawnSync(process.execPath, [path.join(HERE, '../sika-brain/run_golden.mjs')], { encoding: 'utf8', env: { ...process.env, GOLDEN_OUT: out } });
  t('run_golden.mjs exits 0 (bar 95%, property test clean)', r.status === 0, (r.stdout.match(/GOLDEN .*/) || [r.stderr.slice(0, 200)])[0]);
  const j = rdj(out);
  t(`golden ${j.ok}/${j.n} is at or above the baseline ${base.ok}/${base.n}`, j.n === base.n && j.ok >= base.ok, `${(100 * j.ok / j.n).toFixed(2)}% vs ${(100 * base.ok / base.n).toFixed(2)}%`);
  t('property test: zero violations', !j.propBad || j.propBad.length === 0, JSON.stringify((j.propBad || []).slice(0, 2)));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
done('BRAIN GOLDEN');
