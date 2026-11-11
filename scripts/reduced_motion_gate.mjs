// reduced_motion_gate.mjs - prefers-reduced-motion + print-stylesheet gate over SOURCE (CSS + TSX) of every public door page.
// f403_c1, 2026-11-10. STATIC SOURCE GATE: it proves the guards exist in source, not that a browser renders them.
// Usage: node scripts/reduced_motion_gate.mjs [--json] [--table]      exit 1 on any failure.
// Rules (RM = reduced motion, PR = print):
//   RM1 css-animation   every CSS animation/transition >200ms/smooth scroll is inside (prefers-reduced-motion: no-preference),
//                       or covered by a (prefers-reduced-motion: reduce) rule for the same selector, or by a universal reset.
//   RM2 js-motion       every file driving motion in JS (framer-motion m/animate, gsap, lenis, requestAnimationFrame, WAAPI,
//                       inline transitions >200ms, autoplay video) reads the reduce preference AND uses the result.
//   RM3 motion-only     a base state that hides content (opacity 0) until an animation runs must be restored under reduce;
//                       keyframes must not carry text via content:; no <marquee>.
//   PR1 nav hidden      PR2 footer (legal, ABN, privacy/terms) kept   PR3 every fixed overlay hidden in print
//   PR4 no clipping     PR5 body text/prices forced readable (dark theme text colours reset) and not hidden
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCss, isReduce, isNoPref, isPrint, times } from "./lib/rm_css.mjs";

const DIRS = ["app", "components", "lib"];
const EXT = /\.(css|tsx|ts)$/;

export function loadTree(root) {
  const tree = new Map();
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") walk(r); }
      else if (EXT.test(e.name) && !/\.d\.ts$/.test(e.name)) tree.set(r, fs.readFileSync(path.join(root, r), "utf8"));
    }
  };
  for (const d of DIRS) if (fs.existsSync(path.join(root, d))) walk(d);
  return tree;
}

// ---------- imports closure ----------
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;
function resolve(tree, from, spec) {
  let base;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}.css`, `${base}/index.tsx`, `${base}/index.ts`]) if (tree.has(c)) return c;
  return null;
}
function closure(tree, entry, memo = new Map()) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f) || !tree.has(f)) continue;
    seen.add(f);
    if (f.endsWith(".css")) continue;
    for (const m of tree.get(f).matchAll(IMPORT_RE)) { const r = resolve(tree, f, m[1]); if (r) stack.push(r); }
  }
  return seen;
}

// ---------- CSS extraction ----------
function cssSources(file, text) {
  if (file.endsWith(".css")) return [text];
  const out = [];
  for (const m of text.matchAll(/`([^`]{30,})`/g)) {
    const body = m[1].replace(/\$\{[^}]*\}/g, "0");
    if (/[.#\w\]\)-][^{}]*\{[^{}]*:[^{}]*\}/.test(body) && /(animation|transition|@media|position|display)\s*[:(]/.test(body)) out.push(body);
  }
  return out;
}

const keyOf = (sel) => {
  let s = sel.replace(/:(hover|focus|focus-visible|focus-within|active|visited)\b/g, "").trim();
  s = s.split(/[\s>+~]+/).filter(Boolean).pop() || s;
  return s.replace(/\s+/g, "");
};
const UNIVERSAL = /^\*(::?(before|after))?$/;

function declKinds(decls) {
  const k = { animation: false, transition: false, scroll: false, reveal: false };
  for (const d of decls) {
    const v = d.value.toLowerCase();
    if (d.prop === "animation" || d.prop === "animation-name") { if (!/^(none|initial|inherit|unset)\b/.test(v)) k.animation = true; }
    if (d.prop === "transition" || d.prop === "transition-duration") { const t = times(v); if (!/^none\b/.test(v) && t.length && (d.prop === "transition-duration" ? Math.max(...t) : t[0]) > 0.2) k.transition = true; }
    if (d.prop === "scroll-behavior" && v === "smooth") k.scroll = true;
  }
  const op = decls.find((d) => d.prop === "opacity");
  if (op && parseFloat(op.value) <= 0.01 && k.animation) k.reveal = true;
  return k;
}
function resetKinds(decls) {
  const k = { animation: false, transition: false, scroll: false, restore: false };
  for (const d of decls) {
    const v = d.value.toLowerCase().trim();
    if ((d.prop === "animation" || d.prop === "animation-name") && /^none\b/.test(v)) k.animation = true;
    if (d.prop === "animation-duration" && times(v).every((t) => t <= 0.01)) k.animation = true;
    if (d.prop === "transition" && /^none\b/.test(v)) k.transition = true;
    if (d.prop === "transition-duration" && times(v).every((t) => t <= 0.01)) k.transition = true;
    if (d.prop === "scroll-behavior" && v === "auto") k.scroll = true;
    if ((d.prop === "opacity" && parseFloat(v) >= 0.99) || (d.prop === "visibility" && v === "visible")) k.restore = true;
  }
  return k;
}

