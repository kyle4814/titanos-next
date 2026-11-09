#!/usr/bin/env python3
"""Tree-equivalence pass (f361). Read-only on refs; no checkout.

patchid_equiv.py (f232) matches per-commit patch-ids, so a conflict-resolved or
squashed copy of a branch is invisible to it. This tool compares NET change
instead. For every origin/web/f* branch that is not an ancestor of the target
(default: newest origin/web/obelisk-int*), take merge-base..tip per file and
classify each file against the target:
  EXACT   target blob == branch tip blob (or the file is deleted on both)
  LINES   every added line of the branch's net diff already appears in the
          target version of that file, and no removed line is still there
          (a removed line only counts if the branch tip no longer has it)
  OPEN    anything else (binary files can only be EXACT)
Branch status:
  ABSORBED_EXACT   every touched file EXACT
  ABSORBED_LINES   every touched file EXACT or LINES (at least one LINES)
  PARTIAL n/m      n of m files absorbed; the open files are listed
  LIVE             no touched file absorbed
  EMPTY            branch touches no file (nothing to merge; listed apart)
The skip list (ABSORBED_*) is what the next merge brief can exclude.
Caveat: LINES is set membership per file, so a trivial added line such as "}"
is satisfied by any target containing one; treat ABSORBED_LINES as a strong
candidate for a human diff, ABSORBED_EXACT as proven.
Exit 0 on any classification; 2 on a git error.
"""
import argparse, json, subprocess, sys

EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
ZERO = "0" * 40
DEFAULT_GLOB = "refs/remotes/origin/web/f*"
INT_GLOB = "refs/remotes/origin/web/obelisk-int*"


