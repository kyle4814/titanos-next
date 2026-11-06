// F75 C1 model-calls meter. node --experimental-strip-types scripts/test_guestscan_meter.mjs
// 1 clean scan measures 0; 2 a model-host call is counted and breaks the zero assertion;
// 3 a mutant that hardcodes 0 is caught (static and runtime); 4 static gate on the guest-path import graph.
import { readFileSync, existsSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runScan, dohFetch } from "../lib/guestscan/scan.ts";
import { RequestMeter, meteredFetch } from "../lib/guestscan/meter.ts";
import { isModelHost, isModelSdk, MODEL_HOSTS } from "../lib/modelhosts.ts";
import { FIXTURES, fakeDoh } from "../lib/guestscan/fixtures.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { fails++; console.error("FAIL " + m); } };
const json = (o) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
// A fake network: DoH answers empty NOERROR, anything else answers 200 {}.
const net = (log) => async (u) => { log.push(new URL(String(u)).host); return json({ Status: 0 }); };

// 0. host classifier
ok(isModelHost("api.anthropic.com") && isModelHost("API.OpenAI.com") && isModelHost("x.openai.azure.com") && isModelHost("bedrock-runtime.us-east-1.amazonaws.com") && isModelHost("generativelanguage.googleapis.com"), "known model hosts classified");
ok(!isModelHost("cloudflare-dns.com") && !isModelHost("dns.google") && !isModelHost("notanthropic.com") && !isModelHost("example.com") && !isModelHost("s3.amazonaws.com"), "DoH and lookalike hosts not classified as model hosts");
ok(isModelSdk("@anthropic-ai/sdk") && isModelSdk("openai") && isModelSdk("ai") && !isModelSdk("react") && !isModelSdk("airtable"), "SDK package classifier");

// 1. clean scan reports measured 0 with the real DoH wrapper over a fake network
const clean = [];
const r1 = await runScan("example.com.au", dohFetch("cloudflare-dns.com", 6000, net(clean)));
ok(r1.modelCalls === 0, "clean scan reports modelCalls 0");
ok(r1.outbound.total === 17 && clean.length === 17, `clean scan measured 17 outbound requests (meter ${r1.outbound.total}, wire ${clean.length})`);
ok(r1.outbound.hosts.join() === "cloudflare-dns.com", `clean host set = cloudflare-dns.com (${r1.outbound.hosts})`);

// 2. fixture that makes a model-host call: counted, and the zero assertion fails
{
  const wire = [], meter = new RequestMeter();
  const f = dohFetch("cloudflare-dns.com", 6000, net(wire), meter);
  const mf = meteredFetch(meter, net(wire)); // a rogue helper wired to the SAME meter, as any guest-path call must be
  const rogue = async (name, type) => { if (type === "MX") await mf("https://api.anthropic.com/v1/messages", { method: "POST" }); return f(name, type); };
  rogue.meter = meter;
  const r = await runScan("example.com.au", rogue);
  ok(r.modelCalls === 1, `model-host call counted (got ${r.modelCalls})`);
  ok(r.outbound.hosts.includes("api.anthropic.com"), "model host appears in the measured host set");
  ok(!(r.modelCalls === 0), "the zero assertion FAILS when a model host is called");
  // a second scan on the same meter measures only its own calls
  const r2 = await runScan("example.com.au", f);
  ok(r2.modelCalls === 0 && r2.outbound.hosts.join() === "cloudflare-dns.com", "per-scan delta: the next clean scan on a shared meter reads 0");
}

// 3a. mutant (static): scan.ts must not hardcode the number
const scanSrc = readFileSync(path.join(root, "lib/guestscan/scan.ts"), "utf8");
const HARD0 = /modelCalls\s*:\s*0\b/;
ok(!HARD0.test(scanSrc), "scan.ts does not hardcode modelCalls: 0");
ok(/modelCalls\s*:\s*after\.modelCalls/.test(scanSrc), "scan.ts reads modelCalls from the meter snapshot");
ok(HARD0.test(scanSrc.replace(/modelCalls\s*:\s*after\.modelCalls\s*-\s*before\.modelCalls/, "modelCalls: 0")), "the static guard bites on a hardcoded-0 mutant");

