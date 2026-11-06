// f189: migration merge plan. SYNTHETIC fixture repos only (os.tmpdir, removed after). Never touches a real branch.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
// @ts-ignore plain mjs
import { planFrom, applyStrip } from "../scripts/migration_merge_plan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAN = join(HERE, "..", "scripts", "migration_merge_plan.mjs");
const g = (cwd: string, ...a: string[]) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8" });
const SQL = {
  core: "CREATE TABLE core (id TEXT PRIMARY KEY);",
  a: "CREATE TABLE t_a (id TEXT PRIMARY KEY, core_id TEXT REFERENCES core(id));",
  x: "CREATE TABLE t_x (id TEXT PRIMARY KEY);",
  y: "CREATE TABLE t_y (id TEXT PRIMARY KEY);",
  z: "ALTER TABLE t_y ADD COLUMN extra TEXT;",
};
let repo = "";
const commit = (branch: string, files: Record<string, string>, from = "base") => {
  g(repo, "switch", "-q", "-C", branch, from);
  g(repo, "rm", "-rq", "--ignore-unmatch", "portal-api/migrations");
  mkdirSync(join(repo, "portal-api/migrations"), { recursive: true });
  for (const [n, c] of Object.entries(files)) writeFileSync(join(repo, "portal-api/migrations", n), c + "\n");
  g(repo, "add", "-A"); g(repo, "commit", "-qm", branch);
};
const run = (...args: string[]) => { const r = spawnSync("node", ["--disable-warning=ExperimentalWarning", PLAN, "--repo", repo, "--lint-ref", "lintsrc", ...args], { encoding: "utf8" }); return { code: r.status, out: r.stdout + r.stderr }; };

before(() => {
  repo = mkdtempSync(join(tmpdir(), "migplan-fx-"));
  g(repo, "init", "-q", "-b", "base"); g(repo, "config", "user.email", "t@t"); g(repo, "config", "user.name", "t");
  writeFileSync(join(repo, "README"), "x"); g(repo, "add", "-A"); g(repo, "commit", "-qm", "base");
  const local = join(HERE, "..", "scripts", "migration_lint.mjs");
  let lintSrc = existsSync(local) ? readFileSync(local, "utf8") : "";
  if (!lintSrc) { try { lintSrc = execFileSync("git", ["-C", HERE, "show", "origin/web/f104_migration_lint-2026-11-07:portal-api/scripts/migration_lint.mjs"], { encoding: "utf8" }); } catch { /* no lint available */ } }
  assert.ok(lintSrc, "f104 migration lint must be available (local file or origin/web/f104 ref)");
  g(repo, "switch", "-q", "-c", "lintsrc", "base");
  mkdirSync(join(repo, "portal-api/scripts"), { recursive: true }); writeFileSync(join(repo, "portal-api/scripts/migration_lint.mjs"), lintSrc);
  g(repo, "add", "-A"); g(repo, "commit", "-qm", "lint");
  const base = { "0001_core.sql": SQL.core, "0002_a.sql": SQL.a };
  commit("brA", base);
  commit("brB", { ...base, "0003_x.sql": SQL.x });
  commit("brC", { ...base, "0003_y.sql": SQL.y, "0004_z.sql": SQL.z });
  commit("brZ", { "0001_core.sql": SQL.core, "0004_z.sql": SQL.z }); // depends on t_y but never carries it
});
after(() => { if (repo.startsWith(tmpdir())) rmSync(repo, { recursive: true, force: true }); });

test("known collision: 0003 x vs y is found, order keeps each branch's internal order, lint passes on the scratch copy", () => {
  const out = join(repo, "plan.md");
  const r = run("--out", out, "brA", "brB", "brC");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /3 branches, 3 with migrations; 5 distinct; 1 collisions; 0 conflicts; cycle no; lint OK/);
  const md = readFileSync(out, "utf8");
  assert.match(md, /### 0003 \(2 files\)/);
  const order = [...md.matchAll(/\| `(\d{4}_\w+\.sql)` \| `(\w+\.sql)`/g)].map((m) => m[2]);
  assert.deepEqual(order, ["0001_core.sql", "0002_a.sql", "0003_x.sql", "0003_y.sql", "0004_z.sql"]);
  assert.ok(order.indexOf("0003_y.sql") < order.indexOf("0004_z.sql"));
});

