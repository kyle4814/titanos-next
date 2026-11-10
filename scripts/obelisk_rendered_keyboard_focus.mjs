// obelisk_rendered_keyboard_focus.mjs (f407_c10): RENDERED keyboard-only sweep. a11y_static.mjs (f74) is source-only;
// this loads the built pages in headless chromium and presses Tab / Shift+Tab / Enter / Escape like a keyboard user.
// Per page and viewport it asserts:
//   NO_INDICATOR     every focused element shows a visible focus indicator (computed outline, box-shadow, or an
//                    "alt" change: border, background, underline, colour, or a focus-within ancestor / pseudo ring)
//                    that differs from its unfocused state. Outline/box-shadow = primary; the rest are counted as alt.
//   UNREACHABLE      focus lands on something hidden, zero-size, inside aria-hidden, or outside the viewport after focus
//   TRAP             Tab does not return to the document (or wrap to the first stop) within N+5 presses
//   REVERSE_MISMATCH Shift+Tab does not walk the forward order back, or does not return to the document within N+5
//   SKIP_LINK        a skip link (first stop, in-page #hash, text /skip/) must become visible and move focus to its target
//   ESCAPE           a dialog/menu opened by keyboard must close on Escape (aria-expanded false / dialog gone)
// Zero model calls, localhost only (every non-localhost request is aborted), synthetic fixtures for the self-test.
// Usage: node scripts/obelisk_rendered_keyboard_focus.mjs [--out out] [--pages /a,/b] [--viewports desktop,mobile] [--json] [--receipt path]
// Exit 0 clean (or labelled SKIP when chromium/playwright is absent), 1 violations or a requested page missing, 2 usage.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

export const DEFAULT_PAGES = ["/", "/scan", "/pricing", "/app", "/pro", "/agents", "/enterprise", "/partners", "/shop", "/trust", "/proof", "/engineering", "/investors", "/sectors"];
export const VIEWPORTS = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" };
const TABBABLE = 'a[href],area[href],button,input:not([type="hidden"]),select,textarea,summary,iframe,[tabindex],[contenteditable=""],[contenteditable="true"],audio[controls],video[controls]';

const resolveFile = (root, p) => {
  let f = path.join(root, decodeURIComponent(p.split("?")[0]));
  if (!f.startsWith(root)) return null;
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(f + ".html") ? f + ".html" : path.join(f, "index.html");
  return fs.existsSync(f) ? f : null;
};

