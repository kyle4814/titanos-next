// C1 guest scan kill tests that run locally. node --experimental-strip-types scripts/test_guestscan.mjs
// PENDING LIVE (need real traffic, not asserted here): phone wall-clock on real DoH; >=3% of first 1,000 scans press GET THIS FIXED.
import { readFileSync, readdirSync } from "node:fs";
import { runScan, normaliseDomain, isScannable, grade, DOH_HOSTS, DKIM_SELECTORS } from "../lib/guestscan/scan.ts";
import { buildPlan, handRaise, fixFor } from "../lib/guestscan/fixes.ts";
import { FIXTURES, fakeDoh } from "../lib/guestscan/fixtures.ts";
import { gradeFixtures } from "../lib/guestscan/grader.ts";
import { sampleHours, ledgerHours, LEDGER_SEED } from "../lib/guestscan/hours.ts";

let fails = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; } else { fails++; console.error("FAIL " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Planted-fixture grader must be 100%.
const g = await gradeFixtures();
ok(g.pct === 100, `grader 100% (got ${g.hit}/${g.total}: ${g.misses.join("; ")})`);
ok(g.fixtures >= 20 && g.total >= 30, `fixture corpus size ${g.fixtures} fixtures / ${g.total} assertions`);

// 1b. Mutation: a scanner that cannot read TXT must NOT grade 100% (the grader bites).
{
  let hit = 0, total = 0;
  for (const fx of FIXTURES) {
    const real = fakeDoh(fx.world).fetch;
    const broken = async (n, t) => (t === "TXT" ? { Status: 0 } : real(n, t));
    const r = await runScan(fx.domain, broken);
    for (const [c, w] of Object.entries(fx.expect)) { total++; if (r.findings.find((x) => x.check === c)?.status === w) hit++; }
  }
  ok(hit < total, `mutation (TXT blind) is caught by the grader (${hit}/${total})`);
}

// 2. Zero model calls: static + runtime.
const dir = new URL("../lib/guestscan/", import.meta.url);
const FORBID = /anthropic|openai|api\.openai|claude|gpt-|gemini|llm|completion|@anthropic-ai|generativelanguage|bedrock/i;
for (const f of readdirSync(dir)) ok(!FORBID.test(readFileSync(new URL(f, dir), "utf8").replace(/\/\/.*$/gm, "")), `no model reference in lib/guestscan/${f}`);
for (const f of ["../components/GuestScan.tsx", "../components/HoursCounter.tsx"]) ok(!FORBID.test(readFileSync(new URL(f, import.meta.url), "utf8")), `no model reference in ${f}`);
{
  const hosts = new Set();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => { hosts.add(new URL(String(u)).host); return new Response(JSON.stringify({ Status: 0 }), { headers: { "content-type": "application/json" } }); };
  const { dohFetch } = await import("../lib/guestscan/scan.ts");
  const r = await runScan("https://www.Example.com.au/x", dohFetch());
  globalThis.fetch = realFetch;
  ok(r.modelCalls === 0, "result.modelCalls is 0");
  ok([...hosts].every((h) => DOH_HOSTS.includes(h)) && hosts.size === 1, `only DoH host contacted: ${[...hosts]}`);
}

// 3. Speed: the scan is one parallel round. 200 ms per lookup, 17 lookups, must finish far under 10 s.
{
  const fx = FIXTURES[0];
  const fk = fakeDoh(fx.world, 200, sleep);
  const t0 = Date.now();
  const r = await runScan(fx.domain, fk.fetch);
  const wall = Date.now() - t0;
  ok(fk.calls.length === 5 + DKIM_SELECTORS.length, `17 lookups (got ${fk.calls.length})`);
  ok(wall < 1000, `parallel: 17 x 200 ms lookups took ${wall} ms (serial would be 3400)`);
  ok(r.elapsedMs < 1000, "result.elapsedMs reported");
  // Worst case on a phone: 2 s per lookup (slow 3G round trips) must still beat 10 s.
  const slow = fakeDoh(fx.world, 2000, sleep); const t1 = Date.now(); await runScan(fx.domain, slow.fetch);
  ok(Date.now() - t1 < 10000, `2 s per lookup still under 10 s (${Date.now() - t1} ms)`);
}

// 4. Input handling.
ok(normaliseDomain(" HTTPS://www.Example.com.au/contact?x=1 ") === "example.com.au", "normalise");
for (const bad of ["", "localhost", "a b.com", "http://", "-x-.com", "1.2.3.4", "x.c", "a..com"]) ok(!isScannable(normaliseDomain(bad)), `rejects ${JSON.stringify(bad)}`);
{ let threw = false; try { await runScan("not a domain", fakeDoh({}).fetch); } catch (e) { threw = e.message === "invalid_domain"; } ok(threw, "invalid domain throws invalid_domain"); }

// 5. Honesty: failed reads are UNKNOWN, never FAIL; all-unreadable is grade '?' not 'F'.
{
  const r = await runScan("dead.example", fakeDoh({ servfail: ["*"] }).fetch);
  ok(r.findings.every((f) => f.status === "UNKNOWN") && r.grade === "?" && r.score === -1, "all lookups failing => UNKNOWN and grade ?");
  const th = async () => { throw new Error("network"); };
  const r2 = await runScan("dead.example", th);
  ok(r2.findings.every((f) => f.status === "UNKNOWN"), "thrown fetch => UNKNOWN");
}
{ // grade: critical FAIL caps at D or worse even if the rest pass
  const f = (check, status) => ({ check, status, detail: "", fix: "" });
  const r = grade([f("SPF", "FAIL"), f("DMARC", "PASS"), f("DKIM", "PASS"), f("DNSSEC", "PASS"), f("MX", "PASS"), f("MTA-STS", "PASS")]);
  ok(r.score <= 49 && "DF".includes(r.grade), `critical FAIL caps grade (${r.grade} ${r.score})`);
}

// 6. GET THIS FIXED: plan content, order, record values, hours.
{
  const fx = FIXTURES.find((x) => x.id === "nothing-published");
  const r = await runScan(fx.domain, fakeDoh(fx.world).fetch);
  const p = buildPlan(r);
  ok(p.steps.length === 6, `plan has a step per non-pass finding (${p.steps.length})`);
  ok(p.steps[0].check === "SPF" && p.steps[1].check === "DMARC", "FAIL and critical first");
  ok(p.steps.find((s) => s.check === "DMARC").record.host === "_dmarc.bare.example", "DMARC record host uses the domain");
  ok(p.steps.every((s) => s.verify.length > 0 && s.steps.length > 0 && s.minutesWithPlan < s.minutesByHand), "every step has verify, steps and saves time");
  ok(p.hoursHandedBack > 0 && p.minutesHandedBack === p.minutesByHand - p.minutesWithPlan, `hours handed back ${p.hoursHandedBack}`);
  const hr = handRaise(r);
  ok(hr.event === "scan_get_fixed" && hr.failing.includes("SPF") && hr.grade === r.grade, "hand-raise event payload");
  const pass = await runScan("good.example", fakeDoh(FIXTURES[0].world).fetch);
  ok(buildPlan(pass).steps.length === 0 && buildPlan(pass).hoursHandedBack === 0, "perfect domain has an empty plan");
  ok(fixFor({ check: "SPF", status: "PASS", detail: "", fix: "" }, "x.com") === null, "PASS has no fix");
}

// 7. Hours counter: ledger starts at 0 and is labelled; sample is computed and labelled MODELLED.
{
  const s = sampleHours();
  ok(s.byHandHours > 0 && s.handedBackHours > 0 && /MODELLED/.test(s.label), `sample ${JSON.stringify(s)}`);
  ok(ledgerHours() === 0 && /PENDING LIVE/.test(LEDGER_SEED.source), "ledger seed is zero and says PENDING LIVE");
  ok(ledgerHours({ scans: 3, minutesHandedBack: 150, since: "x", source: "t" }) === 2.5, "ledger converts minutes to hours");
}

// 8. Wiring: scan page mounts the widget, home mounts the counter, CSP allows DoH, copy lint.
{
  const scan = readFileSync(new URL("../app/scan/page.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  ok(/GuestScan/.test(scan), "scan page mounts GuestScan");
  ok(/HoursCounter/.test(home), "home mounts HoursCounter");
  ok(/cloudflare-dns\.com/.test(layout), "CSP connect-src allows cloudflare-dns.com");
  for (const f of ["../components/GuestScan.tsx", "../components/HoursCounter.tsx", "../lib/guestscan/fixes.ts"]) {
    const t = readFileSync(new URL(f, import.meta.url), "utf8");
    ok(!/[–—]/.test(t), `no em or en dash in ${f}`);
  }
}

// R-C3 / F-C1 regressions: each SPF case must NOT pass (one assertion per case; mutation check in the receipt).
{
  const D = "acme.example.com.au";
  const spfStatus = async (rec) => {
    const w = JSON.parse(JSON.stringify(FIXTURES[0].world)); // any fixture world, then override the SPF TXT
    w.txt = { ...(w.txt ?? {}), [D]: [rec] };
    const r = await runScan(D, fakeDoh(w).fetch); return r.findings.find((x) => x.check === "SPF");
  };
  const inc = (n) => Array.from({ length: n }, (_, i) => `include:i${i}.example.com`).join(" ");
  const cases = [
    ["redirect + all is FAIL", `v=spf1 redirect=_spf.big.example.com -all`, "FAIL", /redirect/],
    ["redirect + ~all is FAIL", `v=spf1 redirect=_spf.big.example.com ~all`, "FAIL", /redirect/],
    ["redirect alone (valid) is not PASS", `v=spf1 redirect=_spf.big.example.com`, "WARN", /no explicit all/],
    ["12 includes (over 10 lookups) is FAIL", `v=spf1 ${inc(12)} -all`, "FAIL", /12 DNS lookups/],
    ["exactly 10 lookups still PASS", `v=spf1 ${inc(10)} -all`, "PASS", /Strong/],
    ["11 lookups mixing a, mx, exists is FAIL", `v=spf1 a mx exists:x.example.com ${inc(8)} -all`, "FAIL", /11 DNS lookups/],
    ["ptr is not PASS", `v=spf1 ptr -all`, "WARN", /ptr/],
    ["unknown mechanism is FAIL", `v=spf1 bogus:thing -all`, "FAIL", /bogus:thing/],
    ["v=spf10 lookalike is not an SPF record", `v=spf10 -all`, "FAIL", /No SPF record/],
    ["v=spf1 with ip4/ip6/a/mx/exp still PASS", `v=spf1 a mx ip4:203.0.113.0/24 ip6:2001:db8::/32 include:_spf.google.com exp=e.example.com -all`, "PASS", /Strong/],
    ["uppercase V=SPF1 is read", `V=SPF1 INCLUDE:_spf.google.com -ALL`, "PASS", /Strong/],
  ];
  for (const [label, rec, want, rx] of cases) { const f = await spfStatus(rec); ok(f.status === want && rx.test(f.detail), `SPF ${label} (got ${f.status}: ${f.detail.slice(0, 80)})`); }
}

if (fails) { console.error(`${fails} failure(s), ${passed} passed`); process.exit(1); }
console.log(`PASS test_guestscan (${passed} assertions)`);
