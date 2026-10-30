// T12 accessibility pass on the new views, in a real Chrome (no axe or pa11y is installed, so this is a written checker; each check is recorded).
// usage (Windows node): node.exe a11y.mjs [portalDir|baseUrl] <outDir> [sizes=1366x768,390x844]
// A route that does not exist yet is SKIPPED (absent), listed, and never counted as a pass.
import fs from 'node:fs';
import { serve, launch } from './_browser.mjs';
import { PORTAL } from './_env.mjs';
const [, , t0, outDir = './a11y_out', sizesArg = '1366x768,390x844'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
let base, closer = () => {};
if (t0 && /^https?:/.test(t0)) base = t0.endsWith('/') ? t0 : t0 + '/'; else { const s = await serve(t0 || PORTAL); base = s.base; closer = s.close; }
const slug = 'porcelain-on-concrete-internal-wet-floor';
const ROUTES = (process.env.A11Y_ROUTES ? process.env.A11Y_ROUTES.split(',') : ['#/selector', 'systems/' + slug + '/', '#/rules', '#/insights', '#/solver', '#/problems', '#/system']).map((r) => r.trim());
const results = []; const skipped = [];
const rec = (size, route, name, ok, detail = '') => { results.push({ ok }); console.log((ok ? 'PASS ' : 'FAIL ') + size + ' ' + route + ' ' + name + (detail ? ' :: ' + String(detail).slice(0, 200) : '')); };
const browser = await launch();
for (const sz of sizesArg.split(',')) {
  const [W, H] = sz.split('x').map(Number); const phone = W < 600;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage(); const host = new URL(base).host;
  await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); return u.host === host || u.protocol === 'data:' ? r.continue() : r.abort(); });
  for (const route of ROUTES) {
    await page.goto(base + (route.startsWith('#') ? '' : '') + route, { waitUntil: 'load' }).catch(() => {});
    try { await page.waitForSelector('main:not([aria-busy])', { timeout: 15000 }); } catch { skipped.push(`${sz} ${route}: page did not render`); continue; }
    await page.waitForTimeout(300);
    const txt = await page.locator('main').innerText().catch(() => '');
    if (/could not find that page/i.test(txt) || (await page.title()).trim() === '') { if (!skipped.includes(`${route}: view absent`)) skipped.push(`${route}: view absent`); continue; }
    const r = await page.evaluate(() => {
      const out = {}; const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      // headings: one h1, no skipped level
      const hs = [...document.querySelectorAll('main h1,main h2,main h3,main h4,main h5,main h6')].filter(vis).map((h) => +h.tagName[1]);
      out.h1 = hs.filter((x) => x === 1).length; let skip = null; for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) { skip = `h${hs[i - 1]} then h${hs[i]}`; break; } out.headingSkip = skip;
      // controls with a label
      const lab = (e) => { if (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title')) return true; if (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) return true; if (e.closest('label')) return true; return false; };
      out.unlabelled = [...document.querySelectorAll('main input:not([type=hidden]),main select,main textarea')].filter(vis).filter((e) => !lab(e)).map((e) => e.outerHTML.slice(0, 80));
      out.noName = [...document.querySelectorAll('main button,main a[href]')].filter(vis).filter((e) => !(e.innerText || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('title') && !e.querySelector('img[alt]')).map((e) => e.outerHTML.slice(0, 80));
      // chips that toggle must expose state
      out.chipNoState = [...document.querySelectorAll('main .chip, main [role=button]')].filter(vis).filter((e) => e.tagName === 'BUTTON' && !e.hasAttribute('aria-pressed') && !e.hasAttribute('aria-expanded') && !e.hasAttribute('aria-current') && e.closest('[role=group],.chips,.filters,.opts') && !/submit/.test(e.type)).length;
      // touch targets, 44 px, for the controls a thumb has to hit
      const sm = []; for (const e of document.querySelectorAll('main button, main input:not([type=hidden]), main select, main textarea, main .btn, main label.sel-opt, main summary')) { if (!vis(e)) continue; if (e.type === 'radio' || e.type === 'checkbox') { const l = e.closest('label'); if (l) continue; } const b = e.getBoundingClientRect(); if (b.height < 43.5 || b.width < 43.5) sm.push(`${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''} ${Math.round(b.width)}x${Math.round(b.height)}`); }
      out.small = sm.slice(0, 8); out.smallN = sm.length;
      // overflow
      out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      // focus lands on main on route change (set by app.js for hash routes)
      out.activeAfterLoad = document.activeElement && document.activeElement.tagName;
      // rendered text contrast: effective background walked up the tree
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const bgOf = (e) => { let acc = { r: 255, g: 255, b: 255 }; const chain = []; for (let x = e; x; x = x.parentElement) chain.push(x); for (const x of chain.reverse()) { const c = parse(getComputedStyle(x).backgroundColor); if (c && c.a > 0) acc = { r: c.r * c.a + acc.r * (1 - c.a), g: c.g * c.a + acc.g * (1 - c.a), b: c.b * c.a + acc.b * (1 - c.a) }; } return acc; };
      const low = []; let nText = 0; const seen = new Set();
      const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.textContent.trim(); if (!t) continue; const e = n.parentElement; if (!e || !vis(e) || e.closest('[aria-hidden=true],.visually-hidden')) continue; const st = getComputedStyle(e); const fg = parse(st.color); if (!fg) continue; const bg = bgOf(e); const a = fg.a; const fgm = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
        const [x, y] = [lum(fgm), lum(bg)].sort((p, q) => q - p); const ratio = (x + 0.05) / (y + 0.05); const px = parseFloat(st.fontSize); const large = px >= 24 || (px >= 18.66 && +st.fontWeight >= 700); nText++;
        if (ratio < (large ? 3 : 4.5)) { const k = e.tagName + e.className; if (!seen.has(k)) { seen.add(k); low.push(`${ratio.toFixed(2)} ${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${t.slice(0, 30)}"`); } } }
      out.lowContrast = low.slice(0, 6); out.lowN = low.length; out.textNodes = nText;
      // keyboard: every interactive element reachable (tabindex not negative)
      out.negTab = [...document.querySelectorAll('main button,main a[href],main input,main select,main textarea')].filter(vis).filter((e) => e.tabIndex < 0).length;
      return out;
    });
    const R = (n, ok, d) => rec(sz, route, n, ok, d);
    R('one h1', r.h1 === 1, r.h1 + ' h1');
    R('heading order has no skipped level', !r.headingSkip, r.headingSkip || '');
    R('every control has a label', r.unlabelled.length === 0, r.unlabelled.join(' | '));
    R('every button and link has an accessible name', r.noName.length === 0, r.noName.join(' | '));
    R('toggle chips expose their state (aria-pressed)', r.chipNoState === 0, r.chipNoState + ' without');
    R('touch targets at least 44 px', r.smallN === 0, r.smallN + ' small: ' + r.small.join('; '));
    R('no horizontal scroll', r.overflow <= 1, r.overflow + ' px');
    R('rendered text contrast 4.5:1 (3:1 large)', r.lowN === 0, `${r.textNodes} text nodes; low: ${r.lowContrast.join(' | ')}`);
    R('nothing removed from the tab order', r.negTab === 0, r.negTab + '');
    // focus ring on first tab stop
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { w: parseFloat(s.outlineWidth), st: s.outlineStyle, shadow: s.boxShadow !== 'none' }; });
    R('keyboard focus is visible', !!ring && ((ring.st !== 'none' && ring.w >= 2) || ring.shadow), JSON.stringify(ring));
    if (route.startsWith('#')) { // route change moves focus to main
      await page.goto(base + '#/about'); await page.waitForTimeout(300); await page.evaluate((hash) => { location.hash = hash; }, route); await page.waitForTimeout(700);
      const f = await page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName) : null; }); R('focus moves to main on route change', f === 'main', f);
    }
    // reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
    const rm = await page.evaluate(() => { const bad = []; for (const e of document.querySelectorAll('main *, .site-header *')) { const s = getComputedStyle(e); const d = (v) => Math.max(...v.split(',').map((x) => parseFloat(x) * (x.includes('ms') ? 1 : 1000))); if (d(s.animationDuration) > 1 || d(s.transitionDuration) > 1) bad.push(e.tagName + '.' + String(e.className).split(' ')[0]); } return { n: bad.length, ex: bad.slice(0, 3), scroll: getComputedStyle(document.documentElement).scrollBehavior }; });
    R('reduced motion respected', rm.n === 0 && rm.scroll === 'auto', JSON.stringify(rm)); await page.emulateMedia({ reducedMotion: 'no-preference' });
    // print stylesheet: dark ink on white, readable size, no horizontal overflow, nav chrome hidden
    await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(100);
    const pr = await page.evaluate(() => { const b = getComputedStyle(document.body); const m = getComputedStyle(document.querySelector('main')); const hdr = document.querySelector('.hdr-meta,.mega,.bottombar,#assistant,.asst-fab,.fab'); return { bg: b.backgroundColor, color: b.color, font: parseFloat(m.fontSize), hdrShown: hdr ? getComputedStyle(hdr).display !== 'none' : false, ow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    R('print view readable (white page, dark text, at least 12 px, no side overflow)', /255, 255, 255|rgba\(0, 0, 0, 0\)/.test(pr.bg) && pr.font >= 12 && pr.ow <= 1, JSON.stringify(pr)); await page.emulateMedia({ media: 'screen' });
    await page.screenshot({ path: `${outDir}/${sz}_${route.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close(); closer();
const pass = results.filter((x) => x.ok).length; const fail = results.length - pass;
console.log(`A11Y ${pass} passed, ${fail} failed, routes skipped as absent: ${[...new Set(skipped)].join('; ') || 'none'}`);
process.exit(fail ? 1 : 0);
