// W1 foundation regression gate (WEBSITE 1000X): fonts self-hosted + licensed, phi tokens, hero copy, poster budget,
// GSAP licence recorded, no Google font CDN, no em/en dashes in hero copy. Reads source files, not a build.
import { readFileSync, statSync, existsSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const r = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const sz = (p) => statSync(new URL("../" + p, import.meta.url)).size;

for (const f of ["fraunces-wght.woff2", "geist-wght.woff2", "OFL-Fraunces.txt", "OFL-Geist.txt"]) ok(existsSync(new URL("../public/fonts/" + f, import.meta.url)), `font file ${f} present`);
ok(sz("public/fonts/fraunces-wght.woff2") < 60000 && sz("public/fonts/geist-wght.woff2") < 60000, "display + body fonts each under 60 KB");
const layout = r("app/layout.tsx");
ok(/localFont/.test(layout) && !/Inter_Tight|IBM_Plex_Serif/.test(layout), "layout self-hosts the two variable fonts, no Google display/body fonts");
const css = r("app/design-system.css");
for (const [t, v] of [["--phi-t0", "1rem"], ["--phi-dur-1", "0.38s"], ["--phi-dur-2", "0.62s"], ["--phi-dur-3", "1s"], ["--phi-dur-4", "1.62s"], ["--phi-s4", "1.625rem"]]) ok(css.includes(`${t}:`) && css.includes(v), `token ${t} defined (${v})`);
ok(/38\.2%/.test(css) && /61\.8%/.test(css), "hero uses the golden split (61.8 / 38.2)");
ok(/prefers-reduced-motion/.test(css), "design system handles prefers-reduced-motion");
const hero = r("components/hero/Hero.tsx");
ok(hero.includes('{dec("estate_ey")} engineer-years of output in') && !/>\s*44 engineer-years/.test(hero), "hero headline reads its engineer-years figure from the ledger (one figure site-wide)");
ok(/HERO_STRIP/.test(hero) && /cost_job_before/.test(hero) && /tests_main/.test(hero) && !/230 jobs/.test(hero), "hero strip and sub-line read from the ledger (no hand-typed receipts, no 230 jobs)");
ok((hero.match(/className="ds-cta"/g) || []).length === 1, "hero has exactly one CTA");
ok(!/[–—]/.test(hero), "hero copy has no em/en dashes");
ok(!/world's first/i.test(hero), "no unprovable superlative in hero copy");
ok(sz("public/hero/poster-d.webp") > 1000 && sz("public/hero/poster-d.webp") < 200000 && sz("public/hero/poster-m.webp") < 200000, "hero posters exist and are under 200 KB");
const lic = r("docs/W1_LICENCES.md");
ok(/gsap\.com\/standard-license/.test(lic) && /2026-10-08/.test(lic) && /Lenis/.test(lic) && /OFL/.test(lic), "licences recorded with date (GSAP, Lenis, fonts)");
const motion = r("components/MotionLayer.tsx");
ok(/prefers-reduced-motion/.test(motion) && /import\("lenis"\)/.test(motion), "motion layer is lazy and respects reduced motion");
const gl = r("lib/gl.ts");
ok(/IntersectionObserver/.test(gl) && /onSlow/.test(gl) && /prefers-reduced-motion/.test(gl), "GL loop pauses off-screen, bails when slow, skips for reduced motion");
const wm = r("components/hero/PhiWordmark.tsx");
ok(/PHI/.test(wm) && /0\.618/.test(wm), "wordmark is built on phi geometry");
console.log(`== test_w1_foundation: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