// ---- in-page helpers (serialised into the page) ----
const PAGE_INIT = () => {
  const st = document.createElement("style");
  st.textContent = "*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}";
  const put = () => (document.head || document.documentElement).appendChild(st);
  if (document.documentElement) put(); else document.addEventListener("DOMContentLoaded", put);
  const ids = new WeakMap(); let n = 0;
  window.__kbId = (el) => { if (!ids.has(el)) ids.set(el, ++n); return ids.get(el); };
  const isDoc = (el) => !el || el === document.body || el === document.documentElement;
  window.__kbIsDoc = isDoc;
  const snap = (el) => {
    const cs = getComputedStyle(el);
    const pseudo = (w) => { const p = getComputedStyle(el, w); return `${p.content}|${p.outlineStyle}|${p.outlineWidth}|${p.boxShadow}|${p.borderTopColor}|${p.backgroundColor}|${p.opacity}`; };
    const anc = []; for (let a = el.parentElement, i = 0; a && i < 2; a = a.parentElement, i++) { const c = getComputedStyle(a); anc.push(`${c.outlineStyle}|${c.outlineWidth}|${c.boxShadow}|${c.borderTopColor}|${c.backgroundColor}`); }
    return { oStyle: cs.outlineStyle, oWidth: parseFloat(cs.outlineWidth) || 0, oColor: cs.outlineColor, oOffset: cs.outlineOffset, shadow: cs.boxShadow, border: cs.borderTopColor + cs.borderBottomColor + cs.borderLeftColor + cs.borderRightColor, bg: cs.backgroundColor, deco: cs.textDecorationLine + cs.textDecorationColor, color: cs.color, filter: cs.filter, before: pseudo("::before"), after: pseudo("::after"), anc: anc.join("/") };
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false;
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === "none" || c.visibility === "hidden") return false; }
    return true;
  };
  window.__kbCount = (sel) => [...document.querySelectorAll(sel)].filter((e) => !e.disabled && e.tabIndex >= 0 && visible(e)).length;
  window.__kbBase = new WeakMap();
  window.__kbBaseline = (sel) => { for (const e of document.querySelectorAll(sel)) { try { window.__kbBase.set(e, snap(e)); } catch {} } };
  window.__kbState = () => {
    const el = document.activeElement;
    if (isDoc(el)) return { doc: true };
    const r = el.getBoundingClientRect(); const vw = innerWidth, vh = innerHeight;
    let hiddenAnc = false; for (let a = el; a && a.nodeType === 1; a = a.parentElement) if (a.getAttribute("aria-hidden") === "true" || a.hasAttribute("inert")) hiddenAnc = true;
    const inVp = r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
    const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("href") || el.getAttribute("name") || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const now = snap(el); let base = window.__kbBase.get(el); let baseSource = "pre";
    if (!base) { baseSource = "blur"; el.blur(); base = snap(el); el.focus(); }
    const primary = (now.oStyle !== "none" && now.oWidth > 0 && now.oColor !== "rgba(0, 0, 0, 0)" && (now.oStyle !== base.oStyle || now.oWidth !== base.oWidth || now.oColor !== base.oColor || now.oOffset !== base.oOffset))
      || (now.shadow !== "none" && now.shadow !== base.shadow);
    const alt = ["border", "bg", "deco", "color", "filter", "before", "after", "anc"].filter((k) => now[k] !== base[k]);
    return { doc: false, id: window.__kbId(el), tag: el.tagName.toLowerCase(), label, visible: visible(el), hiddenAnc, inVp, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], primary, alt, baseSource, outline: `${now.oStyle} ${now.oWidth}px`, shadow: now.shadow };
  };
  window.__kbDialogs = () => [...document.querySelectorAll('dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]')].filter(visible).length;
  window.__kbExpanded = () => document.querySelectorAll('[aria-expanded="true"]').length;
};

