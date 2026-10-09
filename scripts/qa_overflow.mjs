// L6 overflow gate. Usage: node scripts/qa_overflow.mjs [outDir=out] [reportDir=qa-report/overflow]
// Serves the static export and, for EVERY route at 390 / 768 / 1440 wide, in three states (page, More dropdown open,
// mobile drawer open), fails on: text wider than its box, a child outside a bordered/filled parent, page horizontal
// scroll, text overlapping a button/link, console errors, tap targets under 44px (touch widths). sr-only skip links ignored.
// Exit 1 on any failure; screenshots of failing states land in <reportDir>/shots. Env: ROUTES=/a,/b to subset, SHOTS=all.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.argv[2] || "out");
const REP = path.resolve(process.argv[3] || "qa-report/overflow");
if (!fs.existsSync(path.join(OUT, "index.html"))) { console.error(`qa_overflow: no built site at ${OUT} (run npm run build first)`); process.exit(2); }
fs.rmSync(REP, { recursive: true, force: true });
fs.mkdirSync(path.join(REP, "shots"), { recursive: true });

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const ONLY = process.env.ROUTES ? process.env.ROUTES.split(",") : null;
const routes0 = walk(OUT).filter((f) => f.endsWith(".html") && !/404|_not-found/.test(f))
  .map((f) => { const r = "/" + path.relative(OUT, f).replace(/\\/g, "/").replace(/\.html$/, ""); return r.replace(/\/index$/, "") || "/"; })
  .filter((r) => !r.startsWith("/_next")).sort();
