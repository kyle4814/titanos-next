// Leak test: the built site must contain NO doctrine. Fails if any CORE.md rule text (after the sigil ID),
// any LEXICON.md meaning cell, or any SOUL.md sentence appears in the built output.
// Usage: node scripts/test_no_doctrine_leak.mjs [builtDir]   (default: out/). Run by `npm test`.
// Fixture proof it bites: scripts/test_no_doctrine_leak_bites.sh.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "out"));
const KERNEL = process.env.KERNEL_DIR || path.join(os.homedir(), "klinge-kernel");
const norm = (s) => s.toLowerCase().replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const MIN = 28; // shorter fragments are too generic to be a distinctive doctrine line

const needles = []; // {src, text}
const read = (f) => { const p = path.join(KERNEL, f); if (!fs.existsSync(p)) { console.log(`FAIL missing doctrine file ${p} (fail closed)`); process.exit(1); } return fs.readFileSync(p, "utf8"); };

for (const l of read("CORE.md").split("\n")) {
  const m = l.match(/^([A-Z]+\d*(?:-\d+)?)\s+(.+)$/);
  if (!m || l.startsWith("#") || l.startsWith("##")) continue;
  // the rule text, then each sentence of it (rules are one-liners joined by '.' / ';' / ':')
  const rule = m[2];
  if (norm(rule).length >= MIN) needles.push({ src: "CORE " + m[1], text: rule });
  for (const part of rule.split(/(?<=[.;])\s+/)) if (norm(part).length >= MIN) needles.push({ src: "CORE " + m[1], text: part });
}
for (const l of read("LEXICON.md").split("\n")) {
  if (!l.startsWith("|") || /^\|[-\s|]+\|?$/.test(l)) continue;
  const cells = l.split("|").map((c) => c.trim()).filter(Boolean);
  if (cells.length >= 2 && cells[0] !== "Sigil" && norm(cells[1]).length >= MIN) needles.push({ src: "LEXICON " + cells[0], text: cells[1] });
}
let soul = 0;
for (const para of read("SOUL.md").split(/\n+/)) {
  if (para.startsWith("#")) continue;
  for (const s of para.split(/(?<=[.!?])\s+/)) if (norm(s).length >= 45) { needles.push({ src: "SOUL", text: s.replace(/^[-*>\d.\s]+/, "") }); soul++; }
}
const uniq = new Map(); for (const n of needles) uniq.set(norm(n.text), n);

function* walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) yield* walk(p); else if (/\.(html|txt|js|css|json|xml|svg|md|map)$/.test(e.name)) yield p; } }
if (!fs.existsSync(OUT)) { console.log(`FAIL built output not found: ${OUT} (run npm run build first)`); process.exit(1); }

const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/g, " $& ").replace(/<[^>]+>/g, " ");
let files = 0, fail = 0;
for (const f of walk(OUT)) {
  files++;
  const raw = fs.readFileSync(f, "utf8");
  const hay = [norm(raw), norm(strip(raw)), norm(raw.replace(/\\n|\\"/g, " "))];
  for (const [k, n] of uniq) {
    if (hay.some((h) => h.includes(k))) { fail++; if (fail <= 20) console.log(`FAIL doctrine leak [${n.src}] in ${path.relative(OUT, f)}: ${k.slice(0, 80)}`); }
  }
}
if (files === 0) { console.log("FAIL no files scanned"); process.exit(1); }
console.log(`${fail ? "FAIL" : "PASS"} scanned ${files} files against ${uniq.size} doctrine needles (${soul} SOUL sentences): ${fail} leaks`);
process.exit(fail ? 1 : 0);
