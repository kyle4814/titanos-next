// Test manifest runner (plan ch6 C10). Reads scripts/test_manifest.txt, one shell command per
// line, runs each in order from the repo root, stops on the first failure, passes the exit code
// through. Lint runs first so a bad manifest fails before any test does.
// Usage: node scripts/run_tests.mjs [--list]   (TEST_MANIFEST=path overrides the manifest)
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintManifest, readEntries } from "./test_manifest_lint.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = process.env.TEST_MANIFEST || resolve(root, "scripts/test_manifest.txt");

const problems = lintManifest(manifest, root);
if (problems.length) {
  for (const p of problems) console.error(`test_manifest_lint: ${p}`);
  process.exit(2);
}
const entries = readEntries(manifest);
if (process.argv.includes("--list")) {
  console.log(entries.join("\n"));
  process.exit(0);
}
let n = 0;
for (const cmd of entries) {
  n += 1;
  console.log(`\n[run_tests ${n}/${entries.length}] ${cmd}`);
  const r = spawnSync(cmd, { cwd: root, shell: true, stdio: "inherit" });
  const code = r.status ?? (r.signal ? 128 : 1);
  if (code !== 0) {
    console.error(`\nrun_tests: FAILED at ${n}/${entries.length}: ${cmd} (exit ${code})`);
    process.exit(code);
  }
}
console.log(`\nrun_tests: ${entries.length}/${entries.length} entries passed`);
