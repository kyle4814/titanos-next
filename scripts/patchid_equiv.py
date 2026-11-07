#!/usr/bin/env python3
"""Patch-id equivalence pass (f232). Read-only on refs.

For every origin/web/f* branch that is NOT an ancestor of the target
(default origin/web/obelisk-int3-2026-11-07), compute `git patch-id --stable`
per commit of merge-base..tip and look for the same patch-ids anywhere in the
target's history (merge-base independent). One line per branch:
  ALREADY_IN        every commit's patch-id is in the target
  PARTIAL n/m       n of m present; missing SHAs listed
  ABSENT            none present
  EMPTY             branch adds no patch (nothing to merge)
Writes a JSON list of branches that need no merge (ALREADY_IN + EMPTY).
"""
import argparse, json, subprocess, sys

DEFAULT_TARGET = "origin/web/obelisk-int3-2026-11-07"
DEFAULT_GLOB = "refs/remotes/origin/web/f*"


def git(repo, *args, stdin=None):
    r = subprocess.run(["git", "-C", repo, *args], input=stdin, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("git %s failed: %s" % (" ".join(args), r.stderr.strip()))
    return r.stdout


def patch_ids(repo, *log_args):
    """Return [(commit, patchid)] oldest first; commits with an empty diff are omitted."""
    log = git(repo, "log", "-p", "--no-merges", "--reverse", "--format=commit %H", *log_args)
    if not log.strip():
        return []
    out = git(repo, "patch-id", "--stable", stdin=log)
    res = []
    for line in out.splitlines():
        pid, sha = line.split()
        res.append((sha, pid))
    return res


def pid_in(pid, target_ids):
    return pid in target_ids


def is_ancestor(repo, a, b):
    return subprocess.run(["git", "-C", repo, "merge-base", "--is-ancestor", a, b],
                          capture_output=True).returncode == 0


def classify(repo, branch, target, target_ids):
    base = git(repo, "merge-base", target, branch).strip()
    commits = patch_ids(repo, "%s..%s" % (base, branch))
    if not commits:
        return {"branch": branch, "status": "EMPTY", "present": 0, "total": 0, "missing": []}
    missing = [sha for sha, pid in commits if not pid_in(pid, target_ids)]
    n, m = len(commits) - len(missing), len(commits)
    status = "ALREADY_IN" if not missing else ("ABSENT" if n == 0 else "PARTIAL")
    return {"branch": branch, "status": status, "present": n, "total": m, "missing": missing}


def run(repo, target=DEFAULT_TARGET, pattern=DEFAULT_GLOB):
    refs = git(repo, "for-each-ref", "--format=%(refname:short)", pattern).split()
    refs = [r for r in refs if r != target]
    target_ids = {pid for _, pid in patch_ids(repo, target)}
    results, ancestors = [], []
    for b in sorted(refs):
        if is_ancestor(repo, b, target):
            ancestors.append(b)
            continue
        results.append(classify(repo, b, target, target_ids))
    return results, ancestors


def fmt(r):
    s = r["status"]
    if s == "PARTIAL":
        return "%s PARTIAL %d/%d missing: %s" % (r["branch"], r["present"], r["total"],
                                                 " ".join(x[:10] for x in r["missing"]))
    return "%s %s" % (r["branch"], s)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--target", default=DEFAULT_TARGET)
    ap.add_argument("--glob", default=DEFAULT_GLOB)
    ap.add_argument("--json-out", help="write JSON list of branches needing no merge")
    a = ap.parse_args(argv)
    results, ancestors = run(a.repo, a.target, a.glob)
    for r in results:
        print(fmt(r))
    c = {k: sum(1 for r in results if r["status"] == k) for k in ("ALREADY_IN", "PARTIAL", "ABSENT", "EMPTY")}
    print("TOTALS target=%s ancestors=%d ALREADY_IN=%d PARTIAL=%d ABSENT=%d EMPTY=%d (non-ancestors=%d)"
          % (a.target, len(ancestors), c["ALREADY_IN"], c["PARTIAL"], c["ABSENT"], c["EMPTY"], len(results)))
    skip = [r["branch"] for r in results if r["status"] in ("ALREADY_IN", "EMPTY")]
    if a.json_out:
        with open(a.json_out, "w") as f:
            json.dump(skip, f, indent=1)
    else:
        print(json.dumps(skip))
    return 0


if __name__ == "__main__":
    sys.exit(main())
