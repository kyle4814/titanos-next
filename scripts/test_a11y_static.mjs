// Tests for check_a11y_static.mjs: good fixture clean, bad fixture trips every rule, one mutant per rule.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSource, ratio, discover } from "./check_a11y_static.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, "../app/globals.css"), "utf8");
import { run } from "./check_a11y_static.mjs";
const tok = {}; for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tok[m[1]] = m[2];
const fx = (n) => fs.readFileSync(path.join(here, "fixtures/a11y", n), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("PASS", m); };
const rules = (src, o = { page: true }) => checkSource(src, "t.tsx", tok, o).map((f) => f.rule);

const good = fx("good.tsx");
ok(rules(good).length === 0, `good fixture has zero findings (got ${JSON.stringify(rules(good))})`);

const bad = checkSource(fx("bad.tsx"), "bad.tsx", tok, { page: true });
for (const r of ["input-label", "img-alt", "heading-skip", "button-text", "main-landmark", "tabindex-positive", "contrast"]) ok(bad.some((f) => f.rule === r), `bad fixture trips ${r}`);
ok(checkSource(fx("layout_bad.tsx"), "layout.tsx", tok, { layout: true }).some((f) => f.rule === "html-lang"), "layout without lang trips html-lang");
ok(checkSource(fx("bad.tsx"), "bad.tsx", tok, { page: true }).find((f) => f.rule === "img-alt").line === 7, "finding carries the right line (img on line 7)");

// mutants: break the good fixture one way, the rule must fire (kills a checker that went blind)
const mut = (name, from, to, rule, o) => { ok(good.includes(from), `mutant ${name}: anchor present`); ok(rules(good.replace(from, to), o).includes(rule), `mutant ${name} caught by ${rule}`); };
mut("input", '<input aria-label="Email" type="email" />', '<input type="email" />', "input-label");
mut("input-wrapper", '<Field label="Hours"><input type="number" /></Field>', '<div><input type="number" /></div>', "input-label");
mut("img", '<img src="/a.png" alt="A chart" />', '<img src="/a.png" />', "img-alt");
mut("heading", "<h3>Sub</h3>", "<h4>Sub</h4>", "heading-skip");
mut("button", "<button type=\"button\">Save</button>", '<button type="button"></button>', "button-text");
mut("main", '<main id="main">', "<div>", "main-landmark");
mut("tabindex", "tabIndex={0}", "tabIndex={2}", "tabindex-positive");
mut("contrast", 'color: "var(--text)", background: "var(--vault-black)"', 'color: "#444444", background: "var(--vault-black)"', "contrast");
mut("contrast-large-threshold", 'color: "var(--gold)", fontSize: 28', 'color: "#2a2a2a", fontSize: 28', "contrast");
// large text uses the 3:1 bar, body uses 4.5:1
const mid = "#757575"; // ~4.4 on black-ish? computed below
const r1 = ratio("#767676", "#ffffff");
ok(r1 >= 4.5 && r1 < 4.6, `ratio maths: #767676 on white = ${r1.toFixed(2)}`);
ok(!rules(`<main><p style={{ color: "#6a6a6a", background: "#000000", fontSize: 28 }}>x</p></main>`).includes("contrast"), "large text at ~3.7:1 passes the 3:1 bar");
ok(rules(`<main><p style={{ color: "#6a6a6a", background: "#000000", fontSize: 14 }}>x</p></main>`).includes("contrast"), "body text at ~3.7:1 fails the 4.5:1 bar");
// html lang mutant on a good layout
const goodLayout = '<html lang="en"><body/></html>';
ok(rules(goodLayout, { layout: true }).length === 0, "layout with lang is clean");
ok(rules(goodLayout.replace(' lang="en"', ""), { layout: true }).includes("html-lang"), "mutant: lang removed caught by html-lang");
// scope: the real tree
ok(Array.isArray(discover(path.join(here, ".."))), "discover runs on the real tree");
// tokens
ok(!!tok["vault-black"] && !!tok["text"], "design tokens load from app/globals.css");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
