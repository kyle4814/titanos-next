// Test for scripts/headers_lint.mjs: a passing and a failing fixture per rule, plus a rule-disabling mutant per
// rule that the fixture suite must catch. Fully offline, synthetic fixtures only. Run via `npm test`.
import { lintHeaders, RULES, extractCsp, extractResponses } from "./headers_lint.mjs";

const CSP_OK = `const CSP =
  "default-src 'self'; " +
  // a comment between pieces
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; " +
  "frame-ancestors 'none'";
export default function L(){ return <head><meta httpEquiv="Content-Security-Policy" content={CSP} /><meta name="referrer" content="strict-origin-when-cross-origin" /></head>; }`;
const HDR_OK = "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n";
const ALL = `"content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-frame-options": "DENY", "strict-transport-security": "max-age=31536000"`;
const worker = (hdr, extra = "") => `function json(b){ return new Response(JSON.stringify(b), { status: 200, headers: { ${hdr} } }); }\n${extra}`;
const base = () => ({
  layout: { file: "app/layout.tsx", text: CSP_OK },
  nextConfig: { file: "next.config.ts", text: 'const c = { output: "export" }; export default c;' },
  headersFile: { file: "public/_headers", text: HDR_OK },
  workerFiles: [{ file: "portal-api/src/index.ts", text: worker(ALL, 'function cors(res, env){ res.headers.set("access-control-allow-origin", env.SITE); return res; }') }],
});
const dropHdr = (h) => ALL.split(", ").filter((p) => !p.startsWith(`"${h}"`)).join(", ");

// each case: rule, name, mutate(sources) -> failing sources, expect severity
const CASES = [
  ["H1", "CSP missing", (s) => { s.layout.text = "export default function L(){return null}"; }],
  ["H1", "CSP has unsafe-eval", (s) => { s.layout.text = s.layout.text.replace("'self' 'unsafe-inline'", "'self' 'unsafe-eval'"); }],
  ["H1", "CSP script-src wildcard", (s) => { s.layout.text = s.layout.text.replace("'self' 'unsafe-inline' https://static.cloudflareinsights.com", "*"); }],
  ["H1", "CSP script-src scheme-only https:", (s) => { s.layout.text = s.layout.text.replace("https://static.cloudflareinsights.com", "https:"); }],
  ["H1", "CSP falls back to wildcard default-src", (s) => { s.layout.text = 'const CSP = "default-src *";'; }],
  ["H2", "Worker lacks nosniff", (s) => { s.workerFiles[0].text = worker(dropHdr("x-content-type-options")); }],
  ["H2", "site nosniff not in repo (unverifiable)", (s) => { s.headersFile = null; }, "unverifiable"],
  ["H3", "Worker lacks referrer-policy", (s) => { s.workerFiles[0].text = worker(dropHdr("referrer-policy")); }],
  ["H3", "site has no referrer meta or header", (s) => { s.headersFile = null; s.layout.text = s.layout.text.replace(/<meta name="referrer"[^>]*>/, ""); }],
  ["H4", "Worker lacks frame protection", (s) => { s.workerFiles[0].text = worker(dropHdr("x-frame-options")); }],
  ["H4", "site frame protection edge-only (unverifiable)", (s) => { s.headersFile = null; }, "unverifiable"],
  ["H5", "Worker JSON lacks HSTS", (s) => { s.workerFiles[0].text = worker(dropHdr("strict-transport-security")); }],
  ["H6", 'ACAO "*" via headers.set', (s) => { s.workerFiles[0].text += '\nfunction c2(r){ r.headers.set("access-control-allow-origin", "*"); }'; }],
  ["H6", "ACAO reflects request Origin", (s) => { s.workerFiles[0].text += '\nfunction c3(req, r){ r.headers.set("access-control-allow-origin", req.headers.get("origin")); }'; }],
  ["H6", 'ACAO "*" in a response literal', (s) => { s.workerFiles[0].text = worker(ALL + ', "access-control-allow-origin": "*"'); }],
  ["H6", 'ACAO "*" in _headers', (s) => { s.headersFile.text += "  Access-Control-Allow-Origin: *\n"; }],
  ["H7", "Worker response lacks cache-control", (s) => { s.workerFiles[0].text = worker(dropHdr("cache-control")); }],
  ["H7", "Worker cache-control is public", (s) => { s.workerFiles[0].text = worker(ALL.replace("no-store", "public, max-age=60")); }],
  ["H7", "key route response with no headers at all", (s) => { s.workerFiles[0].text += '\nfunction k(){ return new Response("sk_synthetic_not_a_key"); }'; }],
  ["H8", "headers() under output export", (s) => { s.nextConfig.text = 'const c = { output: "export", async headers() { return []; } }; export default c;'; }],
];

