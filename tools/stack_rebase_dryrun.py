#!/usr/bin/env python3
"""stack_rebase_dryrun.py - replay f223's stacks onto a target in a throwaway worktree and count what lands clean (f231).

f223 (merge_stack_plan.py) prints a bottom-to-top rebase order but never runs it. This runs it, as cherry-picks, in a
detached scratch worktree. Detached HEAD means no branch or tag is ever created or moved: the tool lists every ref
before and after and exits 3 if anything differs. Nothing is pushed, merged or force-written.

  python3 -I tools/stack_rebase_dryrun.py REPO --target REF [--glob 'origin/web/f*'] [--reverse-top N] [--json]

Forward mode (default): per stack, bottom to top; a branch's OWN commits (parent tip..tip, or merge-base..tip for a
root) are cherry-picked onto its parent's NEW tip (target for a root). A conflict aborts that branch, records the
files, and blocks its descendants; independent siblings in a tree still run. Every stack starts from a clean target.
Reverse mode (the order question): the same own-commit sets, applied top branch first onto a running head that starts at
the target; stops at the first conflict. Merge commits inside a branch's own range are skipped and counted.
"""
import argparse, importlib.util, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ENV = dict(os.environ, GIT_AUTHOR_NAME="f231", GIT_AUTHOR_EMAIL="f231@invalid", GIT_COMMITTER_NAME="f231",
           GIT_COMMITTER_EMAIL="f231@invalid", GIT_EDITOR="true", GIT_TERMINAL_PROMPT="0")


