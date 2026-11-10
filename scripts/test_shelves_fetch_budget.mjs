// test_shelves_fetch_budget.mjs - budget gate for the lazy concierge catalogue (f333). Usage: node scripts/test_shelves_fetch_budget.mjs [outDir=out]
// Budget: shelves.json raw < 200 KB, click-to-answer < 1500 ms on loopback, exactly one fetch (none before the first ask, none on the second).
// Part 1: pure checker on fixtures. Part 2: mutation, a 260 KB shelves.json served through the real browser probe must go RED. Part 3: the real build.
// No out/ = SKIPPED-NO-BUILD (exit 0, said plainly). Loopback only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probe } from "./probe_shelves_fetch.mjs";

export const BUDGET = { maxRawBytes: 200 * 1024, maxReadyMs: 1500, fetchCount: 1 };
export function check(m, b = BUDGET) {
  const f = [];
  if (m.status !== 200) f.push(`shelves.json status ${m.status}`);
  if (!(m.rawBytes < b.maxRawBytes)) f.push(`raw ${m.rawBytes} B >= ${b.maxRawBytes}`);
  if (!(m.readyMs < b.maxReadyMs)) f.push(`ready ${m.readyMs} ms >= ${b.maxReadyMs}`);
  if (m.fetchesBeforeAsk !== 0) f.push(`fetched ${m.fetchesBeforeAsk}x before the first ask (not lazy)`);
  if (m.fetchesAfterFirstAsk !== b.fetchCount) f.push(`first ask made ${m.fetchesAfterFirstAsk} fetches, want ${b.fetchCount}`);
  if (m.fetchesAfterSecondAsk !== b.fetchCount) f.push(`after second ask ${m.fetchesAfterSecondAsk} fetches, want ${b.fetchCount}`);
  return f;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let pass = 0, fail = 0;
  const ok = (c, name, extra = "") => { if (c) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, extra); } };
  const good = { status: 200, rawBytes: 154107, readyMs: 80, fetchesBeforeAsk: 0, fetchesAfterFirstAsk: 1, fetchesAfterSecondAsk: 1 };
  ok(check(good).length === 0, "fixture within budget passes");
  ok(check({ ...good, rawBytes: 200 * 1024 }).length === 1, "fixture raw at the limit fails");
  ok(check({ ...good, readyMs: 1500 }).length === 1, "fixture slow ready fails");
  ok(check({ ...good, fetchesAfterSecondAsk: 2 }).length === 1, "fixture second fetch fails");
  ok(check({ ...good, fetchesBeforeAsk: 1, fetchesAfterFirstAsk: 1 }).length === 1, "fixture eager fetch fails");
  ok(check({ ...good, fetchesAfterFirstAsk: 0, fetchesAfterSecondAsk: 0 }).length === 2, "fixture no fetch at all fails");

  const OUT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out"));
  if (!fs.existsSync(path.join(OUT, "faq.html")) || !fs.existsSync(path.join(OUT, "concierge", "shelves.json"))) {
    console.log(`SKIPPED-NO-BUILD real probe not run: no built export at ${OUT} (npm run build first). Fixtures above are the only evidence this run.`);
  } else {
    const real = await probe(OUT);
    console.log("real probe", JSON.stringify(real));
    ok(check(real).length === 0, "real build within shelves fetch budget", "\n  " + check(real).join("\n  "));
    // mutation: same page, shelves.json inflated past the limit (valid JSON, extra filler shelf), served via the probe override. Disk untouched.
    const T = fs.mkdtempSync(path.join(os.tmpdir(), "shelfmut."));
    if (!T.startsWith(os.tmpdir() + path.sep + "shelfmut.")) { console.log("refusing fixture path", T); process.exit(97); }
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(OUT, "concierge", "shelves.json"), "utf8"));
      const fat = path.join(T, "shelves.json");
      fs.writeFileSync(fat, JSON.stringify([...arr, { id: "mutant-filler", pad: "x".repeat(260 * 1024) }]));
      const mut = await probe(OUT, { shelves: fat });
      console.log("mutant probe", JSON.stringify(mut));
      ok(mut.rawBytes > BUDGET.maxRawBytes && check(mut).some((x) => x.startsWith("raw ")), "mutation: inflated shelves.json goes RED on raw bytes");
    } finally { fs.rmSync(T, { recursive: true, force: true }); }
  }
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
