// test_c5_ungraded_verify.mjs (f398). SYNTHETIC data; scratch dir only. Proves the C5 independent verifier AGREES on the real pipeline
// and exits non-zero on each planted failure (mutation test): ungraded entries, stripped checks, one check failed/missing, bad hash,
// unlabelled, dropped/duplicated entries, a primary drill that says not-ok or wrong n, and check-list drift.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { recompute, compare, buildRawCatalogue, OWN_CHECKS } from "./c5_ungraded_verify.mjs";
import { REQUIRED_CHECKS } from "../lib/shop/publish_gate.ts";

const here = dirname(fileURLToPath(import.meta.url)), V = join(here, "c5_ungraded_verify.mjs");
const S = mkdtempSync(join(tmpdir(), "f398c5."));
if (!/\/f398c5\./.test(S)) { console.log("FAIL bad scratch"); process.exit(1); }
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const N = 60;
const base = await buildRawCatalogue(N);
const good = { n: N, ok: true, failures: [] };
const mut = (fn) => { const j = JSON.parse(base); fn(j); return JSON.stringify(j); };
const cli = (cat, prim, n = N) => {
  writeFileSync(join(S, "c.json"), cat); writeFileSync(join(S, "p.json"), JSON.stringify(prim));
  return spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", V, String(n), "--catalogue-file", join(S, "c.json"), "--primary-json", join(S, "p.json")], { encoding: "utf8" });
};
try {
  ok(JSON.stringify(OWN_CHECKS) === JSON.stringify([...REQUIRED_CHECKS]), "own 12-id list equals the lib's REQUIRED_CHECKS");
  const r0 = cli(base, good);
  ok(r0.status === 0 && /C5VERIFY AGREE/.test(r0.stdout), "real catalogue + ok primary -> AGREE, exit 0");
  const rc = recompute(base, N);
  ok(rc.entries === N && rc.ungraded === 0 && rc.duplicates.length === 0, "recompute: 60 entries, 0 ungraded, 0 duplicates");

  const M = {
    "grade deleted on 5 entries": mut((j) => j.entries.slice(0, 5).forEach((e) => delete e.shelf.grade)),
    "checks emptied on 1 entry": mut((j) => { j.entries[3].shelf.grade.checks = []; }),
    "pass flipped false on 1 entry": mut((j) => { j.entries[7].shelf.grade.pass = false; }),
    "one check id removed": mut((j) => { j.entries[9].shelf.grade.checks = j.entries[9].shelf.grade.checks.filter((c) => c.id !== "copy"); }),
    "one check ok:false while pass stays true": mut((j) => { j.entries[11].shelf.grade.checks[0].ok = false; }),
    "content_hash blanked": mut((j) => { j.entries[2].content_hash = ""; }),
    "SYNTHETIC label stripped": mut((j) => { j.entries[4].shelf.name = "Plain"; j.entries[4].shelf.bluf = "Plain"; }),
    "entry dropped (count short)": mut((j) => { j.entries.pop(); }),
    "entry duplicated": mut((j) => { j.entries[1] = JSON.parse(JSON.stringify(j.entries[0])); }),
    "50 planted ungraded appended": mut((j) => { for (let k = 0; k < 50; k++) j.entries.push({ cluster_id: "plant-" + k, content_hash: "0".repeat(64), label: "SYNTHETIC", shelf: { name: "SYNTHETIC", bluf: "SYNTHETIC" } }); }),
  };
  for (const [name, cat] of Object.entries(M)) { const r = cli(cat, good); ok(r.status === 1 && /C5VERIFY DISAGREE/.test(r.stdout), "mutant exits 1: " + name); }

  const rn = cli(base, { ...good, ok: false, failures: ["(a) 0 ungraded visible 3"] });
  ok(rn.status === 1 && /primary drill not ok/.test(rn.stdout), "mutant exits 1: primary drill reports not-ok while recompute is clean");
  const rw = cli(base, { ...good, n: 999 });
  ok(rw.status === 1 && /primary drill n 999/.test(rw.stdout), "mutant exits 1: primary drill ran a different n");
  ok(compare(rc, good, N, REQUIRED_CHECKS.slice(1)).some((s) => /drift/.test(s)), "mutant: lib check-list drift is a disagreement");
  const rj = cli("{not json", good);
  ok(rj.status === 2 && /UNUSABLE/.test(rj.stderr), "unusable input (not JSON) exits 2");
  const re = cli(JSON.stringify({ nope: 1 }), good);
  ok(re.status === 2, "unusable input (no entries array) exits 2");
  const rl = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", V, "1000"], { encoding: "utf8" });
  ok(rl.status === 0 && /AGREE n=1000/.test(rl.stdout), "live path: builds 1000 synthetic, runs the real f386 drill as a child, AGREE");
} finally { rmSync(S, { recursive: true, force: true }); }
console.log(`c5_ungraded_verify: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
