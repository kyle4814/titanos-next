// Sigil set sanity: generator is deterministic, every codename has a valid glyph, no meaning words leak into glyphs.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const dir = path.join(ROOT, "public", "sigils");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg"));
const set = fs.readFileSync(path.join(ROOT, "lib", "sigilSet.ts"), "utf8");
const names = JSON.parse(set.match(/= (\[.*?\]) as const/)[1]);
ok(names.length >= 30, `${names.length} sigils in set`);
ok(names.length === files.length && names.every((n) => files.includes(n.toLowerCase() + ".svg")), "every codename has a glyph file, no extras");
ok(files.every((f) => { const s = fs.readFileSync(path.join(dir, f), "utf8"); return s.startsWith("<svg") && s.includes("viewBox") && !/<(text|script)/.test(s); }), "glyphs are pure geometry (no text, no script)");
const before = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("");
if (fs.existsSync(path.join(process.env.KERNEL_DIR || path.join(process.env.HOME, "klinge-kernel"), "CORE.md"))) {
  execFileSync("node", [path.join(ROOT, "scripts", "gen_sigils.mjs")], { stdio: "ignore" });
  ok(files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("") === before, "generator is deterministic (regenerate = identical)");
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
