// Mobile layout audit: renders every exported page at 360 and 390 px and lists
// horizontal overflow, buttons/links that overflow or clip their text, and tiny tap targets.
// Usage: npx next build && node scripts/mobile_audit.mjs [outDir=out] [--json]
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "out");
const asJson = process.argv.includes("--json");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const routes = walk(root).filter((f) => f.endsWith(".html") && !/404|_not-found/.test(f))
  .map((f) => "/" + path.relative(root, f).replace(/\.html$/, "").replace(/(^|\/)index$/, "")).sort();

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  const cands = [p, p + ".html", path.join(p, "index.html")];
  for (const c of cands) {
    const f = path.join(root, c);
    if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
      return fs.createReadStream(f).pipe(res);
    }
  }
  res.writeHead(404); res.end("nf");
}).listen(0);
const port = server.address().port;

const check = () => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const sel = (el) => {
    const t = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("href") || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""} "${t}"`;
  };
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 1) out.push({ kind: "page-hscroll", detail: `scrollWidth ${sw} > ${vw}` });
  for (const el of document.querySelectorAll("a, button, [role=button], input[type=submit]")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.closest("[aria-hidden=true]")) continue;
    const isBtn = el.tagName === "BUTTON" || el.getAttribute("role") === "button" || /btn|button|cta/i.test(String(el.className)) || cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.borderTopWidth !== "0px";
    if (!isBtn) continue;
    if (r.right > vw + 1 || r.left < -1) out.push({ kind: "button-offscreen", el: sel(el), detail: `left ${Math.round(r.left)} right ${Math.round(r.right)} vw ${vw}` });
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== "visible") out.push({ kind: "button-text-clipped", el: sel(el), detail: `scrollWidth ${el.scrollWidth} > ${el.clientWidth}` });
    // text spilling out of the box (overflow visible)
    const range = document.createRange(); range.selectNodeContents(el);
    const tr = range.getBoundingClientRect();
    if (tr.width && (tr.right > r.right + 2 || tr.left < r.left - 2)) out.push({ kind: "button-text-spill", el: sel(el), detail: `text ${Math.round(tr.left)}-${Math.round(tr.right)} box ${Math.round(r.left)}-${Math.round(r.right)}` });
    if (r.height < 40 && el.tagName !== "A") out.push({ kind: "small-target", el: sel(el), detail: `${Math.round(r.width)}x${Math.round(r.height)}` });
    else if (r.height < 40 && isBtn && cs.display !== "inline") out.push({ kind: "small-target", el: sel(el), detail: `${Math.round(r.width)}x${Math.round(r.height)}` });
  }
  // pairwise overlap of visible buttons (not nested), and hit-test of each button centre
  const btns = [...document.querySelectorAll("a, button, [role=button]")].filter((el) => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0 && !el.closest("[aria-hidden=true]") && !el.closest("[hidden]") && !(el.closest("details:not([open])") && !el.closest("summary")) && !el.matches(".sr-only");
  });
  const isFixed = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true; return false; };
  const abs = (el) => { const r = el.getBoundingClientRect(); return { l: r.left + scrollX, r: r.right + scrollX, t: r.top + scrollY, b: r.bottom + scrollY }; };
  const flow = btns.filter((b) => !isFixed(b));
  for (let i = 0; i < flow.length; i++) for (let j = i + 1; j < flow.length; j++) {
    const a = flow[i], b = flow[j]; if (a.contains(b) || b.contains(a)) continue;
    if (getComputedStyle(a).display === "inline" || getComputedStyle(b).display === "inline") continue;
    const A = abs(a), B = abs(b);
    const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
    if (ox > 4 && oy > 4) out.push({ kind: "buttons-overlap", el: sel(a) + " <> " + sel(b), detail: `${Math.round(ox)}x${Math.round(oy)}px` });
  }
  for (const el of flow) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    const pill = parseFloat(cs.borderTopLeftRadius) >= 999 || parseFloat(cs.borderTopLeftRadius) > r.height / 2;
    const lines = Math.round((r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lh);
    if (pill && lines >= 2 && r.width > 0) out.push({ kind: "pill-button-wraps", el: sel(el), detail: `${lines} lines, ${Math.round(r.width)}x${Math.round(r.height)}` });
    const fs = parseFloat(cs.fontSize);
    if (fs < 12 && (el.innerText || "").trim()) out.push({ kind: "tiny-text-button", el: sel(el), detail: `${fs}px` });
  }
  const covered = new Set();
  for (const el of flow) {
    const r = el.getBoundingClientRect(); if (r.height < 4) continue;
    const y0 = scrollY; const cy = r.top + r.height / 2 + scrollY;
    window.scrollTo(0, Math.max(0, cy - innerHeight / 2));
    const rr = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
    if (hit && !el.contains(hit) && !hit.contains(el)) { const k = sel(el); if (!covered.has(k)) { covered.add(k); out.push({ kind: "button-covered", el: k, detail: `by ${sel(hit)}` }); } }
  }
  window.scrollTo(0, 0);
  // any element poking past the viewport (cause of page hscroll)
  if (sw > vw + 1) {
    const seen = new Set();
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
        const k = sel(el); if (seen.has(k) || seen.size > 6) continue; seen.add(k);
        out.push({ kind: "overflow-source", el: k, detail: `right ${Math.round(r.right)} > ${vw}` });
      }
    }
  }
  return out;
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ["--no-sandbox", "--disable-gpu"] });
const results = [];
const CONC = 6;
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const queue = [...routes];
  const worker = async () => {
    for (let route; (route = queue.shift()); ) {
      const page = await ctx.newPage();
      try {
        await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "load", timeout: 20000 });
        await page.waitForTimeout(700);
        await page.evaluate(async () => {
          document.documentElement.style.scrollBehavior = "auto";
          for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(250);
        for (const f of await page.evaluate(check)) results.push({ width, route, ...f });
      } catch (e) { if (!/navigation/.test(e.message)) results.push({ width, route, kind: "load-error", detail: String(e.message).slice(0, 120) }); } // redirect stubs navigate away mid-check
      await page.close();
      console.error(`${width} ${route}`);
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  await ctx.close();
}
await browser.close(); server.close();
if (asJson) console.log(JSON.stringify(results, null, 1));
else {
  console.log(`routes: ${routes.length}, findings: ${results.length}`);
  for (const r of results) console.log(`${r.width} ${r.route} ${r.kind} ${r.el || ""} ${r.detail}`);
}
process.exit(results.some((r) => r.kind !== "small-target") ? 1 : 0);
