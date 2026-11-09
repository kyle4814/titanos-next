// C10 acceptance: (1) equality with the frozen legacy "a && b && c" line (zero dropped, same order),
// (2) lint passes on the real manifest, (3) two-branch union merge in a temp git repo is clean,
// (4) mutations (deleted line, duplicate, missing file, blank line) are caught.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintManifest, readEntries } from "./test_manifest_lint.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = join(root, "scripts/test_manifest.txt");
const legacy = readFileSync(join(root, "scripts/fixtures/test_manifest_legacy_line.txt"), "utf8").trim().split(" && ");
const entries = readEntries(manifest);
const tmp = mkdtempSync(join(tmpdir(), "c10-"));
let ok = 0;
const t = (name, fn) => { fn(); ok += 1; console.log(`ok - ${name}`); };

try {
  t("lint clean on real manifest", () => assert.deepEqual(lintManifest(manifest, root), []));

  t("legacy line: zero dropped, same relative order", () => {
    const dropped = legacy.filter((c) => !entries.includes(c));
    assert.deepEqual(dropped, []);
    const idx = legacy.map((c) => entries.indexOf(c));
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
    console.log(`  legacy ${legacy.length} commands, manifest ${entries.length} entries, dropped 0`);
  });

  t("package.json test is the runner", () => {
    const pj = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(pj.scripts.test, "node scripts/run_tests.mjs");
  });

  t("gitattributes marks the manifest merge=union", () =>
    assert.match(readFileSync(join(root, ".gitattributes"), "utf8"), /^scripts\/test_manifest\.txt\s+merge=union$/m));

  const mut = (name, lines, rx) => t(`mutation caught: ${name}`, () => {
    const f = join(tmp, `m-${ok}.txt`);
    writeFileSync(f, lines.join("\n") + "\n");
    const p = lintManifest(f, root).join("|");
    assert.match(p, rx);
  });
  mut("duplicate line", [entries[0], entries[0]], /duplicate/);
  mut("missing file", ["node scripts/does_not_exist_zz.mjs"], /missing file/);
  mut("blank line", [entries[0], "", entries[1]], /blank line/);
  mut("empty comment", ["#", entries[0]], /empty comment/);

  t("mutation caught: deleting a line fails the equality check", () => {
    const cut = entries.filter((_, i) => i !== 5);
    assert.ok(legacy.some((c) => !cut.includes(c)), "equality check must see the dropped test");
  });

  t("two branches each append a different line: union merge is clean", () => {
    const repo = join(tmp, "repo");
    const g = (...a) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" });
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    copyFileSync(manifest, join(repo, "test_manifest.txt"));
    writeFileSync(join(repo, ".gitattributes"), "test_manifest.txt merge=union\n");
    g("add", "-A"); g("commit", "-qm", "base");
    const base = readFileSync(join(repo, "test_manifest.txt"), "utf8");
    for (const b of ["a", "b"]) {
      g("switch", "-q", "-c", b, "main");
      writeFileSync(join(repo, "test_manifest.txt"), base + `node scripts/test_new_${b}.mjs\n`);
      g("commit", "-qam", b);
    }
    g("switch", "-q", "a");
    g("merge", "-q", "--no-edit", "b"); // throws on conflict
    const merged = readFileSync(join(repo, "test_manifest.txt"), "utf8");
    assert.ok(merged.includes("test_new_a.mjs") && merged.includes("test_new_b.mjs"));
    assert.equal(merged.split("\n").length, base.split("\n").length + 2);
    // control: the same two-branch merge WITHOUT the attribute conflicts (the attribute does the work)
    const ctl = join(tmp, "ctl");
    const c = (...a) => execFileSync("git", ["-C", ctl, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8", stdio: "pipe" });
    execFileSync("git", ["init", "-q", "-b", "main", ctl]);
    copyFileSync(manifest, join(ctl, "test_manifest.txt")); c("add", "-A"); c("commit", "-qm", "base");
    for (const b of ["a", "b"]) {
      c("switch", "-q", "-c", b, "main");
      writeFileSync(join(ctl, "test_manifest.txt"), base + `node scripts/test_new_${b}.mjs\n`); c("commit", "-qam", b);
    }
    c("switch", "-q", "a");
    assert.throws(() => c("merge", "-q", "--no-edit", "b"));
  });
  console.log(`test_test_manifest: ${ok} checks passed`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
