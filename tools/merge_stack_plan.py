#!/usr/bin/env python3
# VENDORED READ-ONLY COPY of klinge-kernel bin/merge_stack_plan.py @ origin/ent/f223_merge_stack_rebase_plan-2026-11-07 (7911c25168). Do not edit; f231 imports plan() from it.
"""merge_stack_plan.py - work out the STACKS in a pile of unmerged branches (f223).

f218 ranks branches one by one, f220 unions hunks; neither knows that D1 chain branches were cut from each
other. Branch B stacks on A when A's tip is an ancestor of B's tip and A is not already in the target.
Read-only: git rev-list / merge-base / rev-parse / for-each-ref / diff --name-only only. Never checks out,
never writes to the repo. --rebase-script PRINTS the ordered rebase commands; it never runs them.

  python3 -I bin/merge_stack_plan.py REPO [--target REF] [--glob 'origin/web/f*'] [--rebase-script]

Order rule (documented, tested): stacks sharing NO file with any other stack go first, fewest commits first;
then the overlapping stacks, fewest commits first, ties by fewest overlapping neighbours, then base name.
Diamond (a branch with two parents): rebased onto its first parent (by name); the script flags the rest.
"""
import argparse, fnmatch, json, shlex, subprocess, sys


def git(repo, *args, check=True):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit("git %s failed: %s" % (" ".join(args), r.stderr.strip()))
    return r


def resolve_target(repo, want):
    for ref in ([want] if want else []) + ["origin/int3", "origin/main"]:
        r = git(repo, "rev-parse", "--verify", "--quiet", ref + "^{commit}", check=False)
        if r.returncode == 0:
            return ref, r.stdout.strip()
    raise SystemExit("no target ref found (tried %s, origin/int3, origin/main)" % want)


def list_branches(repo, glob):
    out = git(repo, "for-each-ref", "--format=%(refname:short) %(objectname)", "refs/remotes", "refs/heads").stdout
    res = {}
    for ln in out.splitlines():
        name, sha = ln.split()
        if name.endswith("/HEAD"):
            continue
        if fnmatch.fnmatchcase(name, glob):
            res[name] = sha
    return res


def build_parents(sets, tips):
    """sets[b] = commits in target..b; parent edges = the CLOSEST candidate ancestors of b."""
    anc = {b: {a for a in tips if a != b and tips[a] in sets[b]} for b in tips}
    parents = {}
    for b, aa in anc.items():
        # drop A when another ancestor C of b already sits above A (A is an ancestor of C)
        parents[b] = sorted(a for a in aa if not any(c != a and tips[a] in sets[c] for c in aa))
    return parents


def components(names, parents):
    adj = {n: set() for n in names}
    for b, ps in parents.items():
        for p in ps:
            adj[b].add(p); adj[p].add(b)
    seen, out = set(), []
    for n in sorted(names):
        if n in seen:
            continue
        comp, todo = [], [n]
        seen.add(n)
        while todo:
            x = todo.pop(); comp.append(x)
            for y in adj[x]:
                if y not in seen:
                    seen.add(y); todo.append(y)
        out.append(comp)
    return out


