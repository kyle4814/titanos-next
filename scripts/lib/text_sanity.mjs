// C9 rendered-text sanity sweep (f373): serve the static export on 127.0.0.1 only, render every route at 390 and 1280 px,
// collect visible text hits for banned tokens and measure each hero's primary CTA centre offset.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";

export const WIDTHS = [390, 1280];
export const CTA_TOLERANCE_PX = 2;
export const BANNED = [
  ["UNKNOWN", /\bUNKNOWN\b/], ["NaN", /\bNaN\b/], ["undefined", /\bundefined\b/], ["null", /\bnull\b/],
  ["[object", /\[object\b/], ["TODO", /\bTODO\b/], ["lorem", /\blorem\b/i],
];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".mp4": "video/mp4" };

export function listRoutes(root) {
  const out = new Set();
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "_next" && !e.name.startsWith("__next")) walk(f); continue; }
    if (!e.name.endsWith(".html")) continue;
    let r = "/" + path.relative(root, f).replace(/\\/g, "/").replace(/\.html$/, "");
    r = r.replace(/\/index$/, "") || "/";
    if (r === "/404") continue;
    out.add(r);
  } };
  walk(root); return [...out].sort();
}
const resolveFile = (root, p) => {
  const tries = [p, p + ".html", path.join(p, "index.html")].map((x) => path.join(root, x));
  return tries.find((x) => x.startsWith(root) && fs.existsSync(x) && fs.statSync(x).isFile());
};
export function serve(root) {
  root = path.resolve(root);
  const srv = http.createServer((req, res) => {
    const f = resolveFile(root, decodeURIComponent(req.url.split("?")[0].split("#")[0]));
    if (!f) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  }).listen(0, "127.0.0.1");
  return new Promise((r) => srv.once("listening", () => r({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}

// Runs inside the page. Returns { text, counters, cta }.
function inPage(banned) {
  const vis = (el) => { const s = getComputedStyle(el); if (s.display === "none" || s.visibility === "hidden") return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const hits = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const p = n.parentElement; if (!p || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(p.tagName)) continue;
    let ok = true; for (let e = p; e && e !== document.body; e = e.parentElement) if (!vis(e) && getComputedStyle(e).display === "none") { ok = false; break; }
    if (!ok) continue;
    const t = n.textContent.replace(/\s+/g, " ").trim(); if (!t) continue;
    for (const [name, src, fl] of banned) if (new RegExp(src, fl).test(t)) hits.push({ token: name, text: t.slice(0, 160), where: (p.closest("[id]")?.id || p.tagName.toLowerCase()), tag: p.tagName.toLowerCase() });
  }
  // Empty counter slots: elements flagged as counters/stat values that render no digit.
  const counters = [];
  document.querySelectorAll('[data-count],[data-counter],[data-value],[class*="counter"],[class*="stat-num"],[class*="statnum"],[class*="metric"]').forEach((el) => {
    if (!vis(el) && el.getBoundingClientRect().width === 0 && !el.textContent.trim()) { counters.push({ text: "", where: el.className || el.tagName, kind: "empty-hidden" }); return; }
    if (el.children.length === 0 && !el.textContent.trim() && el.getBoundingClientRect().width >= 0 && getComputedStyle(el).display !== "none") counters.push({ text: "", where: String(el.className || el.tagName).slice(0, 80), kind: "empty" });
  });
  // Hero primary CTA.
  let cta = null;
  const h1 = document.querySelector("h1");
  if (h1) {
    let hero = h1.closest("section,header") || h1.parentElement;
    const cands = [...hero.querySelectorAll("a,button")].filter((el) => {
      if (!vis(el)) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (r.width < 60 || r.height < 28) return false;
      const bg = s.backgroundColor; const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
      const hasImg = s.backgroundImage && s.backgroundImage !== "none";
      const bord = parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== "none";
      return hasBg || hasImg || bord;
    });
    const el = cands[0];
    if (el) {
      const r = el.getBoundingClientRect();
      // group = every button-styled element in the hero that shares the primary CTA's line (vertical overlap). A button, its sibling buttons and
      // wrappers all count; a text note sharing the flex row is NOT a member, which is exactly what drags a button off-centre.
      const mem = [...hero.querySelectorAll("a,button")].filter((c) => vis(c) && c.getBoundingClientRect().width >= 60 && c.getBoundingClientRect().height >= 28).filter((c) => c !== el && !c.contains(el) && !el.contains(c) && (() => { const q = c.getBoundingClientRect(); return q.top < r.bottom - 2 && q.bottom > r.top + 2; })());
      let gl = r.left, gr = r.right; for (const c of mem) { const q = c.getBoundingClientRect(); gl = Math.min(gl, q.left); gr = Math.max(gr, q.right); }
      const sibs = mem;
      const hr = hero.getBoundingClientRect(); const hs = getComputedStyle(hero);
      const padL = parseFloat(hs.paddingLeft) || 0, padR = parseFloat(hs.paddingRight) || 0;
      const he = h1.getBoundingClientRect(); const ha = getComputedStyle(h1).textAlign;
      cta = { label: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50), cls: String(el.className).slice(0, 80), left: r.left, right: r.right, cx: (r.left + r.right) / 2, groupCx: (gl + gr) / 2, grouped: sibs.length > 0,
        heroCx: (hr.left + padL + hr.right - padR) / 2, viewCx: document.documentElement.clientWidth / 2, h1Cx: (he.left + he.right) / 2, h1Align: ha, h1Left: he.left, h1W: he.width, scrollW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth };
    }
  }
  return { hits, counters, cta };
}

export async function sweep({ root, routes, widths = WIDTHS, settleMs = 350, concurrency = 6, log = () => {} }) {
  const has = (d) => { try { return fs.readdirSync(d).some((x) => x.startsWith("chromium")); } catch { return false; } };
  const dflt = path.join(process.env.HOME || "", ".cache", "ms-playwright");
  if (!has(process.env.PLAYWRIGHT_BROWSERS_PATH || dflt) && has(dflt)) process.env.PLAYWRIGHT_BROWSERS_PATH = dflt;
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch (e) { return { skipped: "playwright not importable: " + String(e.message).split("\n")[0] }; }
  const { srv, base } = await serve(root);
  let browser;
  try { browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] }); } catch (e) { srv.close(); return { skipped: "chromium absent: " + String(e.message).split("\n")[0] }; }
  const results = [];
  try {
    const jobs = []; for (const route of routes) for (const width of widths) jobs.push({ route, width });
    let next = 0;
    const worker = async () => { for (;;) { const j = jobs[next++]; if (!j) return;
      const { route, width } = j;
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.route("**/*", (rt) => { const u = new URL(rt.request().url()); if (u.hostname === "127.0.0.1") rt.continue(); else rt.abort(); });
      const rec = { route, width, hits: [], counters: [], cta: null, error: null };
      for (let attempt = 0; attempt < 2; attempt++) { // one retry: a page that navigates itself mid-evaluate (redirect, hydrate reload) is re-read once
        try {
          await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
          await page.waitForTimeout(settleMs * (attempt + 1));
          Object.assign(rec, await page.evaluate(inPage, BANNED.map(([n, re]) => [n, re.source, re.flags]))); rec.error = null; break;
        } catch (e) { rec.error = String(e.message).split("\n")[0]; }
      }
      results.push(rec); await ctx.close(); log(route, width, rec);
    } };
    await Promise.all(Array.from({ length: concurrency }, worker));
    results.sort((a, b) => a.route.localeCompare(b.route) || a.width - b.width);
  } finally { await browser.close(); srv.close(); }
  return { results };
}
