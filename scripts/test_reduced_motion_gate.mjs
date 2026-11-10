// Tests for reduced_motion_gate.mjs (f403_c1): clean tree passes, every rule family has a planted mutant that must be caught,
// guarded fixtures must pass, allowlist entries must be justified and still needed. Run: node scripts/test_reduced_motion_gate.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTree, runGate, ALLOW, pageRoutes } from "./reduced_motion_gate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = loadTree(root);
let fail = 0;
const t = (name, ok, extra = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + extra}`); };
const clone = () => new Map(base);
const sub = (tree, file, from, to) => {
  const s = tree.get(file);
  if (s === undefined) throw new Error(`mutant target missing: ${file}`);
  if (!(from instanceof RegExp ? from.test(s) : s.includes(from))) throw new Error(`mutant anchor not found in ${file}: ${from}`);
  tree.set(file, s.replace(from, to));
  return tree;
};
// the global (prefers-reduced-motion: reduce) universal reset flattens every CSS animation, so CSS mutants strip it first
const noUniversal = (x) => { const s = x.get("app/globals.css"); const re = /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{[^}]*\}\s*\}/g; if (!re.test(s)) throw new Error("universal reset not found"); x.set("app/globals.css", s.replace(re, "")); return x; };
const rulesOf = (res) => new Set(res.failures.map((f) => f.rule));

const clean = runGate(base);
t("clean tree: gate passes", clean.pass, JSON.stringify(clean.failures.slice(0, 3)));
t("clean tree: every public page is covered and passes", clean.pages.length === pageRoutes(base).length && clean.pages.length >= 70 && clean.pages.every((p) => p.status === "PASS"), `pages=${clean.pages.length}`);

const MUTANTS = [
  ["RM1 remove the .ph-in reduce rule", "RM1", (x) => sub(noUniversal(x), "app/globals.css", "@media (prefers-reduced-motion: reduce) { .ph-in { animation: none; } }", "")],
  ["RM1 add an unguarded 2s animation", "RM1", (x) => { noUniversal(x); x.set("components/home/Home.module.css", x.get("components/home/Home.module.css") + "\n.zz-mutant { animation: spin 2s linear infinite; }\n"); return x; }],
  ["RM1 add an unguarded 600ms transition", "RM1", (x) => { noUniversal(x); x.set("components/home/Home.module.css", x.get("components/home/Home.module.css") + "\n.zz-mutant2 { transition: transform 600ms ease; }\n"); return x; }],
  ["RM1 add smooth scroll with no reset", "RM1", (x) => { noUniversal(x); x.set("components/home/Home.module.css", x.get("components/home/Home.module.css") + "\n.zz-scroll { scroll-behavior: smooth; }\n"); return x; }],
  ["RM1 universal reset removed alone", "RM1", (x) => noUniversal(x)],
  ["RM2 GoldDust loses its matchMedia guard", "RM2", (x) => sub(x, "components/GoldDust.tsx", /prefers-reduced-motion: reduce/g, "prefers-colour-scheme: dark")],
  ["RM2 Nav stops using the reduce result", "RM2", (x) => sub(x, "components/Nav.tsx", /const reduce = useReducedMotion\(\);/g, "const reduce = false;")],
  ["RM2 autoplay video added", "RM2", (x) => sub(x, "app/v/titanos-pitch/page.tsx", "<video\n          controls", "<video\n          autoPlay loop controls")],
  ["RM2 new gsap component with no guard", "RM2", (x) => { x.set("components/ZzMutant.tsx", 'import gsap from "gsap";\nexport default function Z(){ gsap.to(".a",{x:100}); return null; }\n'); return x; }],
  ["RM3 content hidden until animated, no restore", "RM3", (x) => { x.set("components/home/Home.module.css", x.get("components/home/Home.module.css") + "\n.zz-hidden { opacity: 0; animation: zzin 1s forwards; }\n@media (prefers-reduced-motion: reduce) { .zz-hidden { animation: none; } }\n"); return x; }],
  ["PR1 print no longer hides nav", "PR1", (x) => sub(x, "app/globals.css", "  nav, [data-no-print],", "  [data-no-print],")],
  ["PR2 print hides the footer again", "PR2", (x) => sub(x, "app/globals.css", "  nav, [data-no-print],", "  nav, footer, [data-no-print],")],
  ["PR2 footer loses the ABN", "PR2", (x) => sub(x, "components/Footer.tsx", /ABN 34 318 502 254/g, "")],
  ["PR3 Sigil overlay not marked", "PR3", (x) => sub(x, "components/Sigil.tsx", " data-no-print", "")],
  ["PR3 sticky CTA not hidden in print", "PR3", (x) => sub(x, "app/globals.css", ", .sticky-mobile-cta {", " {")],
  ["PR4 print clipping fix removed", "PR4", (x) => sub(x, "app/globals.css", "    overflow: visible !important;\n  }\n  main, main * {", "  }\n  main, main * {")],
  ["PR5 print colour reset removed", "PR5", (x) => sub(x, "app/globals.css", "    color: black !important;\n    -webkit-text-fill-color: black !important;\n", "")],
];
for (const [name, rule, mut] of MUTANTS) {
  let res;
  try { res = runGate(mut(clone())); } catch (e) { t(`mutant ${name}`, false, e.message); continue; }
  t(`mutant caught: ${name}`, !res.pass && rulesOf(res).has(rule), `rules=${[...rulesOf(res)]}`);
}

// positive controls: guarded motion must not trip the gate
const ok = clone();
ok.set("components/home/Home.module.css", ok.get("components/home/Home.module.css") + "\n.zz-ok { animation: zz 2s infinite; }\n@media (prefers-reduced-motion: reduce) { .zz-ok { animation: none; } }\n.zz-ok2 { transition: opacity 150ms; }\n@media (prefers-reduced-motion: no-preference) { .zz-ok3 { animation: zz 3s infinite; } }\n");
ok.set("components/ZzOk.tsx", 'import { useReducedMotion } from "framer-motion";\nimport { m as motion } from "framer-motion";\nexport default function Z(){ const reduce = useReducedMotion(); return <motion.div animate={{ x: reduce ? 0 : 10 }} />; }\n');
t("guarded css and tsx fixtures pass", runGate(ok).pass, JSON.stringify(runGate(ok).failures.slice(0, 2)));

// allowlist hygiene
for (const [f, a] of Object.entries(ALLOW)) {
  t(`allowlist ${f} is justified`, typeof a.reason === "string" && a.reason.length > 20 && base.has(f));
  const bare = clone(); const saved = { ...ALLOW[f] }; delete ALLOW[f];
  const res = runGate(bare); ALLOW[f] = saved;
  t(`allowlist ${f} is still needed (removing it fails the gate)`, !res.pass);
}
// no em or en dashes in the new files
import fs from "node:fs";
const DASH = new RegExp("[" + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + "]");
for (const f of ["scripts/reduced_motion_gate.mjs", "scripts/lib/rm_css.mjs", "scripts/test_reduced_motion_gate.mjs"]) t(`no em/en dash in ${f}`, !DASH.test(fs.readFileSync(path.join(root, f), "utf8")));
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
