// Migration collision report (f297). REPORT-ONLY: git ls-tree only, never checks out, renumbers or applies anything (GATE5).
// Gap it fills (searched 2026-11-08): migration_lint.mjs checks ONE tree (dup/gap), migration_merge_plan.mjs plans a combined
// renumber of stacked branches. Neither answers the merge-batch question: "which UNMERGED branch adds a number already taken on
// the base or on another listed branch, and what is the next free number?" This does, and flags backdated (non-monotonic) adds.
// Pure core: analyse(baseFiles, {branch: files}) takes plain name lists. CLI: node scripts/migration_collisions.mjs [--repo dir] [--base ref] [--json] [--glob regex] [refs...]
// Exit: 0 clean, 2 collision/bad name found, 1 usage/git error. Identity = filename (a branch carrying a base file is not "adding" it).
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MIG_DIR = "portal-api/migrations";
const NAME_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const pad = (n) => String(n).padStart(4, "0");

// Duplicate prefixes, gaps and bad names inside ONE list of filenames (the base tree).
export function treeReport(files) {
  const byNum = new Map(), badNames = [];
  for (const f of files) {
    const m = NAME_RE.exec(f);
    if (!m) { badNames.push(f); continue; }
    (byNum.get(+m[1]) ?? byNum.set(+m[1], []).get(+m[1])).push(f);
  }
  const nums = [...byNum.keys()].sort((a, b) => a - b);
  const duplicates = nums.filter((n) => byNum.get(n).length > 1).map((n) => ({ num: n, files: byNum.get(n).sort() }));
  const gaps = [];
  for (let i = nums[0] ?? 1; i < (nums.at(-1) ?? 0); i++) if (!byNum.has(i)) gaps.push(i);
  return { count: files.length, max: nums.at(-1) ?? 0, duplicates, gaps, badNames, nums };
}

// Non-monotonic names: sorted by name, the numeric prefixes must be strictly increasing (a repeat = duplicate, a drop = bad order).
export function nonMonotonic(files) {
  const ok = files.filter((f) => NAME_RE.test(f)).sort();
  const out = [];
  for (let i = 1; i < ok.length; i++) if (+NAME_RE.exec(ok[i])[1] <= +NAME_RE.exec(ok[i - 1])[1]) out.push(`${ok[i - 1]} -> ${ok[i]}`);
  return out;
}

// byBranch: {ref: [filenames on that ref]}. Returns per-branch adds, collisions, backdated adds, and suggested next free numbers.
export function analyse(baseFiles, byBranch) {
  const base = treeReport(baseFiles), baseSet = new Set(baseFiles);
  const baseByNum = new Map(baseFiles.filter((f) => NAME_RE.test(f)).map((f) => [+NAME_RE.exec(f)[1], f]));
  const adds = {}; // ref -> [{name,num}]
  for (const [ref, files] of Object.entries(byBranch)) {
    adds[ref] = files.filter((f) => !baseSet.has(f)).map((f) => ({ name: f, num: NAME_RE.test(f) ? +NAME_RE.exec(f)[1] : null }));
  }
  const taken = new Set(baseByNum.keys());
  for (const a of Object.values(adds)) for (const x of a) if (x.num !== null) taken.add(x.num);
  const nextFree = (from) => { let n = from; while (taken.has(n)) n++; return n; };
  const collisions = [], backdated = [], badNames = [];
  for (const [ref, a] of Object.entries(adds)) {
    for (const x of a) {
      if (x.num === null) { badNames.push({ ref, name: x.name }); continue; }
      if (baseByNum.has(x.num)) collisions.push({ ref, name: x.name, num: x.num, kind: "base", with: [{ where: "base", name: baseByNum.get(x.num) }] });
      const others = Object.entries(adds).filter(([r2]) => r2 !== ref).flatMap(([r2, a2]) => a2.filter((y) => y.num === x.num && y.name !== x.name).map((y) => ({ where: r2, name: y.name })));
      if (others.length) collisions.push({ ref, name: x.name, num: x.num, kind: "branch", with: others });
      if (x.num < base.max && !baseByNum.has(x.num)) backdated.push({ ref, name: x.name, num: x.num, baseMax: base.max });
    }
  }
  // Suggested number: allocate sequentially above everything seen, in a stable order (collisions only), never reusing one.
  const alloc = new Set(), suggestions = [];
  let cursor = Math.max(base.max, ...[...taken]) + 1;
  for (const c of [...collisions].sort((a, b) => (a.ref + a.name < b.ref + b.name ? -1 : 1))) {
    const key = c.ref + "|" + c.name;
    if (alloc.has(key)) continue;
    alloc.add(key);
    const n = cursor++;
    suggestions.push({ ref: c.ref, name: c.name, suggested: pad(n) + c.name.slice(4) });
  }
  const perBranch = Object.entries(adds).map(([ref, a]) => ({ ref, adds: a.length, collisions: collisions.filter((c) => c.ref === ref).length }));
  return { base, baseNonMonotonic: nonMonotonic(baseFiles), perBranch, collisions, backdated, badNames, suggestions, nextFree: nextFree(base.max + 1) };
}