def git(repo, *args, stdin=None, raw=False):
    r = subprocess.run(["git", "-C", repo, *args], input=stdin.encode() if isinstance(stdin, str) else stdin, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("git %s failed: %s" % (" ".join(args), r.stderr.decode("utf-8", "replace").strip()))
    return r.stdout if raw else r.stdout.decode("utf-8", "replace")


def is_ancestor(repo, a, b):
    return subprocess.run(["git", "-C", repo, "merge-base", "--is-ancestor", a, b],
                          capture_output=True).returncode == 0


def newest_target(repo):
    """Newest origin/web/obelisk-int* by committer date."""
    out = git(repo, "for-each-ref", "--sort=-committerdate", "--format=%(refname:short)", INT_GLOB).split()
    if not out:
        raise RuntimeError("no origin/web/obelisk-int* ref found")
    return out[0]


def blob_text(repo, sha):
    if not sha or sha == ZERO:
        return None
    return git(repo, "cat-file", "blob", sha, raw=True)


def split_lines(data):
    return data.decode("utf-8", "replace").split("\n")


# ---- the three seams the mutation tests break ----------------------------------

def blob_equal(tip_blob, target_blob):
    """EXACT test: identical blob ids; both absent counts (deleted on both)."""
    return tip_blob == target_blob


def added_ok(added, target_lines):
    """Every added line of the branch's net diff already appears in the target file."""
    ts = set(target_lines)
    return all(l in ts for l in added)


def removed_ok(removed, target_lines, tip_lines):
    """No removed line survives in the target (a line the tip still has is not 'removed')."""
    ts, tip = set(target_lines), set(tip_lines)
    return all((l not in ts) or (l in tip) for l in removed)

# ---------------------------------------------------------------------------------


def net_diff_lines(repo, base_blob, tip_blob, tip_data):
    """(added, removed) lines of base_blob -> tip_blob."""
    if base_blob == ZERO:
        return split_lines(tip_data), []
    out = git(repo, "diff", "-U0", "--no-color", "--no-ext-diff", base_blob, tip_blob)
    added, removed = [], []
    for l in out.split("\n"):
        if l.startswith("+++") or l.startswith("---") or l.startswith("@@") or l.startswith("diff ") or l.startswith("index "):
            continue
        if l.startswith("+"):
            added.append(l[1:])
        elif l.startswith("-"):
            removed.append(l[1:])
    return added, removed


def touched_files(repo, base, tip):
    """[(path, base_blob, tip_blob)] for merge-base..tip, renames split into delete+add."""
    raw = git(repo, "diff", "--raw", "-z", "--no-renames", "--abbrev=40", base, tip, raw=True).decode("utf-8", "replace")
    parts = raw.split("\0")
    res, i = [], 0
    while i < len(parts) and parts[i].startswith(":"):
        meta = parts[i].split()
        res.append((parts[i + 1], meta[2], meta[3]))
        i += 2
    return res


def target_blobs(repo, target, paths):
    if not paths:
        return {}
    req = "".join("%s:%s\n" % (target, p) for p in paths)
    out = git(repo, "cat-file", "--batch-check", stdin=req).split("\n")
    res = {}
    for p, line in zip(paths, out):
        f = line.split()
        res[p] = f[0] if len(f) >= 3 and f[1] == "blob" else None
    return res


def classify_file(repo, path, base_blob, tip_blob, tgt_blob):
    tip = None if tip_blob == ZERO else tip_blob
    if blob_equal(tip, tgt_blob):
        return "EXACT"
    if tip is None or tgt_blob is None:
        return "OPEN"          # deleted on one side only, or missing from the target
    tip_data, tgt_data = blob_text(repo, tip), blob_text(repo, tgt_blob)
    if b"\0" in tip_data or b"\0" in tgt_data:
        return "OPEN"          # binary: exact only
    added, removed = net_diff_lines(repo, base_blob, tip, tip_data)
    tl = split_lines(tgt_data)
    if added_ok(added, tl) and removed_ok(removed, tl, split_lines(tip_data)):
        return "LINES"
    return "OPEN"


def classify(repo, branch, target):
    try:
        base = git(repo, "merge-base", target, branch).strip()
    except RuntimeError:
        base = EMPTY_TREE
    files = touched_files(repo, base, branch)
    if not files:
        return {"branch": branch, "status": "EMPTY", "absorbed": 0, "total": 0, "open": [], "files": {}}
    tb = target_blobs(repo, target, [f[0] for f in files])
    kinds = {p: classify_file(repo, p, bb, tpb, tb[p]) for p, bb, tpb in files}
    n = sum(1 for k in kinds.values() if k != "OPEN")
    m = len(files)
    opn = sorted(p for p, k in kinds.items() if k == "OPEN")
    if n == m:
        status = "ABSORBED_EXACT" if all(k == "EXACT" for k in kinds.values()) else "ABSORBED_LINES"
    elif n == 0:
        status = "LIVE"
    else:
        status = "PARTIAL"
    return {"branch": branch, "status": status, "absorbed": n, "total": m, "open": opn, "files": kinds}


def run(repo, target, pattern=DEFAULT_GLOB):
    git(repo, "rev-parse", "--verify", "--quiet", target + "^{commit}")
    refs = [r for r in git(repo, "for-each-ref", "--format=%(refname:short)", pattern).split() if r != target]
    results, ancestors = [], []
    for b in sorted(refs):
        if is_ancestor(repo, b, target):
            ancestors.append(b)
            continue
        results.append(classify(repo, b, target))
    return results, ancestors


def fmt(r):
    if r["status"] == "PARTIAL":
        return "%s PARTIAL %d/%d open: %s" % (r["branch"], r["absorbed"], r["total"], " ".join(r["open"]))
    return "%s %s%s" % (r["branch"], r["status"], "" if r["status"] == "EMPTY" else " %d/%d" % (r["absorbed"], r["total"]))


def counts(results):
    keys = ("ABSORBED_EXACT", "ABSORBED_LINES", "PARTIAL", "LIVE", "EMPTY")
    return {k: sum(1 for r in results if r["status"] == k) for k in keys}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--target", help="default: newest origin/web/obelisk-int*")
    ap.add_argument("--glob", default=DEFAULT_GLOB)
    ap.add_argument("--tsv-out")
    ap.add_argument("--json-out")
    a = ap.parse_args(argv)
    try:
        target = a.target or newest_target(a.repo)
        results, ancestors = run(a.repo, target, a.glob)
    except RuntimeError as e:
        print("GIT ERROR:", e, file=sys.stderr)
        return 2
    for r in results:
        print(fmt(r))
    c = counts(results)
    print("TOTALS target=%s ancestors=%d %s (non-ancestors=%d)" % (
        target, len(ancestors), " ".join("%s=%d" % kv for kv in c.items()), len(results)))
    skip = [r["branch"] for r in results if r["status"].startswith("ABSORBED_")]
    if a.tsv_out:
        with open(a.tsv_out, "w") as f:
            f.write("branch\tstatus\tabsorbed\ttotal\topen_files\n")
            for r in results:
                f.write("%s\t%s\t%d\t%d\t%s\n" % (r["branch"], r["status"], r["absorbed"], r["total"], ",".join(r["open"])))
    summary = {"target": target, "ancestors": len(ancestors), "counts": c, "skip": skip,
               "empty": [r["branch"] for r in results if r["status"] == "EMPTY"], "branches": results}
    if a.json_out:
        with open(a.json_out, "w") as f:
            json.dump(summary, f, indent=1)
    else:
        print(json.dumps(skip))
    return 0


if __name__ == "__main__":
    sys.exit(main())
