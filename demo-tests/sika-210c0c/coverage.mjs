// T18 (c) coverage grid: every tile type x substrate x location from the engine's FACETS, run through guide().
// SYSTEM = every guide slot filled; PARTIAL = some slots filled; HANDOFF = none. Writes coverage.json and coverage.md next to this file.
import fs from 'node:fs';
import path from 'node:path';
import { loadEngine } from './_engine.mjs';
import { ROOT } from './_env.mjs';
const { assistant, SYN } = await loadEngine();
const F = SYN.FACETS; const T = F.tileType, S = F.substrate, L = F.location;
const slotNames = Object.values(SYN.GUIDE_SLOTS).map((s) => s.id || s.slot || s.name).filter(Boolean);
const cells = []; const tot = { SYSTEM: 0, PARTIAL: 0, HANDOFF: 0 };
for (const t of T) for (const s of S) for (const l of L) {
  const g = assistant.guide({ tileType: t.id, substrate: s.id, location: l.id });
  const slots = (g.state && g.state.slots) || {}; const filled = Object.entries(slots).filter(([, v]) => v && v.length).map(([k]) => k);
  const want = slotNames.length ? slotNames : Object.keys(slots);
  const status = filled.length && want.every((k) => filled.includes(k)) ? 'SYSTEM' : filled.length ? 'PARTIAL' : 'HANDOFF';
  tot[status]++; cells.push({ tileType: t.id, substrate: s.id, location: l.id, status, filled });
}
const total = T.length * S.length * L.length;
const out = { generated: new Date().toISOString(), facets: { tileType: T.length, substrate: S.length, location: L.length }, total, slots: slotNames, totals: tot, cells };
const bad = [];
if (cells.length !== total) bad.push(`cells ${cells.length} != product of facet counts ${total}`);
if (tot.SYSTEM + tot.PARTIAL + tot.HANDOFF !== total) bad.push('totals do not add up');
fs.writeFileSync(path.join(ROOT, 'coverage.json'), JSON.stringify(out));
const md = [`# Coverage grid (guide() over every tile type x substrate x location)`, '', `${T.length} tile types x ${S.length} substrates x ${L.length} locations = ${total} combinations.`, '', `| Status | Count | Share |`, `|---|---|---|`, ...Object.entries(tot).map(([k, v]) => `| ${k} | ${v} | ${(100 * v / total).toFixed(1)}% |`), '', 'SYSTEM = every slot filled (' + (slotNames.join(', ') || 'see JSON') + '); PARTIAL = some; HANDOFF = none.', ''];
for (const l of L) { const row = cells.filter((c) => c.location === l.id); md.push(`- ${l.id}: SYSTEM ${row.filter((c) => c.status === 'SYSTEM').length}, PARTIAL ${row.filter((c) => c.status === 'PARTIAL').length}, HANDOFF ${row.filter((c) => c.status === 'HANDOFF').length}`); }
fs.writeFileSync(path.join(ROOT, 'coverage.md'), md.join('\n') + '\n');
console.log(`COVERAGE GRID ${T.length} x ${S.length} x ${L.length} = ${total}; SYSTEM ${tot.SYSTEM}, PARTIAL ${tot.PARTIAL}, HANDOFF ${tot.HANDOFF}` + (bad.length ? ' ; FAIL ' + bad.join('; ') : ''));
process.exit(bad.length ? 1 : 0);
