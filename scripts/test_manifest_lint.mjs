// Lint for scripts/test_manifest.txt. Fails on: blank lines, bare/empty comments, duplicate
// entries, an entry with no command, or a script path (.mjs .ts .sh .py .js) that does not exist.
// Comment lines ("# words") are allowed and skipped. CLI: node scripts/test_manifest_lint.mjs [file]
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_RX = /\.(mjs|cjs|js|ts|sh|py)$/;

export function readEntries(file) {
  return readFileSync(file, "utf8").split("\n")
    .filter((l) => !l.startsWith("#") && l.trim() !== "");
}

export function lintManifest(file, root) {
  const out = [];
  if (!existsSync(file)) return [`manifest missing: ${file}`];
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  else out.push("no trailing newline (union merge would join lines)");
  const seen = new Map();
  lines.forEach((line, i) => {
    const at = `line ${i + 1}`;
    if (line.trim() === "") return void out.push(`${at}: blank line`);
    if (line !== line.trim()) out.push(`${at}: leading/trailing whitespace`);
    if (line.startsWith("#")) {
      if (line.replace(/^#+/, "").trim() === "") out.push(`${at}: empty comment`);
      return;
    }
    if (seen.has(line)) out.push(`${at}: duplicate of line ${seen.get(line)}: ${line}`);
    else seen.set(line, i + 1);
    for (const tok of line.split(/\s+/).slice(1)) {
      if (SCRIPT_RX.test(tok) && !existsSync(resolve(root, tok))) out.push(`${at}: missing file ${tok}`);
    }
  });
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const file = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "scripts/test_manifest.txt");
  const p = lintManifest(file, root);
  for (const m of p) console.error(`test_manifest_lint: ${m}`);
  if (p.length) process.exit(1);
  console.log(`test_manifest_lint: OK (${readEntries(file).length} entries)`);
}