// returns { motions:[{file,sel,kind}], covers:[{key,universal,kinds}], printRules, fixed:[{file,sel}], failures:[] }
export function analyseCss(tree) {
  const per = new Map(); // file -> {rules, keyframes}
  for (const [f, t] of tree) {
    const parsed = { rules: [], keyframes: [] };
    for (const css of cssSources(f, t)) { const p = parseCss(css); parsed.rules.push(...p.rules); parsed.keyframes.push(...p.keyframes); }
    if (parsed.rules.length || parsed.keyframes.length) per.set(f, parsed);
  }
  return per;
}

function checkCssFile(file, parsed, globalCovers) {
  const fails = [];
  const local = [];
  for (const r of parsed.rules) if (isReduce(r.at)) { const k = resetKinds(r.decls); for (const s of r.sels) local.push({ key: keyOf(s), universal: UNIVERSAL.test(s.trim()), k }); }
  const covers = [...local, ...globalCovers];
  const covered = (sels, kind) => sels.every((s) => covers.some((c) => c.k[kind] && (c.universal || c.key === keyOf(s))));
  for (const r of parsed.rules) {
    if (isReduce(r.at) || isNoPref(r.at) || isPrint(r.at)) continue;
    const k = declKinds(r.decls);
    for (const kind of ["animation", "transition", "scroll"]) {
      if (k[kind] && !covered(r.sels, kind)) fails.push({ rule: "RM1", file, msg: `${kind} on "${r.sels.join(", ")}" has no prefers-reduced-motion guard` });
    }
    if (k.reveal && !r.sels.every((s) => covers.some((c) => c.k.restore && (c.universal || c.key === keyOf(s))))) {
      fails.push({ rule: "RM3", file, msg: `"${r.sels.join(", ")}" is hidden (opacity 0) until animated and never restored under reduce` });
    }
  }
  for (const kf of parsed.keyframes) if (/\bcontent\s*:/.test(kf.body)) fails.push({ rule: "RM3", file, msg: `@keyframes ${kf.name} carries text via content:` });
  return fails;
}

