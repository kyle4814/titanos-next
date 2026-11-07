#!/usr/bin/env python3
"""stack_rebase_sweep.py - sweep EVERY f223 stack in one run (f300, builds on f298 stack_rebase_apply.py).

  python3 -I tools/stack_rebase_sweep.py REPO --target REF [--glob 'origin/web/f*'] [--limit N]
                                         [--out web/stack2-rb-2026-11-08] [--no-branch] [--json]

Per stack, in f223 plan order:
  1. SUPERSEDED check (cheap, no scratch tree). A stack is retired when (a) every commit's `git patch-id --stable` is
     already in the target (f232 logic), or (b) the net diff merge-base(target, tip)..tip of every tip of the stack
     reverse-applies cleanly onto the target tree, i.e. the target already holds the stack's final-state hunks.
     The evidence line says which.
  2. Survivors replay through stack_rebase_apply.Applier (mechanical-hunk auto-resolve, migration renumber) onto ONE
     accumulating scratch head, so the output branch stacks the clean prefixes of every landing stack in plan order.
     A conflict (including one against an earlier landed stack) resets that branch, records the commit and files, and
     stops THAT stack there; the sweep carries on with the next stack.
Writes ONE branch (--out) only when something landed. Never touches another ref (exit 3 if any other ref differs),
never pushes. Table: stack | size | verdict; last line: "remaining after sweep: <n> of <total>".
"""
import argparse, json, os, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stack_rebase_apply as S

SUPERSEDED_CHECK = True      # mutation switch: False = never retire a stack (tests prove the suite notices)
STOP_ON_CONFLICT = True      # mutation switch: False = keep replaying a stack past a conflict


def _own(dry, pidmod, p, repo, b):
    ps = p["parents"][b]
    tsha = p["target_sha"]
    upstream = p["tip_shas"][ps[0]] if ps else dry.g(repo, "merge-base", tsha, p["tip_shas"][b]).stdout.strip()
    commits, _m = dry.own_commits(repo, p["tip_shas"][b], upstream)
    return upstream, commits


def net_diff_present(repo, dry, tsha, tip):
    """True when the target tree already holds the net diff merge-base(target, tip)..tip (reverse-apply is clean)."""
    mb = dry.g(repo, "merge-base", tsha, tip).stdout.strip()
    diff = subprocess.run(["git", "-C", repo, "diff", "--binary", mb, tip], capture_output=True, env=dry.ENV)
    if diff.returncode:
        return False, "diff failed"
    if not diff.stdout:
        return True, 0
    idx = tempfile.mktemp(prefix="f300-idx-")
    env = dict(dry.ENV, GIT_INDEX_FILE=idx)
    try:
        if subprocess.run(["git", "-C", repo, "read-tree", tsha], env=env, capture_output=True).returncode:
            return False, "read-tree failed"
        r = subprocess.run(["git", "-C", repo, "apply", "-R", "--check", "--cached", "-"], input=diff.stdout,
                           env=env, capture_output=True)
        nfiles = diff.stdout.count(b"\ndiff --git ") + 1
        return r.returncode == 0, nfiles
    finally:
        if os.path.exists(idx):
            os.remove(idx)


def superseded(repo, dry, pidmod, p, stack, ids):
    """-> (bool, evidence line)."""
    tsha = p["target_sha"]
    total = present = 0
    for b in stack["branches"]:
        upstream, commits = _own(dry, pidmod, p, repo, b)
        bp = dict(pidmod.patch_ids(repo, "%s..%s" % (upstream, p["tip_shas"][b])))
        for c in commits:
            if c in bp:
                total += 1
                present += bp[c] in ids
    if present == total:
        return True, "all %d patch-ids already in target" % total
    nf = 0
    for tip in stack["tips"]:
        ok, n = net_diff_present(repo, dry, tsha, p["tip_shas"][tip])
        if not ok:
            return False, "patch-ids %d/%d present; net diff of %s not in target" % (present, total, tip)
        nf += n if isinstance(n, int) else 0
    return True, "final-state hunks of %d file(s) already in target blobs (reverse-apply clean); patch-ids %d/%d" % (nf, present, total)


def replay_stack(ap, dry, pidmod, p, stack, ids, limit):
    rows, done, stopped, landed = [], set(), False, 0
    tsha = p["target_sha"]
    for b in (stack["branches"] if not limit else stack["branches"][:limit]):
        row = {"branch": b, "applied": "0/0", "stopped_at": None, "files": [], "skipped_present": 0, "status": "NOT_RUN"}
        rows.append(row)
        if stopped:
            continue
        ps = p["parents"][b]
        if any(x not in done for x in ps):
            row["status"] = "BLOCKED"; row["files"] = [x for x in ps if x not in done]
            if STOP_ON_CONFLICT:
                stopped = True
            continue
        upstream, commits = _own(dry, pidmod, p, ap.repo, b)
        bpids = dict(pidmod.patch_ids(ap.repo, "%s..%s" % (upstream, p["tip_shas"][b])))
        start = ap.head()
        n_app = n_skip = 0
        new_ids, fail = [], None
        for c in commits:
            if c in bpids and bpids[c] in ids:
                n_skip += 1; continue
            r = ap.pick(c)
            if r == "applied":
                n_app += 1
                if c in bpids:
                    new_ids.append(bpids[c])
            elif r == "empty":
                n_skip += 1
            else:
                fail = (c, r); break
        row["skipped_present"] = n_skip
        if fail:
            ap.d("reset", "-q", "--hard", start); ap.d("clean", "-fdxq")
            row.update(status="CONFLICT", stopped_at=fail[0], files=fail[1], applied="0/%d" % len(commits))
            if STOP_ON_CONFLICT:
                stopped = True
            continue
        ids.update(new_ids)
        row.update(status="CLEAN", applied="%d/%d" % (n_app, len(commits)))
        done.add(b); landed += 1
    return rows, landed


