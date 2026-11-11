// proof_feed_freshness_gate.mjs: READ-ONLY gate (f388). Is the site copy of the proof feeds older than the kernel baseline?
//   kernel : <kernel-dir>/BASELINE_<date>.json (newest by name; field ts). Default ~/klinge-kernel/state/baseline (what f382 used).
//   site   : lib/site-data/proof.json (generated.baselineTs) and lib/ledger.json (newest row `measured`).
// Prints the age in days of each. Verdicts per site file:
//   FRESH | STALE-VS-KERNEL (site date earlier than the kernel baseline) | PAST-MAX (older than MAX_DAYS vs today) | ERROR (missing/malformed site file).
// Kernel baseline missing or malformed = UNKNOWN: exit 0 with a loud WARNING, never a silent green.
// Flags: --kernel-dir D  --site-root D  --today YYYY-MM-DD (or PROOF_TODAY)  --mode fail|warn  (warn prints WARN and exits 0 on STALE/PAST-MAX; ERROR is always exit 2)
// Exit: 0 fresh or UNKNOWN or warn-mode; 1 stale/past-max in fail mode; 2 malformed/missing site file.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export const MAX_DAYS = 30;
const DAY = 86400000;
const iso = (s) => { const t = Date.parse(String(s).length === 10 ? `${s}T00:00:00Z` : /Z|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`); return Number.isNaN(t) ? null : t; };
const days = (a, b) => Math.max(0, Math.floor((a - b) / DAY));

export function readJson(path) {
  if (!existsSync(path)) return { error: `missing: ${path}` };
  try { return { value: JSON.parse(readFileSync(path, "utf8")) }; } catch (e) { return { error: `malformed JSON: ${path} (${e.message.slice(0, 60)})` }; }
}

/** Pure. kernelTs/siteTs are ms or null. Returns {verdict, ageDays, vsKernelDays}. */
export function judge({ siteTs, kernelTs, todayTs, maxDays = MAX_DAYS }) {
  if (siteTs == null) return { verdict: "ERROR", reason: "site date unreadable" };
  const ageDays = days(todayTs, siteTs);
  const vsKernelDays = kernelTs == null ? null : days(kernelTs, siteTs);
  if (ageDays > maxDays) return { verdict: "PAST-MAX", ageDays, vsKernelDays };
  if (kernelTs != null && siteTs < kernelTs && days(kernelTs, siteTs) >= 1) return { verdict: "STALE-VS-KERNEL", ageDays, vsKernelDays };
  return { verdict: "FRESH", ageDays, vsKernelDays };
}

export function kernelBaseline(dir) {
  if (!existsSync(dir)) return { unknown: `kernel baseline dir missing: ${dir}` };
  const f = readdirSync(dir).filter((n) => /^BASELINE_\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().pop();
  if (!f) return { unknown: `no BASELINE_*.json in ${dir}` };
  const r = readJson(`${dir}/${f}`);
  if (r.error) return { unknown: r.error };
  const ts = iso(r.value.ts || "");
  return ts == null ? { unknown: `${f} has no readable ts` } : { file: f, ts, raw: r.value.ts };
}

export function run({ kernelDir, siteRoot, today, mode }) {
  const out = [];
  const todayTs = iso(today);
  const k = kernelBaseline(kernelDir);
  if (k.unknown) out.push(`UNKNOWN kernel baseline: ${k.unknown} (site not compared to the kernel; only MAX_DAYS applies) WARNING`);
  else out.push(`kernel ${k.file} ts=${k.raw} age=${days(todayTs, k.ts)}d`);
  const sites = [];
  const p = readJson(`${siteRoot}/lib/site-data/proof.json`);
  if (p.error) sites.push({ name: "proof.json", verdict: "ERROR", reason: p.error });
  else sites.push({ name: "proof.json", date: p.value?.generated?.baselineTs, ...judge({ siteTs: iso(p.value?.generated?.baselineTs || ""), kernelTs: k.ts ?? null, todayTs }) });
  const l = readJson(`${siteRoot}/lib/ledger.json`);
  if (l.error) sites.push({ name: "ledger.json", verdict: "ERROR", reason: l.error });
  else {
    const ds = Object.values(l.value?.n || {}).map((r) => r && r.measured).filter(Boolean).map(iso).filter((t) => t != null);
    const newest = ds.length ? Math.max(...ds) : null;
    sites.push({ name: "ledger.json", date: newest == null ? null : new Date(newest).toISOString().slice(0, 10), ...judge({ siteTs: newest, kernelTs: k.ts ?? null, todayTs }) });
  }
  for (const s of sites) out.push(`${s.verdict.padEnd(16)} ${s.name.padEnd(12)} date=${s.date ?? "-"} age=${s.ageDays ?? "-"}d behind-kernel=${s.vsKernelDays ?? "-"}d${s.reason ? " " + s.reason : ""}`);
  const err = sites.some((s) => s.verdict === "ERROR");
  const bad = sites.some((s) => s.verdict === "STALE-VS-KERNEL" || s.verdict === "PAST-MAX");
  let code = err ? 2 : bad && mode !== "warn" ? 1 : 0;
  out.push(err ? "RESULT=ERROR" : bad ? (mode === "warn" ? "RESULT=WARN (stale site proof data; warn mode, exit 0)" : "RESULT=FAIL (re-run node scripts/reexport_proof_feed.mjs)") : k.unknown ? "RESULT=UNKNOWN (exit 0, kernel baseline unreadable)" : "RESULT=PASS");
  return { code, text: out.join("\n") };
}

if (process.argv[1] && process.argv[1].endsWith("proof_feed_freshness_gate.mjs")) {
  const a = process.argv.slice(2);
  const v = (n, d) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : d; };
  const siteRoot = resolve(v("--site-root", new URL("../", import.meta.url).pathname));
  const r = run({ kernelDir: v("--kernel-dir", `${homedir()}/klinge-kernel/state/baseline`), siteRoot, today: v("--today", process.env.PROOF_TODAY || new Date().toISOString().slice(0, 10)), mode: v("--mode", "fail") });
  console.log(r.text);
  process.exit(r.code);
}
