// Screenshots of our own products from a LOCAL run: the real worker code, the real course files, a fake KV and a
// stand-in model (no model is attached locally, so every AI reply on screen is stand-in text).
// Usage: node scripts/shoot_own_apps.mjs <felicia|pala> <outDir>
// Env: FELICIA_DIR (default ~/felicia-sanctum), PALA_DIR (default ~/pala-garden). Prints a JSON summary of what it saw.
import { register } from "node:module";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { chromium } from "playwright";

const APP = process.argv[2];
const OUT = path.resolve(process.argv[3] || "shots");
const DIRS = {
  felicia: process.env.FELICIA_DIR || path.join(os.homedir(), "felicia-sanctum"),
  pala: process.env.PALA_DIR || path.join(os.homedir(), "pala-garden"),
};
if (!DIRS[APP]) { console.error("usage: shoot_own_apps.mjs <felicia|pala> <outDir>"); process.exit(2); }
const DIR = DIRS[APP];
mkdirSync(OUT, { recursive: true });

// Serve the real html and manifest text; stub only the png imports.
const hook = `import { readFileSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
export async function load(url, ctx, next){ if(/\\.(html|webmanifest)$/.test(url)) return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(readFileSync(fileURLToPath(url),'utf8'))}; if(/\\.png$/.test(url)) return {format:'module',shortCircuit:true,source:'export default "x"'}; return next(url, ctx); }`;
register("data:text/javascript," + encodeURIComponent(hook));
const W = (await import(pathToFileURL(path.join(DIR, "src/worker.js")))).default;
const SIGN = APP === "felicia"
  ? (await import(pathToFileURL(path.join(DIR, "src/auth.js")))).signSession
  : (await import(pathToFileURL(path.join(DIR, "src/logic.js")))).signSession;
const COOKIE = APP === "felicia" ? "fs" : "pg";
const COURSE = path.join(DIR, "course") + "/";

// Workers globals the local run does not have; outside fetches (price feeds) are refused so nothing leaves the machine.
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
const realFetch = globalThis.fetch;
globalThis.fetch = (u, ...a) => (String(u?.url ?? u).startsWith("http://127.0.0.1") ? realFetch(u, ...a) : Promise.reject(new Error("offline local run")));
const store = new Map();
const KV = {
  get: async (k, t) => { const v = store.get(k); return v == null ? null : (t === "json" ? JSON.parse(v) : v); },
  put: async (k, v) => { store.set(k, String(v)); },
  delete: async (k) => { store.delete(k); },
};
const ASSETS = { fetch: async (u) => { const f = path.join(COURSE, new URL(u).pathname); return existsSync(f) ? new Response(readFileSync(f)) : new Response("", { status: 404 }); } };
const REPLIES = {
  tutor: "Front-loading means you name the worries before the buyer has to. Say who you are, why you are calling, how you found them, and what you will not do, then ask permission to go on. See the lessons below for the exact script.",
  roleplay: "Hmm, okay. I am busy, but go on. What exactly would this cost me, and who else has done it?",
  score: "SCORE: 4 out of 5. You named my concern before I raised it, and you asked permission to continue. Next time, give one plain number early.",
  build: "A good first prompt names the goal, the person it is for and one thing it must not do. Try that, then read what comes back before you change anything. See the lessons below.",
  tip: "Slow down by a beat before your close; the pause makes you sound sure.",
};
let rpN = 0;
const RP2 = "Fair enough. A fixed price and a free example is more than most people offer me. Send it over and I will have a look.";
const AI = {
  async run(model, opts) {
    if (String(model).includes("whisper")) return { text: "I help small businesses get hours back each week. Nobody is replaced. Would it be okay if I showed you a one page example?" };
    const last = (opts.messages || []).map((m) => String(m.content)).join(" ").toLowerCase();
    if (APP === "felicia" && !opts.stream && /filler|pace|wpm/.test(last)) return { response: REPLIES.tip };
    const reply = /score/.test(last) && /out of|score me|^score/.test(last) ? REPLIES.score : APP === "pala" ? REPLIES.build : /prospect/.test(last) ? (rpN++ % 2 ? RP2 : REPLIES.roleplay) : REPLIES.tutor;
    if (opts.stream) return new ReadableStream({ start: (c) => { c.enqueue(new TextEncoder().encode("data: " + JSON.stringify({ response: reply }) + "\n\ndata: [DONE]\n\n")); c.close(); } });
    return { response: opts.max_tokens && opts.max_tokens < 120 ? REPLIES.tip : reply };
  },
};
const env = { KV, ASSETS, AI, SESSION_KEY: "local-run-key" };
const tok = await SIGN(env.SESSION_KEY, Math.floor(Date.now() / 1000) + 3600, 0);