def verdict(st):
    if st["superseded"]:
        return "SUPERSEDED"
    bad = next((r for r in st["rows"] if r["status"] in ("CONFLICT", "BLOCKED")), None)
    land = "LANDED %d of %d" % (st["landed"], st["size"])
    if bad:
        what = "CONFLICT at %s %s" % ((bad["stopped_at"] or bad["branch"])[:10], ",".join(bad["files"][:6]) or "-")
        return what if not st["landed"] else land + "; " + what
    return land


def sweep(repo, target, glob, out_branch="web/stack2-rb-2026-11-08", make_branch=True, limit=None, order="plan"):
    pm, dry, pidmod = S._mods()
    before = {ln.rsplit(" ", 1)[0]: ln.rsplit(" ", 1)[1] for ln in dry.refs(repo).splitlines()}
    p = pm.plan(repo, target, glob)
    tsha = p["target_sha"]
    key = (lambda s: s["rank"]) if order == "plan" else (lambda s: (-len(s["branches"]), s["rank"]))
    stacks = sorted(p["stacks"], key=key)
    total = sum(len(s["branches"]) for s in stacks)
    res = {"target": p["target"], "target_sha": tsha, "glob": glob, "out_branch": out_branch, "already_merged": len(p["already_merged"]),
           "order": order, "stacks": [], "out_sha": None, "renumbered": [], "auto_resolved": [], "total_branches": total}
    ids = {pid for _, pid in pidmod.patch_ids(repo, tsha)}
    sc = dry.Scratch(repo, tsha)
    ap = S.Applier(repo, dry, pidmod, pm); ap.sc = sc
    try:
        for s in stacks:
            st = {"base": s["base"], "size": len(s["branches"]), "branches": s["branches"], "superseded": False,
                  "evidence": "", "rows": [], "landed": 0}
            if SUPERSEDED_CHECK:
                st["superseded"], st["evidence"] = superseded(repo, dry, pidmod, p, s, ids)
            if not st["superseded"]:
                st["rows"], st["landed"] = replay_stack(ap, dry, pidmod, p, s, ids, limit)
            st["verdict"] = verdict(st)
            res["stacks"].append(st)
        res["out_sha"] = ap.head()
        res["renumbered"], res["auto_resolved"] = ap.renumbered, ap.auto
        if make_branch and res["out_sha"] != tsha:
            dry.g(repo, "update-ref", "refs/heads/" + out_branch, res["out_sha"])
    finally:
        sc.close()
    after = {ln.rsplit(" ", 1)[0]: ln.rsplit(" ", 1)[1] for ln in dry.refs(repo).splitlines()}
    own = "refs/heads/" + out_branch
    res["refs_unchanged"] = {k: v for k, v in before.items() if k != own} == {k: v for k, v in after.items() if k != own}
    res["superseded_stacks"] = sum(st["superseded"] for st in res["stacks"])
    res["superseded_branches"] = sum(st["size"] for st in res["stacks"] if st["superseded"])
    res["landed_branches"] = sum(st["landed"] for st in res["stacks"])
    res["remaining"] = total - res["superseded_branches"] - res["landed_branches"]
    return res


def render(r):
    L = ["target %s @ %s, glob %s, out %s, order %s (already merged, excluded: %d)" % (r["target"], r["target_sha"][:10], r["glob"], r["out_branch"], r["order"], r["already_merged"]),
         "| stack | size | verdict |", "|---|---|---|"]
    for st in r["stacks"]:
        L.append("| %s | %d | %s%s |" % (st["base"], st["size"], st["verdict"], (" (" + st["evidence"] + ")") if st["superseded"] else ""))
    L.append("stacks %d: SUPERSEDED %d (%d branches), LANDED %d branches, out sha %s, renumbered %d, auto-resolved hunks %d, refs unchanged: %s" % (
        len(r["stacks"]), r["superseded_stacks"], r["superseded_branches"], r["landed_branches"], (r["out_sha"] or "-")[:10],
        len(r["renumbered"]), len(r["auto_resolved"]), r["refs_unchanged"]))
    L.append("remaining after sweep: %d of %d" % (r["remaining"], r["total_branches"]))
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("repo")
    ap.add_argument("--target", required=True)
    ap.add_argument("--glob", default="origin/web/f*")
    ap.add_argument("--limit", type=int, default=0, help="max branches per stack (0 = all)")
    ap.add_argument("--order", choices=("plan", "size"), default="plan", help="plan = f223 rank (small, non-overlapping first); size = largest stack first")
    ap.add_argument("--out", default="web/stack2-rb-2026-11-08")
    ap.add_argument("--no-branch", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    r = sweep(a.repo, a.target, a.glob, a.out, not a.no_branch, a.limit or None, a.order)
    print(json.dumps(r, indent=1) if a.json else render(r))
    return 0 if r["refs_unchanged"] else 3


if __name__ == "__main__":
    sys.exit(main())