export function exitCode(r) {
  return r.base.duplicates.length || r.base.badNames.length || r.collisions.length || r.badNames.length ? 2 : 0;
}

const git = (repo, args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] });
export function filesOn(repo, ref) {
  try { return git(repo, ["ls-tree", "-r", "--name-only", `${ref}:${MIG_DIR}`]).split("\n").filter((l) => l.endsWith(".sql")).map((l) => l.split("/").pop()); }
  catch (e) {
    try { git(repo, ["rev-parse", "--verify", `${ref}^{commit}`]); return []; } catch { throw new Error(`unknown ref ${ref}`); }
  }
}

export function render(r, base) {
  const L = [`MIGRATION COLLISION REPORT base=${base} migrations=${r.base.count} max=${pad(r.base.max)} next free=${pad(r.nextFree)}`];
  for (const d of r.base.duplicates) L.push(`BASE DUPLICATE ${pad(d.num)}: ${d.files.join(", ")}`);
  if (r.base.gaps.length) L.push(`BASE GAPS: ${r.base.gaps.map(pad).join(", ")}`);
  for (const n of r.base.badNames) L.push(`BASE BAD NAME: ${n}`);
  for (const n of r.baseNonMonotonic) L.push(`BASE NON-MONOTONIC: ${n}`);
  for (const c of r.collisions) L.push(`COLLISION ${c.ref}: ${c.name} number ${pad(c.num)} taken by ${c.with.slice(0, 3).map((w) => w.where + ":" + w.name).join(", ")}${c.with.length > 3 ? ` (+${c.with.length - 3} more)` : ""}`);
  for (const b of r.backdated) L.push(`BACKDATED ${b.ref}: ${b.name} (${pad(b.num)} < base max ${pad(b.baseMax)})`);
  for (const b of r.badNames) L.push(`BAD NAME ${b.ref}: ${b.name}`);
  for (const s of r.suggestions) L.push(`SUGGEST ${s.ref}: ${s.name} -> ${s.suggested}`);
  L.push(`branches=${r.perBranch.length} with adds=${r.perBranch.filter((p) => p.adds).length} colliding=${new Set(r.collisions.map((c) => c.ref)).size} collisions=${r.collisions.length}`);
  return L.join("\n");
}

function main(argv) {
  const o = { repo: process.cwd(), base: "HEAD", json: false, glob: null, refs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") o.repo = argv[++i]; else if (a === "--base") o.base = argv[++i]; else if (a === "--json") o.json = true;
    else if (a === "--glob") o.glob = argv[++i]; else o.refs.push(a);
  }
  try {
    if (o.glob) { const re = new RegExp(o.glob); o.refs.push(...git(o.repo, ["for-each-ref", "--format=%(refname:short)", "refs/remotes"]).split("\n").filter((r) => r && re.test(r) && !r.endsWith("/HEAD"))); }
    const byBranch = {};
    for (const ref of new Set(o.refs)) { if (ref !== o.base) byBranch[ref] = filesOn(o.repo, ref); }
    const r = analyse(filesOn(o.repo, o.base), byBranch);
    console.log(o.json ? JSON.stringify(r, null, 1) : render(r, o.base));
    return exitCode(r);
  } catch (e) { console.error(`ERROR ${e.message}`); return 1; }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
