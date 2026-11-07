// f297: migration collision report. SYNTHETIC file lists only (no git, no real branch).
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore plain mjs
import { analyse, treeReport, nonMonotonic, exitCode, render } from "../scripts/migration_collisions.mjs";

const BASE = ["0001_core.sql", "0002_billing.sql", "0003_keys.sql"];

test("clean list passes: no dup, no gap, exit 0", () => {
  const r = analyse(BASE, { "b/ok": [...BASE, "0004_market.sql"] });
  assert.equal(r.collisions.length, 0); assert.equal(r.base.duplicates.length, 0); assert.equal(r.base.gaps.length, 0);
  assert.equal(r.nextFree, 5); // 0004 is taken by the branch add assert.equal(exitCode(r), 0);
});
test("mutation: a seeded duplicate against the base is caught", () => {
  const r = analyse(BASE, { "b/dup": [...BASE, "0003_other.sql"] });
  assert.equal(r.collisions.length, 1); assert.equal(r.collisions[0].kind, "base"); assert.equal(r.collisions[0].with[0].name, "0003_keys.sql");
  assert.equal(r.suggestions[0].suggested, "0004_other.sql"); assert.equal(exitCode(r), 2);
});
test("mutation: two branches adding the same number are both flagged, suggestions differ", () => {
  const r = analyse(BASE, { "b/x": [...BASE, "0004_x.sql"], "b/y": [...BASE, "0004_y.sql"] });
  assert.equal(r.collisions.filter((c: any) => c.kind === "branch").length, 2);
  const s = r.suggestions.map((x: any) => x.suggested); assert.equal(new Set(s).size, 2); assert.ok(s.every((n: string) => +n.slice(0, 4) >= 5));
});
test("same file on two stacked branches is one migration, not a collision", () => {
  const r = analyse(BASE, { "b/x": [...BASE, "0004_x.sql"], "b/y": [...BASE, "0004_x.sql", "0005_y.sql"] });
  assert.equal(r.collisions.length, 0);
});
test("a file already on the base is not an add", () => {
  const r = analyse(BASE, { "b/old": BASE }); assert.equal(r.perBranch[0].adds, 0); assert.equal(r.collisions.length, 0);
});
test("backdated add (below base max, unused number) is flagged without being a collision", () => {
  const r = analyse(["0001_a.sql", "0003_c.sql"], { "b/z": ["0001_a.sql", "0003_c.sql", "0002_b.sql"] });
  assert.equal(r.backdated.length, 1); assert.equal(r.collisions.length, 0);
});
test("base duplicates, gaps and bad names are reported", () => {
  const t = treeReport(["0001_a.sql", "0001_b.sql", "0004_d.sql", "bad.sql"]);
  assert.deepEqual(t.duplicates.map((d: any) => d.num), [1]); assert.deepEqual(t.gaps, [2, 3]); assert.deepEqual(t.badNames, ["bad.sql"]);
});
test("non-monotonic: repeat or drop in sorted prefixes is flagged, clean list is not", () => {
  assert.equal(nonMonotonic(BASE).length, 0);
  assert.equal(nonMonotonic(["0001_a.sql", "0001_b.sql"]).length, 1);
});
test("bad branch name is flagged and render mentions the collision", () => {
  const r = analyse(BASE, { "b/q": [...BASE, "x.sql", "0002_dup.sql"] });
  assert.equal(r.badNames.length, 1); assert.match(render(r, "base"), /COLLISION b\/q: 0002_dup.sql number 0002/);
});
