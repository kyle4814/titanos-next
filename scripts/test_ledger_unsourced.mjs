// C9 (f395): a ledger row marked source_status "UNSOURCED" (or derived from one) can never render without the
// label "estimate, source pending". Runs the REAL lib/ledger.ts (copied to a temp folder with the json import patched for
// node) against a synthetic fixture and the real ledger.json; then plants a mutation (tag() made a no-op) and requires the
// same checks to FAIL. Also scans the site source for raw v("<unsourced key>") reads and hand-typed copies of the figures.
// Run: node --experimental-strip-types scripts/test_ledger_unsourced.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LABEL = "estimate, source pending";
const TS = readFileSync(join(ROOT, "lib/ledger.ts"), "utf8");
const REAL = JSON.parse(readFileSync(join(ROOT, "lib/ledger.json"), "utf8"));

const tmp = mkdtempSync(join(tmpdir(), "ledgunsrc-"));
if (!tmp || !existsSync(tmp) || !tmp.includes("ledgunsrc-")) { console.log("FAIL no safe temp dir"); process.exit(1); }

const mk = (name, ledgerObj, patch) => {
  const d = join(tmp, name); mkdirSync(d, { recursive: true });
  let ts = TS.replace(/import ledger from "\.\/ledger\.json";/, 'import ledger from "./ledger.json" with { type: "json" };');
  if (patch) ts = patch(ts);
  writeFileSync(join(d, "ledger.ts"), ts);
  writeFileSync(join(d, "ledger.json"), JSON.stringify(ledgerObj));
  // The runner prints, per key, every formatter's output and isUnsourced.
  writeFileSync(join(d, "run.ts"), `import * as L from "./ledger.ts";
const out: Record<string, unknown> = {};
for (const k of Object.keys(L.LEDGER)) {
  const key = k as keyof typeof L.LEDGER;
  out[k] = { un: L.isUnsourced(k), r: [L.int(key), L.dec(key), L.aud(key), L.audShort(key), L.times(key), L.rnd(key)] };
}
console.log(JSON.stringify(out));`);
  const r = spawnSync("node", ["--experimental-strip-types", "--no-warnings", join(d, "run.ts")], { encoding: "utf8" });
  if (r.status !== 0) return { err: (r.stderr || "").slice(0, 300) };
  return { out: JSON.parse(r.stdout) };
};

const ent = (extra = {}) => ({ as_of: "2026-11-07", label: "OPERATOR_STATED", method: "m", source: "s", unit: "AU$", value: 1234, ...extra });
const FIX = { ...REAL, n: { ...REAL.n,
  bare: ent({ source_status: "UNSOURCED" }),
  derived: ent({ source: "clean_a, bare" }),
  deeper: ent({ source: "derived" }),
  clean_a: ent({ source: "state/numbers/x.json" }),
  self_loop: ent({ source: "self_loop, clean_a" }),
  big: ent({ value: 24200000, source_status: "UNSOURCED" }),
} };

// 1. fixture: labelled when UNSOURCED or derived (transitively); never labelled when clean
const f = mk("fix", FIX);
ok(!f.err, "fixture ledger.ts loads under node strip-types" + (f.err ? " :: " + f.err : ""));
if (!f.err) {
  for (const k of ["bare", "derived", "deeper", "big"]) ok(f.out[k].un === true && f.out[k].r.every((s) => s.includes(`(${LABEL})`)), `${k}: every formatter (int, dec, aud, audShort, times, rnd) carries the label`);
  for (const k of ["clean_a", "self_loop"]) ok(f.out[k].un === false && f.out[k].r.every((s) => !s.includes("estimate")), `${k}: clean row renders plain, no label`);
}

