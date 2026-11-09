// Tests for scripts/restack_to_manifest.mjs: fixture repo (two fills, duplicate command,
// non-test package.json edit, orphan-script conflict) plus 2 mutations the checks must catch.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tool = join(here, "restack_to_manifest.mjs");
const tmp = mkdtempSync(join(tmpdir(), "restack-"));
const sh = (cwd, ...args) => execFileSync("git", ["-c", "rerere.enabled=false", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = (repo, rel, text) => { mkdirSync(dirname(join(repo, rel)), { recursive: true }); writeFileSync(join(repo, rel), text); };
const pkg = (test, extra = {}) => JSON.stringify({ name: "fx", scripts: { test, build: "x" }, ...extra }, null, 2) + "\n";
const OLD = "node scripts/test_a.mjs && node scripts/test_b.mjs";

function fixture(name) {
  const repo = join(tmp, name);
  mkdirSync(repo);
  sh(repo, "init", "-q", "-b", "main");
  sh(repo, "config", "user.name", "t"); sh(repo, "config", "user.email", "t@t");
  put(repo, "package.json", pkg(OLD));
  for (const f of ["a", "b"]) put(repo, `scripts/test_${f}.mjs`, "// t\n");
  put(repo, "scripts/test_no_orphan_scripts.sh", "# v1\n");
  copyFileSync(join(here, "test_manifest_lint.mjs"), join(repo, "scripts/test_manifest_lint.mjs"));
  sh(repo, "add", "-A"); sh(repo, "commit", "-qm", "old world");
  sh(repo, "tag", "old");
  const fill = (id, { chain, extra, orphan, files = [] }) => {
    sh(repo, "switch", "-q", "-c", id, "old");
    for (const f of files) put(repo, `scripts/${f}`, "// t\n");
    put(repo, "package.json", pkg(chain, extra));
    if (orphan) put(repo, "scripts/test_no_orphan_scripts.sh", "# fill edit\n");
    sh(repo, "add", "-A"); sh(repo, "commit", "-qm", id);
  };
  fill("fill1", { chain: `${OLD} && node scripts/test_x.mjs`, files: ["test_x.mjs"] });
  fill("fill2", { chain: `${OLD} && node scripts/test_y.mjs`, files: ["test_y.mjs"] });
  // duplicate: also adds test_x, which the base manifest will already carry
  fill("fill3", { chain: `${OLD} && node scripts/test_x.mjs && node scripts/test_z.mjs`, files: ["test_x.mjs", "test_z.mjs"], orphan: true });
  // non-test edit in package.json
  fill("fill4", { chain: `${OLD} && node scripts/test_w.mjs`, extra: { dependencies: { left: "1.0.0" } }, files: ["test_w.mjs"] });
  sh(repo, "switch", "-q", "main");
  put(repo, "package.json", pkg("node scripts/run_tests.mjs"));
  put(repo, "scripts/test_manifest.txt", "node scripts/test_a.mjs\nnode scripts/test_b.mjs\nnode scripts/test_x.mjs\n");
  put(repo, ".gitattributes", "scripts/test_manifest.txt merge=union\n");
  put(repo, "scripts/test_x.mjs", "// t\n");
  put(repo, "scripts/test_no_orphan_scripts.sh", "# base v2\n");
  sh(repo, "add", "-A"); sh(repo, "commit", "-qm", "manifest world");
  return repo;
}

/** All behaviour checks against one copy of the tool; returns failures (empty = pass). */
async function checks(toolPath, label) {
  const { restack, format } = await import(pathToFileURL(toolPath).href + `?${label}`);
  const repo = fixture(label);
  const scratchRoot = join(tmp, `scratch-${label}`);
  const go = (b, o = {}) => restack({ repo, branch: b, base: "main", scratchRoot, ...o });
  const fails = [];
  const check = (name, fn) => { try { fn(); } catch (e) { fails.push(`${name}: ${e.message.split("\n")[0]}`); } };
  const mainHead = sh(repo, "rev-parse", "main").trim();

  const r1 = go("fill1");
  check("fill1 LANDED", () => assert.equal(format(r1), "LANDED"));
  check("fill1 raw git conflict was package.json", () => assert.ok(r1.rawConflicts.includes("package.json")));
  check("fill1 added x only (x already in base manifest => dup skipped)", () => { assert.deepEqual(r1.added, ["node scripts/test_x.mjs"]); });

  const r2 = go("fill2", { push: false });
  check("fill2 LANDED, y appended", () => { assert.equal(r2.status, "LANDED"); assert.deepEqual(r2.appended, ["node scripts/test_y.mjs"]); });

  const r3 = go("fill3");
  check("duplicate command is not appended twice", () => {
    assert.deepEqual(r3.skippedDup, ["node scripts/test_x.mjs"]);
    assert.deepEqual(r3.appended, ["node scripts/test_z.mjs"]);
  });
  check("fill3 orphan-script conflict resolved to base", () => { assert.ok(r3.rawConflicts.includes("scripts/test_no_orphan_scripts.sh")); assert.equal(r3.status, "LANDED"); });

  const r4 = go("fill4");
  check("non-test package.json edit stays CONFLICT package.json", () => assert.equal(format(r4), "CONFLICT package.json"));

  // --push: real remote (bare repo), new branch only
  const bare = join(tmp, `${label}-remote.git`);
  sh(tmp, "init", "-q", "--bare", bare);
  sh(repo, "remote", "add", "origin", bare);
  sh(repo, "push", "-q", "origin", "main", "fill2");
  const fill2Head = sh(repo, "rev-parse", "fill2").trim();
  const rp = go("fill2", { push: true });
  check("push creates fill2-rs only", () => {
    assert.equal(rp.pushed, true);
    const heads = sh(repo, "ls-remote", "--heads", "origin").split("\n").filter(Boolean).map((l) => l.split("\t")[1]).sort();
    assert.deepEqual(heads, ["refs/heads/fill2", "refs/heads/fill2-rs", "refs/heads/main"]);
    assert.equal(sh(bare, "rev-parse", "main").trim(), mainHead);
    assert.equal(sh(bare, "rev-parse", "fill2").trim(), fill2Head);
    const mf = sh(bare, "show", "fill2-rs:scripts/test_manifest.txt");
    assert.match(mf, /test_y\.mjs/);
    assert.equal(JSON.parse(sh(bare, "show", "fill2-rs:package.json")).scripts.test, "node scripts/run_tests.mjs");
  });
  check("second push refused (branch exists)", () => assert.throws(() => go("fill2", { push: true }), /already exists/));
  check("refuses main", () => assert.throws(() => restack({ repo, branch: "main", base: "main", scratchRoot }), /protected/));
  check("dry-run leaves repo clean: main unmoved, no worktrees left", () => {
    assert.equal(sh(repo, "rev-parse", "main").trim(), mainHead);
    assert.equal(sh(repo, "worktree", "list").trim().split("\n").length, 1);
  });
  return fails;
}

let ok = 0;
const t = (name, cond, detail = "") => { assert.ok(cond, `${name} ${detail}`); ok += 1; console.log(`ok - ${name}`); };
try {
  const real = await checks(tool, "real");
  t("fixture behaviour checks pass on the real tool", real.length === 0, real.join(" | "));

  const src = readFileSync(tool, "utf8");
  const mutate = (name, from, to) => {
    assert.ok(src.includes(from), `mutation anchor missing: ${name}`);
    const p = join(tmp, `mut-${name}.mjs`);
    writeFileSync(p, src.replace(from, to));
    return checks(p, name);
  };
  const m1 = await mutate("nodedupe", "have.has(c) /*MUT:dedupe*/", "false");
  t("mutation caught: duplicate commands appended twice", m1.some((f) => /duplicate/.test(f)), m1.join(" | "));
  const m2 = await mutate("dropnontest", "pkg.nonTestEdits /*MUT:nontest*/", "false");
  t("mutation caught: non-test package.json edits silently dropped", m2.some((f) => /non-test/.test(f)), m2.join(" | "));
  console.log(`test_restack_to_manifest: ${ok} checks passed`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
