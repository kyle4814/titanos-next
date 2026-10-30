// Mutation test for P1: the engine is fed a scratch copy of the data in which one published rate is changed (7.5 -> 8.5);
// the source texts stay pristine, so props.mjs must fail and name the number 8.5.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PORTAL, ROOT } from './_env.mjs';
const base = process.env.AQ_SCRATCH || os.tmpdir();
const tmp = fs.mkdtempSync(path.join(base, 'mut-'));
if (!tmp || !path.basename(tmp).startsWith('mut-')) { console.log('FAIL: scratch dir not created'); process.exit(2); }
try {
  const dst = path.join(tmp, 'data'); fs.cpSync(path.join(PORTAL, 'data'), dst, { recursive: true });
  const pf = path.join(dst, 'products.json'); const ps = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const p = ps.find((x) => x.id === 'davco-grey-one-potadhesive'); let hits = 0;
  const walk = (o) => { for (const k of Object.keys(o)) { if (typeof o[k] === 'string') { if (/7\.5/.test(o[k])) { o[k] = o[k].replace(/7\.5/g, '8.5'); hits++; } } else if (o[k] && typeof o[k] === 'object') walk(o[k]); } };
  walk(p);
  if (!hits) { console.log('FAIL: nothing to mutate (7.5 not found in the product)'); process.exit(2); }
  fs.writeFileSync(pf, JSON.stringify(ps));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'props.mjs')], { env: { ...process.env, PROPS_ENGINE_DATA: dst }, encoding: 'utf8' });
  const named = /P1: number 8\.5 /.test(r.stdout);
  console.log(r.status !== 0 && named ? `MUTATION CAUGHT: props.mjs exited ${r.status} and named 8.5 (${hits} text(s) changed)` : `MUTATION MISSED: exit ${r.status}, named 8.5: ${named}`);
  process.exit(r.status !== 0 && named ? 0 : 1);
} finally { if (path.basename(tmp).startsWith('mut-') && tmp.startsWith(base)) fs.rmSync(tmp, { recursive: true, force: true }); }
