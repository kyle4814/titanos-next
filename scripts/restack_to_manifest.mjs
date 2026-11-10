// C10 restack tool. Moves a fill branch that still edits the old one-line package.json "test"
// && chain onto the test manifest (scripts/test_manifest.txt, merge=union).
//
// Usage: node scripts/restack_to_manifest.mjs <fill-branch> [--base <ref>] [--repo <dir>] [--push] [--json]
//   Dry-run by default: merges the fill branch into a scratch worktree under SCRATCH_ROOT
//   (default /home/tech2/kk-restack-f340), resolves the known magnets, prints
//   "LANDED" or "CONFLICT <files>", then removes the scratch worktree.
//   --push writes ONLY a new branch <branch>-rs (merge commit: base + fill); it never touches
//   main, the base, or the original branch, and refuses if <branch>-rs already exists on origin.
//
// Resolution rules:
//   package.json   : commands the fill added to the old "test" && chain (diff merge-base..branch)
//                    are appended to scripts/test_manifest.txt (no duplicates); base package.json
//                    is restored. If package.json has any NON-test edit, it stays a CONFLICT.
//   test_no_orphan_scripts.sh : base version on conflict.
//   everything else: a git conflict stays a CONFLICT.
//   After resolving, scripts/test_manifest_lint.mjs must pass or the branch is a CONFLICT.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST = "scripts/test_manifest.txt";
const ORPHAN = "scripts/test_no_orphan_scripts.sh";
const DEFAULT_SCRATCH = "/home/tech2/kk-restack-f340";
const PROTECTED = new Set(["main", "master"]);

function git(cwd, args, { ok = false } = {}) {
  // rerere off: a recorded resolution must never decide for the tool.
  const a = ["-c", "rerere.enabled=false", "-c", "core.hooksPath=/dev/null", ...args];
  try {
    return execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
  } catch (e) {
    if (ok) return null;
    throw new Error(`git ${args.join(" ")} failed: ${(e.stderr || e.message).toString().trim()}`);
  }
}

function pkgAt(repo, ref) {
  const txt = git(repo, ["show", `${ref}:package.json`], { ok: true });
  return txt === null ? null : JSON.parse(txt);
}
const chainOf = (pkg) => (pkg?.scripts?.test ?? "").split(" && ").map((s) => s.trim()).filter(Boolean);
function withoutTest(pkg) {
  const c = structuredClone(pkg ?? {});
  if (c.scripts) delete c.scripts.test;
  return JSON.stringify(c);
}

/** Pure analysis of package.json: which commands did the fill add, and are there non-test edits? */
export function analysePackage(repo, base, branch) {
  const mb = git(repo, ["merge-base", base, branch]).trim();
  const old = pkgAt(repo, mb), mine = pkgAt(repo, branch);
  const oldChain = new Set(chainOf(old));
  const added = chainOf(mine).filter((c) => !oldChain.has(c));
  const nonTestEdits = withoutTest(old) !== withoutTest(mine);
  const touched = JSON.stringify(old) !== JSON.stringify(mine);
  return { mergeBase: mb, added, nonTestEdits, touched };
}

