#!/usr/bin/env python3
"""f298 test: stack_rebase_apply.py on FIXTURE repos only (never the live checkout). Synthetic data.
Covers: 3-deep clean stack, package.json && union, registry union, migration renumber, semantic conflict stops the stack
and leaves the prefix, already-present commit skipped, original refs unchanged. Two mutations must FAIL the suite."""
import os, subprocess, sys, tempfile, shutil, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools"))
import stack_rebase_apply as S

E = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t")
OUT = "out/stack1"


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
    d = tempfile.mkdtemp(prefix="f298-fix-")
    git(d, "init", "-q", "-b", "main")
    commit(d, "a.txt", "1\n2\n3\n", "base")
    return d


def apply(d, limit=8):
    return S.run(d, "main", "web/*", limit, OUT)


def suite():
    fails = []

    def check(c, m):
        if not c:
            fails.append(m)

    # A. 3-deep clean stack lands in order; target moved on
    d = fixture()
    try:
        old = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/c1", old); commit(d, "c.txt", "c1\n", "c1")
        branch(d, "web/c2", "web/c1"); commit(d, "c.txt", "c1\nc2\n", "c2")
        branch(d, "web/c3", "web/c2"); commit(d, "c.txt", "c1\nc2\nc3\n", "c3")
        branch(d, "main", old); commit(d, "z.txt", "z\n", "target moves")
        tips = git(d, "for-each-ref", "--format=%(refname) %(objectname)", "refs/heads").splitlines()
        r = apply(d)
        check(r["applied_branches"] == 3 and [w["status"] for w in r["rows"]] == ["CLEAN"] * 3, "A: 3 clean in order %s" % r["rows"])
        check(show(d, OUT, "c.txt") == "c1\nc2\nc3\n" and show(d, OUT, "z.txt") == "z\n", "A: content on top of moved target")
        log = git(d, "log", "--format=%s", "main..%s" % OUT).split()
        check(log == ["c3", "c2", "c1"], "A: commit order %s" % log)
        after = git(d, "for-each-ref", "--format=%(refname) %(objectname)", "refs/heads").splitlines()
        check(sorted(l for l in after if "out/stack1" not in l) == sorted(tips), "A: original refs unchanged")
        check(r["refs_unchanged"], "A: refs_unchanged flag")
    finally:
        shutil.rmtree(d, ignore_errors=True)

    # B. package.json && union (with a shared x that must dedupe) + registry union
    d = fixture()
    try:
        pj = '{\n  "name": "x",\n  "scripts": {\n    "test": "%s",\n    "build": "next build"\n  }\n}\n'
        reg = 'export const R = [\n  "a",\n%s];\n'
        commit(d, "package.json", pj % "a && b", "pj"); commit(d, "registry.ts", reg % "", "reg")
        old = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/p1", old)
        commit(d, "package.json", pj % "a && b && p && x", "p1 pj")
        commit(d, "registry.ts", reg % '  "b",\n  "z",\n', "p1 reg")
        branch(d, "main", old)
        commit(d, "package.json", pj % "a && b && t && x", "t pj")
        commit(d, "registry.ts", reg % '  "m",\n  "z",\n', "t reg")
        r = apply(d)
        check(r["applied_branches"] == 1, "B: union branch lands %s" % r["rows"])
        if r["applied_branches"] == 1:
            j = json.loads(show(d, OUT, "package.json"))
            ent = j["scripts"]["test"].split(" && ")
            check(ent == ["a", "b", "t", "x", "p"], "B: && union deduped %s" % ent)
            rg = show(d, OUT, "registry.ts")
            check(rg.count('"z"') == 1 and '"m"' in rg and '"b"' in rg, "B: registry union deduped")
    finally:
        shutil.rmtree(d, ignore_errors=True)

    # C. migration number collision renumbered
    d = fixture()
    try:
        commit(d, "portal-api/migrations/0001_a.sql", "select 1;\n", "m1")
        old = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/m1", old); commit(d, "portal-api/migrations/0002_c.sql", "select 3;\n", "branch mig")
        branch(d, "main", old); commit(d, "portal-api/migrations/0002_b.sql", "select 2;\n", "target mig")
        r = apply(d)
        files = git(d, "ls-tree", "-r", "--name-only", OUT, "portal-api/migrations").split()
        check(r["applied_branches"] == 1 and "portal-api/migrations/0003_c.sql" in files and "portal-api/migrations/0002_c.sql" not in files,
              "C: renumbered to 0003 %s" % files)
        check(len(r["renumbered"]) == 1, "C: renumber recorded")
    finally:
        shutil.rmtree(d, ignore_errors=True)

    # D. semantic conflict in the middle stops the stack, prefix stays
    d = fixture()
    try:
        old = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/s1", old); commit(d, "s.txt", "s1\n", "s1")
        branch(d, "web/s2", "web/s1"); commit(d, "a.txt", "1\nbranch\n3\n", "s2 edits a")
        branch(d, "web/s3", "web/s2"); commit(d, "s.txt", "s1\ns3\n", "s3")
        branch(d, "main", old); commit(d, "a.txt", "1\nmain\n3\n", "target edits a")
        r = apply(d)
        st = [w["status"] for w in r["rows"]]
        check(st == ["CLEAN", "CONFLICT", "NOT_RUN"], "D: stop at conflict %s" % st)
        check(r["rows"][1]["files"] == ["a.txt"], "D: conflict files recorded")
        check(show(d, OUT, "s.txt") == "s1\n" and show(d, OUT, "a.txt") == "1\nmain\n3\n", "D: prefix only")
    finally:
        shutil.rmtree(d, ignore_errors=True)

    # E. a commit whose patch is already in the target is skipped
    d = fixture()
    try:
        old = git(d, "rev-parse", "HEAD").strip()
        branch(d, "web/e1", old); commit(d, "e.txt", "e\n", "e-first"); commit(d, "f.txt", "f\n", "e-second")
        first = git(d, "rev-parse", "HEAD~1").strip()
        branch(d, "main", old); commit(d, "q.txt", "q\n", "target moves"); git(d, "cherry-pick", first)
        r = apply(d)
        w = r["rows"][0]
        check(w["status"] == "CLEAN" and w["skipped_present"] == 1 and w["applied"] == "1/2", "E: skipped present %s" % w)
        check(git(d, "log", "--format=%s", "main..%s" % OUT).split() == ["e-second"], "E: only the missing commit added")
    finally:
        shutil.rmtree(d, ignore_errors=True)
    return fails


def main():
    base = suite()
    for f in base:
        print("FAIL " + f)
    ok = not base
    print(("ok   " if ok else "FAIL ") + "baseline suite clean (%d failures)" % len(base))
    for flag in ("STOP_ON_CONFLICT", "DEDUPE"):
        setattr(S, flag, False)
        try:
            mf = suite()
        finally:
            setattr(S, flag, True)
        killed = bool(mf)
        print(("ok   " if killed else "FAIL ") + "mutation %s=False is caught (%d failures)" % (flag, len(mf)))
        ok = ok and killed
    print("RESULT " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