def load_planner():
    spec = importlib.util.spec_from_file_location("merge_stack_plan", os.path.join(HERE, "merge_stack_plan.py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m


def g(cwd, *args):
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True, env=ENV)


def refs(repo):
    return g(repo, "for-each-ref", "--format=%(refname) %(objectname)").stdout


def own_commits(repo, tip, base):
    """non-merge commits in base..tip, oldest first, plus the count of merges skipped."""
    allc = g(repo, "rev-list", "--reverse", "--parents", "%s..%s" % (base, tip)).stdout.splitlines()
    keep, merges = [], 0
    for ln in allc:
        f = ln.split()
        if len(f) > 2:
            merges += 1
        else:
            keep.append(f[0])
    return keep, merges


class Scratch:
    def __init__(self, repo, start):
        self.repo = repo
        self.dir = tempfile.mkdtemp(prefix="f231-scratch-")
        r = g(repo, "worktree", "add", "--detach", "--no-checkout", self.dir, start)
        if r.returncode:
            raise SystemExit("scratch worktree failed: " + r.stderr)
        g(self.dir, "sparse-checkout", "disable")
        g(self.dir, "checkout", "-q", "--detach", start)

    def at(self, sha):
        g(self.dir, "reset", "-q", "--hard", sha)
        g(self.dir, "clean", "-fdxq")

    def replay(self, base, commits):
        """cherry-pick commits onto base. returns (ok, new_head, conflict_files)."""
        self.at(base)
        for c in commits:
            r = g(self.dir, "cherry-pick", "--keep-redundant-commits", c)
            if r.returncode:
                files = g(self.dir, "diff", "--name-only", "--diff-filter=U").stdout.split()
                g(self.dir, "cherry-pick", "--abort")
                self.at(base)
                return False, base, files or ["(no unmerged paths: %s)" % r.stderr.strip()[:120]]
        return True, g(self.dir, "rev-parse", "HEAD").stdout.strip(), []

    def close(self):
        g(self.repo, "worktree", "remove", "--force", self.dir)
        shutil.rmtree(self.dir, ignore_errors=True)
        g(self.repo, "worktree", "prune")


def run_forward(sc, p, stack, tsha):
    rows, newtip = [], {}
    for b in stack["branches"]:
        ps = p["parents"][b]
        if ps:
            par = ps[0]
            if par not in newtip:
                rows.append({"branch": b, "status": "BLOCKED", "blocked_by": par, "files": [], "commits": 0, "merges_skipped": 0})
                continue
            base, upstream = newtip[par], p["tip_shas"][par]
        else:
            base = tsha
            upstream = g(sc.repo, "merge-base", tsha, p["tip_shas"][b]).stdout.strip()
        commits, merges = own_commits(sc.repo, p["tip_shas"][b], upstream)
        ok, head, files = sc.replay(base, commits)
        if ok:
            newtip[b] = head
        rows.append({"branch": b, "status": "CLEAN" if ok else "CONFLICT", "files": files, "commits": len(commits), "merges_skipped": merges})
    return rows


def run_reverse(sc, p, stack, tsha):
    rows, head = [], tsha
    stopped = False
    for b in reversed(stack["branches"]):
        if stopped:
            rows.append({"branch": b, "status": "NOT_RUN", "files": [], "commits": 0, "merges_skipped": 0})
            continue
        ps = p["parents"][b]
        upstream = p["tip_shas"][ps[0]] if ps else g(sc.repo, "merge-base", tsha, p["tip_shas"][b]).stdout.strip()
        commits, merges = own_commits(sc.repo, p["tip_shas"][b], upstream)
        ok, nh, files = sc.replay(head, commits)
        if ok:
            head = nh
        else:
            stopped = True
        rows.append({"branch": b, "status": "CLEAN" if ok else "CONFLICT", "files": files, "commits": len(commits), "merges_skipped": merges})
    return rows


def summarise(rows):
    clean = sum(r["status"] == "CLEAN" for r in rows)
    first = next((r for r in rows if r["status"] == "CONFLICT"), None)
    return {"branches": len(rows), "clean": clean, "conflicts": sum(r["status"] == "CONFLICT" for r in rows),
            "blocked": sum(r["status"] == "BLOCKED" for r in rows), "not_run": sum(r["status"] == "NOT_RUN" for r in rows),
            "first_conflict": first["branch"] if first else None, "first_conflict_files": first["files"] if first else []}


def dryrun(repo, target, glob, reverse_top=3, only_stack=None):
    before = refs(repo)
    pl = load_planner()
    p = pl.plan(repo, target, glob)
    tsha = p["target_sha"]
    sc = Scratch(repo, tsha)
    out = {"target": p["target"], "target_sha": tsha, "glob": glob, "branch_count": p["branch_count"],
           "already_merged": len(p["already_merged"]), "stacks": []}
    try:
        largest = {s["base"] for s in sorted(p["stacks"], key=lambda s: -len(s["branches"]))[:reverse_top]}
        for s in p["stacks"]:
            if only_stack and s["base"] != only_stack:
                continue
            fwd = run_forward(sc, p, s, tsha)
            ent = {"rank": s["rank"], "base": s["base"], "shape": s["shape"], "size": len(s["branches"]),
                   "forward": {"rows": fwd, **summarise(fwd)}}
            if s["base"] in largest:
                rev = run_reverse(sc, p, s, tsha)
                ent["reverse"] = {"rows": rev, **summarise(rev)}
            out["stacks"].append(ent)
    finally:
        sc.close()
    after = refs(repo)
    out["refs_unchanged"] = before == after
    out["total_branches"] = sum(e["size"] for e in out["stacks"])
    out["total_clean_forward"] = sum(e["forward"]["clean"] for e in out["stacks"])
    return out


def render(o):
    L = ["target %s @ %s, glob %s: %d branches, %d already in target" % (o["target"], o["target_sha"][:10], o["glob"], o["branch_count"], o["already_merged"]),
         "%-4s %-52s %-8s %5s %6s %8s %7s  %s" % ("rank", "stack base", "shape", "size", "clean", "conflict", "blocked", "first conflict (files)")]
    for e in o["stacks"]:
        f = e["forward"]
        L.append("%-4d %-52s %-8s %5d %6d %8d %7d  %s" % (e["rank"], e["base"].replace("origin/web/", ""), e["shape"], e["size"], f["clean"], f["conflicts"], f["blocked"],
                 ("%s: %s" % (f["first_conflict"].replace("origin/web/", ""), ", ".join(f["first_conflict_files"][:6]))) if f["first_conflict"] else "-"))
    for e in o["stacks"]:
        if "reverse" in e:
            r = e["reverse"]
            L.append("REVERSE %s: clean %d of %d (forward %d); first conflict %s" % (e["base"].replace("origin/web/", ""), r["clean"], e["size"], e["forward"]["clean"], r["first_conflict"]))
    L.append("TOTAL would land without a human (forward): %d of %d branches in %d stacks; refs unchanged: %s" % (o["total_clean_forward"], o["total_branches"], len(o["stacks"]), o["refs_unchanged"]))
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("repo")
    ap.add_argument("--target", required=True)
    ap.add_argument("--glob", default="origin/web/f*")
    ap.add_argument("--reverse-top", type=int, default=3)
    ap.add_argument("--only-stack", default=None)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    o = dryrun(a.repo, a.target, a.glob, a.reverse_top, a.only_stack)
    print(json.dumps(o, indent=1) if a.json else render(o))
    return 0 if o["refs_unchanged"] else 3


if __name__ == "__main__":
    sys.exit(main())
