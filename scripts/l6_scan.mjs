// L6 scan (QUALITY_LADDER): per route at 390/768/1440, reduced motion on: horizontal overflow, text clipped by its own
// box, interactive elements overlapping each other or overlapping foreign text, tap targets < 44px (reported, not failed).
// Usage: node scripts/l6_scan.mjs [outDir=out] [reportDir=l6-report] ; ROUTES=/,/proof ; SHOTS=1 for full-page shots.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const OUT = path.resolve(process.argv[2] || "out");
const REP = path.resolve(process.argv[3] || "l6-report");
fs.mkdirSync(path.join(REP, "shots"), { recursive: true });
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const ONLY = process.env.ROUTES ? process.env.ROUTES.split(",") : null;
const all = walk(OUT).filter((f) => f.endsWith(".html") && !/404|_not-found/.test(f))
  .map((f) => ("/" + path.relative(OUT, f).replace(/\.html$/, "")).replace(/\/index$/, "") || "/").filter((r) => !r.startsWith("/_next")).sort();
const [SK, SN] = (process.env.SHARD || "0/1").split("/").map(Number);
const routes = (ONLY ? all.filter((r) => ONLY.includes(r)) : all).filter((_, i) => i % SN === SK);
const exists = (p) => { const b = path.join(OUT, p); return fs.existsSync(b) && fs.statSync(b).isFile() ? b : fs.existsSync(b + ".html") ? b + ".html" : fs.existsSync(path.join(b, "index.html")) ? path.join(b, "index.html") : null; };
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif" };
const srv = http.createServer((q, s) => { const f = exists(decodeURIComponent(q.url.split("?")[0])); if (!f) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s); }).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
const probe = () => {
  const cutOff = (e) => { if (e.closest("[inert]")) return true; for (let n = e.parentElement; n; n = n.parentElement) if (n.tagName === "DETAILS" && !n.open && !e.closest("summary")) return true; const r = e.getBoundingClientRect(); for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n); if (o.overflowX === "visible" && o.overflowY === "visible") continue; const q = n.getBoundingClientRect(); if (/(hidden|clip|auto|scroll)/.test(o.overflowY) && (r.bottom <= q.top + 1 || r.top >= q.bottom - 1)) return true; if (/(hidden|clip|auto|scroll)/.test(o.overflowX) && (r.right <= q.left + 1 || r.left >= q.right - 1)) return true; } return false; };
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05 && !cutOff(e); };
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + " \"" + (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 30) + "\"";
  const out = { clipped: [], overlap: [], small: [], wide: [] };
  const cw = document.documentElement.clientWidth;
  const inFixed = (e) => { for (let n = e; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true; return false; };
  for (const e of document.querySelectorAll("body *")) {
    if (!vis(e)) continue;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.right > cw + 1 && !e.closest("[data-allow-overflow],svg") && !(s.position === "absolute" && s.overflow !== "visible") ) { let sc = false; for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n); if (/(hidden|auto|scroll|clip)/.test(o.overflowX)) { sc = true; break; } } if (!sc && r.left < cw) out.wide.push(sel(e) + " right=" + Math.round(r.right)); }
    const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && /(hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY) && s.textOverflow !== "ellipsis" && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) && e.clientHeight > 0) out.clipped.push(sel(e) + ` scroll=${e.scrollWidth}x${e.scrollHeight} client=${e.clientWidth}x${e.clientHeight}`);
  }
  const ints = [...document.querySelectorAll("a[href],button,input,select,textarea,[role=button]")].filter(vis);
  for (const e of ints) { const r = e.getBoundingClientRect(); if ((r.width < 44 || r.height < 44) && r.top < 1e5 && !(e.tagName === "A" && getComputedStyle(e).display === "inline" )) out.small.push(sel(e) + ` ${Math.round(r.width)}x${Math.round(r.height)}`); }
  const inter = (a, b) => { const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 3 && h > 3 ? w * h : 0; };
  for (let i = 0; i < ints.length; i++) for (let j = i + 1; j < ints.length; j++) {
    const a = ints[i], b = ints[j]; if (a.contains(b) || b.contains(a)) continue; if (getComputedStyle(a).display === "inline" && getComputedStyle(b).display === "inline") continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); const ar = inter(ra, rb);
    if (ar > 0 && inFixed(a) === inFixed(b) ) out.overlap.push(sel(a) + " X " + sel(b) + ` area=${Math.round(ar)}`);
  }
  // text blocks overlapped by a foreign painted element (text over button / button over text) via elementFromPoint at text centre
  const texts = [...document.querySelectorAll("h1,h2,h3,h4,p,li,span,label,summary,dt,dd")].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2));
  for (const e of texts) {
    const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter((r) => r.width > 4 && r.height > 4); if (!rs.length) continue;
    const r = rs[0]; if (r.bottom < 0 || r.top > innerHeight * 30) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || x > cw || y < 0 || y > innerHeight) continue;
    const t = document.elementFromPoint(x, y); if (!t || e.contains(t) || t.contains(e)) continue;
    if (t.closest("a,button,[role=button]") && !e.closest("a,button") && !inFixed(t)) out.overlap.push("TEXT-UNDER-CONTROL " + sel(e) + " covered by " + sel(t));
  }
  return out;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--disable-gpu"] });
const res = [];
for (const route of routes) for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  const page = await ctx.newPage(); const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 120)));
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  try {
    await page.goto(base + route, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(900);
    // scroll through so lazy/reveal content paints, then back to top
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
    await page.waitForTimeout(300);
    const o = await page.evaluate(probe);
    o.overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
    o.errors = errs;
    if (process.env.SHOTS) await page.screenshot({ path: path.join(REP, "shots", `${route === "/" ? "index" : route.slice(1).replace(/\//g, "__")}-${w}.png`), fullPage: true });
    res.push({ route, w, ...o });
  } catch (e) { res.push({ route, w, errors: ["scan: " + e.message.slice(0, 100)], clipped: [], overlap: [], small: [], wide: [], overflow: 0 }); }
  await ctx.close(); process.stderr.write(".");
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(REP, "l6.json"), JSON.stringify(res, null, 1));
const bad = res.filter((r) => r.overflow > 0 || r.clipped.length || r.overlap.length || r.wide.length || r.errors.length);
const small = res.reduce((a, r) => a + r.small.length, 0);
for (const r of bad) console.log(`\n${r.route} @${r.w}: overflow=${r.overflow} errors=${r.errors.length}\n` + [...r.wide.map((x) => "  WIDE " + x), ...r.clipped.map((x) => "  CLIP " + x), ...r.overlap.map((x) => "  OVERLAP " + x), ...r.errors.map((x) => "  ERR " + x)].slice(0, 12).join("\n"));
console.log(`\nL6: ${res.length} route×width scans, ${bad.length} with defects, ${small} small tap targets (<44px, informational)`);
process.exit(bad.length ? 1 : 0);
