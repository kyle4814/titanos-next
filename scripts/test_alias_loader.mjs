// test_alias_loader.mjs - scripts/alias_loader.mjs resolves the tsconfig alias "@/*" for node tests.
// Regression: an unresolvable alias fails LOUD (ERR_ALIAS_UNRESOLVED), never silently.
// Mutation: ALIAS_LOADER_MUTANTS=1 breaks the alias map / hook and the probe must fail.
// Run: node scripts/test_alias_loader.mjs
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOADER = path.join(ROOT, "scripts/alias_loader.mjs");
const scratch = mkdtempSync(path.join(tmpdir(), "aliasldr-"));
const probe = (code, env = {}, loader = LOADER) => {
  const f = path.join(scratch, `p${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(f, code);
  return spawnSync(process.execPath, ["--no-warnings", "--import", loader, "--experimental-strip-types", f], { env: { ...process.env, ...env }, encoding: "utf8" });
};
// A file that really exists one level above the alias root: only the guard stops it resolving.
const ESCAPE = `@/../${path.basename(ROOT)}/scripts/alias_loader.mjs`;
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("ok  ", name); };

t("@/lib/config (extensionless .ts) resolves", () => {
  const r = probe(`const m = await import("@/lib/config"); console.log(Object.keys(m).includes("SITE"));`);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "true");
});
t("@/lib/portal.ts (explicit extension) resolves and its own @/ import chains through", () => {
  const r = probe(`const m = await import("@/lib/portal.ts"); console.log(typeof m.ApiError, new m.ApiError(503,"x",{a:1}).body.a);`);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "function 1");
});
t("directory index resolution: @/lib/<dir> picks index.ts", () => {
  const d = path.join(ROOT, ".alias_probe_tmp"); mkdirSync(d, { recursive: true });
  try {
    writeFileSync(path.join(d, "index.ts"), "export const hit: number = 7;\n");
    const r = probe(`const m = await import("@/.alias_probe_tmp"); console.log(m.hit);`);
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "7");
  } finally { rmSync(d, { recursive: true, force: true }); }
});
t("non-alias specifiers are untouched (node:fs, relative)", () => {
  const r = probe(`import fs from "node:fs"; console.log(typeof fs.readFileSync);`);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "function");
});
t("REGRESSION unresolvable alias fails loud: non-zero exit, named code, names the specifier", () => {
  const r = probe(`await import("@/lib/does_not_exist_zzz"); console.log("SILENT");`);
  assert.notEqual(r.status, 0); assert.doesNotMatch(r.stdout, /SILENT/);
  assert.match(r.stderr, /ERR_ALIAS_UNRESOLVED/); assert.match(r.stderr, /@\/lib\/does_not_exist_zzz/);
});
t("REGRESSION traversal out of the alias root is refused", () => {
  const r = probe(`await import("${ESCAPE}"); console.log("SILENT");`);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /ERR_ALIAS_UNRESOLVED/);
});
t("a broken alias map (ALIAS_LOADER_ROOT -> empty dir) makes the real import FAIL", () => {
  const r = probe(`await import("@/lib/config"); console.log("SILENT");`, { ALIAS_LOADER_ROOT: scratch });
  assert.notEqual(r.status, 0); assert.doesNotMatch(r.stdout, /SILENT/); assert.match(r.stderr, /ERR_ALIAS_UNRESOLVED/);
});
t("without the loader the alias cannot load (proves the loader is what makes it work)", () => {
  const f = path.join(scratch, "noloader.mjs"); writeFileSync(f, `await import("@/lib/config");`);
  const r = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", f], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
});

if (process.env.ALIAS_LOADER_MUTANTS === "1") {
  const hooks = readFileSync(path.join(ROOT, "scripts/alias_hooks.mjs"), "utf8");
  const M = [
    ["M1 alias map points at the wrong dir", (s) => s.replace('path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")', 'path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../nowhere")')],
    ["M2 hook ignores the alias prefix", (s) => s.replace('specifier.startsWith("@/")', "false")],
    ["M3 .ts extension dropped from candidates", (s) => s.replace('const EXT = ["", ".ts", ".tsx"', 'const EXT = ["", ".tsx"')],
    ["M4 unresolved alias falls through silently", (s) => s.replace(/const e = new Error\(`alias_loader: cannot resolve[\s\S]*?throw e;\n\}/, "return nextResolve(specifier, context);\n}")],
    ["M5 traversal guard removed", (s) => s.replace('rest.split("/").includes("..")', "false")],
  ];
  let killed = 0;
  for (const [name, fn] of M) {
    const out = fn(hooks); assert.notEqual(out, hooks, `mutant did not apply: ${name}`);
    const md = mkdtempSync(path.join(scratch, "m-"));
    writeFileSync(path.join(md, "alias_hooks.mjs"), out);
    writeFileSync(path.join(md, "alias_loader.mjs"), `import { register } from "node:module"; register("./alias_hooks.mjs", import.meta.url);\n`);
    // mutant hooks sit outside scripts/, so pin the alias root to the repo for the unmutated-root mutants
    const env = { ALIAS_LOADER_ROOT: name.startsWith("M1") ? "" : ROOT };
    const ldr = path.join(md, "alias_loader.mjs");
    const checks = [
      probe(`const m = await import("@/lib/config"); if (!m.SITE) throw new Error("no SITE");`, env, ldr),
      probe(`await import("@/lib/does_not_exist_zzz"); throw new Error("SILENT");`, env, ldr),
      probe(`await import("${ESCAPE}"); throw new Error("SILENT");`, env, ldr),
    ];
    const ok = checks[0].status === 0 && checks[1].status !== 0 && /ERR_ALIAS_UNRESOLVED/.test(checks[1].stderr) && checks[2].status !== 0 && /ERR_ALIAS_UNRESOLVED/.test(checks[2].stderr);
    if (!ok) { killed++; console.log("kill", name); } else console.log("SURVIVED", name);
  }
  rmSync(scratch, { recursive: true, force: true });
  assert.equal(killed, M.length, `ALIAS_LOADER_MUTANTS ${killed}/${M.length} killed`);
  console.log(`ALIAS_LOADER_MUTANTS ${killed}/${M.length} killed`);
} else rmSync(scratch, { recursive: true, force: true });
console.log(`\n${passed} passed`);
