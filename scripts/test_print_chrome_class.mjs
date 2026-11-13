// f427_c10: site-wide print-chrome class fix. (1) screen CSS byte-identical to the int3 base (only @media print may differ),
// (2) the named fixed layers are hidden only inside @media print, (3) a planted NEW position:fixed layer without a print rule fails the gate.
// Run: node scripts/test_print_chrome_class.mjs
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { loadTree, runGate } from "./reduced_motion_gate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const t = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${ok ? "" : " " + x}`); };

// remove every top-level "@media print { ... }" block (brace matched)
function stripPrint(css) {
  let out = "", i = 0;
  const re = /@media\s+print\s*\{/g;
  for (let m; (m = re.exec(css)); ) {
    out += css.slice(i, m.index);
    let d = 1, j = re.lastIndex;
    while (j < css.length && d > 0) { if (css[j] === "{") d++; else if (css[j] === "}") d--; j++; }
    i = j; re.lastIndex = j;
  }
  return out + css.slice(i);
}
const BASE = "a56bef788"; // main plus f421 (video/audio focus ring, screen CSS) and f410 (print rule): the base this f427 change sits on in the 2026-11-13 release
let baseCss = null;
try { baseCss = execFileSync("git", ["show", `${BASE}:app/globals.css`], { cwd: root, encoding: "utf8" }); } catch { /* shallow clone */ }
const cur = readFileSync(path.join(root, "app/globals.css"), "utf8");
if (baseCss === null) console.log("SKIP screen-identical (base commit not in this clone)");
else t("screen CSS (everything outside @media print) is byte-identical to base", stripPrint(cur) === stripPrint(baseCss));

const NAMES = [".vault-mesh", ".finder-fab", ".music-toggle", ".fx-thread", "canvas:not([aria-label])"];
const outside = stripPrint(cur);
for (const n of NAMES) {
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hideRule = new RegExp(esc + "[^{}]*\\{[^}]*display:\\s*none");
  t(`${n} is hidden in print`, hideRule.test(cur.split(/@media\s+print\s*\{/).slice(1).join("\n")));
  t(`${n} display:none rule is not on screen`, !hideRule.test(outside));
}

const tree = loadTree(root);
t("clean tree passes gate", runGate(tree).pass);
const mut = new Map(tree);
mut.set("app/globals.css", mut.get("app/globals.css") + "\n.f427-planted-fixed-layer { position: fixed; top: 0; left: 0; }\n");
const res = runGate(mut);
t("planted new position:fixed layer without print rule FAILS the gate", !res.pass && res.failures.some((f) => f.rule === "PR3" && /f427-planted/.test(f.msg)), JSON.stringify(res.failures.slice(0, 2)));
process.exit(fail ? 1 : 0);
