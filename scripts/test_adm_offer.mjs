// f413: /adm-sprint copy and component gate. Clean model must pass; every mutant must be caught.
// Run: node --experimental-strip-types scripts/test_adm_offer.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { checkAdmOffer } from "./adm_offer_check.mjs";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const mod = await import(new URL("../lib/admOffer.ts", import.meta.url).href);
const componentSrc = fs.readFileSync("components/AdmOffer.tsx", "utf8");
const pageSrc = fs.readFileSync("app/adm-sprint/page.tsx", "utf8");
const base = {
  copy: mod.admAllCopy(), sources: mod.ADM_SOURCES, facts: mod.ADM_FACTS, concerns: mod.ADM_CONCERNS,
  options: mod.ADM_OPTIONS, close: mod.ADM_CLOSE_LEAD, componentSrc,
};
const clone = () => structuredClone(base);

// 1. the real page is clean
const real = checkAdmOffer(base);
ok(real.length === 0, "real copy passes every rule" + (real.length ? " :: " + real.join("; ") : ""));

// 2. mutants: each must be flagged
const mutants = {
  "M1 urgency word": (m) => { m.copy.push("Act now, this is urgent."); },
  "M2 em dash": (m) => { m.copy.push("Sprint — fixed fee"); },
  "M3 missing source (fact cites a missing id)": (m) => { m.facts[0].source = "nowhere"; },
  "M4 no sources at all": (m) => { m.sources = []; },
  "M5 concerns block missing the cost answer": (m) => { m.concerns = m.concerns.filter((c) => c.id !== "cost"); },
  "M6 audit wording": (m) => { m.copy.push("A full audit and certification."); },
  "M7 unsourced number": (m) => { m.copy.push("Trusted by 500 organisations."); },
  "M8 permission close removed": (m) => { m.close = "Buy now."; },
  "M9 form added to component": (m) => { m.componentSrc += "<form onSubmit={x}><input/></form>"; },
  "M10 Option B split altered": (m) => { m.options[1].lines = ["Platform only: AU$0 up front. 50/50."]; },
};
let killed = 0;
for (const [name, mut] of Object.entries(mutants)) {
  const m = clone(); mut(m);
  const r = checkAdmOffer(m);
  ok(r.length > 0, `${name} is caught` + (r.length ? ` (${r[0]})` : ""));
  if (r.length) killed++;
}
ok(killed >= 3 && killed === Object.keys(mutants).length, `${killed}/${Object.keys(mutants).length} mutants killed (need 3 or more)`);

// 3. wiring
ok(/export const metadata/.test(pageSrc) && /withSeo\(ADM_ROUTE/.test(pageSrc), "page exports metadata via withSeo");
ok(/<AdmOffer \/>/.test(pageSrc), "page renders AdmOffer");
ok(/index:\s*true/.test(pageSrc), "page is indexable (a public offer page)");
for (const a of ["data-adm-concerns", "data-adm-options", "data-adm-sources", "data-adm-close", "data-adm-facts"]) ok(componentSrc.includes(a), `component renders ${a}`);
ok(/ADM_CONCERNS\.map/.test(componentSrc) && /ADM_OPTIONS\.map/.test(componentSrc) && /ADM_SOURCES\.map/.test(componentSrc), "component maps concerns, options and sources from the copy module");
// the permission close is the last section
ok(componentSrc.lastIndexOf("data-adm-close") > componentSrc.lastIndexOf("data-adm-sources"), "permission close comes after the sources, at the end");
// sources must point at commits that exist in the kernel repo when it is readable
const kern = "/home/tech2/klinge-kernel";
if (fs.existsSync(kern)) for (const s of mod.ADM_SOURCES) {
  const [file, sha] = s.ref.split(" @ ");
  const r = spawnSync("git", ["-C", kern, "cat-file", "-e", `${sha}:${file}`]);
  ok(r.status === 0, `source ${s.id}: ${file} exists at ${sha}`);
}
// figures trace to the research text
const research = fs.existsSync(kern) ? spawnSync("git", ["-C", kern, "show", "c45d757b49:state/research/ENTERPRISE_TARGETS_EXPLOSION_2026-11-10.md"], { encoding: "utf8" }).stdout : "";
if (research) for (const f of ["AU$25k", "AU$100k/yr", "70%", "30%", "AU$0 up front", "AU$500k", "10 business days", "12-item"]) ok(research.includes(f), `research text contains ${f}`);
const xray = fs.existsSync(kern) ? spawnSync("git", ["-C", kern, "show", "b85f81d535:state/research/adm_xray/SUMMARY.md"], { encoding: "utf8" }).stdout : "";
if (xray) for (const f of ["141 of 184", "77%", "265", "81"]) ok(xray.includes(f), `X-ray summary contains ${f}`);

// 4. content_lint, when the kernel tool is present
const lint = "/home/tech2/klinge-kernel/bin/content_lint.py";
if (fs.existsSync(lint)) {
  const tmp = fs.mkdtempSync("/tmp/f413-lint-"); const f = path.join(tmp, "copy.txt");
  fs.writeFileSync(f, base.copy.join("\n\n") + "\n");
  const r = spawnSync("python3", [lint, "--no-cta", f], { encoding: "utf8" });
  ok(r.status === 0, "content_lint --no-cta CLEAN" + (r.status ? " :: " + (r.stdout + r.stderr).slice(0, 400) : ""));
  fs.rmSync(tmp, { recursive: true, force: true });
} else console.log("NOTE content_lint absent, lint check skipped");

console.log(fail ? `\nFAILED ${fail}` : "\nALL PASS");
process.exit(fail ? 1 : 0);