const clone = (o) => JSON.parse(JSON.stringify(o));

// returns a list of harness failures for the given rule table (empty = the suite is satisfied)
export function runSuite(rules) {
  const bad = [];
  const clean = lintHeaders(base(), { rules }).filter((f) => f.severity !== "info");
  if (clean.length) bad.push(`passing baseline produced findings: ${clean.map((f) => f.rule + ":" + f.msg).join(" | ")}`);
  for (const [rule, name, mut, sev = "fail"] of CASES) {
    const s = clone(base()); mut(s);
    const hits = lintHeaders(s, { rules }).filter((f) => f.rule === rule && f.severity === sev);
    if (!hits.length) bad.push(`${rule} missed: ${name}`);
  }
  return bad;
}

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log(`FAIL ${m}`); } else console.log(`PASS ${m}`); };

// 1. real rules: the baseline is clean and every failing fixture is caught
const real = runSuite(RULES);
ok(real.length === 0, "fixtures: baseline clean and all " + CASES.length + " failing cases caught" + (real.length ? " :: " + real.join("; ") : ""));

// 2. per-rule: baseline emits nothing for that rule, and a failing fixture does
for (const id of Object.keys(RULES)) {
  ok(lintHeaders(base()).filter((f) => f.rule === id && f.severity !== "info").length === 0, `${id} passes its good fixture`);
  ok(CASES.some(([r]) => r === id), `${id} has at least one failing fixture`);
}

// 3. mutants: neuter each rule, the suite MUST notice (a lint whose rules can be silently disabled is worthless)
for (const id of Object.keys(RULES)) {
  const mutant = { ...RULES, [id]: () => [] };
  const caught = runSuite(mutant).some((b) => b.startsWith(id + " missed"));
  ok(caught, `mutant: rule ${id} disabled is caught by the suite`);
  const viaOpt = lintHeaders((() => { const s = clone(base()); CASES.find(([r]) => r === id)[2](s); return s; })(), { disable: [id] }).filter((f) => f.rule === id && f.severity === "fail").length === 0;
  ok(viaOpt, `opts.disable silences ${id}`);
}

// 4. extraction facts
const c = extractCsp(CSP_OK);
ok(c && c.value.includes("default-src 'self'; script-src 'self'") && !c.value.includes("comment"), "extractCsp joins literals and skips comments");
const r = extractResponses("f.ts", worker(ALL) + '\nconst a = new Response(null, { status: 204 });');
ok(r.length === 2 && r[0].json && r[0].hasBody && !r[1].hasBody && r[0].names.has("cache-control"), "extractResponses reads header names, JSON and null-body");

// 5. the real tree today: scanning with no portal-api finds the site only (does not crash on missing surfaces)
ok(lintHeaders({}).every((f) => f.severity !== "fail"), "empty sources: no crash, no false failure");

console.log(fail ? `\ntest_headers_lint: ${fail} FAILED` : "\ntest_headers_lint: all passed");
process.exit(fail ? 1 : 0);
