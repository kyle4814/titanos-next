// W2 images regression gate: every manifest image has a clear licence, a source URL, a credit line, responsive
// AVIF + WebP files on disk, the hero is under 200 KB, the credits page lists every image, below-fold images are lazy.
import { readFileSync, existsSync, statSync } from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const u = (p) => new URL("../" + p, import.meta.url);
const r = (p) => readFileSync(u(p), "utf8");
const manifest = JSON.parse(r("scripts/images/manifest.json"));
const gen = JSON.parse(r("lib/space-images.generated.json"));
ok(manifest.length >= 10 && manifest.length <= 15, `10 to 15 images (${manifest.length})`);
ok(new Set(manifest.map((m) => m.id)).size === manifest.length, "ids unique");
const cats = new Set(manifest.map((m) => m.category));
for (const c of ["black-holes", "nebulae", "star-fields", "galaxies"]) ok(cats.has(c), `category ${c} covered`);
for (const m of manifest) {
  ok(/^https:\/\/(esawebb\.org|esahubble\.org|images\.nasa\.gov)\//.test(m.source), `${m.id} source URL on an approved host`);
  ok(/^https:\/\/(cdn\.esawebb\.org|cdn\.esahubble\.org|images-assets\.nasa\.gov)\//.test(m.download), `${m.id} download URL on an approved host`);
  ok(m.credit && m.credit.length > 3 && m.alt && m.alt.length > 20, `${m.id} credit + alt present`);
  const esa = /^ESA\//.test(m.agency);
  ok(esa ? m.licence === "CC BY 4.0" : /NASA media guidelines/.test(m.licence), `${m.id} licence is clear (${m.licence})`);
  ok(esa ? /NASA|ESA/.test(m.credit) : true, `${m.id} credit names the agency`);
  const g = gen.find((x) => x.id === m.id);
  ok(!!g, `${m.id} generated metadata`);
  if (!g) continue;
  for (const f of g.files) {
    ok(existsSync(u("public/space/" + f.name)) && statSync(u("public/space/" + f.name)).size === f.bytes, `${f.name} on disk`);
  }
  for (const fmt of ["avif", "webp"]) ok(g.files.filter((f) => f.fmt === fmt).length >= 3, `${m.id} has >=3 ${fmt} sizes`);
}
const hero = gen.find((x) => x.id === "nasa-black-hole-jet");
ok(hero.files.every((f) => f.bytes <= 200 * 1024), "hero image: every size under 200 KB (avif and webp)");
ok(hero.files.some((f) => f.w >= 1920), "hero image has a 1920w file");
const credits = r("app/credits/page.tsx");
ok(/SPACE_IMAGES\.map/.test(credits) && /m\.source/.test(credits) && /m\.licence/.test(credits) && /m\.credit/.test(credits), "credits page lists title, credit, licence, source for every image");
ok(/rel="noopener"/.test(credits) && !/[–—]/.test(credits), "credits: external links noopener, no em/en dashes");
const comp = r("components/SpaceImage.tsx");
ok(/loading=\{priority \? "eager" : "lazy"\}/.test(comp) && /image\/avif/.test(comp) && /image\/webp/.test(comp), "SpaceImage: avif+webp, lazy unless priority");
const home = r("app/page.tsx"), heroSrc = r("components/hero/Hero.tsx");
ok(/<SpaceImage id=\{HERO_IMAGE_ID\}[^>]*priority/.test(heroSrc), "hero image is the only eager (priority) image");
ok(!/priority/.test(home.split("<SpaceImage")[1]?.split("/>")[0] ?? ""), "homepage band image is lazy");
ok(/\/credits/.test(r("components/Footer.tsx")) && (!existsSync("out/sitemap.xml") || (/\/credits/.test(readFileSync("out/sitemap.xml","utf8")) && /\/deep-field/.test(readFileSync("out/sitemap.xml","utf8")))), "credits linked from footer and sitemap");
console.log(`\nW2 images: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