// ---------- JS motion ----------
const FM_MOTION = /import\s*\{[^}]*\b(m\s+as\s+motion|motion|m|animate|AnimatePresence|useAnimationControls|useScroll|useSpring|useTransform|useMotionValue)\b[^}]*\}\s*from\s*["']framer-motion["']/;
function jsMotionKinds(text) {
  const k = [];
  if (/from\s*["']gsap["']|import\(\s*["']gsap["']/.test(text)) k.push("gsap");
  if (/from\s*["']lenis["']|import\(\s*["']lenis["']/.test(text)) k.push("lenis");
  if (FM_MOTION.test(text)) k.push("framer-motion");
  if (/\brequestAnimationFrame\s*\(/.test(text)) k.push("requestAnimationFrame");
  if (/\.animate\(\s*[\[{]/.test(text)) k.push("WAAPI");
  if (/<video\b[^>]*\bautoPlay\b/s.test(text) || /<video\b[^>]*\bautoplay\b/si.test(text)) k.push("autoplay-video");
  if (/<marquee\b/i.test(text)) k.push("marquee");
  for (const m of text.matchAll(/\b(transition|animation)\s*:\s*["'`]([^"'`]+)["'`]/g)) { const t = times(m[2]); if (!/^none/.test(m[2]) && t.length && t[0] > 0.2) { k.push(`inline-${m[1]}`); break; } }
  return k;
}
function hasGuard(text) {
  const reads = [];
  const m = text.match(/(?:const|let)\s+(\w+)\s*=\s*useReducedMotion\s*\(\s*\)/);
  if (m) { const used = (text.match(new RegExp(`\\b${m[1]}\\b`, "g")) || []).length > 1; reads.push(used); }
  if (/matchMedia\(\s*["'`][^"'`]*prefers-reduced-motion/.test(text)) reads.push(true);
  if (/reducedMotion\s*=\s*["']/.test(text) || /gsap\.matchMedia/.test(text)) reads.push(true);
  return reads.some(Boolean);
}
// Narrow, justified exemptions: the file is NOT visual motion. Each entry needs a reason and is re-validated by the test.
export const ALLOW = {
  "app/demo/tix/scan/page.tsx": { kinds: ["requestAnimationFrame"], reason: "requestAnimationFrame only paces camera-frame QR decoding; nothing on screen moves" },
};
function checkJsFile(file, text) {
  if (!/\.(tsx|ts)$/.test(file)) return [];
  let kinds = jsMotionKinds(text);
  if (ALLOW[file]) kinds = kinds.filter((k) => !ALLOW[file].kinds.includes(k));
  if (!kinds.length) return [];
  if (hasGuard(text)) return [];
  return [{ rule: kinds.includes("marquee") ? "RM3" : "RM2", file, msg: `drives motion (${kinds.join(", ")}) without reading prefers-reduced-motion` }];
}

// ---------- print ----------
function hides(decls) {
  return decls.some((d) => (d.prop === "display" && /^none\b/i.test(d.value)) || (d.prop === "visibility" && /^hidden\b/i.test(d.value)));
}
export function checkPrint(tree, per, layoutSet) {
  const fails = [];
  const printRules = [];
  for (const [f, p] of per) for (const r of p.rules) if (isPrint(r.at)) printRules.push({ file: f, ...r });
  const global = printRules.filter((r) => layoutSet.has(r.file));
  const hiddenSels = (rs) => rs.filter((r) => hides(r.decls)).flatMap((r) => r.sels);
  const hiddenKeys = new Set(hiddenSels(global).map(keyOf));
  // PR1
  if (!hiddenKeys.has("nav")) fails.push({ rule: "PR1", file: "app/globals.css", msg: "print stylesheet does not hide nav" });
  // PR2
  const footerHidden = hiddenSels(printRules).some((s) => /(^|[\s,>])footer\b/.test(s));
  if (footerHidden) fails.push({ rule: "PR2", file: "app/globals.css", msg: "print stylesheet hides footer (legal footer must print)" });
  const foot = tree.get("components/Footer.tsx") || "";
  if (!/ABN/.test(foot) || !/\/privacy/.test(foot) || !/\/terms/.test(foot)) fails.push({ rule: "PR2", file: "components/Footer.tsx", msg: "footer lacks ABN or privacy/terms links" });
  if (/<footer[^>]*data-no-print/.test(foot)) fails.push({ rule: "PR2", file: "components/Footer.tsx", msg: "footer carries data-no-print" });
  // PR3 fixed overlays: CSS position:fixed owners and inline-style fixed files
  const fixedFiles = [];
  for (const [f, p] of per) {
    if (!layoutSet.has(f) && !f.startsWith("components/") && !f.startsWith("app/")) continue;
    for (const r of p.rules) {
      if (isReduce(r.at) || isPrint(r.at)) continue;
      if (r.decls.some((d) => d.prop === "position" && /^(fixed|sticky)\b/.test(d.value))) {
        for (const s of r.sels) {
          if (/(?:^|\s)(?:html|body)\b/.test(s) && !/[.#]/.test(s)) continue;
          const k = keyOf(s);
          const ok = hiddenKeys.has(k) || printRules.some((pr) => pr.file === f && hides(pr.decls) && pr.sels.some((x) => keyOf(x) === k));
          if (!ok && !/^nav\b/.test(k)) fails.push({ rule: "PR3", file: f, msg: `fixed/sticky overlay "${s}" is not hidden in print` });
        }
      }
    }
  }
  for (const [f, t] of tree) {
    if (!f.endsWith(".tsx")) continue;
    if (/position:\s*["']fixed["']/.test(t) && !/data-no-print/.test(t) && !printRules.some((r) => r.file === f && hides(r.decls)) && !f.includes("/demo/")) fixedFiles.push(f);
  }
  for (const f of fixedFiles) fails.push({ rule: "PR3", file: f, msg: "inline position:fixed element without data-no-print or a print hide rule" });
  // PR4 clipping
  const clipFix = global.some((r) => r.sels.some((s) => /^(html|body|html, body|\*)$/.test(s) || ["html", "body"].includes(s)) && r.decls.some((d) => d.prop === "overflow" && /^visible/.test(d.value)) && r.decls.some((d) => d.prop === "height" && /^auto/.test(d.value)));
  if (!clipFix) fails.push({ rule: "PR4", file: "app/globals.css", msg: "print stylesheet does not set html/body overflow:visible + height:auto (content can be clipped)" });
  if (printRules.some((r) => r.decls.some((d) => (d.prop === "overflow" || d.prop === "overflow-y") && /hidden|clip|scroll/.test(d.value) && r.sels.some((s) => /^(html|body|main)$/.test(s)))))
    fails.push({ rule: "PR4", file: "app/globals.css", msg: "print rule clips html/body/main" });
  // PR5 text readable, not hidden
  const readable = global.some((r) => r.sels.some((s) => /\*/.test(s) || /^body$/.test(s)) && r.decls.some((d) => d.prop === "-webkit-text-fill-color" || (d.prop === "color" && /#0{3,6}|black/i.test(d.value))) && r.sels.some((s) => /\*/.test(s)));
  if (!readable) fails.push({ rule: "PR5", file: "app/globals.css", msg: "print stylesheet does not reset descendant text colours (light-on-white body text and prices vanish)" });
  for (const s of hiddenSels(printRules)) if (/^(main|article|section|p|h[1-6]|li|td|th|table|\.price\w*|\[data-price\w*\])\b/.test(s.trim())) fails.push({ rule: "PR5", file: "app/globals.css", msg: `print hides content selector "${s}"` });
  return fails;
}

// ---------- pages ----------
export function pageRoutes(tree) {
  return [...tree.keys()].filter((f) => /^app\/(.*\/)?page\.tsx$/.test(f)).sort();
}
const routeOf = (f) => "/" + f.replace(/^app\//, "").replace(/\/?page\.tsx$/, "");

export function runGate(tree) {
  const per = analyseCss(tree);
  const layouts = [...tree.keys()].filter((f) => /^app\/(.*\/)?layout\.tsx$/.test(f));
  const rootLayout = closure(tree, "app/layout.tsx");
  // global universal / reduce covers come from files always loaded (root layout closure)
  const globalCovers = [];
  for (const f of rootLayout) { const p = per.get(f); if (!p) continue; for (const r of p.rules) if (isReduce(r.at)) { const k = resetKinds(r.decls); for (const s of r.sels) globalCovers.push({ key: keyOf(s), universal: UNIVERSAL.test(s.trim()), k }); } }
  // per file findings (CSS + JS)
  const byFile = new Map();
  const add = (f, arr) => { if (arr.length) byFile.set(f, [...(byFile.get(f) || []), ...arr]); };
  for (const [f, p] of per) add(f, checkCssFile(f, p, globalCovers.filter((c) => c.universal)));
  for (const [f, t] of tree) add(f, checkJsFile(f, t));
  const printFails = checkPrint(tree, per, rootLayout);
  const pages = pageRoutes(tree).map((pf) => {
    const set = new Set(closure(tree, pf));
    for (const l of layouts) if (pf.startsWith(l.replace(/layout\.tsx$/, ""))) for (const x of closure(tree, l)) set.add(x);
    for (const x of rootLayout) set.add(x);
    const failures = [];
    for (const f of set) failures.push(...(byFile.get(f) || []));
    for (const pfail of printFails) if (set.has(pfail.file) || pfail.file === "app/globals.css") failures.push(pfail);
    for (const x of set) if (tree.get(x) && x.endsWith(".tsx") && x !== "components/Footer.tsx") { /* print overlay findings already per file */ }
    const uniq = [...new Map(failures.map((x) => [`${x.rule}|${x.file}|${x.msg}`, x])).values()];
    return { route: routeOf(pf), files: set.size, status: uniq.length ? "FAIL" : "PASS", failures: uniq };
  });
  const all = [...new Map([...[...byFile.values()].flat(), ...printFails].map((x) => [`${x.rule}|${x.file}|${x.msg}`, x])).values()];
  return { pages, failures: all, pass: all.length === 0 };
}

export function table(res) {
  const rows = res.pages.map((p) => `| ${p.route} | ${p.files} | ${p.status} | ${[...new Set(p.failures.map((f) => f.rule))].join(",") || "-"} |`);
  return ["| route | files | result | rules failed |", "|---|---|---|---|", ...rows].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const res = runGate(loadTree(root));
  if (process.argv.includes("--json")) console.log(JSON.stringify(res, null, 2));
  else {
    if (process.argv.includes("--table")) console.log(table(res));
    for (const f of res.failures) console.error(`${f.rule} ${f.file}: ${f.msg}`);
    console.log(`reduced_motion_gate: ${res.pages.filter((p) => p.status === "PASS").length}/${res.pages.length} pages pass, ${res.failures.length} failure(s)`);
  }
  process.exit(res.pass ? 0 : 1);
}
