#!/usr/bin/env python3
"""Fixture tests for tree_equiv.py (temp repo, no live refs)."""
import json, os, subprocess, sys, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tree_equiv as T

ENV = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t",
           GIT_COMMITTER_EMAIL="t@t", GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_SYSTEM="/dev/null")


def g(d, *a):
    r = subprocess.run(["git", "-C", d, *a], capture_output=True, text=True, env=ENV)
    assert r.returncode == 0, (a, r.stderr)
    return r.stdout.strip()


def put(d, fn, text):
    p = os.path.join(d, fn)
    os.makedirs(os.path.dirname(p) or d, exist_ok=True)
    with open(p, "w") as f:
        f.write(text)


def commit(d, msg):
    g(d, "add", "-A"); g(d, "commit", "-q", "--allow-empty", "-m", msg)


def build():
    d = tempfile.mkdtemp(prefix="treeeqfx_")
    assert d.startswith(tempfile.gettempdir())
    g(d, "init", "-q", "-b", "main")
    put(d, "keep.txt", "k1\nk2\n"); put(d, "old.txt", "o1\nOLDLINE\no3\n"); put(d, "gone.txt", "g\n")
    put(d, "mv_old.txt", "m1\nm2\nm3\nm4\n"); put(d, "x.txt", "x1\nx2\n")
    commit(d, "base")
    def br(name):
        g(d, "checkout", "-q", "-b", "web/" + name, "main")
    br("f1_exact"); put(d, "a.txt", "alpha\nbeta\n"); commit(d, "f1")
    br("f2_lines"); put(d, "b.txt", "one\ntwo\n"); put(d, "keep.txt", "k1\nk2\nk3-added\n"); commit(d, "f2")
    br("f3_partial"); put(d, "c.txt", "gamma\n"); put(d, "d.txt", "delta\n"); commit(d, "f3")
    br("f4_live"); put(d, "e.txt", "eps\n"); commit(d, "f4")
    br("f5_delboth"); os.remove(os.path.join(d, "gone.txt")); commit(d, "f5")
    br("f6_rename"); g(d, "mv", "mv_old.txt", "mv_new.txt"); commit(d, "f6")
    br("f7_removed"); put(d, "old.txt", "o1\no3\n"); commit(d, "f7 removes OLDLINE")
    br("f10_addmiss"); put(d, "x.txt", "x1\nNEWLINE-NOT-IN-TARGET\nx2\n"); commit(d, "f10")
    br("f8_ancestor"); put(d, "z.txt", "zed\n"); commit(d, "f8")
    br("f9_empty"); commit(d, "f9 empty")
    # target: exact copy of f1 (new sha), f2 with extra target lines and reordered, only c.txt of f3,
    # gone.txt deleted too, rename done, OLDLINE still present (so f7 is NOT absorbed), f8 merged
    g(d, "checkout", "-q", "-b", "target", "main")
    put(d, "a.txt", "alpha\nbeta\n")
    put(d, "b.txt", "extra-target-line\none\nmid\ntwo\n"); put(d, "keep.txt", "k1\nk2\nk3-added\nmore\n")
    put(d, "c.txt", "gamma\n")
    os.remove(os.path.join(d, "gone.txt"))
    g(d, "mv", "mv_old.txt", "mv_new.txt")
    commit(d, "target squash")
    g(d, "merge", "-q", "--no-edit", "web/f8_ancestor")
    for b in g(d, "for-each-ref", "--format=%(refname:short)", "refs/heads/").split():
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
        TG = "origin/target"
        results, anc = T.run(d, TG)
        m = by(results)
        check(m["f1_exact"]["status"] == "ABSORBED_EXACT", "exact copy is ABSORBED_EXACT")
        check(m["f2_lines"]["status"] == "ABSORBED_LINES" and m["f2_lines"]["files"]["b.txt"] == "LINES",
              "conflict-resolved copy with extra target lines is ABSORBED_LINES")
        p = m["f3_partial"]
        check(p["status"] == "PARTIAL" and (p["absorbed"], p["total"]) == (1, 2) and p["open"] == ["d.txt"],
              "partial is PARTIAL 1/2 listing d.txt")
        check(m["f4_live"]["status"] == "LIVE", "untouched branch is LIVE")
        check(m["f5_delboth"]["status"] == "ABSORBED_EXACT", "deleted on both is ABSORBED_EXACT")
        check(m["f6_rename"]["status"] == "ABSORBED_EXACT" and m["f6_rename"]["total"] == 2, "rename done in target is ABSORBED_EXACT (2 files)")
        check(m["f7_removed"]["status"] == "LIVE", "removed line still in target is not absorbed")
        check(m["f10_addmiss"]["status"] == "LIVE", "added line missing from a present target file is not absorbed")
        check(m["f9_empty"]["status"] == "EMPTY", "empty branch is EMPTY, no crash")
        check(anc == ["origin/web/f8_ancestor"], "ancestor excluded")
        check("PARTIAL 1/2 open: d.txt" in T.fmt(p), "PARTIAL line shows n/m and open files")
        out = subprocess.run([sys.executable, T.__file__, "--repo", d, "--target", TG, "--tsv-out", d + "/o.tsv",
                              "--json-out", d + "/o.json"], capture_output=True, text=True)
        check(out.returncode == 0 and "ABSORBED_EXACT=3 ABSORBED_LINES=1 PARTIAL=1 LIVE=3 EMPTY=1" in out.stdout, "CLI totals line, exit 0")
        js = json.load(open(d + "/o.json"))
        check(sorted(js["skip"]) == ["origin/web/f1_exact", "origin/web/f2_lines", "origin/web/f5_delboth", "origin/web/f6_rename"],
              "JSON skip list = ABSORBED_* only")
        check(len(open(d + "/o.tsv").read().splitlines()) == 1 + len(results), "TSV has header + one row per branch")
        bad = subprocess.run([sys.executable, T.__file__, "--repo", d, "--target", "origin/nonexistent"], capture_output=True, text=True)
        check(bad.returncode == 2, "git error exits non-zero")
        # MUTATIONS
        o_eq, o_add, o_rem = T.blob_equal, T.added_ok, T.removed_ok
        try:
            T.blob_equal = lambda a, b: False
            mm = by(T.run(d, TG)[0])
            check(mm["f1_exact"]["status"] != "ABSORBED_EXACT" or mm["f5_delboth"]["status"] != "ABSORBED_EXACT",
                  "MUTATION (blob compare always false) is detected")
            T.blob_equal = o_eq
            T.added_ok = lambda a, t: True
            mm = by(T.run(d, TG)[0])
            check(mm["f10_addmiss"]["status"] != "LIVE", "MUTATION (added-line check always true) is detected")
            T.added_ok = o_add
            T.removed_ok = lambda r, t, tip: True
            mm = by(T.run(d, TG)[0])
            check(mm["f7_removed"]["status"] != "LIVE", "MUTATION (removed-line check always true) is detected")
        finally:
            T.blob_equal, T.added_ok, T.removed_ok = o_eq, o_add, o_rem
        before = g(d, "for-each-ref")
        T.run(d, TG)
        check(g(d, "for-each-ref") == before, "refs unchanged (read-only)")
    finally:
        shutil.rmtree(d)
    print("PASS")


main()