// 2. real ledger: the two compute rows and every row derived from them are labelled in every formatter
const real = mk("real", REAL);
ok(!real.err, "real ledger loads" + (real.err ? " :: " + real.err : ""));
const unKeys = Object.keys(REAL.n).filter((k) => REAL.n[k].source_status === "UNSOURCED");
ok(unKeys.includes("compute_build_aud_month") && unKeys.includes("compute_today_aud_month"), "both kernel-audit UNSOURCED rows carry source_status UNSOURCED in lib/ledger.json");
let derivedKeys = [];
if (!real.err) {
  derivedKeys = Object.keys(real.out).filter((k) => real.out[k].un);
  for (const k of ["compute_build_aud_month", "compute_today_aud_month", "compute_build_total_aud", "per_dollar_build_x", "per_dollar_today_x", "per_dollar_full_x", "per_dollar_full_today_x"])
    ok(real.out[k].un && real.out[k].r.every((s) => s.includes(LABEL)), `real ${k}: labelled in every formatter`);
  const bad = Object.keys(real.out).filter((k) => !real.out[k].un && real.out[k].r.some((s) => s.includes("estimate")));
  ok(bad.length === 0, "no clean real row is labelled by mistake (" + bad.join(",") + ")");
  ok(derivedKeys.length >= 7 && derivedKeys.length <= 12, `unsourced set is the expected small closure (${derivedKeys.length}: ${derivedKeys.join(", ")})`);
}

// 3. static scan: no raw reads of an unsourced key, no hand-typed copy of the two stated figures
const walk = (d, acc = []) => { for (const n of readdirSync(d)) { if (["node_modules", ".next", "out", ".git"].includes(n)) continue; const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p, acc); else if (/\.(tsx?|mjs)$/.test(n)) acc.push(p); } return acc; };
const files = ["app", "components", "lib"].flatMap((d) => (existsSync(join(ROOT, d)) ? walk(join(ROOT, d)) : [])).filter((p) => !p.endsWith("lib/ledger.ts"));
const raw = [], typed = [];
for (const p of files) {
  const src = readFileSync(p, "utf8"), rel = relative(ROOT, p);
  for (const k of derivedKeys) if (new RegExp(`\\bv\\(\\s*["'\`]${k}["'\`]\\s*\\)|LEDGER(\\.|\\[\\s*["'])${k}\\b`).test(src)) raw.push(`${rel}:${k}`);
  for (const k of ["compute_build_aud_month", "compute_today_aud_month"]) {
    const val = REAL.n[k].value;
    if (new RegExp(`AU\\$${val}\\)?,? (a|per) month|roughly AU\\$${val}\\b`).test(src)) typed.push(`${rel}:AU$${val}`);
  }
}
ok(raw.length === 0, "no file reads an unsourced key raw via v()/LEDGER (use tag/aud/int/rnd): " + raw.join(", "));
ok(typed.length === 0, "no page hand-types AU$46 or AU$300 (must come from the ledger with the label): " + typed.join(", "));

// 4. mutation: make tag() a no-op; the labelled-render checks must now FAIL (so the test really guards the label)
const mut = mk("mut", FIX, (ts) => ts.replace(/export const tag = [^\n]+/, "export const tag = (_k: LedgerKey, text: string): string => text;"));
ok(!mut.err, "mutated copy still loads" + (mut.err ? " :: " + mut.err : ""));
if (!mut.err) {
  const stillLabelled = ["bare", "derived", "deeper", "big"].every((k) => mut.out[k].r.every((s) => s.includes(`(${LABEL})`)));
  ok(!stillLabelled, "MUTATION (label code removed): the labelled-render check fails, so the guard bites");
}
// 5. mutation: drop source_status from the real json; the stated rows must stop being flagged, which the status check catches
const R2 = JSON.parse(JSON.stringify(REAL)); delete R2.n.compute_today_aud_month.source_status;
const m2 = mk("mut2", R2);
ok(!m2.err && m2.out.compute_today_aud_month.un === false, "MUTATION (source_status removed): row renders unflagged, and the real-ledger status check above would fail");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
