// Per-page Open Graph / Twitter cards, generated after `next build` into out/og/<slug>.png
// (1200x630). The slug rule is lib/seo.ts ogSlug(). One card per indexable route, drawn from that
// page's own <title> and description, so a new page gets a card with no manual step. If chromium is
// unavailable the shared card public/og-image.png is copied instead, so no page is ever left without an image.
import fs from "node:fs";
import path from "node:path";
import { walk, routeOf, inspect } from "./seo_audit.mjs";

const OUT = process.argv[2] || "out";
const slugOf = (route) => route.replace(/^\/+|\/+$/g, "").replace(/\//g, "-") || "home";
const esc = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const cards = [];
for (const f of walk(OUT)) {
  const info = inspect(fs.readFileSync(f, "utf8"));
  if (info.noindex) continue;
  const route = routeOf(OUT, f);
  const title = (info.title || "TITANOS").replace(/\s*[|:]\s*Titanos$/i, "").replace(/\s*\|\s*TITANOS$/i, "");
  cards.push({ slug: slugOf(route), route, title: esc(title), desc: esc(info.description || "") });
}

const dir = path.join(OUT, "og");
fs.mkdirSync(dir, { recursive: true });
const fallback = path.join(process.cwd(), "public", "og-image.png");

const html = (c) => `<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:#0a0a0b;color:#E0E0E0;font-family:Georgia,'Times New Roman',serif;position:relative;overflow:hidden">
<div style="position:absolute;left:0;top:0;bottom:0;width:6px;background:#D4AF37"></div>
<div style="position:absolute;left:72px;top:64px;font:600 22px 'Courier New',monospace;letter-spacing:.32em;color:#D4AF37">TITANOS</div>
<div style="position:absolute;left:72px;top:150px;right:72px;font-size:${c.title.length > 70 ? 54 : c.title.length > 40 ? 64 : 76}px;line-height:1.12;color:#fff;font-weight:400">${c.title}</div>
<div style="position:absolute;left:72px;bottom:112px;right:96px;font:400 28px/1.4 Helvetica,Arial,sans-serif;color:#B9F2FF;max-height:120px;overflow:hidden">${c.desc.slice(0, 150)}</div>
<div style="position:absolute;left:72px;bottom:56px;font:400 22px 'Courier New',monospace;color:#8a8a8a">titanos.tech${c.route === "/" ? "" : c.route}</div>
</body></html>`;

import { launchChromium } from "./lib/browser.mjs";
let browser = null;
try { browser = await launchChromium(); } catch (e) { console.warn(`gen_og: playwright unavailable (${e.message.split("\n")[0]})`); }
if (!browser) console.warn("gen_og: chromium unavailable; copying the shared card");
if (browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const c of cards) {
    await page.setContent(html(c));
    await page.screenshot({ path: path.join(dir, `${c.slug}.png`), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  }
  await browser.close();
} else {
  for (const c of cards) fs.copyFileSync(fallback, path.join(dir, `${c.slug}.png`));
}
console.log(`gen_og: ${cards.length} cards in ${dir}`);