test("mutation: drop the colliding branches and the collision disappears (plan is derived, not canned)", () => {
  const r = run("brA", "brB");
  assert.equal(r.code, 0); assert.match(r.out, /0 collisions/); assert.match(r.out, /3 distinct/);
});

test("mutation: drop the branch that owns a dependency (brZ alone carries 0004_z without t_y) fails the lint LOUDLY", () => {
  const r = run("brA", "brB", "brZ");
  assert.equal(r.code, 3, r.out); assert.match(r.out, /LINT FAIL apply failed at \d{4}_z\.sql/);
});

test("mutation: duplicate number with different content under the same name is a CONFLICT, exit 2, never silently merged", () => {
  commit("brDup", { "0001_core.sql": SQL.core, "0002_a.sql": SQL.a + "\nCREATE TABLE t_dup (id TEXT);", "0003_x.sql": SQL.x });
  const r = run("brA", "brDup");
  assert.equal(r.code, 2, r.out); assert.match(r.out, /CONFLICT 0002_a\.sql/);
  const ok = run("--prefer", "0002_a.sql=" + g(repo, "rev-parse", "brDup:portal-api/migrations/0002_a.sql").trim().slice(0, 8), "brA", "brDup");
  assert.equal(ok.code, 0, ok.out);
});

test("defensive: chains handed over in opposite order for the same two names are a cycle (readBranch sorts by number so git input cannot produce this)", () => {
  const p = { name: "0001_p.sql", num: 1, blob: "a" }, q = { name: "0002_q.sql", num: 2, blob: "b" };
  const c = planFrom({ P: [p, q], Q: [q, p] });
  assert.deepEqual(c.cycle, ["0001_p.sql", "0002_q.sql"]);
});

test("bad filename and unknown branch fail loudly", () => {
  commit("brBad", { "0001_core.sql": SQL.core, "oops.sql": "SELECT 1;" });
  assert.equal(run("brBad").code, 2);
  const u = run("brNope"); assert.equal(u.code, 1); assert.match(u.out, /unknown branch brNope/);
});

test("WOULD-FLIP: --check passes on the same set and exits 4 once a branch is added", () => {
  const js = join(repo, "plan.json");
  assert.equal(run("--json", js, "brA", "brB", "brC").code, 0);
  assert.equal(run("--check", js, "brA", "brB", "brC").code, 0);
  const r = run("--check", js, "brA", "brB", "brC", "brDup");
  assert.notEqual(r.code, 0); // brDup conflicts with brA, so the failure comes first
  commit("brLate", { "0001_core.sql": SQL.core, "0002_a.sql": SQL.a, "0003_late.sql": "CREATE TABLE t_late (id TEXT);" });
  const s = run("--check", js, "brA", "brB", "brC", "brLate");
  assert.equal(s.code, 4, s.out); assert.match(s.out, /STALE PLAN: branches added \["brLate"\]/);
});

test("--strip removes only matching lines and is recorded", () => {
  assert.equal(applyStrip("a\nALTER x\nb", "^ALTER"), "a\nb");
  assert.equal(applyStrip("a\nb", undefined), "a\nb");
  commit("brS1", { "0001_core.sql": SQL.core, "0002_c1.sql": "ALTER TABLE core ADD COLUMN k TEXT;" });
  commit("brS2", { "0001_core.sql": SQL.core, "0002_c2.sql": "ALTER TABLE core ADD COLUMN k TEXT;" });
  assert.equal(run("brS1", "brS2").code, 3);
  assert.equal(run("--strip", "0002_c2.sql=ADD COLUMN k", "brS1", "brS2").code, 0);
});
