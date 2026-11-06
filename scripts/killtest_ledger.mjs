#!/usr/bin/env node
// killtest_ledger.mjs - MEASURE job (read-only). Parses the chunk kill tests C1..C10 from the business plan,
// scans website-chain *RECEIPT*.md final lines (OK / FAILED), and emits a markdown ledger table.
// usage: node scripts/killtest_ledger.mjs <plan.md> <receipts_dir> [out.md]
// A receipt NAMES a chunk when (a) its file name carries a chunk tag (_cN_ or WEB_wN_, N=1..9) or
// (b) its FINAL LINE mentions the token Cn. Body text is never used (a body that merely mentions C3 proves nothing).
// Maturity (CORE EXEC3), never above TESTED unless a final line says so:
//   UNKNOWN (no receipt) / PROPOSED (only FAILED verdicts) / IMPLEMENTED (an OK verdict, no test evidence)
//   / TESTED (an OK verdict whose final line carries test evidence) / INDEPENDENTLY VERIFIED / ENFORCED LIVE (final line says so).
// TESTED means code tests were green. It does NOT mean the chunk's kill test was met (that is a live measure).
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function parsePlan(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*C(\d+)\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const cells = m[2].split("|").map((s) => s.trim());
    if (cells.length < 4) continue;
    rows.push({ id: "C" + Number(m[1]), n: Number(m[1]), name: cells[0], kill: cells[cells.length - 1] });
  }
  return rows;
}

// Bare 'OK <count> <sha>' is the WEB_wN receipt convention (count = tests run); all others need a test/pass/mutant word.
const TEST_EVIDENCE = /^\d+\s+[0-9a-f]{7,40}\b|\b\d+\s*(?:\/\s*\d+\s*)?(?:new\s+)?(?:tests?|checks?|pass|mutants?|mutations?)\b|\b\d+\/\d+\b|\bmutations?\b|\bmutants?\b|\btests?\b/i;

export function parseVerdict(finalLine) {
  const m = finalLine.match(/^(\S+)\s+(OK|FAILED)\b(.*)$/);
  if (m) return { word: m[2], rest: m[3].trim(), tag: m[1] };
  const w = finalLine.match(/\b(OK|FAILED)\b/);
  return { word: w ? w[1] : "NONE", rest: finalLine, tag: "" };
}

export function chunksNamed(file, finalLine) {
  const s = new Set();
  let m;
  const base = file.replace(/_RECEIPT\.md$/, "");
  const f = base.match(/_c(\d{1,2})_/i);
  if (f) s.add("C" + Number(f[1]));
  const w = base.match(/^WEB_w(\d)_/);
  if (w) s.add("C" + Number(w[1]));
  const re = /(?<![-\w])C(\d{1,2})\b/g; // "R-C3" / "F-C1" are finding ids, not chunks
  while ((m = re.exec(finalLine))) s.add("C" + Number(m[1]));
  return [...s];
}

export function maturity(verdicts) {
  if (!verdicts.length) return "UNKNOWN";
  const finals = verdicts.map((v) => v.rest).join(" \n ");
  if (/ENFORCED LIVE/.test(finals)) return "ENFORCED LIVE";
  if (/INDEPENDENTLY VERIFIED/.test(finals)) return "INDEPENDENTLY VERIFIED";
  const oks = verdicts.filter((v) => v.word === "OK");
  if (!oks.length) return "PROPOSED";
  return oks.some((v) => TEST_EVIDENCE.test(v.rest)) ? "TESTED" : "IMPLEMENTED";
}

export function scan(planText, dir) {
  const chunks = parsePlan(planText);
  const files = readdirSync(dir).filter((f) => /RECEIPT.*\.md$/.test(f) && !/^FILL_fp_/.test(f));
  const recs = files.map((file) => {
    const p = join(dir, file);
    const lines = readFileSync(p, "utf8").split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    const finalLine = lines.length ? lines[lines.length - 1].trim() : "";
    return { file, finalLine, mtime: statSync(p).mtimeMs, v: parseVerdict(finalLine) };
  });
  return chunks
    .sort((a, b) => a.n - b.n)
    .map((c) => {
      const mine = recs.filter((r) => chunksNamed(r.file, r.finalLine).includes(c.id)).sort((a, b) => a.mtime - b.mtime);
      const verdicts = mine.filter((r) => r.v.word !== "NONE").map((r) => r.v);
      const last = mine.length ? mine[mine.length - 1] : null;
      return {
        ...c,
        receipts: mine.map((r) => r.file.replace(/_RECEIPT\.md$/, "")),
        okCount: mine.filter((r) => r.v.word === "OK").length,
        failedCount: mine.filter((r) => r.v.word === "FAILED").length,
        last: last ? `${last.v.word} (${last.file.replace(/_RECEIPT\.md$/, "")})` : "UNKNOWN",
        maturity: maturity(verdicts),
      };
    });
}

export function renderTable(rows, meta = {}) {
  const esc = (s) => s.replace(/\|/g, "\\|");
  const tested = rows.filter((r) => ["TESTED", "INDEPENDENTLY VERIFIED", "ENFORCED LIVE"].includes(r.maturity));
  const none = rows.filter((r) => r.maturity === "UNKNOWN");
  const out = [];
  out.push("# KILL TEST LEDGER, chunks C1 to C10");
  out.push("");
  out.push(`Generated ${meta.date || "unknown date"} by scripts/killtest_ledger.mjs. System: website chain receipts (${meta.dir || "?"}), ${meta.count ?? "?"} receipt files scanned (FILL_fp_* planner receipts excluded). Source of kill tests: business plan chapter 6.`);
  out.push("");
  out.push("MATURITY is the build maturity from receipts (CORE EXEC3). TESTED = code tests were green per the receipt final line. It is NOT a claim that the kill test itself was met: every kill test is a live measure and is UNKNOWN until run.");
  out.push("");
  out.push("| Chunk | Kill test (plan text) | Receipts naming it | OK / FAILED | Last verdict | Maturity |");
  out.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    const rc = r.receipts.length ? r.receipts.join(", ") : "none";
    out.push(`| ${r.id} ${esc(r.name)} | ${esc(r.kill)} | ${esc(rc)} | ${r.okCount} / ${r.failedCount} | ${esc(r.last)} | ${r.maturity} |`);
  }
  out.push("");
  out.push(`TESTED or above: ${tested.length} of ${rows.length} (${tested.map((r) => r.id).join(", ") || "none"}).`);
  out.push(`No receipt (UNKNOWN): ${none.length} (${none.map((r) => r.id).join(", ") || "none"}).`);
  out.push(`Other: ${rows.filter((r) => !tested.includes(r) && !none.includes(r)).map((r) => r.id + " " + r.maturity).join(", ") || "none"}.`);
  return out.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const [plan, dir, out] = process.argv.slice(2);
  if (!plan || !dir) { console.error("usage: killtest_ledger.mjs <plan.md> <receipts_dir> [out.md]"); process.exit(2); }
  const rows = scan(readFileSync(plan, "utf8"), dir);
  if (!rows.length) { console.error("FAIL no C1..C10 rows parsed from plan"); process.exit(1); }
  const count = readdirSync(dir).filter((f) => /RECEIPT.*\.md$/.test(f) && !/^FILL_fp_/.test(f)).length;
  const md = renderTable(rows, { date: new Date().toISOString().slice(0, 10), dir, count });
  if (out) writeFileSync(out, md); else process.stdout.write(md);
}
