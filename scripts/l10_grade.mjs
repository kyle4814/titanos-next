// L10 site grader. Usage: node scripts/l10_grade.mjs <baseUrl> <outJson> [routes,comma]
// Per route on an emulated phone (390x844 @2x, CPU 4x slow, ~slow-4G): status, LCP, CLS (settled + after a scroll to the bottom),
// long-task total (TBT proxy), console errors, axe-core serious/critical (if /tmp/axe or node_modules has it), images (natural vs
// rendered at DPR, alt), tap targets under 44 px, off-scale text under 12 px, security headers. Writes JSON; the grade file is built from it.
import { chromium } from "playwright";
import fs from "node:fs";
import { createRequire } from "node:module";

const base = (process.argv[2] || "https://titanos.tech").replace(/\/$/, "");
const outFile = process.argv[3] || "l10_grade.json";
const routes = (process.argv[4] || "/,/offers,/products,/scan,/proof,/contact,/case-studies,/services,/enterprise,/about,/faq,/security,/costs").split(",");
let axeSrc = null;
for (const p of ["axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"]) {
  try { axeSrc = fs.readFileSync(p.startsWith("/") ? p : createRequire(import.meta.url).resolve(p), "utf8"); break; } catch {}
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const out = { base, at: new Date().toISOString(), axe: !!axeSrc, routes: {} };

for (const route of routes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(m.type() + ": " + m.text().slice(0, 140)); });
  page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 140)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__cls = 0; window.__lcp = 0; window.__lt = 0; window.__ltMax = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt += Math.max(0, e.duration - 50); window.__ltMax = Math.max(window.__ltMax, e.duration); } }).observe({ type: "longtask", buffered: true });
  });
  const r = { errors: errs };
  const resp = await page.goto(base + route, { waitUntil: "load", timeout: 90000 }).catch((e) => (errs.push("goto: " + e.message.slice(0, 100)), null));
  r.status = resp?.status();
  if (route === routes[0] && resp) { const h = resp.headers(); r.headers = { csp: !!h["content-security-policy"], hsts: !!h["strict-transport-security"], xcto: !!h["x-content-type-options"], referrer: h["referrer-policy"] || null }; }
  await page.waitForTimeout(3000);
  const m1 = await page.evaluate(() => ({ cls: window.__cls, lcp: window.__lcp, tbt: window.__lt, maxLt: window.__ltMax }));
  Object.assign(r, { lcpMs: Math.round(m1.lcp), clsLoad: +m1.cls.toFixed(3), tbtMs: Math.round(m1.tbt), longestTaskMs: Math.round(m1.maxLt) });
  // scroll the whole page in steps (motion + lazy content), then read CLS and long tasks again
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((s) => setTimeout(s, 120)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
  const m2 = await page.evaluate(() => ({ cls: window.__cls, tbt: window.__lt, maxLt: window.__ltMax }));
  Object.assign(r, { clsAfterScroll: +m2.cls.toFixed(3), tbtAfterScrollMs: Math.round(m2.tbt), longestTaskAfterScrollMs: Math.round(m2.maxLt) });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  Object.assign(r, await page.evaluate(() => {
    const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const imgs = [...document.images].filter(vis).map((i) => ({ src: (i.currentSrc || i.src).slice(-60), nat: i.naturalWidth, rend: Math.round(i.getBoundingClientRect().width), alt: i.getAttribute("alt") }));
    const blurry = imgs.filter((i) => i.rend && i.nat && i.nat < i.rend * 2 && !/\.svg/.test(i.src)).length;
    const noAlt = imgs.filter((i) => i.alt === null).length;
    const tap = [...document.querySelectorAll("a[href],button,input,select,textarea,[role=button]")].filter(vis).filter((e) => { const b = e.getBoundingClientRect(); return (b.width < 44 || b.height < 44) && !(e.tagName === "A" && getComputedStyle(e).display === "inline" && e.closest("p,li,span")); }).map((e) => (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 30));
    const small = new Set();
    for (const e of document.querySelectorAll("body *")) { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 12 && vis(e)) small.add(fs.toFixed(1)); }
    return { images: imgs.length, blurryImages: blurry, imagesNoAltAttr: noAlt, tapUnder44: tap.length, tapSample: tap.slice(0, 6), textUnder12px: [...small], overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth, h1: document.querySelectorAll("h1").length, title: document.title.slice(0, 80), desc: !!document.querySelector('meta[name=description]'), og: !!document.querySelector('meta[property="og:image"]') };
  }));
  r.text = await page.evaluate(() => document.body.innerText);
  if (axeSrc) {
    await page.evaluate(axeSrc);
    r.axe = await page.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0]?.target?.join(" ").slice(0, 80) })));
  }
  const slug = route === "/" ? "index" : route.slice(1).replace(/\//g, "__");
  fs.mkdirSync(outFile.replace(/\.json$/, "") + "_shots", { recursive: true });
  await page.screenshot({ path: outFile.replace(/\.json$/, "") + `_shots/${slug}-390.png`, fullPage: true }).catch(() => {});
  out.routes[route] = r;
  process.stderr.write(".");
  await ctx.close();
}
await browser.close();
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log("\nwrote", outFile);