/** Sweep one page in one viewport. Returns { page, vp, status, n, presses, stops, violations[], notes[] }. */
async function sweepPage(browser, base, page, vpName) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vpName], reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); if (u.hostname === "127.0.0.1" || u.hostname === "localhost") route.continue(); else route.abort(); });
  const pg = await ctx.newPage(); await pg.addInitScript(PAGE_INIT);
  const out = { page, vp: vpName, status: 0, n: 0, presses: 0, stops: 0, violations: [], notes: [], altOnly: 0, skip: "none", escape: { probed: 0, opened: 0, exempt: 0 } };
  const bad = (code, detail) => out.violations.push({ code, detail });
  const load = async () => {
    const resp = await pg.goto(base + page, { waitUntil: "load" }); await pg.waitForTimeout(600);
    await pg.evaluate(PAGE_INIT_READY); return resp;
  };
  const PAGE_INIT_READY = `(() => { if (!window.__kbCount) throw new Error("init missing"); window.__kbBaseline(${JSON.stringify(TABBABLE)}); })()`;
  try {
    const resp = await load(); out.status = resp ? resp.status() : 0;
    if (out.status !== 200) { bad("LOAD", `status ${out.status}`); await ctx.close(); return out; }
    out.n = await pg.evaluate((s) => window.__kbCount(s), TABBABLE);
    const limit = out.n + 5;

    // ---- skip link: first Tab stop that is an in-page #hash link with "skip" text
    await pg.keyboard.press("Tab");
    let first = await pg.evaluate(() => window.__kbState());
    const isSkip = first.doc ? false : await pg.evaluate(() => { const a = document.activeElement; const h = a.getAttribute && a.getAttribute("href"); return a.tagName === "A" && !!h && h.startsWith("#") && h.length > 1 && /skip/i.test(a.textContent + " " + (a.getAttribute("aria-label") || "")); });
    if (isSkip) {
      if (!first.visible || !first.inVp) bad("SKIP_LINK", `skip link not visible on focus (rect ${first.rect})`);
      const target = await pg.evaluate(() => document.activeElement.getAttribute("href").slice(1));
      const exists = await pg.evaluate((t) => !!document.getElementById(t), target);
      if (!exists) bad("SKIP_LINK", `target #${target} does not exist`);
      else {
        await pg.keyboard.press("Enter"); await pg.waitForTimeout(150);
        const moved = await pg.evaluate((t) => { const el = document.getElementById(t); const a = document.activeElement; return { onTarget: a === el || el.contains(a), hash: location.hash === "#" + t }; }, target);
        // next Tab must continue from the target (sequential focus start point), not from the top of the document
        await pg.keyboard.press("Tab"); const nxt = await pg.evaluate((t) => { const el = document.getElementById(t); const a = document.activeElement; return window.__kbIsDoc(a) ? "doc" : (el.contains(a) || (el.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) ? "after" : "before"); }, target);
        if (!moved.hash && !moved.onTarget) bad("SKIP_LINK", `Enter on skip link did not move to #${target}`);
        else if (nxt === "before") bad("SKIP_LINK", `after skip, next Tab went back before #${target}`);
        else out.skip = "works";
      }
      await load();
    } else out.skip = "absent";

    // ---- forward Tab walk
    const seq = []; const seen = new Set(); let returned = null;
    for (let i = 1; i <= limit; i++) {
      await pg.keyboard.press("Tab"); out.presses++;
      const s = await pg.evaluate(() => window.__kbState());
      if (s.doc) { returned = "document"; break; }
      if (seen.has(s.id)) { returned = seq[0] && seq[0].id === s.id ? "wrap-to-first" : "cycle"; if (returned === "cycle") { bad("TRAP", `focus cycles back to ${s.tag} "${s.label}" at press ${i}, never reaching the document`); } break; }
      seen.add(s.id); seq.push(s);
      const where = `${s.tag} "${s.label}"`;
      if (!s.visible || s.hiddenAnc || !s.inVp) bad("UNREACHABLE", `${where}: visible=${s.visible} ariaHiddenAncestor=${s.hiddenAnc} inViewport=${s.inVp} rect=${s.rect}`);
      if (!s.primary) { if (s.alt.length) out.altOnly++; else bad("NO_INDICATOR", `${where}: outline ${s.outline}, shadow ${s.shadow}, no alt change`); }
    }
    out.stops = seq.length;
    if (!returned) bad("TRAP", `no return to document or wrap within ${limit} presses (N=${out.n}, ${seq.length} distinct stops): keyboard trap`);
    if (returned === "document" || returned === "wrap-to-first") { /* ok */ }

    // ---- reverse: from the document state walk Shift+Tab; must reproduce forward order reversed and exit
    if (returned === "document" && seq.length) {
      const rev = []; let back = null;
      for (let i = 1; i <= limit; i++) {
        await pg.keyboard.press("Shift+Tab"); out.presses++;
        const s = await pg.evaluate(() => window.__kbState());
        if (s.doc) { back = "document"; break; }
        rev.push(s.id);
        if (rev.length > seq.length + 2) break;
      }
      if (!back) bad("REVERSE_MISMATCH", `Shift+Tab did not return to the document within ${limit} presses`);
      else {
        const want = seq.map((s) => s.id).reverse();
        if (rev.length !== want.length || rev.some((id, k) => id !== want[k])) bad("REVERSE_MISMATCH", `Shift+Tab visited ${rev.length} stops, forward visited ${want.length}; first differing index ${rev.findIndex((id, k) => id !== want[k])}`);
      }
    }

    // ---- Escape: every keyboard-openable disclosure/dialog must close on Escape
    await load();
    await pg.keyboard.press("Escape");
    // Held to the Escape contract: menus/dialogs (aria-haspopup, panel role dialog/menu/listbox/alertdialog or aria-modal) and
    // header/nav toggles. Plain accordion/FAQ disclosures (WAI-ARIA accordion pattern) have no Escape contract: exempt, counted.
    const trigAll = await pg.evaluate(() => [...document.querySelectorAll('button[aria-expanded],button[aria-haspopup],[role="button"][aria-expanded],[aria-haspopup]')].filter((e) => !e.disabled && e.tabIndex >= 0 && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== "hidden").slice(0, 40).map((e) => {
      const ctl = e.getAttribute("aria-controls") && document.getElementById(e.getAttribute("aria-controls"));
      const pop = (e.getAttribute("aria-haspopup") || "false") !== "false";
      const role = ctl && /^(dialog|alertdialog|menu|listbox|tree|grid)$/.test(ctl.getAttribute("role") || "") || (ctl && ctl.getAttribute("aria-modal") === "true");
      const inNav = !!e.closest("header,nav,[role=banner],[role=navigation]");
      return { id: window.__kbId(e), held: pop || !!role || inNav };
    }));
    out.escape.exempt = trigAll.filter((t) => !t.held).length;
    const trig = trigAll.filter((t) => t.held).map((t) => t.id);
    for (const id of trig) {
      const before = await pg.evaluate(() => ({ d: window.__kbDialogs(), x: window.__kbExpanded() }));
      const ok = await pg.evaluate((id) => { const el = [...document.querySelectorAll("*")].find((e) => window.__kbId(e) === id); if (!el) return false; el.focus(); return document.activeElement === el; }, id);
      if (!ok) continue; out.escape.probed++;
      await pg.keyboard.press("Enter"); await pg.waitForTimeout(250);
      const open = await pg.evaluate(() => ({ d: window.__kbDialogs(), x: window.__kbExpanded(), det: [...document.querySelectorAll("details[open]")].length }));
      if (open.d <= before.d && open.x <= before.x && !open.det) { await pg.keyboard.press("Escape"); continue; }
      out.escape.opened++;
      const desc = await pg.evaluate(() => { const a = document.activeElement; return a && a.tagName ? `${a.tagName.toLowerCase()} "${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 30)}"` : "?"; });
      await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
      const after = await pg.evaluate(() => ({ d: window.__kbDialogs(), x: window.__kbExpanded(), det: document.querySelectorAll("details[open]").length }));
      // a <details>/<summary> disclosure has no Escape contract; only dialogs, menus and aria-expanded widgets are held to it
      if (after.d > before.d || after.x > before.x) bad("ESCAPE", `opened from ${desc}; Escape left dialogs ${before.d}->${after.d}, expanded ${before.x}->${after.x}`);
      else if (!open.det || open.d > before.d || open.x > before.x) { /* closed as required */ }
    }
    // a dialog already open at load must also close
    await load();
    const preOpen = await pg.evaluate(() => window.__kbDialogs());
    if (preOpen) { await pg.keyboard.press("Escape"); await pg.waitForTimeout(300); const left = await pg.evaluate(() => window.__kbDialogs()); if (left) bad("ESCAPE", `dialog open on load did not close on Escape (${preOpen}->${left})`); }
  } catch (e) { bad("ERROR", String(e.message).split("\n")[0]); }
  await ctx.close();
  return out;
}

