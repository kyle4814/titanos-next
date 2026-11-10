// Migration merge plan (f189). Reads portal-api/migrations of N branches with git ls-tree / cat-file ONLY (no checkout of
// any branch), builds the combined set, reports every number collision, and proposes a renumbered apply order that keeps
// each branch's internal order and passes the f104 migration lint on a scratch copy. Applies NOTHING live (GATE5): the
// scratch copy lives under os.tmpdir and the SQL runs in an in-memory SQLite only.
// Identity: a migration is (filename, blob sha). Same name + same blob on two stacked branches = ONE migration (shared).
// Same name + different blob = CONFLICT (hard fail). Same number + different name = COLLISION (renumbered).
// Exit: 0 plan ok, 1 usage/git error, 2 conflict or order cycle, 3 lint/apply failure, 4 stale plan (--check).
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIG_DIR = "portal-api/migrations";
export const DEFAULT_LINT_REF = "origin/web/f104_migration_lint-2026-11-07";
const NAME_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

const git = (repo, args, opts = {}) => execFileSync("git", ["-C", repo, ...args], { encoding: opts.buf ? "buffer" : "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] });

// Per branch: [{name, num, blob}] sorted by (num, name) = the branch's internal order.
export function readBranch(repo, branch) {
  let out;
  try { out = git(repo, ["ls-tree", "-r", `${branch}:${MIG_DIR}`]); }
  catch (e) {
    const msg = String(e.stderr ?? e.message);
    if (/does not exist|exists on disk, but not in|Not a valid object/i.test(msg)) {
      try { git(repo, ["rev-parse", "--verify", `${branch}^{commit}`]); return []; } catch { throw new Error(`unknown branch ${branch}`); }
    }
    throw new Error(`git ls-tree failed for ${branch}: ${msg.trim()}`);
  }
  const files = [];
  for (const line of out.split("\n").filter(Boolean)) {
    const m = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);
    if (!m) continue;
    const name = m[2].split("/").pop();
    if (!name.endsWith(".sql")) continue;
    const nm = NAME_RE.exec(name);
    files.push({ name, num: nm ? +nm[1] : null, blob: m[1], badName: !nm });
  }
  return files.sort((a, b) => (a.num ?? 9999) - (b.num ?? 9999) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Pure planner (no git): input {branch: [{name,num,blob}]}. Returns {conflicts, collisions, order, cycle, badNames, shared}.
export function planFrom(byBranch, prefer = {}) {
  const branches = Object.keys(byBranch);
  const byName = new Map(); // name -> {num, blobs:Set, branches:[]}
  const badNames = [];
  for (const b of branches) for (const f of byBranch[b]) {
    if (f.badName) { badNames.push(`${b}: ${f.name}`); continue; }
    const e = byName.get(f.name) ?? byName.set(f.name, { name: f.name, num: f.num, blobs: new Map(), branches: [] }).get(f.name);
    (e.blobs.get(f.blob) ?? e.blobs.set(f.blob, []).get(f.blob)).push(b);
    e.branches.push(b);
  }
  const conflicts = [], resolved = [], chosen = {};
  for (const e of byName.values()) {
    if (e.blobs.size > 1) {
      const variants = [...e.blobs].map(([blob, bs]) => ({ blob: blob.slice(0, 10), full: blob, branches: bs }));
      const pick = prefer[e.name] && variants.filter((v) => v.full.startsWith(prefer[e.name]));
      if (pick && pick.length === 1) { resolved.push({ name: e.name, variants, chosen: pick[0].blob }); chosen[e.name] = pick[0].full; }
      else conflicts.push({ name: e.name, variants });
    } else chosen[e.name] = [...e.blobs.keys()][0];
  }
  const byNum = new Map();
  for (const e of byName.values()) (byNum.get(e.num) ?? byNum.set(e.num, []).get(e.num)).push(e);
  const collisions = [...byNum].filter(([, es]) => es.length > 1).sort((a, b) => a[0] - b[0])
    .map(([num, es]) => ({ num, files: es.map((e) => ({ name: e.name, branches: [...new Set(e.branches)].sort() })).sort((a, b) => (a.name < b.name ? -1 : 1)) }));
  // Precedence edges: for each branch, consecutive files in its internal order.
  const names = [...byName.keys()];
  const succ = new Map(names.map((n) => [n, new Set()])), indeg = new Map(names.map((n) => [n, 0]));
  for (const b of branches) {
    const seq = byBranch[b].filter((f) => !f.badName).map((f) => f.name);
    for (let i = 0; i + 1 < seq.length; i++) if (!succ.get(seq[i]).has(seq[i + 1])) { succ.get(seq[i]).add(seq[i + 1]); indeg.set(seq[i + 1], indeg.get(seq[i + 1]) + 1); }
  }
  const key = (n) => `${String(byName.get(n).num).padStart(4, "0")}|${n}`;
  const ready = names.filter((n) => indeg.get(n) === 0).sort((a, b) => (key(a) < key(b) ? -1 : 1));
  const order = [];
  while (ready.length) {
    const n = ready.shift(); order.push(n);
    for (const s of succ.get(n)) { indeg.set(s, indeg.get(s) - 1); if (indeg.get(s) === 0) { ready.push(s); ready.sort((a, b) => (key(a) < key(b) ? -1 : 1)); } }
  }
  const cycle = order.length === names.length ? null : names.filter((n) => !order.includes(n)).sort();
  const proposed = order.map((n, i) => ({ seq: i + 1, newName: `${String(i + 1).padStart(4, "0")}_${NAME_RE.exec(n)[2]}.sql`, oldName: n, oldNum: byName.get(n).num, renamed: byName.get(n).num !== i + 1, branches: [...new Set(byName.get(n).branches)].sort() }));
  return { branches, conflicts, resolved, chosen, collisions, badNames, cycle, order: proposed, shared: proposed.filter((p) => p.branches.length === branches.length).length };
}

function ensureLint(repo, lintRef, scratch) {
  const local = join(HERE, "migration_lint.mjs");
  const dest = join(scratch, "migration_lint.mjs");
  const src = existsSync(local) ? readFileSync(local, "utf8") : git(repo, ["show", `${lintRef}:portal-api/scripts/migration_lint.mjs`]);
  writeFileSync(dest, src);
  return dest;
}

// Writes the proposed order to a scratch dir, runs the f104 lint (names + apply-in-order; TS/SQL pairs need a src tree, so []).
// A semantic overlap renumbering cannot fix (two migrations adding the same column): --strip name.sql=REGEX drops matching
// lines from that file in the SCRATCH copy and the plan records it as a required content edit before merge.
export const applyStrip = (text, rx) => (rx ? text.split("\n").filter((l) => !new RegExp(rx).test(l)).join("\n") : text);

export async function verifyOnScratch(repo, plan, lintRef = DEFAULT_LINT_REF) {
  const scratch = mkdtempSync(join(tmpdir(), "migplan-"));
  try {
    const mdir = join(scratch, "migrations"); mkdirSync(mdir);
    for (const p of plan.order) writeFileSync(join(mdir, p.newName), applyStrip(git(repo, ["cat-file", "blob", plan.chosen[p.oldName]]), plan.strips?.[p.oldName]));
    const lintPath = ensureLint(repo, lintRef, scratch);
    const { lint } = await import(pathToFileURL(lintPath).href + `?t=${Date.now()}`);
    const r = lint({ migDir: mdir, srcRoot: scratch, pairs: [], discover: false, declaredPath: join(scratch, "none.json") });
    return { failures: r.failures, warnings: r.warnings, files: r.files.length };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

export async function buildPlan(repo, branches, { lintRef = DEFAULT_LINT_REF, lint = true, prefer = {}, strips = {} } = {}) {
  const byBranch = {};
  for (const b of branches) byBranch[b] = readBranch(repo, b);
  const plan = planFrom(byBranch, prefer);
  Object.defineProperty(plan, "_byBranch", { value: byBranch, enumerable: false });
  plan.strips = strips;
  plan.lint = null;
  if (lint && !plan.conflicts.length && !plan.cycle && !plan.badNames.length) plan.lint = await verifyOnScratch(repo, plan, lintRef);
  plan.perBranch = branches.map((b) => ({ branch: b, count: byBranch[b].length, files: byBranch[b].map((f) => f.name) }));
  return plan;
}

export function exitCode(plan) {
  if (plan.conflicts.length || plan.cycle || plan.badNames.length) return 2;
  if (plan.lint && plan.lint.failures.length) return 3;
  return 0;
}

export function toMarkdown(plan, meta = {}) {
  const L = [];
  L.push("# Migration merge plan (f189)", "");
  L.push(`Generated ${meta.date ?? ""} by \`portal-api/scripts/migration_merge_plan.mjs\` from \`${meta.base ?? "origin/main"}\`. Read-only: git ls-tree / cat-file only, scratch copy in os.tmpdir, in-memory SQLite. Nothing applied, nothing deployed.`, "");
  L.push("Identity rule: same filename and same blob on two stacked branches is ONE migration. Same filename, different blob is a CONFLICT. Same number, different filename is a COLLISION (renumbered below). Each branch's internal (number, name) order is kept.", "");
  L.push("## Summary", "");
  L.push(`- Branches scanned: ${plan.branches.length} (with migrations)`);
  L.push(`- Distinct migrations: ${plan.order.length} (present on every scanned branch: ${plan.shared})`);
  L.push(`- Number collisions: ${plan.collisions.length}`);
  L.push(`- Conflicts (same name, different content): ${plan.conflicts.length}`);
  L.push(`- Order cycle: ${plan.cycle ? "YES " + plan.cycle.join(", ") : "none"}`);
  L.push(`- f104 lint on scratch copy: ${plan.lint ? (plan.lint.failures.length ? "FAILED " + plan.lint.failures.join(" | ") : `OK (${plan.lint.files} migrations, ${plan.lint.warnings.length} warnings)`) : "not run"}`, "");
  L.push("## Number collisions", "");
  if (!plan.collisions.length) L.push("none"); else for (const c of plan.collisions) { L.push(`### ${String(c.num).padStart(4, "0")} (${c.files.length} files)`); for (const f of c.files) L.push(`- \`${f.name}\` on ${f.branches.length} branches: ${f.branches.slice(0, 3).join(", ")}${f.branches.length > 3 ? `, (+${f.branches.length - 3} more)` : ""}`); L.push(""); }
  L.push("", "## Conflicts", "");
  if (!plan.conflicts.length) L.push("none"); else for (const c of plan.conflicts) { L.push(`- \`${c.name}\`: ` + c.variants.map((v) => `${v.blob} on ${v.branches.join(", ")}`).join(" vs ")); }
  L.push("", "## Resolved conflicts (explicit --prefer)", "");
  if (!plan.resolved.length) L.push("none"); else for (const c of plan.resolved) L.push(`- \`${c.name}\`: kept blob ${c.chosen}; variants: ` + c.variants.map((v) => `${v.blob} on ${v.branches.length} branches (${v.branches.slice(0, 3).join(", ")}${v.branches.length > 3 ? ", ..." : ""})`).join(" vs "));
  L.push("", "## Content edits required before merge (--strip)", "");
  if (!Object.keys(plan.strips ?? {}).length) L.push("none"); else for (const [n, rx] of Object.entries(plan.strips)) L.push(`- \`${n}\`: remove lines matching \`${rx}\` (duplicate of a column added by another migration in the set; renumbering cannot fix a repeated ALTER)`);
  L.push("", "## Proposed apply order", "", "| New | Old name | Renamed | On branches |", "|---|---|---|---|");
  for (const p of plan.order) L.push(`| \`${p.newName}\` | \`${p.oldName}\` | ${p.renamed ? "yes" : "no"} | ${p.branches.length} |`);
  L.push("", "## Per-branch contribution", "", "| Branch | Migrations |", "|---|---|");
  for (const b of plan.perBranch) L.push(`| ${b.branch} | ${b.count} |`);
  if (meta.cmd) L.push("", "## Regenerate", "", "```", meta.cmd, "```");
  L.push("", "## WOULD-FLIP", "", "A branch added after this plan that carries a migration changes the set: re-run with `--check portal-api/MIGRATION_MERGE_PLAN.json` (or `docs/MIGRATION_MERGE_PLAN.json`); it exits 4 if the set or order differs from the committed plan. Renaming applies only when the stacks merge (GATE5); this plan renames nothing on any branch.", "");
  return L.join("\n");
}

export const snapshot = (plan) => ({ blobs: plan.chosen, strips: plan.strips ?? {}, branches: [...plan.branches].sort(), order: plan.order.map((p) => [p.newName, p.oldName]), collisions: plan.collisions.map((c) => c.num) });

function listBranches(repo, pattern) {
  const re = new RegExp(pattern);
  const all = git(repo, ["for-each-ref", "--format=%(refname:short)", "refs/remotes", "refs/heads"]).split("\n").filter(Boolean);
  return all.filter((r) => re.test(r) && !r.endsWith("/HEAD")).sort();
}

async function main(argv) {
  const o = { repo: process.cwd(), out: null, json: null, check: null, glob: null, lintRef: DEFAULT_LINT_REF, base: "origin/main", branches: [], prefer: {}, strips: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") o.repo = argv[++i]; else if (a === "--out") o.out = argv[++i]; else if (a === "--json") o.json = argv[++i];
    else if (a === "--check") o.check = argv[++i]; else if (a === "--glob") o.glob = argv[++i]; else if (a === "--lint-ref") o.lintRef = argv[++i];
    else if (a === "--base") o.base = argv[++i]; else if (a === "--strip") { const i2 = argv[++i].indexOf("="); const v = argv[i]; o.strips[v.slice(0, i2)] = v.slice(i2 + 1); } else if (a === "--prefer") { const [n, h] = argv[++i].split("="); o.prefer[n] = h; } else if (a.startsWith("--")) { console.error(`unknown flag ${a}`); return 1; } else o.branches.push(a);
  }
  try {
    if (o.glob) o.branches.push(...listBranches(o.repo, o.glob));
    // Keep only branches that actually carry a migration, de-duplicating origin/x vs x.
    const seen = new Set(); o.branches = o.branches.filter((b) => !seen.has(b.replace(/^origin\//, "")) && seen.add(b.replace(/^origin\//, "")));
    if (!o.branches.length) { console.error("usage: migration_merge_plan.mjs [--repo dir] [--glob regex] [--out md] [--json file] [--check json] [--lint-ref ref] [--prefer name.sql=blobprefix] [--strip name.sql=regex] <branch>..."); return 1; }
    const withMig = [];
    for (const b of o.branches) if (readBranch(o.repo, b).length) withMig.push(b);
    const plan = await buildPlan(o.repo, withMig, { lintRef: o.lintRef, prefer: o.prefer, strips: o.strips });
    const snap = snapshot(plan);
    if (o.out) { mkdirSync(dirname(o.out), { recursive: true }); writeFileSync(o.out, toMarkdown(plan, { date: new Date().toISOString().slice(0, 10), base: o.base, cmd: "node --disable-warning=ExperimentalWarning portal-api/scripts/migration_merge_plan.mjs " + process.argv.slice(2).map((x) => (/[\s$^]/.test(x) ? `'${x}'` : x)).join(" ") })); }
    if (o.json) writeFileSync(o.json, JSON.stringify(snap, null, 1) + "\n");
    console.log(`scanned ${o.branches.length} branches, ${withMig.length} with migrations; ${plan.order.length} distinct; ${plan.collisions.length} collisions; ${plan.conflicts.length} conflicts; cycle ${plan.cycle ? "YES" : "no"}; lint ${plan.lint ? (plan.lint.failures.length ? "FAILED" : "OK") : "not run"}`);
    for (const c of plan.conflicts) console.log(`CONFLICT ${c.name}`);
    if (plan.cycle) console.log(`CYCLE ${plan.cycle.join(", ")}`);
    for (const f of plan.lint?.failures ?? []) console.log(`LINT FAIL ${f}`);
    let code = exitCode(plan);
    if (code === 0 && o.check) {
      const prev = JSON.parse(readFileSync(o.check, "utf8"));
      const added = snap.branches.filter((b) => !prev.branches.includes(b)), gone = prev.branches.filter((b) => !snap.branches.includes(b));
      if (JSON.stringify(prev.order) !== JSON.stringify(snap.order) || added.length || gone.length) {
        console.log(`STALE PLAN: branches added ${JSON.stringify(added)} removed ${JSON.stringify(gone)}; order ${JSON.stringify(prev.order) === JSON.stringify(snap.order) ? "same" : "differs"}`); code = 4;
      } else console.log("plan current");
    }
    return code;
  } catch (e) { console.error(`ERROR ${e.message}`); return 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2)).then((c) => process.exit(c));
