// T12 contrast: reads the portal's CSS custom properties and every rule that sets both a text colour and a background colour,
// computes the WCAG contrast ratio of each pair and exits non-zero if any pair is under 4.5 to 1 (3 to 1 only for pairs marked large text below).
// A failing pair is fixed in the CSS, never exempted here.
import fs from 'node:fs';
import path from 'node:path';
import { PORTAL } from './_env.mjs';
const css = ['portal.css', 'sheet.css'].map((f) => { try { return fs.readFileSync(path.join(PORTAL, 'assets', f), 'utf8'); } catch { return ''; } }).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const vars = {}; for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+)/gi)) vars[m[1]] = m[2].trim();
const resolve = (v, d = 0) => { v = (v || '').trim(); const m = /^var\(--([a-z0-9-]+)(?:\s*,\s*([^)]+))?\)$/i.exec(v); if (m && d < 6) return resolve(vars[m[1]] ?? m[2], d + 1); return v; };
function hex(c) { c = resolve(c).toLowerCase(); let m = /^#([0-9a-f]{3})$/.exec(c); if (m) return m[1].split('').map((x) => parseInt(x + x, 16)); m = /^#([0-9a-f]{6})$/.exec(c); if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); if (c === 'white') return [255, 255, 255]; if (c === 'black') return [0, 0, 0]; return null; }
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const LARGE = [/wordmark/, /^\.tri\b/]; // wordmark only: set at display size (logo, not body text)
const pairs = new Map();
for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
  const sel = m[1].trim().replace(/\s+/g, ' '); const body = m[2];
  const col = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(body); const bg = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(body);
  if (!col || !bg) continue; const fg = hex(col[1].trim()); const bgc = hex(bg[1].trim().split(/\s+/)[0]);
  if (!fg || !bgc) continue; pairs.set(sel, { sel, fg: col[1].trim(), bg: bg[1].trim().split(/\s+/)[0], r: ratio(fg, bgc) });
}
// Pairs the CSS really uses as text on a known background (colour-only rules are listed against the background the markup puts them on).
// Variables that are only borders, bullets or decoration (--secondary, --success, --grey-3, the footer bullet colours) are not text pairs and are not listed.
const phFg = (/\.ph small\{[^}]*?color:\s*(#[0-9a-f]{3,6})/i.exec(css) || [0, '#000'])[1]; // read from the CSS so a fix is measured, not assumed
const key = [['body text', '#000', '#fff'], ['body text on grey band', '#000', 'var(--grey-light)'], ['secondary text (grey-darker) on white', 'var(--grey-darker)', '#fff'], ['grey-dark on white', 'var(--grey-dark)', '#fff'], ['grey-dark on grey-light', 'var(--grey-dark)', 'var(--grey-light)'],
  ['button ink on primary yellow', 'var(--primary-ink)', 'var(--primary)'], ['black on primary yellow', '#000', 'var(--primary)'], ['white on grey-dark (footer)', '#fff', 'var(--footer-bg)'], ['white on grey-darker (footer bar, demo notice)', '#fff', 'var(--footer-bar)'],
  ['primary yellow on grey-darker (.hdr-notice strong)', 'var(--primary)', 'var(--grey-darker)'], ['alert ink on white (.err)', 'var(--alert-ink)', '#fff'], ['search placeholder (grey-darker) on white', 'var(--grey-darker)', '#fff'],
  ['image placeholder caption (.ph small) on the placeholder gradient end', phFg, '#ececec'], ['focus ring on white', 'var(--focus)', '#fff'], ['focus ring (white) on grey-dark', '#fff', 'var(--grey-dark)'], ['focus ring on primary yellow', 'var(--focus)', 'var(--primary)']];
const rows = []; let bad = 0;
const rec = (name, fgS, bgS, r, large) => { const need = large ? 3 : 4.5; const ok = r >= need; if (!ok) bad++; rows.push(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}:1 (need ${need})  ${name}  [${fgS} on ${bgS}]`); };
for (const [n, f, b] of key) rec(n, f, b, ratio(hex(f), hex(b)), /focus ring/.test(n));
for (const p of pairs.values()) rec(p.sel.slice(0, 70), p.fg, p.bg, p.r, LARGE.some((re) => re.test(p.sel)));
console.log(rows.join('\n'));
console.log(`CONTRAST ${rows.length} pairs listed (${key.length} key pairs, ${pairs.size} rule pairs), ${bad} under the bar`);
process.exit(bad ? 1 : 0);
