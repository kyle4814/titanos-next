// Tests for render_spy.mjs on PLANTED FIXTURE pages (synthetic, localhost only). Both planted evasions must be caught:
//  - model-host.html builds https://api.anthropic.com/... from string parts at runtime (static gate cannot see it)
//  - mailto-late.html injects a mailto into the DOM after load (static mailto sweep cannot see it)
// A mutation run (host list emptied in a temp copy) must make the model-host check FAIL. SKIPs, labelled, without chromium.
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { spawnSync } from "node:child_process";
import { spy, isModelHost, MODEL_HOSTS } from "./render_spy.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

// pure checks
ok(isModelHost("api.anthropic.com") && isModelHost("api.openai.com") && !isModelHost("cloudflare-dns.com") && !isModelHost("notanthropic.com"), "isModelHost: suffix match, no substring false positive");
ok(MODEL_HOSTS.length >= 10, "model host list populated");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "renderspy-"));
if (!root.startsWith(os.tmpdir())) throw new Error("bad tmp");
const page = (body) => `<!doctype html><html><body><main>${body}</main></body></html>`;
fs.writeFileSync(path.join(root, "clean.html"), page(`<a href="mailto:static@example.test">static</a><p>clean</p>`));
fs.writeFileSync(path.join(root, "model-host.html"), page(`<script>
  const h = ["api", "anth" + "ropic", "com"].join("."); fetch("https://" + h + "/v1/messages", { method: "POST", body: "{}" }).catch(() => {});
</script>`));
fs.writeFileSync(path.join(root, "mailto-late.html"), page(`<script>
  setTimeout(() => { const a = document.createElement("a"); a.href = "mail" + "to:" + "sales" + "@example.test?subject=late"; a.textContent = "order"; document.body.appendChild(a); }, 150);
</script>`));
fs.writeFileSync(path.join(root, "mailto-flash.html"), page(`<script>
  const a = document.createElement("a"); a.setAttribute("href", "mailto:flash@example.test"); document.body.appendChild(a); setTimeout(() => a.remove(), 50);
</script>`));
fs.writeFileSync(path.join(root, "scan.html"), page(`<form onsubmit="event.preventDefault(); fetch('https://cloudflare-dns.com/dns-query?name=x&type=TXT').then(()=>{document.getElementById('instant').textContent='grade F'})"><input aria-label="Your domain"><button>Check now</button></form><div id="instant"></div>`));

const pages = ["/clean", "/model-host", "/mailto-late", "/mailto-flash", "/scan"];
const r = await spy({ root, pages, scanDomain: "bare.example" });
if (r.skipped) { console.log("SKIP test_render_spy (labelled, not a pass): " + r.skipped); fs.rmSync(root, { recursive: true }); process.exit(0); }
const by = Object.fromEntries(r.pages.map((p) => [p.page, p]));
ok(by["/clean"].mailtos.length === 1 && by["/clean"].runtimeOnly.length === 0 && by["/clean"].hosts.join() === "127.0.0.1", "clean page: static mailto is not runtime-only, only localhost contacted");
ok(by["/model-host"].hosts.includes("api.anthropic.com"), "string-built model host request CAUGHT in page hosts");
ok(r.modelHosts.includes("api.anthropic.com") && r.modelHosts.length === 1, "modelHosts lists exactly api.anthropic.com");
ok(by["/mailto-late"].runtimeOnly.includes("mailto:sales@example.test?subject=late"), "mailto injected after load CAUGHT as runtime-only");
ok(by["/mailto-flash"].runtimeOnly.includes("mailto:flash@example.test") && by["/mailto-flash"].mailtos.length === 1, "mailto added then removed CAUGHT by the MutationObserver");
ok(r.scan && r.scan.ran && r.scan.resultShown && r.scan.dnsCalls >= 1, "guest scan flow ran on the synthetic domain; DoH answered by the fixture");
ok(r.hosts.has("cloudflare-dns.com"), "DoH host appears in the host set");

// CLI exit codes
const cli = (dir, pgs) => spawnSync(process.execPath, [path.join(here, "render_spy.mjs"), "--out", dir, "--pages", pgs], { encoding: "utf8", env: process.env });
const c1 = cli(root, "/model-host"); ok(c1.status === 1 && /MODEL HOST CONTACTED: api\.anthropic\.com/.test(c1.stdout), "CLI exits 1 and names the model host");
const c2 = cli(root, "/clean"); ok(c2.status === 0 && /NO MODEL HOST CONTACTED/.test(c2.stdout), "CLI exits 0 on the clean page");
const c3 = cli(path.join(root, "nope"), "/clean"); ok(c3.status === 0 && /^SKIP render_spy: no built tree/.test(c3.stdout), "CLI labelled SKIP when out/ missing");

// MUTATION: empty the model host list in a temp copy; the caught-model-host check must now fail
if (!process.env.RENDER_SPY_MUTANT) {
  const mut = path.join(here, "_render_spy_mutant.mjs"), mt = path.join(here, "_test_render_spy_mutant.mjs");
  try {
    fs.writeFileSync(mut, fs.readFileSync(path.join(here, "render_spy.mjs"), "utf8").replace(/export const MODEL_HOSTS = \[[^\]]*\];/, "export const MODEL_HOSTS = [];"));
    fs.writeFileSync(mt, fs.readFileSync(fileURLToPath(import.meta.url), "utf8").replace('"./render_spy.mjs"', '"./_render_spy_mutant.mjs"'));
    const m = spawnSync(process.execPath, [mt], { encoding: "utf8", env: { ...process.env, RENDER_SPY_MUTANT: "1" } });
    ok(m.status !== 0 && /FAIL modelHosts lists exactly/.test(m.stdout), "MUTATION (model host list emptied) makes the test FAIL");
  } finally { fs.rmSync(mut, { force: true }); fs.rmSync(mt, { force: true }); }
}
fs.rmSync(root, { recursive: true });
if (fail) { console.log(`FAIL test_render_spy (${fail})`); process.exit(1); }
console.log("PASS test_render_spy");