const routes = ONLY ? routes0.filter((r) => ONLY.includes(r)) : routes0;
const exists = (p) => { const b = path.join(OUT, p); return fs.existsSync(b) && fs.statSync(b).isFile() ? b : fs.existsSync(b + ".html") ? b + ".html" : fs.existsSync(path.join(b, "index.html")) ? path.join(b, "index.html") : null; };
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".txt": "text/plain", ".xml": "application/xml", ".mp4": "video/mp4" };
const srv = http.createServer((q, s) => {
  const f = exists(decodeURIComponent(q.url.split("?")[0].split("#")[0]));
  if (!f) { s.writeHead(404); return s.end("nf"); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s);
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${srv.address().port}`;

// Runs inside the page. Returns [{kind, sel, detail}].
function checks({ touch, state }) {
  const out = [];
  const vh = innerHeight;
  const desc = (el) => {
    const t = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
    const tx = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return tx ? `${t} "${tx}"` : t;
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const srOnly = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width <= 2 || r.height <= 2 || /sr-only|skip/i.test(String(el.className)) || el.matches?.('a[href^="#"]:not(:focus)') && (r.right < 0 || r.bottom < 0 || cs.clip !== "auto" && cs.clip !== "") ;
  };
  const hidden = (el) => { const dt = el.closest("details"); if (dt && !dt.open && !el.closest("summary")) return true; for (let e = el; e && e !== document.body; e = e.parentElement) { if (e.getAttribute("aria-hidden") === "true" && !e.closest("button,a")) return true; const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return true; } return false; };
  const scrollerBetween = (el, anc) => { for (let e = el.parentElement; e && e !== anc; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true; } return false; };
  const inAutoScroller = (el) => { for (let e = el; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  const directText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  // 3. page horizontal scroll
  const de = document.documentElement;
  const over = Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth;
  if (over > 1) out.push({ kind: "page-hscroll", sel: "html", detail: `scrollWidth exceeds viewport by ${over}px` });

  const fixedAnc = (el) => { for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).position === "fixed") return true; return false; };
  // Open-menu states only judge the header / dropdown / drawer; the page body is covered by the "page" state.
  const inScope = (e) => state === "page" || fixedAnc(e) || !!e.closest("header,nav,.nav-more-panel");
  const all = [...document.body.querySelectorAll("*")].filter((e) => !/^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|TEMPLATE|BR|OPTION|OPTGROUP)$/i.test(e.tagName) && !e.closest("select"));
  const textEls = all.filter((e) => directText(e) && visible(e) && !hidden(e) && !srOnly(e) && inScope(e));

  // 1. text wider than its box (own box clipped/overflowing, or text node geometry outside own box)
  for (const el of textEls) {
    if (inAutoScroller(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display !== "inline" && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !/^(auto|scroll)$/.test(cs.overflowX) && !(cs.textOverflow === "ellipsis" && cs.overflow !== "visible")) {
      out.push({ kind: "text-wider-than-box", sel: desc(el), detail: `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}` });
      continue;
    }
    const rg = document.createRange(); rg.selectNodeContents(el);
    let minL = 1e9, maxR = -1e9;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { const g = document.createRange(); g.selectNodeContents(n); for (const q of g.getClientRects()) { if (q.width < 1) continue; minL = Math.min(minL, q.left); maxR = Math.max(maxR, q.right); } }
    if (maxR > -1e9 && cs.display !== "inline" && (maxR > r.right + 1.5 || minL < r.left - 1.5)) out.push({ kind: "text-wider-than-box", sel: desc(el), detail: `text spans ${Math.round(minL)}..${Math.round(maxR)} but box is ${Math.round(r.left)}..${Math.round(r.right)}` });
  }

  // 2. child outside a bordered/filled parent
  const boxed = (el) => { const cs = getComputedStyle(el); const bw = ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs["border" + s + "Width"]) > 0 && cs["border" + s + "Style"] !== "none"); const bg = cs.backgroundColor; return bw || (bg && !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(bg)) || (cs.backgroundImage !== "none" && !/url\(/.test(cs.backgroundImage)); };
  const fixedish = (el) => { for (let e = el; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "fixed") return true; } return false; };
  for (const el of textEls) {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (!boxed(p)) continue;
      const pr = p.getBoundingClientRect();
      if (pr.width < 4 || pr.height < 4) break;
      if (scrollerBetween(el, p) || getComputedStyle(p).overflowX === "auto" || getComputedStyle(p).overflowX === "scroll") break;
      const dx = Math.max(pr.left - r.left, r.right - pr.right), dy = Math.max(pr.top - r.top, r.bottom - pr.bottom);
      if (dx > 1.5 || dy > 1.5) out.push({ kind: "child-outside-parent", sel: desc(el), detail: `outside ${desc(p)} by ${Math.round(Math.max(dx, dy))}px` });
      break; // nearest boxed ancestor only
    }
  }

  // 4. overlapping text over buttons/links (nearest-box intersection, neither containing the other)
  const inter = [...document.querySelectorAll('a[href], button, [role="button"], input, select, textarea')].filter((e) => visible(e) && !hidden(e) && !srOnly(e) && inScope(e));
  const rectOf = (e) => e.getBoundingClientRect();
  const trs = textEls.map((t) => ({ t, r: rectOf(t), sc: inAutoScroller(t), fx: fixedish(t) }));
  for (const b of inter) {
    const br = rectOf(b); if (br.bottom < 0 || br.top > vh * 6) continue;
    const brs = getComputedStyle(b).display === "inline" ? [...b.getClientRects()] : [br];
    const bsc = inAutoScroller(b), bfx = fixedish(b);
    for (const { t, r: tr, sc, fx } of trs) {
      let w = 0, h = 0;
      const trs2 = getComputedStyle(t).display === "inline" ? [...t.getClientRects()] : [tr];
      for (const x of brs) for (const y of trs2) { const ww = Math.min(x.right, y.right) - Math.max(x.left, y.left), hh = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top); if (ww > w && hh > 0 || hh > h && ww > 0) { w = Math.max(w, ww); h = Math.max(h, hh); } }
      if (w <= 3 || h <= 3) continue;
      if (t === b || b.contains(t) || t.contains(b) || sc !== bsc || fx !== bfx || t.closest("a,button") === b) continue;
      out.push({ kind: "text-overlaps-button", sel: desc(t), detail: `overlaps ${desc(b)} by ${Math.round(w)}x${Math.round(h)}px` });
    }
  }

  // 6. tap targets under 44px (touch widths only; in-flow inline links inside prose are WCAG-exempt)
  if (touch) {
    for (const b of inter) {
      if (b.matches('input[type="hidden"]')) continue;
      const lab = b.matches('input[type="checkbox"],input[type="radio"]') ? b.closest("label") : null;
      const r = lab ? rectOf(lab) : rectOf(b); const cs = getComputedStyle(b);
      if (r.right < 0 || r.left > innerWidth + 4) continue;
      if (cs.display === "inline" && b.closest("p,li,dd,blockquote,figcaption,small,span,label")) continue;
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.push({ kind: "tap-target", sel: desc(b), detail: `${Math.round(r.width)}x${Math.round(r.height)}px` });
    }
  }
  return out;
}

const WIDTHS = [[390, 844], [768, 1024], [1440, 900]];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--disable-gpu"] });
const fails = []; // {route,w,state,kind,sel,detail}
const slug = (r) => (r === "/" ? "index" : r.slice(1).replace(/\//g, "__"));
let states = 0;
const CONC = +(process.env.CONC || 4);
const queue = [...routes];
async function doRoute(route) {
  for (const [w, h] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1000 });
    const page = await ctx.newPage();
    const errs = [];
    // vault.titanos.tech only allows framing from https://titanos.tech, so the /refer embed cannot load on the local test origin: not a site bug.
    page.on("console", (m) => { if (m.type() === "error" && !/frame-ancestors/.test(m.text())) errs.push("console: " + m.text().slice(0, 160)); });
    page.on("pageerror", (e) => { if (!/Transition was skipped/.test(String(e))) errs.push("pageerror: " + String(e).slice(0, 160)); });
    page.on("requestfailed", (q) => { if (!/ERR_ABORTED/.test(q.failure()?.errorText || "") && !/^https:\/\/vault\.titanos\.tech\//.test(q.url())) errs.push("requestfailed: " + q.url().slice(0, 100)); });
    await page.goto(base + route, { waitUntil: "load", timeout: 60000 }).catch((e) => errs.push("goto: " + e.message.slice(0, 100)));
    await page.waitForTimeout(1500);
    const run = async (state) => {
      states++;
      const found = await page.evaluate(checks, { touch: w <= 768, state }).catch((e) => [{ kind: "gate-error", sel: "", detail: String(e.message).slice(0, 120) }]);
      for (const f of found) fails.push({ route, w, state, ...f });
      if (found.length || process.env.SHOTS === "all") await page.screenshot({ path: path.join(REP, "shots", `${slug(route)}-${w}-${state}.png`) }).catch(() => {});
    };
    await run("page");
    const more = page.locator(".nav-more-btn").first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => {}); await page.waitForTimeout(500);
      await run("more");
      await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    }
    const burger = page.locator(".nav-burger").first();
    if (await burger.isVisible().catch(() => false)) {
      await burger.click().catch(() => {}); await page.waitForTimeout(800);
      await run("drawer");
    }
    for (const e of errs) fails.push({ route, w, state: "page", kind: "console-error", sel: "", detail: e });
    await ctx.close();
  }
  process.stderr.write(".");
}
await Promise.all(Array.from({ length: Math.min(CONC, routes.length) }, async () => { for (let r; (r = queue.shift()) !== undefined;) await doRoute(r); }));
await browser.close(); srv.close();

// Dedupe across routes (shared nav/footer repeats): group by kind+sel+detail-class+state+width.
const groups = new Map();
for (const f of fails) {
  const k = [f.kind, f.sel, f.w, f.state, f.kind === "console-error" ? f.detail : ""].join("|");
  const g = groups.get(k) || { ...f, routes: [] };
  g.routes.push(f.route); groups.set(k, g);
}
const uniq = [...groups.values()];
fs.writeFileSync(path.join(REP, "overflow.json"), JSON.stringify({ routes: routes.length, states, failures: fails.length, unique: uniq.length, uniq }, null, 1));
console.log(`\nqa_overflow: ${routes.length} routes, ${states} states, ${fails.length} failures (${uniq.length} unique) -> ${path.relative(process.cwd(), REP)}/overflow.json`);
const byKind = {}; for (const u of uniq) byKind[u.kind] = (byKind[u.kind] || 0) + 1;
console.log(JSON.stringify(byKind));
for (const u of uniq.slice(0, +(process.env.SHOW || 25))) console.log(`FAIL ${u.kind} @${u.w} [${u.state}] ${u.sel} :: ${u.detail} (${u.routes.length} route${u.routes.length > 1 ? "s" : ""}: ${u.routes.slice(0, 3).join(",")})`);
process.exit(fails.length ? 1 : 0);
