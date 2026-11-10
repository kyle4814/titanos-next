#!/usr/bin/env python3
"""f300 test: stack_rebase_sweep.py on FIXTURE repos only (never the live checkout). Synthetic data.
Covers: patch-id superseded stack retired, blob-superseded stack retired, two independent stacks land into one branch,
a stack conflicting with an earlier landed stack stops at the right commit, original refs unchanged.
Two mutations (superseded check off, stop-on-conflict off) must FAIL the suite."""
import os, subprocess, sys, tempfile, shutil
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools"))
import stack_rebase_sweep as W

E = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t")
OUT = "out/stack2"


def git(d, *a):
    r = subprocess.run(["git", "-C", d, *a], capture_output=True, text=True, env=E)
    assert r.returncode == 0, (a, r.stderr)
    return r.stdout


def commit(d, f, text, msg):
    p = os.path.join(d, f)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w").write(text); git(d, "add", f); git(d, "commit", "-qm", msg)


def branch(d, name, frm):
    git(d, "checkout", "-q", "-B", name, frm)


def show(d, ref, f):
    return git(d, "show", "%s:%s" % (ref, f))


def fixture():
    d = tempfile.mkdtemp(prefix="f300-fix-")
    git(d, "init", "-q", "-b", "main")
    commit(d, "a.txt", "1\n2\n3\n", "base")
    return d


def refs(d):
    return sorted(l for l in git(d, "for-each-ref", "--format=%(refname) %(objectname)", "refs/heads").splitlines() if OUT not in l)


def sweep(d):
    return W.sweep(d, "main", "web/*", OUT)


def verdicts(r):
    return {st["base"]: st["verdict"] for st in r["stacks"]}


def suite():
    fails = []

    def check(c, m):
        if not c:
            fails.append(m)

    # A. patch-id superseded stack (cherry-picked into target) and blob-superseded stack (same final state, other commits)
    d = fixture()
    try:
        old = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/p1", old); commit(d, "p.txt", "p\n", "p1")
        branch(d, "web/p2", "web/p1"); commit(d, "q.txt", "q\n", "p2")
        branch(d, "web/b1", old); commit(d, "f.txt", "1\n", "b1"); commit(d, "f.txt", "1\n2\n", "b1 more")
        branch(d, "web/live", old); commit(d, "l.txt", "l\n", "live one")
        branch(d, "main", old); commit(d, "z.txt", "z\n", "target moves")
        git(d, "cherry-pick", "web/p1"); git(d, "cherry-pick", "web/p2")
        commit(d, "f.txt", "1\n2\n", "f in one go")
        before = refs(d)
        r = sweep(d)
        v = verdicts(r)
        check(v.get("web/p1") == "SUPERSEDED", "A: patch-id stack retired %s" % v)
        check(v.get("web/b1") == "SUPERSEDED", "A: blob-superseded stack retired %s" % v)
        check(v.get("web/live") == "LANDED 1 of 1", "A: live branch still lands %s" % v)
        by = {st["base"]: st for st in r["stacks"]}
        check("patch-ids" in by["web/p1"]["evidence"] and "final-state" in by["web/b1"]["evidence"], "A: evidence lines %s" % [s["evidence"] for s in r["stacks"]])
        check(r["superseded_branches"] == 3 and r["landed_branches"] == 1 and r["remaining"] == 0, "A: counts %s" % [r["superseded_branches"], r["landed_branches"], r["remaining"]])
        check(refs(d) == before and r["refs_unchanged"], "A: original refs unchanged")
    finally:
        shutil.rmtree(d, ignore_errors=True)

    # B. two independent stacks both land into one branch
    d = fixture()
    try:
        old = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/x1", old); commit(d, "x.txt", "x1\n", "x1")
        branch(d, "web/x2", "web/x1"); commit(d, "x.txt", "x1\nx2\n", "x2")
        branch(d, "web/y1", old); commit(d, "y.txt", "y1\n", "y1")
        branch(d, "main", old); commit(d, "z.txt", "z\n", "target moves")
        before = refs(d)
        r = sweep(d)
        check(r["landed_branches"] == 3 and sorted(verdicts(r).values()) == ["LANDED 1 of 1", "LANDED 2 of 2"], "B: both land %s" % verdicts(r))
        check(show(d, OUT, "x.txt") == "x1\nx2\n" and show(d, OUT, "y.txt") == "y1\n" and show(d, OUT, "z.txt") == "z\n", "B: all content in ONE branch")
        check(len(git(d, "log", "--format=%s", "main..%s" % OUT).split("\n")) - 1 == 3, "B: three commits stacked")
        check(refs(d) == before, "B: original refs unchanged")
    finally:
        shutil.rmtree(d, ignore_errors=True)

    # C. a later stack conflicts with an earlier landed stack: stops at the right commit, prefix stays, tail NOT_RUN
    d = fixture()
    try:
        old = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/a1", old); commit(d, "a.txt", "1\nA\n3\n", "a edits line 2")
        branch(d, "web/b1", old); commit(d, "b.txt", "b1\n", "b1")
        branch(d, "web/b2", "web/b1"); commit(d, "a.txt", "1\nB\n3\n", "b2 edits line 2"); bad = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/b3", "web/b2"); commit(d, "b.txt", "b1\nb3\n", "b3")
        branch(d, "main", old)
        before = refs(d)
        r = sweep(d)
        by = {st["base"]: st for st in r["stacks"]}
        check(by["web/a1"]["verdict"] == "LANDED 1 of 1", "C: earlier stack lands %s" % verdicts(r))
        sb = by["web/b1"]
        check([w["status"] for w in sb["rows"]] == ["CLEAN", "CONFLICT", "NOT_RUN"], "C: b stops at b2 %s" % [w["status"] for w in sb["rows"]])
        check(sb["rows"][1]["stopped_at"] == bad and sb["rows"][1]["files"] == ["a.txt"], "C: conflict commit + file recorded")
        check(sb["verdict"].startswith("LANDED 1 of 3; CONFLICT at %s" % bad[:10]), "C: verdict names the sha %s" % sb["verdict"])
        check(show(d, OUT, "a.txt") == "1\nA\n3\n" and show(d, OUT, "b.txt") == "b1\n", "C: prefix only")
        check(r["remaining"] == 2 and refs(d) == before, "C: remaining 2, refs unchanged (%s)" % r["remaining"])
        r2 = W.sweep(d, "main", "web/*", OUT, False, None, "size")
        v2 = verdicts(r2)
        check(v2.get("web/b1") == "LANDED 3 of 3" and v2.get("web/a1", "").startswith("CONFLICT"), "C: --order size lands the big stack first %s" % v2)
    finally:
        shutil.rmtree(d, ignore_errors=True)
    return fails


def main():
    base = suite()
    for f in base:
        print("FAIL " + f)
    ok = not base
    print(("ok   " if ok else "FAIL ") + "baseline suite clean (%d failures)" % len(base))
    for flag in ("SUPERSEDED_CHECK", "STOP_ON_CONFLICT"):
        setattr(W, flag, False)
        try:
            mf = suite()
        finally:
            setattr(W, flag, True)
        killed = bool(mf)
        print(("ok   " if killed else "FAIL ") + "mutation %s=False is caught (%d failures)" % (flag, len(mf)))
        ok = ok and killed
    print("RESULT " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
