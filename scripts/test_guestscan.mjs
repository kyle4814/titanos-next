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

// 3. Speed: one parallel round plus one nested SPF round (F38). 200 ms per lookup, 18 lookups, must finish far under 10 s.
{
  const fx = FIXTURES[0];
  const fk = fakeDoh(fx.world, 200, sleep);
  const t0 = Date.now();
  const r = await runScan(fx.domain, fk.fetch);
  const wall = Date.now() - t0;
  ok(fk.calls.length === 5 + DKIM_SELECTORS.length + 1, `18 lookups (17 + 1 nested include read, F38) (got ${fk.calls.length})`);
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

// F35. Nested SPF lookup walk (RFC 7208 4.6.4), fake resolver trees only: no live DNS.
{
  const { spfNestedLookups } = await import("../lib/guestscan/spfnest.ts");
  const tree = (zone, onCall) => async (type, name) => {
    if (onCall) onCall(type, name);
    const z = zone[`${type}:${name}`];
    if (z === "ERR") return { status: "error" };
    if (z === undefined) return { status: "void" };
    return { status: "ok", records: Array.isArray(z) ? z : [z] };
  };
  const incs = (n, pre) => Array.from({ length: n }, (_, i) => `include:${pre}${i}.example.net`).join(" ");
  // Leaf zones: n includes, each a flat SPF with only ip4.
  const leaves = (n, pre) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`TXT:${pre}${i}.example.net`, "v=spf1 ip4:203.0.113.0/24 -all"]));
  const run = (zone, opts) => spfNestedLookups("corp.example.com", tree(zone), opts);

  { const r = await run({ "TXT:corp.example.com": "v=spf1 ip4:203.0.113.1 -all" });
    ok(r.state === "WITHIN_LIMIT" && r.lookups === 0 && r.resolverCalls === 1, `F35 flat no-lookup record WITHIN_LIMIT (${JSON.stringify(r)})`); }
  { const r = await run({ "TXT:corp.example.com": `v=spf1 ${incs(3, "i")} -all`, ...leaves(3, "i") });
    ok(r.state === "WITHIN_LIMIT" && r.lookups === 3, `F35 flat 3 includes counted (${r.lookups})`); }
  // Nested: 5 direct terms, each include has 2 more includes (flat leaves) = 5 + 10 = 15 > 10 though direct count is 5.
  {
    const zone = { "TXT:corp.example.com": `v=spf1 ${incs(5, "m")} -all` };
    for (let i = 0; i < 5; i++) { zone[`TXT:m${i}.example.net`] = `v=spf1 include:l${i}a.example.org include:l${i}b.example.org -all`; zone[`TXT:l${i}a.example.org`] = "v=spf1 ip4:203.0.113.1 -all"; zone[`TXT:l${i}b.example.org`] = "v=spf1 ip4:203.0.113.2 -all"; }
    const r = await run(zone);
    ok(r.state === "OVER_LIMIT" && r.lookups === 11, `F35 nested 5 direct (spfInfo says 5) walks to OVER_LIMIT, stops at 11 (got ${r.state} ${r.lookups})`);
    ok(r.reasons.some((x) => /over the limit of 10/.test(x)), "F35 OVER_LIMIT carries a reason");
  }
  // Nested, exactly 10 across the tree: 2 direct + 4 each = 2 + 8 = 10 -> WITHIN_LIMIT; adding one more term -> OVER.
  {
    const mk = (extra) => {
      const zone = { "TXT:corp.example.com": `v=spf1 include:p.example.net include:q.example.net${extra ? " a" : ""} -all`, "A:corp.example.com": "ok" };
      zone["TXT:p.example.net"] = "v=spf1 mx a include:p1.example.net include:p2.example.net -all";
      zone["TXT:q.example.net"] = "v=spf1 mx a include:q1.example.net include:q2.example.net -all";
      for (const n of ["p1", "p2", "q1", "q2"]) zone[`TXT:${n}.example.net`] = "v=spf1 ip4:203.0.113.3 -all";
      zone["MX:p.example.net"] = "10 mail.p.example.net"; zone["A:p.example.net"] = "203.0.113.4";
      zone["MX:q.example.net"] = "10 mail.q.example.net"; zone["A:q.example.net"] = "203.0.113.5";
      return zone;
    };
    const under = await run(mk(false)); const over = await run(mk(true));
    ok(under.state === "WITHIN_LIMIT" && under.lookups === 10, `F35 nested exactly 10 is WITHIN_LIMIT (${under.state} ${under.lookups})`);
    ok(over.state === "OVER_LIMIT" && over.lookups === 11, `F35 nested 11 is OVER_LIMIT (${over.state} ${over.lookups})`);
    // Mutation check on the counting: if mx/a/include did not count, the same tree would read WITHIN. Prove each term class bites.
    for (const kind of ["include", "a", "mx"]) {
      const z = mk(true);
      const strip = (rec) => rec.split(" ").filter((t) => kind === "include" ? !t.startsWith("include:") : t !== kind).join(" ");
      for (const k of Object.keys(z)) if (k.startsWith("TXT:")) z[k] = strip(z[k]);
      const m = await run(z);
      ok(m.lookups < 11 && m.state !== "OVER_LIMIT", `F35 mutation: dropping ${kind} terms changes the verdict (${m.state} ${m.lookups}), so the counter bites on ${kind}`);
    }
  }
  // redirect, exists and ptr count too.
  { const r = await run({ "TXT:corp.example.com": "v=spf1 exists:chk.example.net ptr redirect=r.example.net", "A:chk.example.net": "1.2.3.4", "TXT:r.example.net": "v=spf1 -all" });
    ok(r.lookups === 3 && r.state === "WITHIN_LIMIT", `F35 exists + ptr + redirect each count (${r.lookups})`); }
  // Cycle: a -> b -> a is OVER_LIMIT (receivers loop to the limit), flagged, and the walk terminates.
  { let calls = 0; const zone = { "TXT:corp.example.com": "v=spf1 include:b.example.net -all", "TXT:b.example.net": "v=spf1 include:corp.example.com -all" };
    const r = await spfNestedLookups("corp.example.com", tree(zone, () => calls++));
    ok(r.cycle && r.state === "OVER_LIMIT" && calls <= 3, `F35 cycle detected, OVER_LIMIT, walk stopped (${calls} calls)`); }
  // Depth cap: a chain of 6 with maxDepth 3 is UNKNOWN with a depth reason, never a guess.
  { const zone = { "TXT:corp.example.com": "v=spf1 include:c1.example.net -all" };
    for (let i = 1; i <= 6; i++) zone[`TXT:c${i}.example.net`] = i < 6 ? `v=spf1 include:c${i + 1}.example.net -all` : "v=spf1 -all";
    const r = await run(zone, { maxDepth: 3 });
    ok(r.state === "UNKNOWN" && r.reasons.some((x) => /depth cap of 3/.test(x)), `F35 depth cap gives UNKNOWN with reason (${r.state}: ${r.reasons})`);
    const full = await run(zone);
    ok(full.state === "WITHIN_LIMIT" && full.lookups === 6 && full.maxDepthSeen === 6, `F35 same chain under default depth is WITHIN_LIMIT with 6 lookups (${full.state} ${full.lookups})`); }
  // Resolver budget: hard cap on resolver calls, UNKNOWN with reason, call count never exceeds the cap.
  { let calls = 0; const zone = { "TXT:corp.example.com": `v=spf1 ${incs(9, "b")} -all`, ...leaves(9, "b") };
    const r = await spfNestedLookups("corp.example.com", tree(zone, () => calls++), { maxResolverCalls: 4 });
    ok(r.state === "UNKNOWN" && calls === 4 && r.reasons.some((x) => /budget of 4/.test(x)), `F35 resolver budget stops at 4 calls, UNKNOWN (${r.state}, ${calls} calls)`); }
  // Failing lookup: SERVFAIL on a nested include is UNKNOWN naming the name, not WITHIN_LIMIT; a throw is treated the same.
  { const zone = { "TXT:corp.example.com": "v=spf1 include:ok.example.net include:bad.example.net -all", "TXT:ok.example.net": "v=spf1 -all", "TXT:bad.example.net": "ERR" };
    const r = await run(zone);
    ok(r.state === "UNKNOWN" && r.reasons.some((x) => /TXT bad\.example\.net/.test(x)), `F35 failing nested lookup is UNKNOWN with the name (${r.state}: ${r.reasons})`);
    const thrower = async () => { throw new Error("boom"); };
    const t = await spfNestedLookups("corp.example.com", thrower);
    ok(t.state === "UNKNOWN", `F35 throwing resolver is UNKNOWN (${t.state})`);
    // OVER_LIMIT is still definitive when a later lookup fails: the count is a lower bound.
    const z2 = { "TXT:corp.example.com": `v=spf1 ${incs(11, "d")} -all`, ...leaves(10, "d"), "TXT:d10.example.net": "ERR" };
    const o = await run(z2);
    ok(o.state === "OVER_LIMIT", `F35 over-limit is definitive despite a failing lookup (${o.state} ${o.lookups})`); }
  // Void lookups: a, mx, exists and include-with-no-record that return nothing; more than 2 is flagged.
  { const zone = { "TXT:corp.example.com": "v=spf1 a:gone1.example.net mx:gone2.example.net exists:gone3.example.net -all" };
    const r = await run(zone);
    ok(r.voidLookups === 3 && r.voidOver && r.state === "WITHIN_LIMIT" && r.reasons.some((x) => /void lookups/.test(x)), `F35 3 void lookups flagged (${r.voidLookups}, voidOver ${r.voidOver})`);
    const two = await run({ "TXT:corp.example.com": "v=spf1 a:gone1.example.net mx:gone2.example.net -all" });
    ok(two.voidLookups === 2 && !two.voidOver, `F35 exactly 2 void lookups not flagged (${two.voidLookups})`);
    const none = await run({ "TXT:corp.example.com": "v=spf1 a:h.example.net -all", "A:h.example.net": "1.2.3.4" });
    ok(none.voidLookups === 0, `F35 a resolving a-term is not void`); }
  // Macros cannot be resolved without a sender: counted, UNKNOWN with reason.
  { const r = await run({ "TXT:corp.example.com": "v=spf1 exists:%{i}._spf.example.net -all" });
    ok(r.lookups === 1 && r.state === "UNKNOWN" && r.reasons.some((x) => /macro/.test(x)), `F35 macro target is UNKNOWN with reason (${r.state})`); }
  // Same record under the direct-only scanner count: documents the gap this closes.
  { const { spfInfo } = await import("../lib/guestscan/scan.ts");
    ok(spfInfo(`v=spf1 ${incs(5, "m")} -all`).lookups === 5, "F35 direct-only spfInfo still reports 5 (unchanged, autofix guards untouched)"); }
}

