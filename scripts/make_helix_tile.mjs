// Rasterise ONE seamless tile of the desktop helix (variant C, desktop CSS, true feGaussianBlur on the halos) to a transparent WebP,
// for phones (public/helix/helix_tile_c.webp). Usage: node scripts/make_helix_tile.mjs [outDir=out] [dest=public/helix/helix_tile_c.webp]
// Needs a built `out/`. The SVG tile is 800 units tall in a 200 wide viewBox (periodic in 800); the phone column is 236 CSS px at 3x DPR,
// so the WebP is 708 x 2832. Seamless by construction: five tile copies are laid end to end and ONE blur is applied across all of them,
// then the middle copy is cropped, so the halo at the tile edges carries the neighbours' light exactly as it continues on the page.
// The breathing is NOT baked in (opacity 1, no scale): the phone CSS still runs fx-breathe over the image.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";
const root = path.resolve(process.argv[2] || "out"); const dest = path.resolve(process.argv[3] || "public/helix/helix_tile_c.webp");
const W_CSS = 340, TILE = 800, VB_W = 200, PHONE_W = 236, DPR3 = 3;
const outW = PHONE_W * DPR3, outH = Math.round(TILE * outW / VB_W); // 708 x 2832
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".json":"application/json",".woff2":"font/woff2"};
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  for (const c of [f, f + ".html", path.join(f, "index.html")]) { try { if (fs.statSync(c).isFile()) { f = c; break; } } catch {} }
  try { r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); } catch { r.writeHead(404); r.end("nf"); }
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const port = srv.address().port;
const b = await chromium.launch();
// desktop settings (fine pointer, > 768px), DPR chosen so the 340px desktop column lands on 708 device px
const dpr = outW / W_CSS;
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
const pg = await ctx.newPage();
await pg.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
await pg.waitForTimeout(1500);
const cssTileH = await pg.evaluate(({ W_CSS, TILE, VB_W }) => {
  const ns = "http://www.w3.org/2000/svg";
  const src = document.querySelector(".fx-thread svg");
  const tile = src.querySelector("#hx-tile");
  const defs = src.querySelector("defs");
  // five tile copies end to end (cloned, not <use>), halos gathered into ONE blurred group under all the cores
  const svg = document.createElementNS(ns, "svg");
  const N = 5;
  svg.setAttribute("viewBox", `0 0 ${VB_W} ${TILE * N}`); svg.setAttribute("width", VB_W); svg.setAttribute("height", TILE * N); svg.setAttribute("fill", "none");
  svg.appendChild(defs.cloneNode(false)); const d = svg.firstChild;
  for (const el of defs.querySelectorAll("filter, linearGradient")) d.appendChild(el.cloneNode(true));
  const halos = document.createElementNS(ns, "g"); halos.setAttribute("class", "hx-halo");
  const cores = document.createElementNS(ns, "g");
  for (let k = 0; k < N; k++) {
    for (const child of tile.children) {
      const c = child.cloneNode(true);
      const g = document.createElementNS(ns, "g"); g.setAttribute("transform", `translate(0 ${k * TILE})`);
      if (child.classList.contains("hx-halo")) { while (c.firstChild) g.appendChild(c.firstChild); halos.appendChild(g); }
      else { g.appendChild(c); cores.appendChild(g); }
    }
  }
  svg.appendChild(halos); svg.appendChild(cores);
  document.documentElement.style.background = "transparent";
  document.body.innerHTML = "";
  document.body.style.cssText = "margin:0;background:transparent";
  const wrap = document.createElement("div");
  wrap.className = "fx-thread"; wrap.dataset.helix = "C";
  wrap.style.cssText = "position:static;-webkit-mask-image:none;mask-image:none;background:transparent";
  wrap.innerHTML = `<div class="fx-thread__pulse" style="position:static;animation:none;opacity:1;transform:none;width:${W_CSS}px;background:transparent"><div class="fx-thread__tiles" style="position:static;will-change:auto;transform:none"></div></div>`;
  wrap.querySelector(".fx-thread__tiles").appendChild(svg);
  document.body.appendChild(wrap);
  svg.style.cssText = "display:block;width:100%;height:auto";
  return TILE * W_CSS / VB_W;
}, { W_CSS, TILE, VB_W });
await pg.waitForTimeout(500);
const buf = await pg.screenshot({ omitBackground: true, fullPage: true, clip: { x: 0, y: cssTileH * 2, width: W_CSS, height: cssTileH } });
await b.close(); srv.close();
// the desktop column (340) is wider than the phone column (236): the SVG viewBox is 200 wide in both, so resize 708 -> 708 is 1:1 here
// (340 css px * dpr 2.082 = 708 device px = the phone column at 3x). Height = 2832.
if (process.env.HELIX_PNG) fs.writeFileSync(process.env.HELIX_PNG, buf);
const img = sharp(buf);
const meta = await img.metadata();
fs.mkdirSync(path.dirname(dest), { recursive: true });
const out = await sharp(buf).resize(outW, outH, { fit: "fill" }).webp({ quality: 50, alphaQuality: 100, effort: 6, smartSubsample: false }).toBuffer();
fs.writeFileSync(dest, out);
console.log(`shot ${meta.width}x${meta.height} -> ${outW}x${outH}, wrote ${dest} (${out.length} bytes)`);
