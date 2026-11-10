#!/usr/bin/env node
// soak_pin_matrix_gate.mjs - READ-ONLY. SOAK RULE (Kyle X reply 2118838864991359483, 2026-11-07): the C10 soak counts only if the
// kill matrix JSON head, the soak pin sha and the x3 independent escape probe receipts ALL name the same sha, with >= 3 probes
// and 0 open P0/P1, and the live head still equals that sha. A head that moved after the pin is RESTART, never PASS.
// usage: node scripts/soak_pin_matrix_gate.mjs --matrix <kill_matrix.json> --pin <PIN.json> --x3 <receipt.json> [--x3 ...]
//          (--head <sha> | --repo <dir> --ref <ref>) [--min-probes 3]
// matrix: {"head":"<40hex>", ...} ("sha" accepted). pin: {"sha":"<40hex>"} (soak_sha_pin.py shape).
// x3 receipt: X3_<sha>.json {"sha","verdict":"CLEAN","x3_open_p0p1":0} counts as ONE probe, or {"sha","probes":[{"id","sha","open_p0p1":0}...]}.
// Output: one line. PASS (exit 0) / RESTART (exit 3) / FAIL <why> (exit 1) / ERROR <why> (exit 4, unreadable input). Never writes anything.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const FULL = /^[0-9a-f]{40}$/;
const readJson = (p, what) => {
  let t;
  try { t = readFileSync(p, "utf8"); } catch (e) { return { err: `${what} unreadable: ${p}` }; }
  try {
    const j = JSON.parse(t);
    if (!j || typeof j !== "object" || Array.isArray(j)) return { err: `${what} is not a JSON object: ${p}` };
    return { j };
  } catch { return { err: `${what} is not valid JSON: ${p}` }; }
};

// Collect probes from one x3 receipt. Returns {probes:[{id,sha,open}], err}
export function probesOf(j, label) {
  const out = [];
  if (Array.isArray(j.probes)) {
    j.probes.forEach((p, i) => out.push({ id: `${label}#${p && p.id !== undefined ? p.id : i}`, sha: p && p.sha !== undefined ? p.sha : j.sha, open: p ? p.open_p0p1 : undefined, verdict: p && p.verdict !== undefined ? p.verdict : "CLEAN" }));
  } else {
    out.push({ id: label, sha: j.sha, open: j.x3_open_p0p1, verdict: j.verdict === undefined ? "CLEAN" : j.verdict });
  }
  return out;
}

export function evaluate({ matrix, pin, x3, head, minProbes = 3 }) {
  const mh = matrix && (matrix.head !== undefined ? matrix.head : matrix.sha);
  const ps = pin && pin.sha;
  if (typeof mh !== "string" || !FULL.test(mh)) return { code: 1, line: `SOAKMX FAIL kill matrix head is not a full 40-hex sha (${JSON.stringify(mh)})` };
  if (typeof ps !== "string" || !FULL.test(ps)) return { code: 1, line: `SOAKMX FAIL soak pin sha is not a full 40-hex sha (${JSON.stringify(ps)})` };
  if (typeof head !== "string" || !FULL.test(head)) return { code: 1, line: `SOAKMX FAIL current head is not a full 40-hex sha (${JSON.stringify(head)})` };
  if (mh !== ps) return { code: 1, line: `SOAKMX FAIL matrix head ${mh.slice(0, 9)} != pin ${ps.slice(0, 9)}` };
  const probes = x3.flatMap((r) => probesOf(r.j, r.label));
  if (probes.length < minProbes) return { code: 1, line: `SOAKMX FAIL only ${probes.length} x3 probe(s), need ${minProbes}` };
  const ids = new Set();
  for (const p of probes) {
    if (ids.has(p.id)) return { code: 1, line: `SOAKMX FAIL duplicate probe id ${p.id}` };
    ids.add(p.id);
    if (typeof p.sha !== "string" || !FULL.test(p.sha)) return { code: 1, line: `SOAKMX FAIL probe ${p.id} sha is not a full 40-hex sha` };
    if (p.sha !== ps) return { code: 1, line: `SOAKMX FAIL probe ${p.id} names ${p.sha.slice(0, 9)}, pin is ${ps.slice(0, 9)}` };
    if (!Number.isInteger(p.open) || p.open < 0) return { code: 1, line: `SOAKMX FAIL probe ${p.id} open P0/P1 is ${JSON.stringify(p.open)}, not a non-negative integer (probe did not complete)` };
    if (p.open > 0) return { code: 1, line: `SOAKMX FAIL probe ${p.id} has ${p.open} open P0/P1` };
    if (p.verdict !== "CLEAN") return { code: 1, line: `SOAKMX FAIL probe ${p.id} verdict ${JSON.stringify(p.verdict)} is not CLEAN` };
  }
  // all three artifacts agree on ps; only now does the live head matter
  if (head !== ps) return { code: 3, line: `SOAKMX RESTART head moved ${ps.slice(0, 9)} -> ${head.slice(0, 9)}; re-pin, re-run the matrix and x3 on the new sha` };
  return { code: 0, line: `SOAKMX PASS sha ${ps.slice(0, 9)} matrix=pin=x3 (${probes.length} probes, open P0/P1 = 0), head unchanged` };
}

function main(argv) {
  const a = { x3: [], minProbes: 3 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--matrix") { a.matrix = v; i++; } else if (k === "--pin") { a.pin = v; i++; } else if (k === "--x3") { a.x3.push(v); i++; }
    else if (k === "--head") { a.head = v; i++; } else if (k === "--repo") { a.repo = v; i++; } else if (k === "--ref") { a.ref = v; i++; }
    else if (k === "--min-probes") { a.minProbes = Number(v); i++; } else return { code: 4, line: `SOAKMX ERROR unknown argument ${k}` };
  }
  if (!a.matrix || !a.pin || !a.x3.length) return { code: 4, line: "SOAKMX ERROR need --matrix, --pin and at least one --x3" };
  if (!Number.isInteger(a.minProbes) || a.minProbes < 3) return { code: 4, line: "SOAKMX ERROR --min-probes cannot go below 3" };
  const m = readJson(a.matrix, "kill matrix"); if (m.err) return { code: 4, line: `SOAKMX ERROR ${m.err}` };
  const p = readJson(a.pin, "soak pin"); if (p.err) return { code: 4, line: `SOAKMX ERROR ${p.err}` };
  const x3 = [];
  for (const f of a.x3) { const r = readJson(f, "x3 receipt"); if (r.err) return { code: 4, line: `SOAKMX ERROR ${r.err}` }; x3.push({ j: r.j, label: f.split("/").pop() }); }
  let head = a.head;
  if (head === undefined) {
    if (!a.repo || !a.ref) return { code: 4, line: "SOAKMX ERROR need --head <sha> or --repo <dir> --ref <ref>" };
    const g = spawnSync("git", ["-C", a.repo, "rev-parse", "--verify", `${a.ref}^{commit}`], { encoding: "utf8" });
    if (g.status !== 0) return { code: 4, line: `SOAKMX ERROR cannot resolve ${a.ref} in ${a.repo}` };
    head = g.stdout.trim();
  }
  return evaluate({ matrix: m.j, pin: p.j, x3, head, minProbes: a.minProbes });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = main(process.argv.slice(2));
  console.log(r.line);
  process.exit(r.code);
}
