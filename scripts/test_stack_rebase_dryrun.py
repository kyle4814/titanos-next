#!/usr/bin/env python3
"""f231 test: fixture repo (3-deep clean stack, conflicting-middle stack, independent branch) + mutation + ref safety."""
import os, subprocess, sys, tempfile, shutil
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools"))
import stack_rebase_dryrun as S

E = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t")
def git(d, *a): 
    r = subprocess.run(["git", "-C", d, *a], capture_output=True, text=True, env=E)
    assert r.returncode == 0, (a, r.stderr); return r.stdout
def commit(d, f, text, msg):
    open(os.path.join(d, f), "w").write(text); git(d, "add", f); git(d, "commit", "-qm", msg)
def branch(d, name, frm):
    git(d, "checkout", "-q", "-B", name, frm)
fails = []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

d = tempfile.mkdtemp(prefix="f231-fix-")
try:
    git(d, "init", "-q", "-b", "main")
    commit(d, "a.txt", "1\n2\n3\n", "base")
    commit(d, "m.txt", "x\ny\nz\n", "base2")
    # target moves: edits m.txt line y (so a stack that edits y from the old base conflicts)
    old = git(d, "rev-parse", "HEAD").strip()
    # clean stack: c1 -> c2 -> c3 each appends to its own file / sequential lines of c.txt
    branch(d, "web/c1", old); commit(d, "c.txt", "c1\n", "c1")
    branch(d, "web/c2", "web/c1"); commit(d, "c.txt", "c1\nc2\n", "c2")
    branch(d, "web/c3", "web/c2"); commit(d, "c.txt", "c1\nc2\nc3\n", "c3")
    # conflict stack: k1 ok, k2 edits m.txt line y, k3 builds on k2
    branch(d, "web/k1", old); commit(d, "k.txt", "k1\n", "k1")
    branch(d, "web/k2", "web/k1"); commit(d, "m.txt", "x\nK2\nz\n", "k2")
    branch(d, "web/k3", "web/k2"); commit(d, "k.txt", "k1\nk3\n", "k3")
    # independent
    branch(d, "web/i1", old); commit(d, "i.txt", "i\n", "i1")
    # target main advances with a conflicting edit to m.txt y
    branch(d, "main", old); commit(d, "m.txt", "x\nMAIN\nz\n", "main edits y")
    git(d, "update-ref", "refs/remotes/origin/main", "main")
    for b in ["c1", "c2", "c3", "k1", "k2", "k3", "i1"]:
        git(d, "update-ref", "refs/remotes/origin/web/" + b, "web/" + b)
    git(d, "checkout", "-q", "--detach", "main")
    for b in ["c1", "c2", "c3", "k1", "k2", "k3", "i1"]:
        git(d, "branch", "-D", "web/" + b)
    before = S.refs(d)
    o = S.dryrun(d, "origin/main", "origin/web/*", reverse_top=3)
    by = {e["base"].split("/")[-1]: e for e in o["stacks"]}
    check(len(o["stacks"]) == 3, "three stacks found (%d)" % len(o["stacks"]))
    c = by["c1"]["forward"]; k = by["k1"]["forward"]; i = by["i1"]["forward"]
    check(c["clean"] == 3 and c["conflicts"] == 0, "3-deep clean stack: 3 clean (%s)" % c["clean"])
    check(k["clean"] == 1 and k["first_conflict"].endswith("k2") and k["first_conflict_files"] == ["m.txt"], "middle conflict: k2 first, files m.txt")
    check(k["blocked"] == 1, "k3 blocked behind k2 (%d)" % k["blocked"])
    check(i["clean"] == 1, "independent branch clean")
    check(o["total_clean_forward"] == 5 and o["total_branches"] == 7, "would land without a human: 5 of 7")
    # mutation: top-first must give a different clean count on the clean stack
    r = by["c1"]["reverse"]
    check(r["clean"] != c["clean"], "MUTATION top-first differs: reverse clean %d vs forward %d" % (r["clean"], c["clean"]))
    check(r["first_conflict"] is not None, "top-first reports a conflict on the clean stack")
    # ref safety
    check(o["refs_unchanged"] and S.refs(d) == before, "refs identical before and after")
    check(not [x for x in git(d, "worktree", "list").splitlines() if "f231-scratch" in x], "scratch worktree removed")
finally:
    shutil.rmtree(d, ignore_errors=True)
print("PASS" if not fails else "FAILED %d" % len(fails))
sys.exit(1 if fails else 0)
