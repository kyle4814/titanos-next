import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FLOWS } from "../src/flows.ts";
import { MANIFEST, OUT_PATH, SOURCE_QUOTES, buildRows, problems, render, titleExists, verifySource } from "../scripts/flow16_matrix.ts";

test("flow16: FLOW16_MATRIX.md equals a fresh regeneration (diff is empty)", () => {
  assert.equal(readFileSync(OUT_PATH, "utf8"), render(buildRows()), "stale: run node --experimental-strip-types scripts/flow16_matrix.ts");
});

test("flow16: every registered flow has a manifest entry whose test files and titles exist (grep-verified)", () => {
  const rows = buildRows();
  assert.equal(rows.length, 16);
  assert.deepEqual(problems(rows), []);
  assert.deepEqual(MANIFEST.map((m) => m.id), FLOWS.map((f) => f.id));
});

test("flow16: every C2-owned flow is TESTED and no flow is silently claimed beyond its evidence", () => {
  const rows = buildRows();
  for (const r of rows.filter((x) => x.owner === "C2")) assert.equal(r.status, "TESTED", r.id);
  for (const r of rows.filter((x) => x.owner !== "C2")) assert.ok(r.status.startsWith("OWNED-ELSEWHERE"), r.id);
  assert.ok(rows.filter((r) => r.gap).every((r) => r.status === "OWNED-ELSEWHERE-UNTESTED"), "a flow with a stated gap is never TESTED");
});

test("flow16 mutation: a title that does not exist fails the job and the matrix names it", () => {
  const bad = MANIFEST.map((m) => (m.id === "refund" ? { ...m, evidence: [{ file: m.evidence[0].file, title: "refund: this test was never written" }] } : m));
  const rows = buildRows(undefined, bad);
  const p = problems(rows, bad);
  assert.ok(p.some((x) => x.includes("flow refund: test does not exist")), p.join("|"));
  assert.notEqual(rows.find((r) => r.id === "refund")!.status, "TESTED");
});

test("flow16 mutation: a missing test file, a missing manifest entry and a stray entry all fail", () => {
  const noFile = MANIFEST.map((m) => (m.id === "status" ? { ...m, evidence: [{ file: "portal-api/test/nope.test.ts", title: "x" }] } : m));
  assert.ok(problems(buildRows(undefined, noFile), noFile).some((x) => x.includes("flow status")));
  const dropped = MANIFEST.filter((m) => m.id !== "invoices");
  assert.ok(problems(buildRows(undefined, dropped), dropped).some((x) => x.includes("flow invoices")));
  const stray = [...MANIFEST, { id: "teleport", evidence: [] }];
  assert.ok(problems(buildRows(), stray).some((x) => x.includes("teleport")));
  const fewer = FLOWS.filter((f) => f.id !== "scan");
  assert.ok(problems(buildRows(undefined, MANIFEST, fewer), MANIFEST, fewer).some((x) => x.includes("scan")));
});

test("flow16 mutation: a title that only appears in a comment or a string is not accepted for a *.test.ts file", () => {
  const dir = mkdtempSync(join(tmpdir(), "flow16-"));
  mkdirSync(join(dir, "t"));
  writeFileSync(join(dir, "t/a.test.ts"), '// "ghost title"\nconst s = "ghost title";\ntest("real title", () => {});\n');
  assert.equal(titleExists(dir, { file: "t/a.test.ts", title: "ghost title" }), false);
  assert.equal(titleExists(dir, { file: "t/a.test.ts", title: "real title" }), true);
});

test("flow16: generated note states the evidence, UNKNOWN for the 14, and never invents the list", () => {
  const md = readFileSync(OUT_PATH, "utf8");
  assert.ok(md.includes("UNKNOWN: which 14 the author meant"));
  assert.ok(md.includes("PROPOSAL (INFERRED"));
  assert.ok(!/[–—]/.test(md), "no em or en dashes");
  for (const q of SOURCE_QUOTES) assert.ok(md.includes(q.needle), q.needle);
});

test("flow16: the quoted kernel lines still say what we quote (skipped when the kernel is not on this box)", { skip: !existsSync(SOURCE_QUOTES[0].file) }, () => {
  assert.deepEqual(verifySource(), []);
});

test("flow16 docs: /terms and /trust are both TESTED routes, so all 16 flows have a verified test, and the terms-vs-billing findings are carried", () => {
  const rows = buildRows();
  const docs = rows.find((r) => r.id === "docs")!;
  assert.deepEqual(docs.routes, [{ route: "/trust", tested: true }, { route: "/terms", tested: true }]);
  assert.equal(rows.filter((r) => r.status === "OWNED-ELSEWHERE-UNTESTED").length, 0);
  assert.ok((docs.findings ?? []).length >= 1 && docs.findings!.every((f) => f.includes("app/terms/page.tsx")), "findings name the terms file");
  assert.ok(render(rows).includes("Routes tested: 2 of 2. Flows with a verified test: 16 of 16."), "count line is computed by the script");
});

test("flow16 docs mutation: remove the /terms test title and the docs flow drops back to UNTESTED with /terms UNTESTED", () => {
  const bad = MANIFEST.map((m) => (m.id === "docs" ? { ...m, routes: m.routes!.map((r) => (r.route === "/terms" ? { ...r, evidence: [{ file: "scripts/test_terms_flow.mjs", title: "terms: this assertion was never written" }] } : r)) } : m));
  const docs = buildRows(undefined, bad).find((r) => r.id === "docs")!;
  assert.equal(docs.status, "OWNED-ELSEWHERE-UNTESTED");
  assert.deepEqual(docs.routes!.find((r) => r.route === "/terms"), { route: "/terms", tested: false });
});