/** Force the merged package.json "test" line back to base's; false if that cannot be proven. */
function keepMergedPackage(wt, base, pkgPath) {
  const baseTxt = git(wt, ["show", `${base}:package.json`]);
  const rx = /^\s*"test":.*$/m;
  const baseLine = baseTxt.match(rx)?.[0];
  let txt = readFileSync(pkgPath, "utf8");
  if (!baseLine || !rx.test(txt) || txt.includes("<<<<<<<")) return false;
  txt = txt.replace(rx, () => baseLine.replace(/,?\s*$/, (txt.match(rx)[0].trimEnd().endsWith(",") ? "," : "")));
  try {
    if (JSON.parse(txt).scripts.test !== JSON.parse(baseTxt).scripts.test) return false;
  } catch { return false; }
  writeFileSync(pkgPath, txt);
  git(wt, ["add", "package.json"]);
  return true;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Key-level 3-way of plain JSON. Returns { value, conflicts: [dotted.path] }. Ours key order is kept,
 *  keys only theirs added are appended. Deleting on one side and leaving the other alone is clean. */
export function merge3(base, ours, theirs, path = "") {
  const conflicts = [];
  if (same(ours, theirs)) return { value: ours, conflicts };
  if (same(base, ours)) return { value: theirs, conflicts };
  if (same(base, theirs)) return { value: ours, conflicts };
  if (!(isObj(base ?? {}) && isObj(ours) && isObj(theirs))) return { value: ours, conflicts: [path || "(root)"] };
  const b = base ?? {};
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(b)])];
  const out = {};
  const order = [...Object.keys(ours), ...Object.keys(theirs).filter((k) => !(k in ours))];
  for (const k of keys) {
    const has = (o) => Object.prototype.hasOwnProperty.call(o, k);
    const sub = path ? `${path}.${k}` : k;
    const o = has(ours) ? ours[k] : undefined, t = has(theirs) ? theirs[k] : undefined, bb = has(b) ? b[k] : undefined;
    let r;
    if (same(o, t)) r = { value: o, conflicts: [] };
    else if (same(bb, o)) r = { value: t, conflicts: [] };
    else if (same(bb, t)) r = { value: o, conflicts: [] };
    else if (isObj(o) && isObj(t)) r = merge3(isObj(bb) ? bb : {}, o, t, sub);
    else r = { value: o, conflicts: [sub] };
    conflicts.push(...r.conflicts);
    if (r.value !== undefined) out[k] = r.value;
  }
  const ordered = {};
  for (const k of order) if (k in out) ordered[k] = out[k];
  for (const k of Object.keys(out)) if (!(k in ordered)) ordered[k] = out[k];
  return { value: ordered, conflicts };
}

// scripts.* values that are `a && b && c` test chains (postbuild runs the built-output checks): merged as
// command sets (union of what the fill added, honouring what either side removed), not as one string.
const CHAIN_KEYS = new Set(["postbuild"]);
const cmds = (v) => (typeof v === "string" ? v.split(" && ").map((x) => x.trim()).filter(Boolean) : null);

/** Command-level 3-way of one chain. Ours order wins; theirs additions follow their predecessor in theirs. */
export function mergeChain(base, ours, theirs) {
  const B = cmds(base) ?? [], O = cmds(ours), T = cmds(theirs);
  if (!O || !T) return null;
  const bs = new Set(B), ts = new Set(T), os = new Set(O);
  const removed = new Set(B.filter((c) => !ts.has(c)));
  const out = O.filter((c) => !removed.has(c));
  for (let i = 0; i < T.length; i++) {
    const c = T[i];
    if (bs.has(c) || os.has(c)) continue;
    let at = -1;
    for (let j = i - 1; j >= 0 && at < 0; j--) at = out.indexOf(T[j]);
    out.splice(at + 1, 0, c);
  }
  return out.join(" && ");
}

/** Finer package.json 3-way. Splits scripts into the test-line (scripts.test: handled by the manifest,
 *  the base line wins, the fill's added commands go to the manifest = union) and the non-test remainder
 *  (key-level 3-way). Returns { merged, conflicts: ["scripts.build", ...] }. */
export function mergePackage(base, ours, theirs) {
  const strip = (p) => { const c = structuredClone(p ?? {}); const t = c.scripts?.test; if (c.scripts /*MUT:split*/) delete c.scripts.test; return { rest: c, test: t }; };
  const B = strip(base), O = strip(ours), T = strip(theirs);
  // chain keys: pull them out, merge as command sets, put the result back
  const chainOut = {};
  for (const k of CHAIN_KEYS) {
    const vals = [B.rest, O.rest, T.rest].map((p) => p.scripts?.[k]);
    if (vals[1] === undefined || vals[2] === undefined || vals[1] === vals[2] || vals[0] === vals[1] || vals[0] === vals[2]) continue;
    const m = mergeChain(vals[0], vals[1], vals[2]);
    if (m === null) continue;
    chainOut[k] = m;
    for (const p of [B.rest, O.rest, T.rest]) delete p.scripts[k];
  }
  const r = merge3(B.rest, O.rest, T.rest);
  const merged = r.value;
  for (const [k, v] of Object.entries(chainOut)) { merged.scripts = merged.scripts ?? {}; merged.scripts[k] = v; }
  if (O.test !== undefined) {
    merged.scripts = merged.scripts ?? {};
    const scripts = {};
    // keep ours key order, with test back in the slot it holds in ours
    for (const k of Object.keys(ours.scripts ?? {})) scripts[k] = k === "test" ? O.test : merged.scripts[k];
    for (const k of Object.keys(merged.scripts)) if (!(k in scripts)) scripts[k] = merged.scripts[k];
    for (const k of Object.keys(scripts)) if (scripts[k] === undefined) delete scripts[k];
    merged.scripts = scripts;
  }
  return { merged, conflicts: r.conflicts };
}

