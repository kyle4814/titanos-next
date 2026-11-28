// seo20/perf: Core Web Vitals source hygiene, no build needed. Usage: node scripts/test_cwv_hygiene.mjs
// Checks the code, not a measurement: every <img> in app/ and components/ carries intrinsic size (width+height props or an
// explicit style height) so it cannot shift layout; every <img> other than the home hero is lazy or the hero fetchPriority
// image; no <video> uses preload="auto" or autoPlay; the root fonts use font-display swap; below-fold home sections keep
// content-visibility with an "auto" intrinsic size. Each rule is proven able to fail on a mutant string.
import fs from "node:fs";
import path from "node:path";

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n); } };

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, out); }
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}
const tags = (src, name) => [...src.matchAll(new RegExp(`<${name}\\b[\\s\\S]*?(?:/>|>)`, "g"))].map((m) => m[0]);
export function imgProblems(tag) {
  const p = [];
  const sized = (/\bwidth=/.test(tag) && /\bheight=/.test(tag)) || /style=\{\{[^}]*\bheight:/.test(tag);
  if (!sized) p.push("no intrinsic size");
  if (!/loading=/.test(tag) && !/fetchPriority=/.test(tag) && !/decoding="async"/.test(tag)) p.push("no loading, fetchPriority or decoding async");
  return p;
}
export function videoProblems(tag) {
  const p = [];
  if (/preload="auto"/.test(tag)) p.push("preload auto");
  if (/\bautoPlay\b/.test(tag)) p.push("autoplay");
  return p;
}

ok(imgProblems('<img src="/a.png" alt="" />').length === 2, "mutant: bare img flagged for size and loading");
ok(imgProblems('<img src="/a.png" alt="" width={1} height={1} loading="lazy" />').length === 0, "clean img passes");
ok(videoProblems('<video preload="auto" autoPlay>').length === 2, "mutant: autoplay preload auto flagged");

const files = [...walk("app"), ...walk("components")];
let imgs = 0, vids = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const t of tags(src, "img")) { imgs++; const pr = imgProblems(t); ok(pr.length === 0, `${f} img: ${pr.join(", ") || "ok"}`); }
  for (const t of tags(src, "video")) { vids++; const pr = videoProblems(t); ok(pr.length === 0, `${f} video: ${pr.join(", ") || "ok"}`); }
}
ok(imgs > 5 && vids >= 2, `scanned ${imgs} img and ${vids} video tags`);

const layout = fs.readFileSync("app/layout.tsx", "utf8");
ok((layout.match(/display: "swap"/g) || []).length >= 3, "root fonts all use display swap");
const css = fs.readFileSync("components/home-redesign/home-redesign.css", "utf8");
ok(/content-visibility:\s*auto;\s*contain-intrinsic-size:\s*auto\s+\d+px/.test(css), "below-fold home sections use content-visibility with auto intrinsic size");
ok(!/\.pe-hero[^{]*\{[^}]*content-visibility/.test(css), "hero is never content-visibility");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