def plan(repo, target_want, glob):
    target, tsha = resolve_target(repo, target_want)
    allb = list_branches(repo, glob)
    merged, cand, alias = [], {}, {}
    seen_sha = {}
    for name in sorted(allb):
        sha = allb[name]
        if git(repo, "merge-base", "--is-ancestor", sha, tsha, check=False).returncode == 0:
            merged.append(name); continue
        if sha in seen_sha:                      # identical tip: alias of the first name
            alias.setdefault(seen_sha[sha], []).append(name); continue
        seen_sha[sha] = name
        cand[name] = sha
    sets = {b: set(git(repo, "rev-list", "%s..%s" % (target, cand[b])).stdout.split()) for b in cand}
    parents = build_parents(sets, cand)
    files = {b: set(git(repo, "diff", "--name-only", "%s...%s" % (target, cand[b])).stdout.split()) for b in cand}
    depth_memo = {}
    def depth(b):
        if b not in depth_memo:
            depth_memo[b] = 1 + max([depth(p) for p in parents[b]] or [0])
        return depth_memo[b]
    stacks = []
    for comp in components(list(cand), parents):
        order = sorted(comp, key=lambda b: (depth(b), b))          # bottom to top (topological)
        roots = [b for b in order if not parents[b]]
        hasch = {p for b in comp for p in parents[b]}
        tipsl = [b for b in order if b not in hasch]
        union = set()
        for b in comp:
            union |= sets[b]
        fset = set()
        for b in comp:
            fset |= files[b]
        stacks.append({"branches": order, "base": roots[0], "roots": roots, "tips": tipsl,
                       "depth": max(depth(b) for b in comp), "commits_above_target": len(union),
                       "files": sorted(fset), "shape": "diamond" if any(len(parents[b]) > 1 for b in comp)
                       else ("single" if len(comp) == 1 else ("chain" if len(tipsl) == 1 else "tree"))})
    for i, s in enumerate(stacks):
        s["_f"] = set(s["files"])
    for s in stacks:
        s["overlap"] = {o["base"]: len(s["_f"] & o["_f"]) for o in stacks if o is not s and s["_f"] & o["_f"]}
    stacks.sort(key=lambda s: (bool(s["overlap"]), s["commits_above_target"], len(s["overlap"]), s["base"]))
    for i, s in enumerate(stacks, 1):
        s["rank"] = i; del s["_f"]
    return {"repo": repo, "target": target, "target_sha": tsha, "glob": glob, "branch_count": len(allb),
            "already_merged": merged, "aliases": alias, "parents": parents, "tip_shas": cand,
            "stack_count": len(stacks), "largest_depth": max([s["depth"] for s in stacks] or [0]),
            "stacks": stacks, "rebase_order": [s["base"] for s in stacks]}


def local(name):
    return name.split("/", 1)[1] if name.startswith("origin/") else name


def rebase_script(p):
    L = ["# merge_stack_plan rebase script (PRINTED ONLY, nothing was run). target %s @ %s" % (p["target"], p["target_sha"][:10]),
         "# run from a scratch clone, never the live tree. Each branch rebases onto its parent's NEW tip."]
    done = set()
    for s in p["stacks"]:
        L.append("# --- stack %d: base %s, depth %d, %d commits, shape %s ---" % (s["rank"], s["base"], s["depth"], s["commits_above_target"], s["shape"]))
        for b in s["branches"]:
            ps = p["parents"][b]
            if ps:
                newbase, upstream = local(ps[0]), p["tip_shas"][ps[0]]
                for extra in ps[1:]:
                    L.append("# DIAMOND: %s also stacks on %s; after this rebase cherry-pick %s..%s by hand" % (b, extra, p["tip_shas"][ps[0]][:10], p["tip_shas"][extra][:10]))
            else:
                newbase = p["target"]
                upstream = git(p["repo"], "merge-base", p["target_sha"], p["tip_shas"][b]).stdout.strip()
            L.append("git checkout -B %s %s && git rebase --onto %s %s %s" % (
                shlex.quote(local(b)), shlex.quote(b), shlex.quote(newbase), upstream, shlex.quote(local(b))))
            done.add(b)
    return "\n".join(L) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("repo")
    ap.add_argument("--target", default=None, help="default origin/int3, falls back to origin/main")
    ap.add_argument("--glob", default="origin/web/f*")
    ap.add_argument("--rebase-script", action="store_true", help="print (never run) the ordered rebase commands")
    a = ap.parse_args(argv)
    p = plan(a.repo, a.target, a.glob)
    if a.rebase_script:
        sys.stdout.write(rebase_script(p))
    else:
        json.dump(p, sys.stdout, indent=1, sort_keys=True); print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
