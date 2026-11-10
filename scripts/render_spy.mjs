// RENDER SPY (f180_c1): load built pages in headless chromium and report what the page actually does after hydration.
//  1. every request host (page.route intercepts ALL requests; nothing leaves localhost: DoH is answered by a synthetic
//     fixture, every other non-localhost host is recorded and aborted),
//  2. every mailto: href present after hydration, and the RUNTIME-ONLY ones (absent from the raw HTML on disk, so
//     invisible to the static mailto sweep). A MutationObserver also catches a mailto that is added then removed.
// Closes two WOULD-FLIPs: a model host built from a string at runtime evades the static gate (f75), and a mailto
// assembled in client JS after load is invisible (f82).
// Usage: node scripts/render_spy.mjs [--out out] [--json] [--scan-domain bare.example] [--pages /a,/b]
// Exit 0 clean, 1 model host contacted, 2 usage, 0 with a labelled SKIP line when chromium is absent.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

export const MODEL_HOSTS = ["anthropic.com", "claude.ai", "openai.com", "generativelanguage.googleapis.com", "aiplatform.googleapis.com", "api.mistral.ai", "mistral.ai", "cohere.com", "cohere.ai", "groq.com", "openrouter.ai", "together.xyz", "together.ai", "x.ai", "deepseek.com", "perplexity.ai", "replicate.com", "fireworks.ai", "huggingface.co", "azure.com", "bedrock-runtime.amazonaws.com"];
export const isModelHost = (h) => MODEL_HOSTS.some((m) => h === m || h.endsWith("." + m));
export const SCAN_PAGE = "/scan";
export const ORDER_PAGES = ["/order/ai", "/order/compliance", "/order/leads", "/order/monitor", "/audit", "/monitor"];
export const KEY_PAGES = ["/", "/offers", "/contact", "/products", "/engineering"];
export const DNS_HOST = "cloudflare-dns.com";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };

const resolveFile = (root, p) => {
  let f = path.join(root, p);
  if (!f.startsWith(root)) return null;
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(f + ".html") ? f + ".html" : path.join(f, "index.html");
  return fs.existsSync(f) ? f : null;
};
const rawMailtos = (root, page) => {
  const f = resolveFile(root, page); if (!f || !f.endsWith(".html")) return new Set();
  const html = fs.readFileSync(f, "utf8"); const s = new Set();
  for (const m of html.matchAll(/href=["'](mailto:[^"']*)["']/gi)) s.add(m[1].replace(/&amp;/g, "&"));
  return s;
};
const norm = (h) => h.trim();
const INIT = () => {
  window.__mailtoSeen = new Set();
  const note = (el) => { try { if (el && el.getAttribute) { const h = el.getAttribute("href"); if (h && /^mailto:/i.test(h)) window.__mailtoSeen.add(h); } if (el && el.querySelectorAll) el.querySelectorAll("a[href^='mailto:' i]").forEach((a) => window.__mailtoSeen.add(a.getAttribute("href"))); } catch {} };
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === "attributes") note(m.target); m.addedNodes.forEach(note); } })
    .observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
};

