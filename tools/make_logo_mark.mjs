// Crops the angular gold T from the owner's building render signage and keys the dark facade to transparency -> public/site-redesign/t-mark.png/.webp.
// Usage: node tools/make_logo_mark.mjs <building-src.png>
import sharp from "sharp";
const src = process.argv[2];
const { data, info } = await sharp(src).extract({ left: 468, top: 396, width: 140, height: 140 }).resize(168, 168, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const a = Math.max(0, Math.min(1, (lum - 70) / 110));
  data[i + 3] = Math.round(a * 255);
  // un-premultiply glow toward gold so edges do not go grey
  if (a > 0 && a < 1) { data[i] = Math.min(255, data[i] / Math.max(a, 0.35)); data[i + 1] = Math.min(255, data[i + 1] / Math.max(a, 0.35)); data[i + 2] = Math.min(255, data[i + 2] / Math.max(a, 0.35)); }
}
const img = sharp(data, { raw: info });
await img.clone().png({ compressionLevel: 9 }).toFile("public/site-redesign/t-mark.png");
await img.clone().webp({ quality: 90, alphaQuality: 95 }).toFile("public/site-redesign/t-mark.webp");
console.log("ok");
