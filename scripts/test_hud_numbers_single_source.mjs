// test_hud_numbers_single_source.mjs (f394): the HUD feed and the ledger carry ONE set of shared figures.
//  1 committed state: --check green, shared fields equal the ledger, no stale 60.6 / 230,797 anywhere on the HUD
//  2 planted drift in the HUD file (value, fact text, replacement cost) or in the ledger (estate_ey, estate_sloc) fails --check (exit 1)
//  3 a HUD-only field change (snapshot_ts/ms, facts_as_of, needle.method) passes --check and survives a rewrite untouched
//  4 write is byte-identical run twice, idempotent on the committed file, and fixes a drifted file
//  5 no figure text in the HUD page sources disagrees with the ledger (literal "N engineer-years" / "N lines" / "AU$N million")
//  6 regen_ledger.mjs --check fails (exit 1) when the HUD drifts, and has no WARN line
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { derive, diffShared, serialize } from "./hud_numbers_from_ledger.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, "..");
const LEDGER = path.join(ROOT, "lib/ledger.json");
const HUD = path.join(ROOT, "lib/hud/numbers.json");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } else console.log("ok   " + m); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const ledger = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
const hud = JSON.parse(fs.readFileSync(HUD, "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hudsingle-"));
if (!tmp || !tmp.startsWith(os.tmpdir())) throw new Error("bad tmp");
const put = (name, o) => { const p = path.join(tmp, name); fs.writeFileSync(p, typeof o === "string" ? o : JSON.stringify(o, null, 1) + "\n"); return p; };
const run = (args) => spawnSync("node", [path.join(HERE, "hud_numbers_from_ledger.mjs"), ...args], { encoding: "utf8" });

// 1 committed state
{
  const r = run(["--check"]);
  ok(r.status === 0, `committed --check green (exit ${r.status})`);
  ok(diffShared(ledger, hud).length === 0, "no shared field differs from the ledger");
  ok(hud.rows.engineer_years.value === ledger.n.estate_ey.value, `HUD engineer_years ${hud.rows.engineer_years.value} == ledger estate_ey`);
  ok(hud.rows.sloc.value === ledger.n.estate_sloc.value, `HUD sloc ${hud.rows.sloc.value} == ledger estate_sloc`);
  ok(hud.ledger_as_of === ledger.n.estate_ey.as_of, "HUD carries the ledger as_of the shared figures come from");
  const all = fs.readFileSync(HUD, "utf8");
  ok(!/60\.6|230,?797|230\.8|31\.6 million/.test(all), "no stale pre-f393 figure (60.6 / 230,797 / 230.8 / 31.6 million) in numbers.json");
}

// 2 planted drift fails
{
  const cases = {
    "hud engineer_years": (l, h) => { h.rows.engineer_years.value = 60.6; },
    "hud sloc": (l, h) => { h.rows.sloc.value += 1; },
    "hud fleet row": (l, h) => { h.rows.fleet_jobs_24h.value += 1; },
    "hud fact text": (l, h) => { h.facts.estate_ey.text = h.facts.estate_ey.text.replace("67.6", "60.6"); },
    "hud replacement cost": (l, h) => { h.rows.replacement_cost_aud.value += 1000; },
    "hud needle": (l, h) => { h.needle.ceiling = 100; },
    "ledger estate_ey": (l, h) => { l.n.estate_ey.value += 1; },
    "ledger estate_sloc": (l, h) => { l.n.estate_sloc.value += 1; },
    "ledger fact text": (l, h) => { l.facts.estate.text += " "; },
  };
  for (const [name, f] of Object.entries(cases)) {
    const l = clone(ledger), h = clone(hud); f(l, h);
    const r = run(["--check", "--ledger", put("l.json", l), "--hud", put("h.json", h)]);
    ok(r.status === 1 && /FAIL/.test(r.stderr), `planted drift (${name}) fails --check with exit 1`);
  }
}

// 3 HUD-only fields pass and survive
{
  const h = clone(hud);
  h.snapshot_ts = "2026-12-01T00:00:00"; h.snapshot_ms += 86400000; h.facts_as_of = "2026-12-01"; h.needle.method = "other HUD-only method text";
  const hp = put("hudonly.json", h);
  ok(run(["--check", "--ledger", LEDGER, "--hud", hp]).status === 0, "HUD-only field change (ts, ms, facts_as_of, needle.method) passes --check");
  run(["--ledger", LEDGER, "--hud", hp]);
  const after = JSON.parse(fs.readFileSync(hp, "utf8"));
  ok(after.snapshot_ts === h.snapshot_ts && after.snapshot_ms === h.snapshot_ms && after.facts_as_of === h.facts_as_of && after.needle.method === h.needle.method, "rewrite leaves HUD-only fields untouched");
}

