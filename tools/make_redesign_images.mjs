// Builds the homepage redesign image derivatives (AVIF + WebP, sized variants, metadata stripped) from the two owner-supplied
// source renders and writes docs/ops/site-redesign/ASSET_SOURCE_MANIFEST.json (source SHA256, derivative SHA256, dimensions).
// Usage: node tools/make_redesign_images.mjs <hero-src.png> <building-src.png>
import sharp from "sharp";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const [heroSrc, buildingSrc] = process.argv.slice(2);
if (!heroSrc || !buildingSrc) { console.error("usage: make_redesign_images.mjs hero.png building.png"); process.exit(2); }
const OUT = "public/site-redesign";
fs.mkdirSync(OUT, { recursive: true });
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const manifest = { generated: new Date().toISOString().slice(0, 10), note: "Owner-supplied AI-generated renders. The building is an illustrative architectural concept, not a real TITANOS office. Metadata stripped from every derivative.", sources: [], derivatives: [] };

async function run(label, src, widths, aspect, concept) {
  const buf = fs.readFileSync(src);
  const meta = await sharp(buf).metadata();
  manifest.sources.push({ id: label, basename: path.basename(src), bytes: buf.length, sha256: sha(buf), width: meta.width, height: meta.height, format: meta.format, ai_generated: true, concept_render_not_real_building: concept });
  for (const w of widths) {
    if (w > meta.width) continue;
    for (const fmt of ["avif", "webp"]) {
      let p = sharp(buf);
      let h = null;
      if (aspect) { h = Math.round(w / aspect); p = p.resize(w, h, { fit: "cover", position: aspect.pos }); } else { p = p.resize(w); }
      p = fmt === "avif" ? p.avif({ quality: 58, effort: 6 }) : p.webp({ quality: 80, effort: 6 });
      const name = `${label}-${w}.${fmt}`;
      const out = await p.toBuffer({ resolveWithObject: true });
      fs.writeFileSync(path.join(OUT, name), out.data);
      manifest.derivatives.push({ file: `public/site-redesign/${name}`, from: label, width: out.info.width, height: out.info.height, bytes: out.data.length, sha256: sha(out.data) });
    }
  }
}
await run("hero-mountain", heroSrc, [480, 768, 1199], null, false);
await run("building-concept", buildingSrc, [640, 960, 1280, 1672], null, true);
fs.mkdirSync("docs/ops/site-redesign", { recursive: true });
fs.writeFileSync("docs/ops/site-redesign/ASSET_SOURCE_MANIFEST.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(manifest.derivatives.map((d) => `${d.file} ${d.width}x${d.height} ${d.bytes}`).join("\n"));
