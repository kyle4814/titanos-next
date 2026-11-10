// C10 viewport overflow sweep (f385). Serves the static export on 127.0.0.1 only and renders every route at 360, 768, 1024 and 1440 px.
// Per render it records: (hscroll) documentElement.scrollWidth beyond the viewport; (offender) visible elements whose box leaves the viewport
// and is not clipped or scrolled by an ancestor; (footer) .footer-columns children that leave the viewport, overlap, or spill text;
// (tap) interactive targets under 44 px at 360 (inline links inside running text are exempt, WCAG 2.5.8).
import fs from "node:fs";
import path from "node:path";
import { serve, listRoutes } from "./text_sanity.mjs";
export { listRoutes };

export const WIDTHS = [360, 768, 1024, 1440];
export const TAP_MIN = 44;
export const TAP_WIDTH = 360;
export const SLACK = 1; // px of rounding slack on right edge and scroll width

// f413: deterministic readiness. Measuring before the stylesheet applied gave 40, 38 and 29 tap hits for the same route under load.
// A page is READY only when (1) document.fonts.ready resolved, (2) every link[rel=stylesheet] has a sheet with readable, non-empty cssRules
// and no <link> is still pending, and (3) a computed-style probe confirms an app rule applied (a throw-away element carrying a known class).
// On timeout the render is a MEASURE ERROR (rec.error), which evaluate() counts and the sweep exits non-zero on: never a pass.
export const READY_TIMEOUT_MS = 15000;
export const DEFAULT_PROBE = "auto"; // "auto": the page's own first plain-class rule; or { cls, prop, value }; or null for sheet checks only
function readyInPage(probe) {
  const why = [];
  if (document.readyState !== "complete") why.push("document.readyState=" + document.readyState);
  if (!window.__fontsReady) { window.__fontsReady = false; document.fonts.ready.then(() => { window.__fontsReady = true; }); }
  if (!window.__fontsReady) why.push("fonts not ready");
  for (const l of document.querySelectorAll("link[rel~=stylesheet]")) {
    let n = -1; try { n = l.sheet ? l.sheet.cssRules.length : -1; } catch { n = -2; }
    if (n === -2) continue; // cross-origin sheet: unreadable, rely on the probe
    if (n <= 0) why.push("stylesheet not applied: " + (l.getAttribute("href") || "").slice(-40));
  }
  if (!document.styleSheets.length) why.push("no stylesheets at all");
  if (probe) {
    let p = probe;
    if (probe === "auto") { // first top-level `.class{decl}` rule in a readable sheet, declaration free of var()/inherit
      p = null;
      outer: for (const sh of document.styleSheets) {
        let rules; try { rules = sh.cssRules; } catch { continue; }
        for (const r of rules) {
          if (r.type !== 1 || !/^\.[A-Za-z_][\w-]*$/.test(r.selectorText)) continue;
          for (let i = 0; i < r.style.length; i++) {
            const prop = r.style[i], value = r.style.getPropertyValue(prop);
            if (prop.startsWith("--") || /var\(|inherit|initial|unset|revert|env\(|calc\(/.test(value)) continue;
            p = { cls: r.selectorText.slice(1), prop, value, auto: true }; break outer;
          }
        }
      }
    }
    if (p) {
      const mk = () => { const e = document.createElement("div"); e.style.cssText = "position:absolute;left:-9999px;top:0"; document.body.appendChild(e); return e; };
      const el = mk(); el.className = p.cls; const ref = mk();
      const got = getComputedStyle(el)[p.prop];
      let want = p.value;
      if (p.auto) { ref.style.setProperty(p.prop, p.value); want = getComputedStyle(ref)[p.prop]; }
      el.remove(); ref.remove();
      if (got !== want) why.push(`probe .${p.cls} ${p.prop}=${got} want ${want}`);
    }
  }
  return why;
}
export async function waitReady(page, { probe = DEFAULT_PROBE, timeoutMs = READY_TIMEOUT_MS } = {}) {
  const start = Date.now(); let why = ["not polled"];
  while (Date.now() - start < timeoutMs) {
    try { why = await page.evaluate(readyInPage, probe); }
    catch (e) { // a meta-refresh stub navigated mid-poll: follow it to the destination document and poll again
      if (!/context was destroyed|navigation/i.test(String(e.message))) throw e;
      why = ["navigating"]; try { await page.waitForLoadState("load", { timeout: Math.max(1000, timeoutMs - (Date.now() - start)) }); } catch {}
    }
    if (!why.length) return { ms: Date.now() - start };
    await page.waitForTimeout(50);
  }
  throw new Error("MEASURE ERROR: page not ready after " + timeoutMs + " ms: " + why.join("; "));
}

// Runs inside the page. args: { tapMin, tapOn, slack }.
function inPage(args) {
  const { tapMin, tapOn, slack } = args;
  const vw = document.documentElement.clientWidth;
  const sel = (el) => {
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return (el.tagName.toLowerCase() + id + cls).slice(0, 90);
  };
  const shown = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const clipped = (el) => { // an ancestor that clips or scrolls horizontally and itself sits inside the viewport
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (["hidden", "clip", "auto", "scroll"].includes(s.overflowX)) { const r = e.getBoundingClientRect(); if (r.right <= vw + slack && r.left >= -slack) return true; }
      if (s.position === "fixed") return false;
    }
    return false;
  };
  const doc = document.documentElement;
  const hscroll = { scrollW: Math.max(doc.scrollWidth, document.body.scrollWidth), vw, over: Math.max(doc.scrollWidth, document.body.scrollWidth) - vw > slack };

  const offenders = [];
  const bad = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "META", "LINK", "TITLE", "PATH", "DEFS", "G"].includes(el.tagName.toUpperCase())) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + slack && r.left >= -slack) continue;
    if (!shown(el) || clipped(el)) continue;
    let anc = false; for (let p = el.parentElement; p; p = p.parentElement) if (bad.has(p)) { anc = true; break; }
    if (anc) continue; // report the topmost offender only
    bad.add(el);
    offenders.push({ sel: sel(el), tag: el.tagName.toLowerCase(), left: Math.round(r.left), right: Math.round(r.right), over: Math.round(Math.max(r.right - vw, -r.left)), text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50) });
  }

  const footer = [];
  const fc = document.querySelector(".footer-columns");
  if (fc) {
    const kids = [...fc.children].filter((k) => shown(k)).map((k) => ({ el: k, r: k.getBoundingClientRect() }));
    const rowsTop = new Set(kids.map((k) => Math.round(k.r.top / 4)));
    for (const k of kids) {
      if (k.r.right > vw + slack || k.r.left < -slack) footer.push({ kind: "column-outside-viewport", sel: sel(k.el), right: Math.round(k.r.right) });
      if (k.el.scrollWidth - k.el.clientWidth > slack) footer.push({ kind: "column-text-spill", sel: sel(k.el), spill: k.el.scrollWidth - k.el.clientWidth });
      for (const a of k.el.querySelectorAll("a,li,div")) { const q = a.getBoundingClientRect(); if (q.width && (q.right > k.r.right + slack + 0.5 || q.left < k.r.left - slack - 0.5) && !clipped(a)) { footer.push({ kind: "link-outside-column", sel: sel(a), by: Math.round(Math.max(q.right - k.r.right, k.r.left - q.left)) }); break; }}
    }
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].r, b = kids[j].r; const ow = Math.min(a.right, b.right) - Math.max(a.left, b.left), oh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ow > slack && oh > slack) footer.push({ kind: "columns-overlap", sel: sel(kids[i].el) + " x " + sel(kids[j].el), area: Math.round(ow * oh) });
    }
    footer.layout = undefined;
    footer.push({ kind: "info-layout", rows: rowsTop.size, cols: kids.length, info: true });
  }

  const taps = [];
  if (tapOn) {
    for (const el of document.body.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex='-1'])")) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= tapMin && r.height >= tapMin) continue;
      const s = getComputedStyle(el);
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      let inline = false;
      if (el.tagName === "A" && s.display === "inline") { // inline link inside a sentence: exempt
        const par = el.closest("p,li,dd,blockquote,figcaption,td");
        if (par) { const own = [...par.childNodes].filter((n) => n !== el && (n.nodeType === 3 ? n.textContent.trim() : false)).length; inline = own > 0; }
      }
      if (el.getAttribute("tabindex") !== null && !["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"].includes(el.tagName) && !el.getAttribute("role")) continue; // scroll containers etc
      if (el.closest(".sr-only,[class*=skip]") && r.width <= 1) continue;
      taps.push({ sel: sel(el), w: Math.round(r.width), h: Math.round(r.height), inline, text: t.slice(0, 40), inFooter: !!el.closest("footer"), inNav: !!el.closest("nav,header") });
    }
  }
  return { hscroll, offenders, footer, taps };
}

