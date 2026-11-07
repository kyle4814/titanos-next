#!/usr/bin/env python3
"""Fixture tests for patchid_equiv.py (temp repo, no live refs)."""
import os, subprocess, sys, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import patchid_equiv as P

ENV = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t",
           GIT_COMMITTER_EMAIL="t@t", GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_SYSTEM="/dev/null")


def g(d, *a):
    r = subprocess.run(["git", "-C", d, *a], capture_output=True, text=True, env=ENV)
    assert r.returncode == 0, (a, r.stderr)
    return r.stdout.strip()


def commit(d, fn, text, msg):
    with open(os.path.join(d, fn), "a") as f:
        f.write(text)
    g(d, "add", "-A"); g(d, "commit", "-q", "-m", msg)
    return g(d, "rev-parse", "HEAD")


def build():
    d = tempfile.mkdtemp(prefix="pidfx_")
    assert d.startswith(tempfile.gettempdir())
    g(d, "init", "-q", "-b", "main")
    commit(d, "base.txt", "base\n", "base")
    # branches
    g(d, "checkout", "-q", "-b", "web/f1_cherry", "main"); c1 = commit(d, "a.txt", "alpha\n", "f1")
    g(d, "checkout", "-q", "-b", "web/f2_amend", "main"); commit(d, "b.txt", "one\n", "f2a"); commit(d, "b2.txt", "two\n", "f2b")
    g(d, "checkout", "-q", "-b", "web/f3_untouched", "main"); commit(d, "c.txt", "gamma\n", "f3")
    g(d, "checkout", "-q", "-b", "web/f4_empty", "main"); g(d, "commit", "-q", "--allow-empty", "-m", "empty")
    g(d, "checkout", "-q", "-b", "web/f5_ancestor", "main"); a5 = commit(d, "e.txt", "eps\n", "f5")
    # target: unrelated commit, cherry-pick of f1 (new SHA), first f2 commit exact, second amended, ancestor f5 merged
    g(d, "checkout", "-q", "-b", "target", "main"); commit(d, "t.txt", "t\n", "t")
    g(d, "cherry-pick", c1)
    g(d, "cherry-pick", "web/f2_amend~1")
    commit(d, "b2.txt", "TWO-CHANGED\n", "f2b amended")
    g(d, "merge", "-q", "--no-edit", "web/f5_ancestor")
    for b in ("web/f1_cherry", "web/f2_amend", "web/f3_untouched", "web/f4_empty", "web/f5_ancestor", "target"):
        g(d, "update-ref", "refs/remotes/origin/" + b, b)
    return d


def check(cond, msg):
    if not cond:
        print("FAIL", msg); sys.exit(1)
    print("ok  ", msg)


def by(results):
    return {r["branch"].split("/")[-1]: r for r in results}


def main():
    d = build()
    try:
        T = "origin/target"
        results, anc = P.run(d, T, "refs/remotes/origin/web/f*")
        m = by(results)
        check(m["f1_cherry"]["status"] == "ALREADY_IN", "cherry-picked commit is ALREADY_IN")
        check(m["f2_amend"]["status"] == "PARTIAL" and (m["f2_amend"]["present"], m["f2_amend"]["total"]) == (1, 2)
              and len(m["f2_amend"]["missing"]) == 1, "amended commit is PARTIAL 1/2 with one missing SHA")
        check(m["f3_untouched"]["status"] == "ABSENT", "untouched branch is ABSENT")
        check(m["f4_empty"]["status"] == "EMPTY", "empty branch handled (EMPTY, no crash)")
        check(anc == ["origin/web/f5_ancestor"], "ancestor branch excluded from classification")
        check("PARTIAL 1/2" in P.fmt(m["f2_amend"]), "PARTIAL line shows n/m")
        out = subprocess.run([sys.executable, P.__file__, "--repo", d, "--target", T, "--json-out", d + "/skip.json"],
                             capture_output=True, text=True)
        check(out.returncode == 0 and "TOTALS" in out.stdout and "ALREADY_IN=1 PARTIAL=1 ABSENT=1 EMPTY=1" in out.stdout,
              "CLI prints totals line")
        import json
        skip = json.load(open(d + "/skip.json"))
        check(sorted(skip) == ["origin/web/f1_cherry", "origin/web/f4_empty"], "JSON skip list = ALREADY_IN + EMPTY")
        # MUTATION: break the patch-id compare; the assertions above must then fail
        orig = P.pid_in
        try:
            P.pid_in = lambda pid, ids: False
            mm = by(P.run(d, T, "refs/remotes/origin/web/f*")[0])
            check(mm["f1_cherry"]["status"] != "ALREADY_IN", "MUTATION (compare always false) is detected")
            P.pid_in = lambda pid, ids: True
            mm = by(P.run(d, T, "refs/remotes/origin/web/f*")[0])
            check(mm["f3_untouched"]["status"] != "ABSENT", "MUTATION (compare always true) is detected")
        finally:
            P.pid_in = orig
        before = g(d, "for-each-ref")
        P.run(d, T, "refs/remotes/origin/web/f*")
        check(g(d, "for-each-ref") == before, "refs unchanged (read-only)")
    finally:
        shutil.rmtree(d)
    print("PASS")


main()
