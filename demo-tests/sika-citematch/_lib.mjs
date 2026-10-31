// tiny test helpers shared by the citematch node tests
import fs from 'node:fs';
let pass = 0, fail = 0;
export const t = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + String(detail).slice(0, 240) : '')); };
export const done = (label) => { console.log(`${label} ${fail ? 'RED' : 'GREEN'}: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); };
export const rdj = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