export async function sweep({ root, routes, widths = WIDTHS, settleMs = 350, concurrency = 4, probe = DEFAULT_PROBE, readyTimeoutMs = READY_TIMEOUT_MS, server = null, log = () => {}, tapOn = (w) => w === TAP_WIDTH }) {
  const has = (d) => { try { return fs.readdirSync(d).some((x) => x.startsWith("chromium")); } catch { return false; } };
  const dflt = path.join(process.env.HOME || "", ".cache", "ms-playwright");
  if (!has(process.env.PLAYWRIGHT_BROWSERS_PATH || dflt) && has(dflt)) process.env.PLAYWRIGHT_BROWSERS_PATH = dflt;
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch (e) { return { skipped: "playwright not importable: " + String(e.message).split("\n")[0] }; }
  const { srv, base } = server || await serve(root);
  let browser;
  try { browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] }); } catch (e) { if (!server) srv.close(); return { skipped: "chromium absent: " + String(e.message).split("\n")[0] }; }
  const results = [];
  try {
    const jobs = []; for (const route of routes) for (const width of widths) jobs.push({ route, width });
    let next = 0;
    const worker = async () => { for (;;) { const j = jobs[next++]; if (!j) return;
      const { route, width } = j;
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.route("**/*", (rt) => { const u = new URL(rt.request().url()); if (u.hostname === "127.0.0.1") rt.continue(); else rt.abort(); });
      const rec = { route, width, hscroll: null, offenders: [], footer: [], taps: [], error: null };
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
          await waitReady(page, { probe, timeoutMs: readyTimeoutMs });
          await page.waitForTimeout(settleMs * (attempt + 1));
          Object.assign(rec, await page.evaluate(inPage, { tapMin: TAP_MIN, tapOn: tapOn(width), slack: SLACK })); rec.error = null; break;
        } catch (e) { rec.error = String(e.message).split("\n")[0]; }
      }
      results.push(rec); await ctx.close(); log(route, width, rec);
    } };
    await Promise.all(Array.from({ length: concurrency }, worker));
    results.sort((a, b) => a.route.localeCompare(b.route) || a.width - b.width);
  } finally { await browser.close(); if (!server) srv.close(); }
  return { results };
}
