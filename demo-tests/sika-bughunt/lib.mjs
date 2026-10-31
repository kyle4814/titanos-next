// Shared helpers for the simulated-user suite: a seeded PRNG, the browser launcher (Windows Chrome via playwright-core),
// and a "Sim" that wraps one page with listeners and a health check run after every journey step.
import fs from 'node:fs';

const WIN = process.platform === 'win32';
export const PW = process.env.PLAYWRIGHT_CORE || (WIN ? 'file://wsl.localhost/Ubuntu' : '') + '/home/tech2/titanos_launch/titanos-next/node_modules/playwright-core/index.mjs';
export const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function sample(r, arr, n) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }

export async function launch() { const { chromium } = await import(PW); return chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-gpu', '--hide-scrollbars'] }); }

export class Findings {
  constructor() { this.list = []; this.seen = new Set(); this.steps = 0; this.stepLog = []; }
  add(f) { const key = [f.kind, f.route || '', f.detail.replace(/[0-9]+/g, '#').slice(0, 120)].join('|'); if (this.seen.has(key)) { const e = this.list.find((x) => x.key === key); e.count++; if (e.sizes && !e.sizes.includes(f.size)) e.sizes.push(f.size); return; } this.seen.add(key); this.list.push({ ...f, key, count: 1, sizes: [f.size] }); }
}

/** One simulated user on one page. step(name, fn) runs fn, waits for the router to settle, times it, and health-checks the page. */
export class Sim {
  constructor(browser, base, size, persona, findings, outDir, opts = {}) { Object.assign(this, { browser, base, size, persona, F: findings, outDir, opts }); this.console = []; this.failed = []; this.external = []; this.routeNow = ''; }
  async init() {
    const [W, H] = this.size.split('x').map(Number); this.W = W; this.H = H; this.phone = W < 800;
    this.ctx = await this.browser.newContext({ viewport: { width: W, height: H }, hasTouch: this.phone, isMobile: W < 600, acceptDownloads: true, reducedMotion: 'reduce', ...(this.opts.ctx || {}) });
    this.ctx.setDefaultTimeout(15000); this.ctx.setDefaultNavigationTimeout(40000);
    this.page = await this.ctx.newPage(); const p = this.page; const ev0 = p.evaluate.bind(p); p.evaluate = (f, a) => Promise.race([ev0(f, a), new Promise((_, rj) => setTimeout(() => rj(new Error('evaluate hung 20 s: the page is frozen')), 20000))]); const host = new URL(this.base).host; this.host = host;
    p.on('console', (m) => { if (!['error', 'warning'].includes(m.type())) return; const u = m.location()?.url || ''; if (u && !u.includes(host) && !u.startsWith('data:')) return; this.console.push(m.type() + ': ' + m.text().slice(0, 220)); });
    p.on('pageerror', (e) => this.console.push('pageerror: ' + e.message.slice(0, 220)));
    p.on('response', (r) => { try { if (new URL(r.url()).host === host && r.status() >= 400) this.failed.push(r.status() + ' ' + r.url().replace(this.base, '')); } catch {} });
    p.on('requestfailed', (r) => { try { if (new URL(r.url()).host === host && !/net::ERR_ABORTED/.test(r.failure()?.errorText || '')) this.failed.push('FAILED ' + r.url().replace(this.base, '')); } catch {} });
    if (!this.opts.noRoute) await this.ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.host === host || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue(); this.external.push(u.href.slice(0, 100)); return route.abort(); });
    return this;
  }
  note(sev, kind, detail, extra = {}) { this.F.add({ sev, kind, size: this.size, persona: this.persona, step: this.stepName || '', route: this.routeNow, detail: String(detail).slice(0, 400), ...extra }); }
  async settle() { await this.page.waitForFunction(() => !!document.querySelector('main') && !document.querySelector('main[aria-busy], main [aria-busy="true"]') && !/Loading the product portal/.test(document.querySelector('main').innerText), null, { timeout: 20000 }).catch(() => this.note('P1', 'never-settles', 'main stays aria-busy or missing for 20 s')); }
  async shot(tag) { try { fs.mkdirSync(this.outDir, { recursive: true }); const f = `${this.size}_${this.persona}_${tag}`.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.png'; await this.page.screenshot({ path: this.outDir + '/' + f }); return f; } catch { return ''; } }
  async step(name, fn, { slowOk = false, expectRoute } = {}) {
    this.stepName = name; this.F.steps++; if (process.env.BH_VERBOSE) console.log('STEP', this.size, this.persona, name.slice(0, 60)); if (this.F.steps % 100 === 0) console.log('progress', this.F.steps, 'steps', this.size, this.persona, name.slice(0, 40)); const t0 = Date.now();
    try { await fn(this.page, this); } catch (e) { if (process.env.BH_VERBOSE) console.log('STEPFAIL', this.size, this.persona, name, e.message.split('\n')[0].slice(0, 120)); this.note('P1', 'step-failed', `${name}: ${e.message.split('\n')[0]}`); await this.shot('fail_' + this.F.steps); }
    await this.page.waitForTimeout(40).catch(() => {}); await this.settle(); const ms = Date.now() - t0; this.F.stepLog.push({ size: this.size, persona: this.persona, name, ms });
    this.routeNow = await this.page.evaluate(() => location.hash.split('?')[0]).catch(() => '');
    if (expectRoute && !expectRoute.test(this.routeNow)) this.note('P1', 'wrong-route', `after "${name}" expected ${expectRoute} got ${this.routeNow}`);
    if (ms > 300 && !slowOk) this.F.stepLog[this.F.stepLog.length - 1].slow = true;
    await this.health(name);
  }
  async health(name) {
    const p = this.page; const c = this.console.splice(0); const f = this.failed.splice(0);
    for (const m of c) { if (this.expect404 && /404 \(Not Found\)/.test(m)) continue; this.note('P1', 'console', m); }
    for (const m of f) { if (this.expect404 && /^404 /.test(m)) continue; this.note(/\.(pdf|png|jpg|svg)$/i.test(m) ? 'P2' : 'P1', 'failed-request', m); }
    const h = await p.evaluate(() => {
      const out = {}; const de = document.documentElement; out.over = de.scrollWidth - de.clientWidth;
      if (out.over > 1) { const bad = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > de.clientWidth + 1 && r.width > 0 && getComputedStyle(e).position !== 'fixed' && !e.closest('[hidden],.visually-hidden,.skip-link'); }).slice(0, 3); out.overEls = bad.map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0] + ' right=' + Math.round(e.getBoundingClientRect().right)); }
      const m = document.querySelector('main'); const t = m ? m.innerText : ''; out.len = t.length; out.h1 = document.querySelectorAll('h1').length;
      out.bad = (t.match(/\bundefined\b|\bNaN\b|\[object |\bInfinity\b|\{\{|%s|\bnull\b/g) || []).slice(0, 3);
      out.imgs = [...document.images].filter((i) => i.offsetParent && i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src.slice(-60)).slice(0, 3);
      const ids = {}; document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; }); out.dupIds = Object.keys(ids).filter((k) => ids[k] > 1 && !/^i-/.test(k)).slice(0, 4);
      out.noName = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select')].filter((e) => e.offsetParent && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[aria-hidden=true], [inert], .assistant:not(.open)') && !(e.textContent || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.getAttribute('title') && !(e.labels && e.labels.length) && !e.querySelector('img[alt]:not([alt=""])') && !e.getAttribute('placeholder')).map((e) => e.outerHTML.slice(0, 90)).slice(0, 3);
      out.hash = location.hash; out.title = document.title;
      if (innerWidth < 800) out.small = [...document.querySelectorAll('main a[href],main button,main input:not([type=hidden]),main select')].filter((e) => { if (!e.offsetParent || e.closest('[hidden],.visually-hidden')) return false; const r = e.getBoundingClientRect(); if (r.width === 0 || (e.tagName === 'A' && getComputedStyle(e).display === 'inline')) return false; return r.height < 24 || r.width < 24; }).map((e) => e.tagName + ':' + (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 20) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 3);
      return out;
    }).catch((e) => ({ err: e.message }));
    if (h.err) return this.note('P2', 'health-eval-failed', h.err);
    if (h.over > 1) { this.note('P2', 'horizontal-overflow', `${h.over}px wider than viewport; ${(h.overEls || []).join(', ')}`); await this.shot('overflow'); }
    if (h.len < 30) { this.note('P1', 'empty-main', `main has ${h.len} chars`); await this.shot('empty'); }
    if (h.h1 !== 1) this.note('P3', 'h1-count', `${h.h1} h1 elements`);
    if (h.bad.length) { this.note('P1', 'bad-token-in-text', h.bad.join(', ')); await this.shot('badtoken'); }
    if (h.imgs.length) this.note('P2', 'broken-image', h.imgs.join(', '));
    if (h.dupIds.length) this.note('P2', 'duplicate-id', h.dupIds.join(', '));
    if (h.noName.length) this.note('P2', 'control-without-name', h.noName.join(' | '));
    if (h.small && h.small.length) this.note('P3', 'small-touch-target', h.small.join(', '));
    if (/^undefined|\bundefined\b/.test(h.title)) this.note('P2', 'bad-title', h.title);
  }
  async close() { await this.ctx.close().catch(() => {}); }
}
