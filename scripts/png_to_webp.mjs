// node scripts/png_to_webp.mjs <dir> [quality=0.82]: re-encodes every PNG in <dir> (non-recursive) to a sibling .webp via headless Chromium canvas (no cwebp needed).
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
const dir = path.resolve(process.argv[2]); const q = +(process.argv[3] || 0.82);
const b = await chromium.launch(); const pg = await b.newPage();
for (const f of fs.readdirSync(dir).filter(n => n.endsWith(".png"))) {
  const src = fs.readFileSync(path.join(dir, f)).toString("base64");
  const out = await pg.evaluate(async ([s, q]) => {
    const img = new Image(); img.src = "data:image/png;base64," + s; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, "image/webp", q)); const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(bin);
  }, [src, q]);
  const o = path.join(dir, f.replace(/\.png$/, ".webp")); fs.writeFileSync(o, Buffer.from(out, "base64"));
  console.log(f, fs.statSync(path.join(dir, f)).size, "->", fs.statSync(o).size);
}
await b.close();
