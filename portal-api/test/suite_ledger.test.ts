import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore .mjs has no types
import { runLedger, summarise, parallelCap } from "../scripts/suite_ledger.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/suite_ledger.mjs", import.meta.url));

function fixtures() {
  const dir = mkdtempSync(join(tmpdir(), "suite_ledger_"));
  assert.ok(dir.length > "/tmp/".length && dir.includes("suite_ledger_"), "temp dir path sane");
  const w = (n: string, s: string) => writeFileSync(join(dir, n), s);
  w("pass.test.mjs", `import {test} from "node:test"; test("a",()=>{}); test("b",()=>{});`);
  w("fail.test.mjs", `import {test} from "node:test"; import a from "node:assert"; test("ok",()=>{}); test("bad",()=>a.equal(1,2));`);
  w("hang.test.mjs", `import {test} from "node:test"; test("hang",()=>new Promise(()=>{setInterval(()=>{},1000)}));`);
  w("crash.test.mjs", `import "./does_not_exist.mjs"; import {test} from "node:test"; test("x",()=>{});`);
  assert.equal(readdirSync(dir).length, 4, "fixtures written before use");
  const files = readdirSync(dir).sort().map((f) => join(dir, f));
  return { dir, files };
}

test("each synthetic fixture is classified; hang is UNKNOWN; counts add up", async () => {
  const { dir, files } = fixtures();
  try {
    const r = await runLedger({ cwd: dir, files, capMs: 2500, par: 3, nodeArgs: [] });
    const by = Object.fromEntries(r.rows.map((x: any) => [x.file.split("/").pop(), x]));
    assert.equal(by["pass.test.mjs"].status, "pass");
    assert.equal(by["pass.test.mjs"].tests, 2);
    assert.equal(by["pass.test.mjs"].pass, 2);
    assert.equal(by["fail.test.mjs"].status, "fail");
    assert.equal(by["fail.test.mjs"].fail, 1);
    assert.equal(by["crash.test.mjs"].status, "fail");
    assert.equal(by["hang.test.mjs"].status, "timeout");
    assert.equal(by["hang.test.mjs"].rerun, true, "timed-out file re-run singly once");
    assert.ok(by["hang.test.mjs"].ms < 10000, "hang killed, not waited out");
    assert.equal(r.summary, "FILES 4 PASS 1 FAIL 2 TIMEOUT 1 UNKNOWN 1");
    for (const x of r.rows) for (const k of ["file", "status", "tests", "pass", "fail", "ms", "load"]) assert.ok(k in x, k);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("budget exhausted: unreached files are NOT RUN and count UNKNOWN", async () => {
  const { dir, files } = fixtures();
  try {
    const r = await runLedger({ cwd: dir, files, capMs: 2500, par: 1, budgetMs: 0, nodeArgs: [] });
    assert.ok(r.rows.every((x: any) => x.status === "not_run"));
    assert.equal(r.summary, "FILES 4 PASS 0 FAIL 0 TIMEOUT 0 UNKNOWN 4");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("parallel width never exceeds cores/4 and is at least 1", () => {
  assert.equal(parallelCap(3, 8), 2);
  assert.equal(parallelCap(3, 16), 3);
  assert.equal(parallelCap(99, 16), 4);
  assert.equal(parallelCap(3, 2), 1);
  assert.equal(parallelCap(NaN, 12), 3);
});

test("MUTATION: treating timeout as pass is caught", async () => {
  const { dir, files } = fixtures();
  try {
    const src = readFileSync(SCRIPT, "utf8");
    assert.ok(src.includes('/*TIMEOUT_STATUS*/"timeout"'), "mutation anchor present");
    const mut = src.replace('/*TIMEOUT_STATUS*/"timeout"', '"pass"');
    assert.notEqual(mut, src);
    const mdir = mkdtempSync(join(tmpdir(), "suite_ledger_mut_"));
    try {
      const mfile = join(mdir, "mut.mjs");
      writeFileSync(mfile, mut);
      assert.ok(readFileSync(mfile, "utf8").length > 0);
      const m = await import(mfile);
      const hang = files.filter((f) => f.endsWith("hang.test.mjs"));
      const good = await runLedger({ cwd: dir, files: hang, capMs: 1500, par: 1, nodeArgs: [] });
      const bad = await m.runLedger({ cwd: dir, files: hang, capMs: 1500, par: 1, nodeArgs: [] });
      assert.equal(good.rows[0].status, "timeout");
      assert.equal(bad.rows[0].status, "pass", "mutant really treats timeout as pass");
      assert.notEqual(bad.rows[0].status, good.rows[0].status);
      // the real assertion the suite relies on: a hang must never be counted green
      assert.notEqual(summarise(bad.rows).split(" PASS ")[1].split(" ")[0], "0", "mutant inflates PASS");
      assert.equal(summarise(good.rows), "FILES 1 PASS 0 FAIL 0 TIMEOUT 1 UNKNOWN 1");
    } finally { rmSync(mdir, { recursive: true, force: true }); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