/** Run the spy. Returns { skipped?, hosts, modelHosts, pages:[{page,status,hosts,mailtos,runtimeOnly}], scan }. */
export async function spy({ root, pages, scanPage = SCAN_PAGE, scanDomain = "bare.example", settleMs = 600 }) {
  root = path.resolve(root);
  let chromium;
  // The box exports PLAYWRIGHT_BROWSERS_PATH to a cache that may lack chromium; fall back to the default cache if that one has it.
  const has = (d) => { try { return fs.readdirSync(d).some((x) => x.startsWith("chromium")); } catch { return false; } };
  const dflt = path.join(process.env.HOME || "", ".cache", "ms-playwright");
  if (!has(process.env.PLAYWRIGHT_BROWSERS_PATH || dflt) && has(dflt)) process.env.PLAYWRIGHT_BROWSERS_PATH = dflt;
  try { ({ chromium } = await import("playwright")); } catch (e) { return { skipped: "playwright not importable: " + String(e.message).split("\n")[0] }; }
  const srv = http.createServer((req, res) => {
    const f = resolveFile(root, decodeURIComponent(req.url.split("?")[0].split("#")[0]));
    if (!f) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  }).listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  let browser;
  try { browser = await chromium.launch(); } catch (e) { srv.close(); return { skipped: "chromium absent: " + String(e.message).split("\n")[0] }; }
  const allHosts = new Set(), out = { hosts: allHosts, pages: [], scan: null };
  try {
    for (const page of pages) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
      const pg = await ctx.newPage(); const hosts = new Set(); let dnsCalls = 0;
      await ctx.addInitScript(INIT);
      await ctx.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
        hosts.add(u.hostname);
        if (u.hostname === "127.0.0.1") return route.continue();
        if (u.hostname === DNS_HOST) { dnsCalls++; return route.fulfill({ status: 200, contentType: "application/dns-json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ Status: 3, Answer: [] }) }); }
        return route.abort();
      });
      pg.on("request", (r) => { try { const u = new URL(r.url()); if (/^https?:|^wss?:/.test(u.protocol)) hosts.add(u.hostname); } catch {} });
      const resp = await pg.goto(base + page, { waitUntil: "load" }).catch(() => null);
      await pg.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(settleMs);
      let scan = null;
      if (page === scanPage) {
        const input = pg.locator('input[aria-label="Your domain"]');
        if (await input.count()) {
          await input.fill(scanDomain);
          await pg.locator('button:has-text("Check now")').click();
          await pg.waitForSelector("text=grade", { timeout: 10000 }).catch(() => {});
          await pg.waitForTimeout(settleMs);
          scan = { ran: true, domain: scanDomain, dnsCalls, resultShown: (await pg.locator("#instant").textContent().catch(() => "")).includes("grade") };
        } else scan = { ran: false, reason: "no guest scan form (input[aria-label=\"Your domain\"]) on this build" };
        out.scan = scan;
      }
      const rendered = await pg.evaluate(() => {
        const live = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => /^mailto:/i.test(h));
        return { live, seen: [...(window.__mailtoSeen || [])] };
      });
      const raw = rawMailtos(root, page);
      const mailtos = [...new Set([...rendered.live, ...rendered.seen].map(norm))].sort();
      const runtimeOnly = mailtos.filter((m) => !raw.has(m));
      for (const h of hosts) allHosts.add(h);
      out.pages.push({ page, status: resp ? resp.status() : 0, hosts: [...hosts].sort(), mailtos, runtimeOnly });
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  out.modelHosts = [...allHosts].filter(isModelHost).sort();
  return out;
}

const main = async () => {
  const a = process.argv.slice(2); const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  const root = get("--out", "out");
  if (!fs.existsSync(root)) { console.log(`SKIP render_spy: no built tree at ${root} (run npm run build)`); return 0; }
  const pages = get("--pages", null)?.split(",") ?? [SCAN_PAGE, ...ORDER_PAGES, ...KEY_PAGES];
  const r = await spy({ root, pages, scanDomain: get("--scan-domain", "bare.example") });
  if (r.skipped) { console.log("SKIP render_spy (labelled, not a pass): " + r.skipped); return 0; }
  if (a.includes("--json")) console.log(JSON.stringify({ ...r, hosts: [...r.hosts].sort() }, null, 2));
  else {
    console.log("RENDER SPY (synthetic scan domain, no external network: non-localhost aborted, DoH faked)");
    console.log("page\tstatus\thosts\tmailto(after hydration)\truntime-only");
    for (const p of r.pages) console.log([p.page, p.status, p.hosts.join(",") || "-", p.mailtos.length, p.runtimeOnly.length].join("\t"));
    console.log("SCAN FLOW: " + JSON.stringify(r.scan ?? { ran: false, reason: "scan page not in list" }));
    console.log("ALL HOSTS: " + [...r.hosts].sort().join(", "));
    for (const p of r.pages.filter((p) => ORDER_PAGES.includes(p.page))) for (const m of p.runtimeOnly) console.log(`RUNTIME-ONLY MAILTO ${p.page} ${m}`);
  }
  if (r.modelHosts.length) { console.log("MODEL HOST CONTACTED: " + r.modelHosts.join(", ")); return 1; }
  console.log("NO MODEL HOST CONTACTED");
  return 0;
};
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(await main());