// F38. The nested walk is wired into runScan: the SPF finding's lookup count comes from the walk. Fake DoH worlds only.
{
  const D = "corp.example.com";
  const spfF = async (txt) => { const fk = fakeDoh({ txt }); const r = await runScan(D, fk.fetch); return { f: r.findings.find((x) => x.check === "SPF"), calls: fk.calls.length }; };
  const leaf = "v=spf1 ip4:203.0.113.0/24 -all";
  // Root has 5 direct terms (under 10) but each include nests one more include and one a: 5 + 5 + 5 = 15 > 10.
  const txt = { [D]: [`v=spf1 ${[0,1,2,3,4].map((i) => `include:n${i}.example.net`).join(" ")} -all`] };
  for (let i = 0; i < 5; i++) txt[`n${i}.example.net`] = [`v=spf1 include:m${i}.example.net a -all`], txt[`m${i}.example.net`] = [leaf];
  { const { f } = await spfF(txt);
    ok(f.status === "FAIL" && /needs 11 DNS lookups, over the limit of 10/.test(f.detail), `F38 5 direct terms but over 10 nested reports OVER_LIMIT FAIL (${f.status}: ${f.detail.slice(0, 70)})`); }
  { const flat = { [D]: [`v=spf1 ${[0,1,2,3,4].map((i) => `include:n${i}.example.net`).join(" ")} -all`] };
    for (let i = 0; i < 5; i++) flat[`n${i}.example.net`] = [leaf];
    const { f } = await spfF(flat); ok(f.status === "PASS", `F38 same 5 includes that stay flat (5 lookups) still PASS (${f.status})`); }
  // Loop: a includes b includes a. Must terminate (bounded calls) and be reported, not hang.
  { const loop = { [D]: ["v=spf1 include:a.example.net -all"], "a.example.net": ["v=spf1 include:b.example.net -all"], "b.example.net": ["v=spf1 include:a.example.net -all"] };
    const t0 = Date.now(); const { f, calls } = await spfF(loop);
    ok(Date.now() - t0 < 2000 && calls < 30 && f.status === "FAIL", `F38 include loop terminates and FAILs (${f.status}, ${calls} DoH calls total)`); }
  // Depth cap: a chain longer than maxDepth 10 never walks past the cap; result is not a hang and not an invented FAIL.
  { const chain = { [D]: ["v=spf1 include:c0.example.net -all"] };
    for (let i = 0; i < 20; i++) chain[`c${i}.example.net`] = [`v=spf1 include:c${i + 1}.example.net -all`];
    const fk = fakeDoh({ txt: chain }); const r = await runScan(D, fk.fetch);
    const walked = fk.calls.filter((c) => /^c\d+\.example\.net$/.test(c.name) && c.type === "TXT").length;
    const f = r.findings.find((x) => x.check === "SPF");
    ok(walked <= 10 && f.status === "FAIL" && /needs 11 DNS lookups/.test(f.detail), `F38 a 20-deep include chain stops at the cap (walked ${walked} hops of 20) and FAILs at 11 (${f.status}: ${f.detail.slice(0, 50)})`);
    // The explicit depth cap (maxDepth 10, shorter-than-limit chains via redirect-free a-less hops) is covered by the F35 depth block.
  }
  // Failed nested read never turns a clean record into a FAIL: UNKNOWN falls back to direct.
  { const bad = { [D]: ["v=spf1 include:x.example.net -all"] };
    const fk = fakeDoh({ txt: bad, servfail: ["x.example.net/TXT"] }); const r = await runScan(D, fk.fetch);
    ok(r.findings.find((x) => x.check === "SPF").status === "PASS", "F38 failing nested read does not manufacture a FAIL"); }
}

if (fails) { console.error(`${fails} failure(s), ${passed} passed`); process.exit(1); }
console.log(`PASS test_guestscan (${passed} assertions)`);
