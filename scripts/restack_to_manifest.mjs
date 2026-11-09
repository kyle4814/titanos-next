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
      if (pkg.nonTestEdits /*MUT:nontest*/) {
        left.add("package.json");
      } else {
        git(wt, ["checkout", base, "--", "package.json"]);
        left.delete("package.json");
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