/** Write the finer 3-way into the worktree. Returns { ok, keys }. */
function finerPackage(wt, repo, mergeBase, base, branch, pkgPath) {
  let b, o, t;
  try { b = pkgAt(repo, mergeBase); o = pkgAt(repo, base); t = pkgAt(repo, branch); } catch { return { ok: false, keys: [] }; }
  if (!o || !t) return { ok: false, keys: [] };
  const { merged, conflicts } = mergePackage(b, o, t);
  if (conflicts.length) return { ok: false, keys: conflicts };
  const oursTxt = git(wt, ["show", `${base}:package.json`]);
  const indent = oursTxt.match(/^(\s+)"/m)?.[1] ?? "  ";
  writeFileSync(pkgPath, JSON.stringify(merged, null, indent) + (oursTxt.endsWith("\n") ? "\n" : ""));
  git(wt, ["add", "package.json"]);
  return { ok: true, keys: [] };
}

const unmerged = (wt) =>
  git(wt, ["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean);

export function restack({ repo, branch, base, scratchRoot = DEFAULT_SCRATCH, push = false, remote = "origin" }) {
  const short = branch.replace(/^(refs\/remotes\/)?origin\//, "");
  const newBranch = `${short}-rs`;
  if (PROTECTED.has(short) || PROTECTED.has(newBranch)) throw new Error("refusing: protected branch name");
  const pkg = analysePackage(repo, base, branch);
  mkdirSync(scratchRoot, { recursive: true });
  const wt = join(scratchRoot, short.replace(/[^A-Za-z0-9._-]/g, "_") + `-${process.pid}`);
  git(repo, ["worktree", "add", "--detach", wt, base]);
  const result = { branch, base, newBranch, mergeBase: pkg.mergeBase, added: pkg.added, appended: [], skippedDup: [], rawConflicts: [], conflicts: [], pushed: false, status: "" };
  try {
    git(wt, ["config", "user.name", "restack-tool"]);
    git(wt, ["config", "user.email", "restack@localhost"]);
    git(wt, ["merge", "--no-commit", "--no-ff", branch], { ok: true });
    result.rawConflicts = unmerged(wt);
    const left = new Set(result.rawConflicts);

    // package.json
    const pkgPath = join(wt, "package.json");
    if (pkg.touched) {
      let pkgOk = true;
      if (pkg.nonTestEdits /*MUT:nontest*/) {
        // Non-test edits are never dropped: a git conflict stays a CONFLICT; a git-clean merge is
        // kept with its "test" line forced back to the base line.
        if (left.has("package.json")) {
          // adjacent-hunk case: git cannot split it, the key-level 3-way can
          const f = finerPackage(wt, repo, pkg.mergeBase, base, branch, pkgPath);
          pkgOk = f.ok;
          if (f.ok) left.delete("package.json");
          else {
            left.delete("package.json");
            if (f.keys.length) for (const k of f.keys) left.add(`package.json[${k}]`);
            else left.add("package.json");
          }
        } else {
          pkgOk = keepMergedPackage(wt, base, pkgPath);
          if (!pkgOk) left.add("package.json");
        }
      } else {
        git(wt, ["checkout", base, "--", "package.json"]);
        left.delete("package.json");
      }
      if (pkgOk) {
        const mfPath = join(wt, MANIFEST);
        const have = new Set(existsSync(mfPath) ? readFileSync(mfPath, "utf8").split("\n").filter((l) => l && !l.startsWith("#")) : []);
        let text = existsSync(mfPath) ? readFileSync(mfPath, "utf8") : "";
        if (text && !text.endsWith("\n")) text += "\n";
        for (const c of pkg.added) {
          if (have.has(c) /*MUT:dedupe*/) { result.skippedDup.push(c); continue; }
          have.add(c);
          text += c + "\n";
          result.appended.push(c);
        }
        if (existsSync(mfPath) || result.appended.length) {
          writeFileSync(mfPath, text);
          left.delete(MANIFEST);
          git(wt, ["add", MANIFEST]);
        }
      }
    }
    else if (left.has("package.json")) {
      // criss-cross history: git reports a conflict although the fill never touched package.json
      // against the merge-base; the key-level 3-way settles it (their side == base, so ours wins).
      const f = finerPackage(wt, repo, pkg.mergeBase, base, branch, pkgPath);
      left.delete("package.json");
      if (!f.ok) for (const k of (f.keys.length ? f.keys.map((x) => `package.json[${x}]`) : ["package.json"])) left.add(k);
    }
    // test_no_orphan_scripts.sh: base wins
    if (left.has(ORPHAN)) {
      git(wt, ["checkout", base, "--", ORPHAN]);
      left.delete(ORPHAN);
    }
    // a manifest conflict that is still open (fill edited it directly): union is the rule, so a
    // real conflict marker means two edits git could not union: leave it a CONFLICT.
    result.conflicts = [...left].sort();

    if (!result.conflicts.length) {
      const lint = join(wt, "scripts/test_manifest_lint.mjs");
      if (existsSync(lint) && existsSync(join(wt, MANIFEST))) {
        try {
          execFileSync("node", [lint], { cwd: wt, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        } catch (e) {
          result.conflicts.push(`${MANIFEST} (lint: ${(e.stderr || e.stdout || "").toString().trim().split("\n")[0]})`);
        }
      }
    }
    result.status = result.conflicts.length ? "CONFLICT" : "LANDED";

    if (push && result.status === "LANDED") {
      const exists = git(repo, ["ls-remote", "--heads", remote, `refs/heads/${newBranch}`], { ok: true });
      if (exists && exists.trim()) throw new Error(`refusing: ${remote}/${newBranch} already exists`);
      git(wt, ["add", "-A"]);
      git(wt, ["commit", "-m", `restack ${short} onto the test manifest (restack_to_manifest.mjs)`]);
      git(wt, ["push", remote, `HEAD:refs/heads/${newBranch}`]);
      result.pushed = true;
    }
  } finally {
    git(wt, ["merge", "--abort"], { ok: true });
    git(repo, ["worktree", "remove", "--force", wt], { ok: true });
    rmSync(wt, { recursive: true, force: true });
    git(repo, ["worktree", "prune"], { ok: true });
  }
  return result;
}

export function format(r) {
  return r.status === "LANDED" ? "LANDED" : `CONFLICT ${r.conflicts.join(" ")}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  const branch = a.find((x, i) => !x.startsWith("--") && !["--base", "--repo"].includes(a[i - 1]));
  const base = opt("--base");
  if (!branch || !base) {
    console.error("usage: restack_to_manifest.mjs <fill-branch> --base <ref> [--repo dir] [--push] [--json]");
    process.exit(64);
  }
  const repo = resolve(opt("--repo") ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  const r = restack({ repo, branch, base, push: a.includes("--push"), scratchRoot: process.env.SCRATCH_ROOT || DEFAULT_SCRATCH });
  if (a.includes("--json")) console.log(JSON.stringify(r));
  else {
    console.log(`${branch}: ${format(r)}`);
    console.log(`  added ${r.added.length}, appended ${r.appended.length}, dup-skipped ${r.skippedDup.length}, raw git conflicts: ${r.rawConflicts.join(" ") || "none"}${r.pushed ? `, pushed ${r.newBranch}` : ""}`);
  }
  process.exit(r.status === "LANDED" ? 0 : 1);
}