// 4 deterministic
{
  const h = clone(hud); h.rows.engineer_years.value = 1; h.rows.sloc.value = 2; h.facts.estate.text = "x";
  const hp = put("drift.json", h);
  ok(run(["--ledger", LEDGER, "--hud", hp]).status === 0, "write on a drifted file exits 0");
  const b1 = fs.readFileSync(hp);
  run(["--ledger", LEDGER, "--hud", hp]);
  const b2 = fs.readFileSync(hp);
  ok(Buffer.compare(b1, b2) === 0, "run twice is byte-identical");
  ok(run(["--check", "--ledger", LEDGER, "--hud", hp]).status === 0, "drifted file is green after write");
  ok(b1.toString() === serialize(derive(ledger, h).hud), "bytes equal serialize(derive())");
  ok(b1.toString() === fs.readFileSync(HUD, "utf8"), "rewritten drifted file equals the committed numbers.json");
  const l = clone(ledger); delete l.n.estate_sloc;
  const r = run(["--ledger", put("lmiss.json", l), "--hud", put("hmiss.json", hud)]);
  ok(/UNKNOWN left alone: rows\.sloc/.test(r.stdout) && JSON.parse(fs.readFileSync(path.join(tmp, "hmiss.json"), "utf8")).rows.sloc.value === hud.rows.sloc.value, "missing ledger input = field left alone and reported UNKNOWN, never invented");
}

// 5 page sources
{
  const files = ["app/hud/page.tsx", "lib/hud/data.ts", ...fs.readdirSync(path.join(ROOT, "components/hud")).filter((f) => /\.tsx?$/.test(f)).map((f) => "components/hud/" + f)];
  const ey = ledger.n.estate_ey.value, sloc = ledger.n.estate_sloc.value;
  const costM = (Math.round(ey * 23_000_000 / 44.1) / 1e6).toFixed(1);
  let literals = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of src.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(engineer-years?|lines)\b/g)) {
      literals++;
      const v = Number(m[1].replace(/,/g, ""));
      ok(m[2].startsWith("engineer") ? v === ey : v === sloc, `${f}: literal "${m[0]}" agrees with the ledger`);
    }
    for (const m of src.matchAll(/AU\$\s?(\d[\d.,]*)\s*million/g)) { literals++; ok(m[1] === costM, `${f}: literal "${m[0]}" agrees with the ledger (${costM})`); }
    ok(!/60\.6|230,?797|230\.8/.test(src), `${f}: no stale pre-f393 figure`);
  }
  ok(true, `${literals} literal figure(s) checked across ${files.length} HUD source files (HUD page reads numbers.json: ${/numbers/.test(fs.readFileSync(path.join(ROOT, "lib/hud/data.ts"), "utf8"))})`);
  // built page sources, when a build exists
  for (const d of ["out/hud", ".next/server/app/hud"]) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => /\.(html|rsc)$/.test(x))) ok(!/60\.6|230,?797/.test(fs.readFileSync(path.join(dir, f), "utf8")), `built ${d}/${f}: no stale figure`);
  }
}

// 6 regen_ledger --check integration
{
  const src = fs.readFileSync(path.join(HERE, "regen_ledger.mjs"), "utf8");
  ok(!/console\.log\(`WARN/.test(src), "regen_ledger.mjs has no WARN line left for the HUD");
  const r = spawnSync("node", [path.join(HERE, "regen_ledger.mjs"), "--check"], { encoding: "utf8" });
  ok(r.status === 0 && !/WARN/.test(r.stdout + r.stderr), "regen_ledger.mjs --check green with zero WARN lines");
  // drift: run a copy of the scripts tree against a drifted HUD
  const sandbox = path.join(tmp, "site"); fs.mkdirSync(path.join(sandbox, "scripts"), { recursive: true }); fs.mkdirSync(path.join(sandbox, "lib/hud"), { recursive: true });
  for (const f of ["regen_ledger.mjs", "ledger_derive.mjs", "hud_numbers_from_ledger.mjs"]) fs.copyFileSync(path.join(HERE, f), path.join(sandbox, "scripts", f));
  fs.copyFileSync(LEDGER, path.join(sandbox, "lib/ledger.json"));
  const h = clone(hud); h.rows.engineer_years.value = 60.6;
  fs.writeFileSync(path.join(sandbox, "lib/hud/numbers.json"), JSON.stringify(h, null, 1) + "\n");
  const r2 = spawnSync("node", [path.join(sandbox, "scripts/regen_ledger.mjs"), "--check"], { encoding: "utf8" });
  ok(r2.status === 1 && /HUD single-source/.test(r2.stderr), `regen_ledger --check fails (exit ${r2.status}) when the HUD drifts`);
}

// 7 regression: a fixture-ledger regen run must never rewrite the committed HUD feed (found in f394: it did)
{
  const kn = path.join(os.homedir(), "klinge-kernel/state/numbers/NUMBERS.json");
  if (fs.existsSync(kn)) {
    const before = fs.readFileSync(HUD);
    const lp = put("fixture_ledger.json", clone(ledger));
    spawnSync("node", [path.join(HERE, "regen_ledger.mjs"), "--ledger", lp], { encoding: "utf8" });
    ok(Buffer.compare(before, fs.readFileSync(HUD)) === 0, "regen_ledger --ledger <fixture> leaves the committed lib/hud/numbers.json untouched");
  } else console.log("SKIP regression 7 (kernel NUMBERS.json absent; read-only source)");
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `FAILED ${bad}` : "ALL PASS");
process.exit(bad ? 1 : 0);