const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await W.fetch(new Request(`http://127.0.0.1:${server.address().port}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }), env, { waitUntil() {} });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) Readable.fromWeb(r.body).pipe(res); else res.end();
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

// Seed progress through the real API so locks, XP and the path show a believable state.
const call = (p, b) => W.fetch(new Request(BASE + p, { method: b === undefined ? "GET" : "POST", headers: { cookie: `${COOKIE}=${tok}`, "content-type": "application/json", origin: BASE }, body: b === undefined ? undefined : JSON.stringify(b) }), env, { waitUntil() {} });
const TRACK = APP === "pala" ? "&track=build" : "";
const lessonPath = (id) => path.join(COURSE, APP === "pala" ? "tracks/build/lessons" : "lessons", id.split("-")[0], id + ".json");
let firstMod, lessonIds, openId, outline;
const seen = { app: APP, seeded: 0, consoleErrors: [], shots: [] };
async function seed() {
  store.clear();
  outline = await (await call("/api/course" + (TRACK ? "?" + TRACK.slice(1) : ""))).json();
  firstMod = outline.modules[0];
  lessonIds = firstMod.lessons.map((l) => l.id);
  const n = Math.min(5, lessonIds.length - 1);
  for (let i = 0; i < n; i++) {
    const full = JSON.parse(readFileSync(lessonPath(lessonIds[i]), "utf8"));
    const r = await call("/api/course/submit", { lesson: lessonIds[i], answers: full.quiz.map((q) => q.answer), ...(APP === "pala" ? { track: "build" } : {}) });
    if (!r.ok) throw new Error("seed failed " + lessonIds[i] + " " + r.status);
  }
  openId = lessonIds[n];
  Object.assign(seen, { total: outline.total, modules: outline.modules.length, seeded: n, openId });
}

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const SIZES = [["390", { width: 390, height: 844 }, true], ["1440", { width: 1440, height: 900 }, false]];
const settle = (p, ms = 700) => p.waitForTimeout(ms);

async function shootFelicia(page, w, shot) {
  await page.goto(BASE + "/#/");
  await page.waitForSelector(".row", { timeout: 8000 });
  await shot("path", { full: false });
  await page.goto(BASE + "/#/lesson/" + openId); await page.waitForSelector(".md", { timeout: 8000 }); await settle(page);
  await shot("lesson", { full: false });
  const opts = page.locator("#quiz .q");
  const n = await opts.count();
  const full = JSON.parse(readFileSync(lessonPath(openId), "utf8"));
  for (let i = 0; i < n; i++) await opts.nth(i).locator(".opt").nth(full.quiz[i].answer).click();
  await page.locator("#sub").scrollIntoViewIfNeeded(); await page.locator("#sub").click(); await settle(page, 900);
  await shot("quiz", { focus: "#quiz" });
  await page.goto(BASE + "/#/coach"); await page.waitForSelector("#ti", { timeout: 8000 });
  await page.fill("#ti", "How do I front-load concerns?"); await page.press("#ti", "Enter"); await page.waitForSelector(".bub.ai:not(:has-text('...'))", { timeout: 8000 }); await settle(page, 900);
  await shot("tutor", { full: false });
  await page.click('.modes button[data-m="roleplay"]'); await page.waitForSelector(".bub", { timeout: 8000 });
  await page.fill("#ti", "Hi, thanks for taking my call. Before anything else, I only use public information and I will not touch your systems. Would it be okay if I took two minutes?");
  await page.press("#ti", "Enter"); await settle(page, 1200);
  await page.fill("#ti", "Fair question. The price is fixed up front and you can say no at any point. Would it be okay if I sent you a one page example first?");
  await page.press("#ti", "Enter"); await settle(page, 1200);
  await page.click("#sc"); await settle(page, 1500);
  await shot("roleplay", { full: false });
  await page.click('.modes button[data-m="speech"]'); await page.waitForSelector("#rc", { timeout: 8000 }); await settle(page);
  // Headless has no real microphone: a stand-in recorder hands the real endpoint a 4 KB blob after a real 9 s wait.
  await page.evaluate(() => {
    window.MediaRecorder = class { constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; } static isTypeSupported() { return true; } start() { this.state = "recording"; } stop() { this.state = "inactive"; this.ondataavailable({ data: new Blob([new Uint8Array(4000)], { type: "audio/webm" }) }); setTimeout(() => this.onstop(), 0); } };
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [] });
  });
  await page.click("#rc"); await settle(page, 9000); await page.click("#rc", { force: true }); await settle(page, 2500);
  seen.speechStatus = await page.locator("#rs").innerText();
  await shot("speech", { full: false });
}

async function shootPala(page, w, shot) {
  await page.goto(BASE + "/");
  await page.waitForFunction(() => typeof course === "function", null, { timeout: 8000 });
  await page.evaluate(() => course("build")); await page.waitForSelector("#co_tk", { timeout: 8000 }); await settle(page);
  await shot("tracks", { full: false });
  await page.evaluate((m) => comod(m), firstMod.id); await settle(page);
  await shot("module", { full: false });
  await page.evaluate(([id, m]) => colesson(id, m), [openId, firstMod.id]); await page.waitForSelector("#co_try, .h", { timeout: 8000 }); await settle(page);
  await shot("lesson", { full: false });
  await page.evaluate(() => document.getElementById("actour")?.remove());
  const full = JSON.parse(readFileSync(lessonPath(openId), "utf8"));
  for (let i = 0; i < full.quiz.length; i++) await page.locator(`input[name="cq${i}"][value="${full.quiz[i].answer}"]`).check();
  const sub = page.locator("button", { hasText: /check|submit|score/i }).last();
  await sub.scrollIntoViewIfNeeded(); await sub.click(); await settle(page, 1000);
  await shot("quiz", { full: false, bottom: true });
  await page.evaluate(() => petalOpen()); await settle(page);
  await page.fill("#ps_q", "How do I write my first prompt?"); await page.press("#ps_q", "Enter"); await settle(page, 2000);
  await shot("coach", { full: false });
}

for (const [label, vp, mobile] of SIZES) {
  await seed();
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, permissions: ["microphone"], reducedMotion: "reduce" });
  const page = await ctx.newPage();
  let loggedIn = false;
  page.on("console", (m) => { if (m.type() === "error" && (loggedIn || !/401/.test(m.text())) && !(APP === "pala" && /502/.test(m.text()))) seen.consoleErrors.push(`${label}: ${m.text().slice(0, 160)}`); });
  page.on("pageerror", (e) => seen.consoleErrors.push(`${label}: pageerror ${String(e).slice(0, 160)}`));
  const shot = async (name, o = {}) => {
    await page.evaluate(() => document.getElementById("actour")?.remove());
    if (o.focus) await page.locator(o.focus).scrollIntoViewIfNeeded().catch(() => {});
    if (o.bottom) await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const file = `${name}-${label}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    seen.shots.push({ file, overflowPx: ov });
  };
  if (APP === "felicia") {
    await page.goto(BASE + "/"); await page.waitForSelector("#pw", { timeout: 8000 }); await settle(page);
    await shot("login");
  }
  loggedIn = true;
  await ctx.addCookies([{ name: COOKIE, value: tok, url: BASE }]);
  await (APP === "felicia" ? shootFelicia : shootPala)(page, label, shot);
  await ctx.close();
}
await browser.close();
server.close();
console.log(JSON.stringify(seen, null, 1));
process.exit(seen.consoleErrors.length ? 3 : 0);