/** Run the sweep. Returns { skipped?, results[], missing[], uncovered[] }. */
export async function run({ out = "out", pages = DEFAULT_PAGES, viewports = ["desktop", "mobile"] } = {}) {
  const root = path.resolve(out);
  let chromium;
  const has = (d) => { try { return fs.readdirSync(d).some((x) => x.startsWith("chromium")); } catch { return false; } };
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && !has(process.env.PLAYWRIGHT_BROWSERS_PATH) && has(path.join(process.env.HOME || "", ".cache/ms-playwright"))) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  try { ({ chromium } = await import("playwright")); } catch (e) { return { skipped: "playwright not importable: " + String(e.message).split("\n")[0] }; }
  const srv = http.createServer((req, res) => {
    const f = resolveFile(root, req.url); if (!f) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("404"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  let browser; try { browser = await chromium.launch(); } catch (e) { srv.close(); return { skipped: "chromium absent: " + String(e.message).split("\n")[0] }; }
  const results = []; const missing = [];
  for (const p of pages) {
    if (!resolveFile(root, p)) { missing.push(p); continue; }
    for (const vp of viewports) results.push(await sweepPage(browser, base, p, vp));
  }
  await browser.close(); srv.close();
  // uncovered: exported html pages in out/ that this sweep did not touch (top-level doors only counted by path)
  const all = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith(".html")) all.push("/" + path.relative(root, f).replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "")); } };
  try { walk(root); } catch {}
  const swept = new Set(pages.map((p) => (p === "/" ? "/" : p.replace(/\/$/, ""))));
  const uncovered = [...new Set(all.map((p) => (p === "/" || p === "" ? "/" : p)))].filter((p) => !swept.has(p) && !/^\/(404|_not-found)/.test(p)).sort();
  return { results, missing, uncovered };
}

