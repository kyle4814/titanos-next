// C9 figure freshness. Kill test: no figure on the Proof Wall, status page, investor room or trust pages
// can sit in the repo without a source path that exists, a system name and an ISO date, and a figure
// older than 30 days is listed. f22 lints the figures and f89 traces case studies; neither checks freshness.
//
// States (one primary state per figure; the flags array keeps every reason):
//   UNDATED  date absent, or not an ISO date (YYYY-MM-DD, optionally with a time and offset), or not a real calendar day
//   ORPHAN   no source path, or a named source path exists neither in the repo nor in the --receipts folder
//   NOSYSTEM no system name (EV6: WHICH system)
//   ALLOWED  (warning, never silent) the only defect is a source path that lives in another repo (the kernel) and is named in
//            scripts/figure_freshness_allowlist.json with a reason and an EXACT cap. A cap that is too high, too low or missing
//            fails the run, so the cap can only fall as figures are fixed; a path absent from the kernel checkout fails too.
//   FUTURE   date is after --as-of (warning)
//   STALE    date is more than 30 days before --as-of (warning); day 30 is FRESH, day 31 is STALE
//   FRESH    everything above is clean
// Exit 1 on any UNDATED, ORPHAN or NOSYSTEM. FUTURE is a warning. STALE is a warning when no allowlist is loaded; with the allowlist it must be classified per file with an exact cap or the run fails. Exit 2 on a usage error.
//
// Usage: node scripts/figure_freshness.mjs [--as-of YYYY-MM-DD] [--receipts DIR] [--root DIR] [--allowlist FILE] [--kernel DIR] [--json] [--quiet]
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const STALE_DAYS = 30;
const DAY_MS = 86400000;
export const FAILING = ["UNDATED", "ORPHAN", "NOSYSTEM"];
const PRIORITY = ["UNDATED", "ORPHAN", "NOSYSTEM", "ALLOWED", "FUTURE", "STALE", "FRESH"];

// ---- dates ------------------------------------------------------------------------------------
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
// Returns the calendar day as a UTC-midnight millisecond count, or null. The day is the one written, no timezone shifting.
export function parseIsoDay(s) {
  if (typeof s !== "string") return null;
  const m = ISO.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (m[4] !== undefined && (+m[4] > 23 || +m[5] > 59 || (m[6] !== undefined && +m[6] > 59))) return null;
  if (m[7] && m[7] !== "Z" && (+m[7].slice(1, 3) > 23 || +m[7].slice(4, 6) > 59)) return null;
  return t;
}

export function classifyDate(dateStr, asOfDay) {
  if (dateStr === undefined || dateStr === null || dateStr === "") return { flag: "UNDATED", reason: "no date" };
  const day = parseIsoDay(dateStr);
  if (day === null) return { flag: "UNDATED", reason: `not an ISO date: ${JSON.stringify(dateStr)}` };
  const age = Math.round((asOfDay - day) / DAY_MS);
  if (age < 0) return { flag: "FUTURE", reason: `${-age} day(s) after as-of`, age };
  if (age > STALE_DAYS) return { flag: "STALE", reason: `${age} days old`, age };
  return { flag: null, age };
}

// ---- sources ----------------------------------------------------------------------------------
const PATH_RX = /(?:[\w.~-]*\/)*[\w.-]+\.(?:json|jsonl|md|py|mjs|csv|log|ts|tsx|sh|pdf|txt)\b|(?:[\w.~-]*\/)+[\w.*-]*\*[\w.*-]*/g;
const URL_RX = /^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|tech|org|gov|au|io|net)(?:\/|$)/i;

function globExists(dir, pattern) {
  const rx = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$");
  try { return readdirSync(dir).some((f) => rx.test(f)); } catch { return false; }
}

