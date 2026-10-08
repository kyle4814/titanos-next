// W2 image pipeline: originals (outside the repo) -> responsive AVIF + WebP in public/space/ + lib/space-images.generated.json.
// Usage: node scripts/images/build_images.mjs <originals-dir>. Never upscales. Hero image is held under HERO_BUDGET per file.
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const here = new URL(".", import.meta.url).pathname;
const root = join(here, "../..");
const src = process.argv[2];
if (!src) { console.error("usage: build_images.mjs <originals-dir>"); process.exit(2); }
const manifest = JSON.parse(readFileSync(join(here, "manifest.json"), "utf8"));
const WIDTHS = [480, 960, 1440, 1920];
const HERO_ID = "nasa-black-hole-jet";
const HERO_BUDGET = 200 * 1024;
const out = join(root, "public/space");
mkdirSync(out, { recursive: true });
const gen = [];
for (const m of manifest) {
  const input = join(src, m.id + ".jpg");
  const meta = await sharp(input, { limitInputPixels: false }).metadata();
  const widths = WIDTHS.filter((w) => w <= meta.width);
  if (!widths.length) widths.push(meta.width);
  const files = [];
  for (const w of widths) {
    const h = Math.round((meta.height * w) / meta.width);
    const base = () => sharp(input, { limitInputPixels: false }).resize({ width: w, withoutEnlargement: true });
    for (const fmt of ["avif", "webp"]) {
      const name = `${m.id}-${w}.${fmt}`;
      if (existsSync(join(out, name)) && process.env.REBUILD !== "1") { files.push({ w, h, fmt, bytes: statSync(join(out, name)).size, name }); continue; } // resumable
      let q = fmt === "avif" ? 50 : 74;
      let buf;
      for (;;) {
        buf = await (fmt === "avif" ? base().avif({ quality: q, effort: 4 }) : base().webp({ quality: q, effort: 5 })).toBuffer();
        if (m.id !== HERO_ID || buf.length <= HERO_BUDGET || q <= 20) break;
        q -= 4;
      }
      writeFileSync(join(out, name), buf);
      files.push({ w, h, fmt, bytes: buf.length, name });
    }
  }
  gen.push({ id: m.id, width: meta.width, height: meta.height, files });
  console.log(m.id, meta.width + "x" + meta.height, files.map((f) => `${f.w}${f.fmt[0]}:${Math.round(f.bytes / 1024)}K`).join(" "));
}
writeFileSync(join(root, "lib/space-images.generated.json"), JSON.stringify(gen, null, 1) + "\n");
