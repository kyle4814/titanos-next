// Generates public/.well-known/security.txt (RFC 9116) from lib/site-data/disclosure.json. The only writer of that file.
// Usage: node scripts/gen_security_txt.mjs [--check]   (--check exits 1 if the file on disk differs)
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
export function render(d) {
  const t = d.securityTxt;
  return [`Contact: ${t.contact}`, `Expires: ${t.expires}`, `Preferred-Languages: ${t.preferredLanguages}`, `Policy: ${t.policy}`, `Canonical: ${t.canonical}`, ""].join("\n");
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const d = JSON.parse(readFileSync(new URL("lib/site-data/disclosure.json", root), "utf8"));
  const out = new URL("public/.well-known/security.txt", root);
  const want = render(d);
  if (process.argv.includes("--check")) {
    let have = "";
    try { have = readFileSync(out, "utf8"); } catch { /* missing counts as different */ }
    if (have !== want) { console.error("security.txt differs from disclosure.json: run node scripts/gen_security_txt.mjs"); process.exit(1); }
    console.log("security.txt matches disclosure.json");
  } else { writeFileSync(out, want); console.log("wrote public/.well-known/security.txt"); }
}