export function pathExists(p, roots) {
  const rel = p.replace(/^~\//, "");
  const cands = [];
  for (const r of roots) {
    if (!r) continue;
    cands.push(join(r, rel));
    // absolute paths that name a kernel checkout: strip up to the checkout folder name
    const m = /klinge-kernel\/(.+)$/.exec(rel);
    if (m) cands.push(join(r, m[1]));
  }
  for (const c of cands) {
    if (c.includes("*")) { if (globExists(dirname(c), basename(c))) return true; continue; }
    if (existsSync(c)) return true;
  }
  return false;
}

// derivedKeys: Set of other figure ids a source may point at ("estate_ey, parttime"). Returns {ok, reason, paths, external, derived}.
export function checkSource(source, roots, derivedKeys = new Set(), derivedResolve = null, seen = new Set()) {
  const out = { ok: false, reason: "", paths: [], external: false, derived: [], missing: [], hard: false };
  // missing = source paths that do not exist; hard = a defect no allowlist may excuse (no source, no checkable path, a loop)
  if (typeof source !== "string" || !source.trim()) { out.reason = "no source"; out.hard = true; return out; }
  // Text in brackets is commentary on the source, not a source: strip it before looking for paths.
  const bare = source.replace(/\([^)]*\)/g, " ");
  const paths = [...bare.matchAll(PATH_RX)].map((m) => m[0]);
  const parts = source.split(/[,;]\s*/).map((s) => s.replace(/\s*\(.*$/, "").trim()).filter(Boolean);
  const derived = parts.filter((p) => derivedKeys.has(p));
  if (paths.length) {
    const missing = paths.filter((p) => !pathExists(p, roots));
    out.paths = paths;
    if (missing.length) { out.reason = `source path not found: ${missing.join(", ")}`; out.missing = missing; return out; }
    out.ok = true; return out;
  }
  if (derived.length && derived.length === parts.length && derivedResolve) {
    for (const d of derived) {
      if (seen.has(d)) { out.reason = `derived source loops at ${d}`; out.hard = true; return out; }
      const r = derivedResolve(d, new Set([...seen, d]));
      if (!r.ok) { out.reason = `derived from ${d}: ${r.reason}`; out.derived = derived; out.missing = r.missing || []; out.hard = !!r.hard || !(r.missing && r.missing.length); return out; }
    }
    out.ok = true; out.derived = derived; return out;
  }
  if (parts.length === 1 && URL_RX.test(parts[0])) { out.ok = true; out.external = true; return out; }
  out.reason = `source names no checkable path: ${JSON.stringify(source.slice(0, 80))}`;
  out.hard = true;
  return out;
}

// ---- adapters: one per data file ---------------------------------------------------------------
// Each returns figure records { id, system, date, source(s), derivedKeys? }. `paths` = a list of explicit source paths
// to check; `source` = one free-text source string. A record with no number (hasNumber false) is skipped, not scored.
const j = (root, rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

function proofWall(d) {
  const from = (d.generated && d.generated.from) || [];
  const figs = [];
  const add = (id, o) => o && figs.push({ id, system: o.source, date: o.date, paths: from, hasNumber: true });
  add("headline", d.headline); add("fleetCost", d.fleetCost);
  (d.charts || []).forEach((c) => add(`charts.${c.id}`, c));
  (d.stars || []).forEach((c) => add(`stars.${c.id}`, c));
  return figs;
}
function claimsLedger(d) {
  return (d.rows || []).map((r) => ({ id: `rows.${r.id}`, system: r.source, date: r.date,
    paths: ["lib/site-data/proof.json", "lib/site-data/sectors.json", "scripts/gen_open_data.mjs"], hasNumber: true }));
}
function statusData(d) {
  return (d.components || []).map((c) => ({ id: `components.${c.id}`, system: d.system, date: c.lastChecked,
    paths: ["lib/site-data/status-sample.json"], hasNumber: Number.isInteger(c.total) && c.total > 0 }));
}
function trustSections(d) {
  return (d.sections || []).map((s) => ({ id: `sections.${s.id}`, system: d.system, date: d.asOf, paths: s.source ? [s.source] : [], hasNumber: true }));
}
function trustCentre(d) {
  const items = d.items || d.sections || d.claims || [];
  return items.map((s, i) => ({ id: `items.${s.id || i}`, system: s.system || d.system, date: s.date || s.asOf || d.asOf || d.updated,
    paths: s.source ? [s.source] : [], hasNumber: true }));
}
function pricingTrace(d) {
  return (d.rows || []).map((r) => ({ id: `rows.${r.id}`, system: d.system, date: d.asOf, paths: r.source ? [r.source] : [], hasNumber: true }));
}
function investorLedger(d) {
  const keys = new Set([...Object.keys(d.n || {}), ...Object.keys(d.facts || {})]);
  const figs = Object.entries(d.n || {}).map(([k, f]) => ({ id: `n.${k}`, system: d.generated_by, date: f.as_of, source: f.source, derivedKeys: keys, hasNumber: true }));
  Object.entries(d.facts || {}).forEach(([k, f]) => figs.push({ id: `facts.${k}`, system: d.generated_by, date: d.facts_as_of, source: f.source, derivedKeys: keys, hasNumber: true }));
  return figs;
}
function pageStamps(d, root) {
  let ledgerDay = null;
  try { ledgerDay = j(root, "lib/ledger.json").facts_as_of; } catch { /* leave null */ }
  return Object.entries(d).filter(([k]) => k.startsWith("/")).map(([k, s]) => ({
    id: k, system: s.system, date: s.date ?? (s.dateFrom === "ledger" ? ledgerDay : undefined), paths: s.source ? [s.source] : [], hasNumber: true }));
}

export const ADAPTERS = [
  { file: "lib/site-data/proof.json", surface: "Proof Wall", fn: proofWall },
  { file: "public/data/claims-ledger.json", surface: "Proof Wall (open data)", fn: claimsLedger },
  { file: "public/data/status.json", surface: "Status page", fn: statusData },
  { file: "lib/ledger.json", surface: "Investor room", fn: investorLedger },
  { file: "lib/site-data/trust.json", surface: "Trust page", fn: trustSections },
  { file: "lib/trust-centre.json", surface: "Trust centre", fn: trustCentre },
  { file: "lib/site-data/pricing-trace.json", surface: "Pricing page", fn: pricingTrace },
  { file: "lib/site-data/provenance.json", surface: "Evidence page stamps", fn: pageStamps },
];

// ---- scan ---------------------------------------------------------------------------------------
// Kernel-relative form of a source path, so one allowlist key covers "bin/x.py", "~/bin/x.py" and "/home/u/klinge-kernel/bin/x.py".
export function kernelRel(p) {
  const m = /klinge-kernel\/(.+)$/.exec(p);
  return (m ? m[1] : p).replace(/^~\//, "");
}

// Validates the allowlist against what the scan found. Returns an array of error strings (empty = honest).
export function checkAllowlist(allowlist, used, kernel, staleUsed = new Map()) {
  const errs = [];
  if (!allowlist || !Array.isArray(allowlist.paths)) return ["allowlist has no paths array"];
  const seen = new Set();
  let sum = 0;
  for (const e of allowlist.paths) {
    const tag = `allowlist ${JSON.stringify(e && e.path)}`;
    if (!e || typeof e.path !== "string" || !e.path.trim()) { errs.push("allowlist entry without a path"); continue; }
    if (e.path !== kernelRel(e.path)) errs.push(`${tag}: write the kernel-relative path`);
    if (seen.has(e.path)) errs.push(`${tag}: duplicate entry`);
    seen.add(e.path);
    if (typeof e.reason !== "string" || e.reason.trim().length < 20) errs.push(`${tag}: needs a real reason (20+ characters)`);
    if (!Number.isInteger(e.cap) || e.cap < 1) { errs.push(`${tag}: cap must be an integer of 1 or more`); continue; }
    sum += e.cap;
    const n = used.get(e.path) || 0;
    if (n > e.cap) errs.push(`${tag}: ${n} figure(s) use it, cap is ${e.cap} (fix the figures, a cap never rises)`);
    if (n < e.cap) errs.push(`${tag}: only ${n} figure(s) use it, lower cap ${e.cap} to ${n}`);
    if (kernel && !existsSync(join(kernel, e.path))) errs.push(`${tag}: not found in the kernel checkout ${kernel} (allowlist rot)`);
  }
  // STALE figures are classified per data file: each file carries a reason and an exact cap, and an unlisted file may hold none.
  const stale = Array.isArray(allowlist.stale) ? allowlist.stale : [];
  const sfiles = new Set();
  for (const e of stale) {
    const tag = `stale ${JSON.stringify(e && e.file)}`;
    if (!e || typeof e.file !== "string" || !e.file) { errs.push("stale entry without a file"); continue; }
    if (sfiles.has(e.file)) errs.push(`${tag}: duplicate entry`);
    sfiles.add(e.file);
    if (typeof e.reason !== "string" || e.reason.trim().length < 20) errs.push(`${tag}: needs a real reason (20+ characters)`);
    if (!Number.isInteger(e.cap) || e.cap < 1) { errs.push(`${tag}: cap must be an integer of 1 or more`); continue; }
    const n = staleUsed.get(e.file) || 0;
    if (n > e.cap) errs.push(`${tag}: ${n} STALE figure(s), cap is ${e.cap} (refresh the figures, a cap never rises)`);
    if (n < e.cap) errs.push(`${tag}: only ${n} STALE figure(s), lower cap ${e.cap} to ${n}`);
  }
  for (const [f, n] of staleUsed) if (!sfiles.has(f)) errs.push(`stale ${JSON.stringify(f)}: ${n} STALE figure(s) with no classified entry`);
  if (allowlist.total_cap !== sum) errs.push(`allowlist total_cap ${allowlist.total_cap} must equal the sum of entry caps ${sum}`);
  return errs;
}

export function scan({ root, receipts = null, asOf, adapters = ADAPTERS, allowlist = null, kernel = null }) {
  const asOfDay = parseIsoDay(asOf);
  if (asOfDay === null || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error(`--as-of must be YYYY-MM-DD, got ${JSON.stringify(asOf)}`);
  const roots = [root, receipts];
  const used = new Map();
  const report = { allowed: [], allowlistErrors: [], kernel, asOf, root, receipts, staleDays: STALE_DAYS, scanned: [], notPresent: [], skippedNoNumber: [], figures: [], counts: {}, flagCounts: {}, externalSources: 0 };
  for (const a of adapters) {
    const full = join(root, a.file);
    if (!existsSync(full)) { report.notPresent.push(a.file); continue; }
    let data;
    try { data = JSON.parse(readFileSync(full, "utf8")); } catch (e) { report.figures.push(rec(a, { id: "(file)", date: null }, ["UNDATED"], [`unreadable JSON: ${e.message}`])); report.scanned.push(a.file); continue; }
    report.scanned.push(a.file);
    const figs = a.fn(data, root);
    const byId = new Map();
    for (const f of figs.filter((x) => x.id.startsWith("n."))) byId.set(f.id.slice(2), f);
    for (const f of figs.filter((x) => x.id.startsWith("facts."))) if (!byId.has(f.id.slice(6))) byId.set(f.id.slice(6), f);
    for (const f of figs) if (!byId.has(f.id)) byId.set(f.id, f);
    for (const f of figs) {
      if (!f.hasNumber) { report.skippedNoNumber.push(`${a.file}#${f.id}`); continue; }
      const flags = [], why = [];
      const dc = classifyDate(f.date, asOfDay);
      if (dc.flag) { flags.push(dc.flag); why.push(dc.reason); }
      if (typeof f.system !== "string" || !f.system.trim()) { flags.push("NOSYSTEM"); why.push("no system name"); }
      // source check
      const srcs = f.paths ? f.paths : [f.source];
      if (f.paths && !f.paths.length) { flags.push("ORPHAN"); why.push("no source"); }
      const missingAll = []; let hard = false;
      for (const s of f.paths ? f.paths : [f.source]) {
        const resolveDerived = (key, seen) => { const t = byId.get(key); return t ? checkSource(t.source, roots, f.derivedKeys, resolveDerived, seen) : { ok: false, hard: true, reason: `unknown figure ${key}` }; };
        const r = f.paths ? checkSource(s, roots) : checkSource(s, roots, f.derivedKeys || new Set(), resolveDerived, new Set([f.id.replace(/^(n|facts)\./, "")]));
        if (r.external) report.externalSources++;
        if (!r.ok) { missingAll.push(...(r.missing || [])); if (r.hard || !(r.missing && r.missing.length)) hard = true; }
        if (!r.ok && !flags.includes("ORPHAN")) { flags.push("ORPHAN"); why.push(r.reason); }
        else if (!r.ok) why.push(r.reason);
      }
      // An ORPHAN whose only defect is missing cross-repo paths, all named in the allowlist, becomes ALLOWED (still listed).
      if (allowlist && flags.includes("ORPHAN") && !hard && missingAll.length && !flags.some((x) => x === "UNDATED" || x === "NOSYSTEM")) {
        const keys = [...new Set(missingAll.map(kernelRel))];
        const listed = new Set((allowlist.paths || []).map((e) => e && e.path));
        if (keys.every((k) => listed.has(k))) {
          flags.splice(flags.indexOf("ORPHAN"), 1, "ALLOWED");
          keys.forEach((k) => used.set(k, (used.get(k) || 0) + 1));
          report.allowed.push({ file: a.file, id: f.id, paths: keys });
        }
      }
      report.figures.push(rec(a, f, flags, why, dc.age));
    }
  }
  if (allowlist) {
    const staleUsed = new Map();
    for (const f of report.figures) if (f.flags.includes("STALE")) staleUsed.set(f.file, (staleUsed.get(f.file) || 0) + 1);
    report.allowlistErrors = checkAllowlist(allowlist, used, kernel, staleUsed);
  }
  for (const s of PRIORITY) { report.counts[s] = 0; report.flagCounts[s] = 0; }
  for (const f of report.figures) { report.counts[f.state]++; f.flags.forEach((x) => report.flagCounts[x]++); }
  report.failing = report.figures.filter((f) => f.flags.some((x) => FAILING.includes(x)));
  report.warnings = report.figures.filter((f) => !f.flags.some((x) => FAILING.includes(x)) && f.flags.length);
  report.exitCode = report.failing.length || report.allowlistErrors.length ? 1 : 0;
  return report;
}
function rec(a, f, flags, why, age) {
  const state = flags.length ? PRIORITY.find((p) => flags.includes(p)) : "FRESH";
  return { file: a.file, surface: a.surface, id: f.id, system: f.system ?? null, date: f.date ?? null, age: age ?? null, state, flags, why };
}

// ---- CLI ----------------------------------------------------------------------------------------
function main(argv) {
  const opt = { root: join(dirname(fileURLToPath(import.meta.url)), ".."), receipts: null, asOf: new Date().toISOString().slice(0, 10), json: false, quiet: false, allowlist: undefined, kernel: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--as-of") opt.asOf = argv[++i];
    else if (a === "--receipts") opt.receipts = argv[++i];
    else if (a === "--root") opt.root = argv[++i];
    else if (a === "--allowlist") opt.allowlist = argv[++i];
    else if (a === "--kernel") opt.kernel = argv[++i];
    else if (a === "--json") opt.json = true;
    else if (a === "--quiet") opt.quiet = true;
    else { console.error(`unknown argument ${a}`); return 2; }
  }
  if (opt.receipts && !(existsSync(opt.receipts) && statSync(opt.receipts).isDirectory())) { console.error(`--receipts is not a folder: ${opt.receipts}`); return 2; }
  // The allowlist defaults to <root>/scripts/figure_freshness_allowlist.json when present (none = every hit counts).
  // The kernel checkout defaults to $FIGFRESH_KERNEL, then /home/tech2/klinge-kernel when it exists; absent = allowlisted paths are reported unverified.
  const alPath = opt.allowlist ?? join(opt.root, "scripts", "figure_freshness_allowlist.json");
  if (opt.allowlist && !existsSync(alPath)) { console.error(`--allowlist file not found: ${alPath}`); return 2; }
  if (existsSync(alPath)) { try { opt.allowlist = JSON.parse(readFileSync(alPath, "utf8")); } catch (e) { console.error(`allowlist unreadable: ${e.message}`); return 2; } } else opt.allowlist = null;
  const kd = opt.kernel ?? process.env.FIGFRESH_KERNEL ?? "/home/tech2/klinge-kernel";
  opt.kernel = existsSync(kd) && statSync(kd).isDirectory() ? kd : null;
  let r;
  try { r = scan(opt); } catch (e) { console.error(e.message); return 2; }
  if (opt.json) { console.log(JSON.stringify(r, null, 2)); return r.exitCode; }
  console.log(`figure_freshness as-of ${r.asOf} (stale after ${r.staleDays} days), receipts ${r.receipts || "none"}`);
  console.log(`scanned: ${r.scanned.join(", ") || "(none)"}`);
  if (r.notPresent.length) console.log(`not present in this tree: ${r.notPresent.join(", ")}`);
  console.log("counts: " + PRIORITY.map((s) => `${s} ${r.counts[s]}`).join("  ") + `  (figures ${r.figures.length}, skipped with no number ${r.skippedNoNumber.length}, external-url sources ${r.externalSources})`);
  if (!opt.quiet) {
    for (const f of r.failing) console.log(`FAIL ${f.state} ${f.file}#${f.id} [${f.flags.join("+")}] ${f.why.join("; ")}`);
    for (const f of r.warnings) console.log(`WARN ${f.state} ${f.file}#${f.id} ${f.why.join("; ")}`);
  }
  if (opt.allowlist) console.log(`allowlist: ${r.allowed.length} figure(s) ALLOWED on ${opt.allowlist.paths.length} kernel path(s); ` + (r.kernel ? `every path verified present in ${r.kernel}` : "kernel checkout absent, paths UNVERIFIED here"));
  for (const e of r.allowlistErrors) console.log(`FAIL ALLOWLIST ${e}`);
  console.log(r.exitCode ? `FAIL ${r.failing.length} figure(s) UNDATED, ORPHAN or NOSYSTEM, ${r.allowlistErrors.length} allowlist or STALE-classification error(s)` : "PASS no UNDATED, ORPHAN or NOSYSTEM figure");
  return r.exitCode;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
