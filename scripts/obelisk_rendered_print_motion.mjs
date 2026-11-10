// f406: RENDERED print + reduced-motion probe (verifies in a real browser what f403/f405 only checked in source).
// Usage: node scripts/obelisk_rendered_print_motion.mjs [--out out] [--pages /,/scan,...] [--json]
//   --out DIR    static export dir to serve on 127.0.0.1 (default: out)
//   --pages CSV  routes to probe (default: DEFAULT_PAGES below)
// Exit 0 = every page passed; 1 = a page failed; 2 = harness error (no browser, bad dir, unknown page).
// Localhost only, zero model calls, no network.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "..", "package.json"));

// home, /scan, pricing, account (/app), portal (/pro) + 8 more doors from plan ch6 site map (line 1444).
export const DEFAULT_PAGES = [
  "/", "/scan", "/pricing", "/app", "/pro",
  "/agents", "/enterprise", "/partners", "/shop", "/trust", "/proof", "/engineering", "/sectors",
];

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".txt": "text/plain", ".mp4": "video/mp4", ".webm": "video/webm", ".ico": "image/x-icon" };

function serve(root) {
  return new Promise((ok) => {
    const srv = createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const cands = [p, p + ".html", join(p, "index.html")].map((c) => resolve(root, "." + (c.startsWith("/") ? c : "/" + c)));
      const f = cands.find((c) => c.startsWith(root) && existsSync(c) && statSync(c).isFile());
      if (!f) { res.writeHead(404); res.end("nf"); return; }
      res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
      res.end(readFileSync(f));
    });
    srv.listen(0, "127.0.0.1", () => ok(srv));
  });
}

// ---- in-page probes (serialised into the browser; no closures) ----
function printProbe() {
  const out = { chrome: [], clipped: [], hscroll: null };
  const vis = (el, cs) => {
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const desc = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  for (const el of document.body.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (!vis(el, cs)) continue;
    if (cs.position === "fixed" || cs.position === "sticky") {
      out.chrome.push(desc(el) + " position:" + cs.position);
    }
    if (el.clientWidth <= 2 && el.clientHeight <= 2) continue; // visually-hidden (sr-only) pattern, not content loss
    const clips = (v) => v === "hidden" || v === "clip";
    if ((clips(cs.overflowY) && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 2 && (el.innerText || "").trim().length > 0) ||
        (clips(cs.overflowX) && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && (el.innerText || "").trim().length > 0)) {
      // decorative clip boxes (aria-hidden, no direct text) are not content loss
      if (el.closest("[aria-hidden='true']")) continue;
      out.clipped.push(desc(el) + " client " + el.clientWidth + "x" + el.clientHeight + " scroll " + el.scrollWidth + "x" + el.scrollHeight);
    }
  }
  const de = document.documentElement;
  if (de.scrollWidth > innerWidth + 2) out.hscroll = "documentElement scrollWidth " + de.scrollWidth + " > viewport " + innerWidth;
  return out;
}

function motionProbe() {
  const out = { slow: [], videos: [], checked: 0, matches: matchMedia("(prefers-reduced-motion: reduce)").matches };
  const maxMs = (s) => Math.max(0, ...String(s).split(",").map((t) => {
    t = t.trim(); const n = parseFloat(t);
    if (isNaN(n)) return 0;
    return t.endsWith("ms") ? n : n * 1000;
  }));
  const desc = (el, pseudo) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + (pseudo || "");
  for (const el of document.querySelectorAll("*")) {
    for (const pseudo of [null, "::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (!pseudo) { const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) continue; }
      out.checked++;
      const a = maxMs(cs.animationDuration), t = maxMs(cs.transitionDuration);
      // an animation only runs if a name is set; but the brief says every visible element's duration, so check both
      if (a >= 10 || t >= 10) out.slow.push(desc(el, pseudo) + " animation-duration:" + cs.animationDuration + " transition-duration:" + cs.transitionDuration);
    }
  }
  for (const v of document.querySelectorAll("video")) {
    if (v.autoplay || v.hasAttribute("autoplay") || !v.paused) out.videos.push("video autoplay=" + v.autoplay + " paused=" + v.paused + " src=" + (v.currentSrc || v.getAttribute("src") || "(none)"));
  }
  return out;
}

export async function probe({ outDir, pages }) {
  const root = resolve(outDir);
  if (!existsSync(root)) throw new Error("out dir missing: " + root);
  const { chromium } = require("playwright");
  const srv = await serve(root);
  const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const route of pages) {
      const r = { route, status: null, print: null, motion: null, failures: [] };
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      try {
        const resp = await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
        r.status = resp ? resp.status() : 0;
        if (r.status !== 200) { r.failures.push("HTTP " + r.status); results.push(r); continue; }
        await page.waitForTimeout(600);
        // (b) reduced motion (context already emulates it)
        r.motion = await page.evaluate(motionProbe);
        if (!r.motion.matches) r.failures.push("reduced-motion emulation not active");
        for (const s of r.motion.slow) r.failures.push("MOTION " + s);
        for (const v of r.motion.videos) r.failures.push("VIDEO " + v);
        // (a) print
        await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
        await page.waitForTimeout(200);
        r.print = await page.evaluate(printProbe);
        for (const c of r.print.chrome) r.failures.push("PRINT-CHROME " + c);
        for (const c of r.print.clipped) r.failures.push("PRINT-CLIP " + c);
        if (r.print.hscroll) r.failures.push("PRINT-HSCROLL " + r.print.hscroll);
      } catch (e) {
        r.failures.push("ERROR " + e.message.split("\n")[0]);
      } finally { await ctx.close(); }
      results.push(r);
    }
  } finally { await browser.close(); srv.close(); }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const arg = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  const outDir = arg("--out", "out");
  const pages = arg("--pages", null)?.split(",").filter(Boolean) ?? DEFAULT_PAGES;
  let results;
  try { results = await probe({ outDir, pages }); } catch (e) { console.error("harness error: " + e.message); process.exit(2); }
  const bad = results.filter((r) => r.failures.length);
  if (a.includes("--json")) console.log(JSON.stringify(results, null, 2));
  for (const r of results) {
    console.log((r.failures.length ? "FAIL " : "PASS ") + r.route + (r.motion ? " (elements checked " + r.motion.checked + ")" : ""));
    for (const f of r.failures.slice(0, 12)) console.log("   " + f);
    if (r.failures.length > 12) console.log("   ... " + (r.failures.length - 12) + " more");
  }
  console.log(`rendered print+motion: ${results.length - bad.length}/${results.length} pages pass`);
  process.exit(bad.length ? 1 : 0);
}
