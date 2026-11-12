// F364: the error-path mutant target moved when F363 wrapped handle() in one cors() exit (handleInner).
// f86 mutation proof: copy portal-api to a scratch dir, break the header plumbing six ways, and the header suite MUST fail each time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "..");

// scratch root mirrors the repo layout: <root>/portal-api and <root>/lib (the Worker imports ../../lib)
function scratch(): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), "f86-"));
  const dir = join(root, "portal-api");
  cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes("node_modules") && !/[\\/]\.mut-[^\\/]*/.test(s) });
  // int3: the Worker also imports lib/shop (drain tick) and lib/concierge (demand), so the whole site lib/ (~1.6 MB) is copied
  cpSync(join(SITE, "lib"), join(root, "lib"), { recursive: true });
  return { root, dir };
}

const MUTANTS: Array<{ name: string; file: string; from: string; to: string }> = [
  { name: "drop one header (HSTS)", file: "src/http.ts", from: '  res.headers.set("strict-transport-security", hsts);\n', to: "" },
  { name: "wrong HSTS value", file: "src/http.ts", from: "includeSubDomains${preload}", to: "${preload}" },
  { name: "override a stricter caller value", file: "src/http.ts", from: "Math.max(HSTS_MAX_AGE, m ? Number(m[1]) : 0)", to: "HSTS_MAX_AGE" },
  { name: "one raw Response left (report markdown)", file: "src/index.ts", from: 'text(r.markdown, "text/markdown; charset=utf-8")', to: 'new Response(r.markdown, { headers: { "content-type": "text/markdown; charset=utf-8" } })' },
  { name: "helper bypassed on the error path", file: "src/index.ts", from: "if (e instanceof HttpError) return json({ error: e.code }, e.status);", to: "if (e instanceof HttpError) return new Response(JSON.stringify({ error: e.code }), { status: e.status, headers: { \"content-type\": \"application/json\" } });" },
  { name: "no-store dropped", file: "src/http.ts", from: '  if (!cc || !/\\bno-store\\b/i.test(cc)) res.headers.set("cache-control", "no-store");\n', to: "" },
];

// a nested `node --test` that inherits NODE_TEST_CONTEXT reports into the parent run and exits 0 whatever happens
function cleanEnv() { const e = { ...process.env, NODE_NO_WARNINGS: "1" }; delete e.NODE_TEST_CONTEXT; return e; }

function runSuite(dir: string) {
  return spawnSync(process.execPath, ["--test", "--experimental-strip-types", "test/http_headers.test.ts"], { cwd: dir, encoding: "utf8", timeout: 120000, env: cleanEnv() });
}

test("baseline: the unmutated copy passes the header suite", () => {
  const { root, dir } = scratch();
  try { const r = runSuite(dir); assert.equal(r.status, 0, r.stdout.slice(-1500)); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

for (const m of MUTANTS) {
  test(`mutant caught: ${m.name}`, () => {
    const { root, dir } = scratch();
    try {
      const f = join(dir, m.file), src = readFileSync(f, "utf8");
      assert.ok(src.includes(m.from), `mutation target not found: ${m.name}`);
      writeFileSync(f, src.replace(m.from, () => m.to));
      const r = runSuite(dir);
      assert.notEqual(r.status, 0, `SURVIVED: ${m.name}`);
      assert.match(r.stdout, /not ok [0-9]+ - (http|static|route|preflight|error)/, `died for the wrong reason (load error?): ${m.name}\n${r.stdout.slice(0, 600)}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