// 3b. mutant (runtime): copy the module with the literal restored; the model-call fixture must expose it
{
  const tmp = mkdtempSync(path.join(tmpdir(), "f75mut-"));
  try {
    mkdirSync(path.join(tmp, "lib"), { recursive: true });
    cpSync(path.join(root, "lib/guestscan"), path.join(tmp, "lib/guestscan"), { recursive: true });
    cpSync(path.join(root, "lib/modelhosts.ts"), path.join(tmp, "lib/modelhosts.ts"));
    writeFileSync(path.join(tmp, "package.json"), '{"type":"module"}');
    const p = path.join(tmp, "lib/guestscan/scan.ts");
    const mutated = readFileSync(p, "utf8").replace(/modelCalls\s*:\s*after\.modelCalls\s*-\s*before\.modelCalls/, "modelCalls: 0");
    ok(mutated !== readFileSync(p, "utf8"), "mutant was applied");
    writeFileSync(p, mutated);
    const M = await import(pathToFileURL(p).href + "?m=1");
    const Mm = await import(pathToFileURL(path.join(tmp, "lib/guestscan/meter.ts")).href);
    const meter = new Mm.RequestMeter(); const mf = Mm.meteredFetch(meter, net([]));
    const f = M.dohFetch("cloudflare-dns.com", 6000, net([]), meter);
    const rogue = async (n, t) => { if (t === "MX") await mf("https://api.openai.com/v1/chat/completions"); return f(n, t); };
    rogue.meter = meter;
    const r = await M.runScan("example.com.au", rogue);
    ok(meter.modelCalls === 1 && r.modelCalls !== meter.modelCalls, `mutant is caught: meter saw ${meter.modelCalls}, mutant reported ${r.modelCalls}`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

// 4. static gate: import graph of the guest path has no model SDK and no model hostname
const ENTRY = ["components/GuestScan.tsx", "components/HoursCounter.tsx", ...readdirSync(path.join(root, "lib/guestscan")).map((f) => "lib/guestscan/" + f)];
const DENYLIST_FILE = "lib/modelhosts.ts"; // the one file allowed to spell hostnames: it IS the list
const IMPORT_RE = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
function resolveLocal(from, spec) {
  let base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(path.join(root, from)), spec);
  for (const c of [base, base + ".ts", base + ".tsx", base + ".mjs", base + ".js", path.join(base, "index.ts"), path.join(base, "index.tsx")]) if (existsSync(c) && !readdirSafe(c)) return path.relative(root, c);
  return null;
}
function readdirSafe(p) { try { readdirSync(p); return true; } catch { return false; } }
export function walkGraph(entries) {
  const seen = new Map(); const sdk = []; const stack = [...entries];
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue;
    const src = readFileSync(path.join(root, f), "utf8"); seen.set(f, src);
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (spec.startsWith(".") || spec.startsWith("@/")) { const r = resolveLocal(f, spec); if (r) stack.push(r); else sdk.push(`${f}: unresolved local import ${spec}`); }
      else if (isModelSdk(spec)) sdk.push(`${f}: model SDK ${spec}`);
    }
  }
  return { files: seen, sdk };
}
const g = walkGraph(ENTRY);
ok(g.files.size >= 8, `import graph walked ${g.files.size} files`);
ok(g.files.has("lib/modelhosts.ts") && g.files.has("lib/guestscan/meter.ts"), "graph includes the meter and the host list");
ok(g.sdk.length === 0, `no model SDK import on the guest path ${g.sdk.join("; ")}`);
const hostRes = MODEL_HOSTS.map((h) => new RegExp("(^|[^a-z0-9-])" + h.replace(/\./g, "\\.") + "($|[^a-z0-9-])", "i"));
const hostHits = [];
for (const [f, src] of g.files) {
  if (f === DENYLIST_FILE) continue;
  const code = src.replace(/\/\/.*$/gm, "");
  MODEL_HOSTS.forEach((h, i) => { if (hostRes[i].test(code)) hostHits.push(`${f}: ${h}`); });
  if (/bedrock(-runtime)?\.[a-z0-9-]+\.amazonaws\.com/i.test(code)) hostHits.push(`${f}: bedrock`);
}
ok(hostHits.length === 0, `no model API hostname on the guest path ${hostHits.join("; ")}`);
for (const f of ["package.json"]) { const deps = Object.keys({ ...JSON.parse(readFileSync(path.join(root, f), "utf8")).dependencies }); ok(!deps.some(isModelSdk), `package.json dependencies carry no model SDK (${deps.filter(isModelSdk)})`); }
// the gate bites: a planted SDK import and a planted hostname are both found
{
  const probe = (code) => { const sdkHit = [...code.matchAll(IMPORT_RE)].some((m) => isModelSdk(m[1] ?? m[2] ?? m[3] ?? m[4])); const hostHit = MODEL_HOSTS.some((h, i) => hostRes[i].test(code)); return sdkHit || hostHit; };
  ok(probe('import Anthropic from "@anthropic-ai/sdk";'), "gate bites on a model SDK import");
  ok(probe('const u = "https://api.openai.com/v1/x";'), "gate bites on a model hostname");
  ok(!probe('import { x } from "./scan.ts"; const u = "https://cloudflare-dns.com/dns-query";'), "gate passes a clean file");
}

console.log(`test_guestscan_meter: ${passed} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