const argv = process.argv.slice(2);
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const known = new Set(["--out", "--pages", "--viewports", "--json", "--receipt"]);
  for (const a of argv) if (a.startsWith("--") && !known.has(a)) { console.error("usage: obelisk_rendered_keyboard_focus.mjs [--out out] [--pages /a,/b] [--viewports desktop,mobile] [--json] [--receipt file]"); process.exit(2); }
  const outDir = arg("--out", "out");
  if (!fs.existsSync(outDir)) { console.error(`KBFOC FAILED no such directory ${outDir}`); process.exit(2); }
  const pages = arg("--pages", "") ? arg("--pages").split(",") : DEFAULT_PAGES;
  const viewports = arg("--viewports", "desktop,mobile").split(",");
  for (const v of viewports) if (!VIEWPORTS[v]) { console.error("unknown viewport " + v); process.exit(2); }
  const r = await run({ out: outDir, pages, viewports });
  if (r.skipped) { console.log("KBFOC SKIP " + r.skipped); process.exit(0); }
  const viol = r.results.flatMap((x) => x.violations.map((v) => ({ page: x.page, vp: x.vp, ...v })));
  if (argv.includes("--json")) console.log(JSON.stringify({ ...r, violations: viol }, null, 1));
  else {
    for (const x of r.results) console.log(`${viol.some((v) => v.page === x.page && v.vp === x.vp) ? "FAIL" : "ok  "} ${x.vp.padEnd(7)} ${x.page.padEnd(14)} N=${String(x.n).padStart(3)} stops=${String(x.stops).padStart(3)} presses=${String(x.presses).padStart(3)} skip=${x.skip} escape=${x.escape.opened}/${x.escape.probed}+${x.escape.exempt}exempt altOnlyIndicators=${x.altOnly}`);
    for (const v of viol) console.log(`  VIOLATION ${v.code} ${v.vp} ${v.page}: ${v.detail}`);
    if (r.missing.length) console.log("MISSING (requested, not exported): " + r.missing.join(" "));
    if (r.uncovered.length) console.log(`UNCOVERED exported pages: ${r.uncovered.length}`);
  }
  if (arg("--receipt", "")) fs.writeFileSync(arg("--receipt"), JSON.stringify({ results: r.results, missing: r.missing, uncovered: r.uncovered }, null, 1));
  const failed = viol.length > 0 || r.missing.length > 0;
  console.log(failed ? `KBFOC FAILED ${viol.length} violations, ${r.missing.length} missing pages` : `KBFOC OK ${r.results.length} page-viewport sweeps clean`);
  process.exit(failed ? 1 : 0);
}
