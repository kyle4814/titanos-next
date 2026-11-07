#!/usr/bin/env python3
"""stack_rebase_apply.py - the first bounded EXECUTOR for f223's stacks (f298).

f223 plans, f231 dry-runs, f232 finds commits already present. This replays the bottom N branches of the largest
stack, in stack order, onto a fresh target in a detached scratch worktree, and writes ONE new branch holding only the
clean prefix. It never touches an original ref, never pushes, never force-writes any other branch (exit 3 if any ref
other than the output branch differs after the run).

  python3 -I tools/stack_rebase_apply.py REPO --target REF [--glob 'origin/web/f*'] [--limit 8]
                                         [--out web/stack1-rb-2026-11-08] [--json]

Per commit: skipped when its `git patch-id --stable` is already in the running head (f232 logic); else cherry-picked.
A conflict is auto-resolved ONLY when every hunk is mechanical:
  1. package.json: `&&` entries of a script line unioned (base order, then ours-added, then theirs-added, deduped),
     and the file must still parse as JSON.
  2. registry/list files (allow-list below): both sides only ADD lines -> union, deduped.
  3. a picked commit that adds migration NNNN_x.sql whose number is already taken is renumbered to the next free
     number above the tree max (same rule as portal-api/scripts/migration_collisions.mjs suggestions).
Anything else: the branch is aborted and reset, CONFLICT + files recorded, and the stack STOPS (a child cannot land
without its parent). The branch table is: branch | applied | stopped-at | files.
"""
import argparse, importlib.util, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
STOP_ON_CONFLICT = True      # mutation switch: False = keep going past a conflict (tests prove the suite notices)
DEDUPE = True                # mutation switch: False = union without dedupe (tests prove the suite notices)
LIST_FILES = re.compile(r"(registry|manifest|index)\.(ts|tsx|js|mjs|json|py)$|(^|/)docs?/.+\.(md|json)$|\.gitignore$|CHANGELOG")
MIG_RE = re.compile(r"^(portal-api/migrations/)(\d{4})(_[a-z0-9_]+\.sql)$")
SCRIPT_RE = re.compile(r'^(\s*)("[^"]+"):\s*"((?:[^"\\]|\\.)*)"(,?)\s*$')


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m


def _mods():
    return (_load("merge_stack_plan", os.path.join(HERE, "merge_stack_plan.py")),
            _load("stack_rebase_dryrun", os.path.join(HERE, "stack_rebase_dryrun.py")),
            _load("patchid_equiv", os.path.join(HERE, "..", "scripts", "patchid_equiv.py")))


# ---------- mechanical hunk resolvers (pure) ----------
def parse_hunks(text):
    """-> list of segments: str lines (plain) or ('H', ours, base, theirs). None if markers are not diff3-shaped."""
    out, st, cur = [], 0, None
    for ln in text.splitlines(keepends=True):
        if ln.startswith("<<<<<<< ") and st == 0:
            st, cur = 1, ([], [], [])
        elif ln.startswith("||||||| ") and st == 1:
            st = 2
        elif ln.rstrip("\n") == "=======" and st in (1, 2):
            st = 3
        elif ln.startswith(">>>>>>> ") and st == 3:
            out.append(("H",) + cur); st, cur = 0, None
        elif st == 0:
            out.append(ln)
        else:
            if st == 1:
                cur[0].append(ln)          # ours before any base marker (non-diff3): base unknown
            elif st == 2:
                cur[1].append(ln)
            else:
                cur[2].append(ln)
    if st != 0:
        return None
    return out


def _is_subseq(small, big):
    it = iter(big)
    return all(any(x == y for y in it) for x in small)


def additive_union(o, b, t):
    """both sides only ADD lines relative to base -> ours + theirs' new lines. None if either side removed/changed one."""
    if not (_is_subseq(b, o) and _is_subseq(b, t)):
        return None
    new_t = [l for l in t if l not in b]
    if DEDUPE:
        new_t = [l for l in new_t if l not in o]
    return o + new_t


def _parse_script_lines(lines):
    d, order = {}, []
    for l in lines:
        m = SCRIPT_RE.match(l.rstrip("\n"))
        if not m:
            return None
        d[m.group(2)] = (m.group(1), m.group(3), m.group(4)); order.append(m.group(2))
    return d, order


def _entries(v):
    return [e for e in v.split(" && ")] if v else []


def _union_entries(b, o, t):
    res = [e for e in b if e in o and e in t]           # kept by both
    add = [e for e in o if e not in b] + [e for e in t if e not in b]
    for e in add:
        if DEDUPE and e in res:
            continue
        res.append(e)
    return res


def package_json_candidates(o, b, t):
    """script-line union. Returns candidate line lists (trailing-comma variants); None if not mechanical."""
    po, pb, pt = _parse_script_lines(o), _parse_script_lines(b), _parse_script_lines(t)
    if not (po and pb and pt):
        return None
    (do, oo), (db, ob), (dt, ot) = po, pb, pt
    keys = list(dict.fromkeys(oo + ot + ob))
    lines = []
    for k in keys:
        vo, vb, vt = do.get(k), db.get(k), dt.get(k)
        indent = (vo or vt or vb)[0]
        if vo and vt and vo[1] == vt[1]:
            val = vo[1]
        elif vo and vb and vo[1] == vb[1] and vt:
            val = vt[1]
        elif vt and vb and vt[1] == vb[1] and vo:
            val = vo[1]
        elif vb is None and (vo is None or vt is None):
            val = (vo or vt)[1]
        elif vo and vt:
            if "&&" not in (vo[1] + vt[1]):
                return None
            val = " && ".join(_union_entries(_entries(vb[1]) if vb else [], _entries(vo[1]), _entries(vt[1])))
        else:
            return None                                    # a key deleted on one side and changed on the other
        lines.append((indent, k, val))
    cands = []
    for last_comma in (True, False):
        cands.append(["%s%s: \"%s\"%s\n" % (i, k, v, "," if (n < len(lines) - 1 or last_comma) else "")
                      for n, (i, k, v) in enumerate(lines)])
    return cands


def resolve_text(path, text):
    """-> (new_text, hunks_resolved) or (None, reason)."""
    segs = parse_hunks(text)
    if segs is None:
        return None, "unparseable markers"
    pick = []                                              # per hunk: list of candidate line lists
    for s in segs:
        if isinstance(s, str):
            continue
        _, o, b, t = s
        cands = None
        if os.path.basename(path) == "package.json":
            cands = package_json_candidates(o, b, t)
        if cands is None and LIST_FILES.search(path):
            r = additive_union(o, b, t)
            cands = [r] if r is not None else None
        if not cands:
            return None, "non-mechanical hunk in %s" % path
        pick.append(cands)
    n = len(pick)

    def build(choice):
        out, h = [], 0
        for s in segs:
            if isinstance(s, str):
                out.append(s)
            else:
                out.extend(pick[h][choice[h]]); h += 1
        return "".join(out)
    if n > 6:
        return None, "too many hunks"
    for mask in range(2 ** n):
        choice = [(mask >> i) & 1 if len(pick[i]) > 1 else 0 for i in range(n)]
        if any(c and len(pick[i]) < 2 for i, c in enumerate(choice)):
            continue
        res = build(choice)
        if os.path.basename(path) == "package.json":
            try:
                json.loads(res)
            except ValueError:
                continue
        return res, n
    return None, "resolution does not parse"


# ---------- executor ----------
class Applier:
    def __init__(self, repo, dry, pid, plan_mod):
        self.repo, self.dry, self.pid, self.plan = repo, dry, pid, plan_mod
        self.g = dry.g
        self.renumbered, self.auto = [], []

    def d(self, *a):
        return self.g(self.sc.dir, *a)

    def head(self):
        return self.d("rev-parse", "HEAD").stdout.strip()

    def tree_migs(self):
        return [f for f in self.d("ls-tree", "-r", "--name-only", "HEAD").stdout.split() if MIG_RE.match(f)]

    def renumber_new_migrations(self):
        added = [f for f in self.d("diff", "--name-only", "--diff-filter=A", "HEAD~1", "HEAD").stdout.split() if MIG_RE.match(f)]
        if not added:
            return
        for f in added:
            allm = [x for x in self.tree_migs() if x != f]
            m = MIG_RE.match(f)
            if any(MIG_RE.match(x).group(2) == m.group(2) for x in allm):
                nxt = max([int(MIG_RE.match(x).group(2)) for x in allm] + [0]) + 1
                new = "%s%04d%s" % (m.group(1), nxt, m.group(3))
                self.d("mv", f, new)
                self.d("commit", "-q", "--amend", "--no-edit")
                self.renumbered.append({"from": f, "to": new})

    def pick(self, sha):
        """-> 'applied' | 'empty' | list of conflict files."""
        r = self.d("-c", "merge.conflictstyle=diff3", "cherry-pick", sha)
        if r.returncode == 0:
            self.renumber_new_migrations()
            return "applied"
        files = self.d("diff", "--name-only", "--diff-filter=U").stdout.split()
        if not files:
            if self.d("diff", "--cached", "--quiet").returncode == 0:
                self.d("cherry-pick", "--skip"); return "empty"
            self.d("cherry-pick", "--abort"); return ["(cherry-pick failed: %s)" % r.stderr.strip()[:100]]
        fixes = {}
        for f in files:
            p = os.path.join(self.sc.dir, f)
            try:
                text = open(p, encoding="utf-8").read()
            except (OSError, UnicodeDecodeError):
                fixes = None; break
            new, info = resolve_text(f, text)
            if new is None:
                fixes = None; break
            fixes[f] = (new, info)
        if not fixes:
            self.d("cherry-pick", "--abort")
            return files
        for f, (new, info) in fixes.items():
            open(os.path.join(self.sc.dir, f), "w", encoding="utf-8").write(new)
            self.d("add", f)
            self.auto.append({"file": f, "hunks": info, "commit": sha[:10]})
        c = self.d("cherry-pick", "--continue", "--no-edit")
        if c.returncode:
            if self.d("diff", "--cached", "--quiet").returncode == 0:
                self.d("cherry-pick", "--skip"); return "empty"
            self.d("cherry-pick", "--abort"); return files
        self.renumber_new_migrations()
        return "applied"


def run(repo, target, glob, limit=8, out_branch="web/stack1-rb-2026-11-08", make_branch=True, stack_index=0):
    pm, dry, pidmod = _mods()
    before = {ln.rsplit(" ", 1)[0]: ln.rsplit(" ", 1)[1] for ln in dry.refs(repo).splitlines()}
    p = pm.plan(repo, target, glob)
    tsha = p["target_sha"]
    stacks = sorted(p["stacks"], key=lambda s: (-len(s["branches"]), s["rank"]))
    res = {"target": p["target"], "target_sha": tsha, "glob": glob, "limit": limit, "out_branch": out_branch,
           "rows": [], "applied_branches": 0, "stack_base": None, "out_sha": None, "renumbered": [], "auto_resolved": []}
    res["stack_index"], res["stack_count"] = stack_index, len(stacks)
    if stack_index >= len(stacks):
        res["refs_unchanged"] = True
        return res
    stack = stacks[stack_index]
    res["stack_base"], res["stack_size"] = stack["base"], len(stack["branches"])
    sc = dry.Scratch(repo, tsha)
    ap = Applier(repo, dry, pidmod, pm); ap.sc = sc
    try:
        ids = {pid for _, pid in pidmod.patch_ids(repo, tsha)}
        done, stopped = set(), False
        for b in stack["branches"][:limit]:
            row = {"branch": b, "applied": "0/0", "stopped_at": None, "files": [], "skipped_present": 0, "status": "NOT_RUN"}
            res["rows"].append(row)
            if stopped:
                continue
            ps = p["parents"][b]
            if any(x not in done for x in ps):
                row["status"] = "BLOCKED"; row["files"] = [x for x in ps if x not in done]
                if STOP_ON_CONFLICT:
                    stopped = True
                continue
            upstream = p["tip_shas"][ps[0]] if ps else dry.g(repo, "merge-base", tsha, p["tip_shas"][b]).stdout.strip()
            commits, _m = dry.own_commits(repo, p["tip_shas"][b], upstream)
            bpids = dict(pidmod.patch_ids(repo, "%s..%s" % (upstream, p["tip_shas"][b])))
            start = ap.head()
            n_app, n_skip, new_ids, fail = 0, 0, [], None
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
            done.add(b); res["applied_branches"] += 1
        res["out_sha"] = ap.head()
        res["renumbered"], res["auto_resolved"] = ap.renumbered, ap.auto
        if make_branch and res["out_sha"] != tsha:
            dry.g(repo, "update-ref", "refs/heads/" + out_branch, res["out_sha"])
    finally:
        sc.close()
    after = {ln.rsplit(" ", 1)[0]: ln.rsplit(" ", 1)[1] for ln in dry.refs(repo).splitlines()}
    own = "refs/heads/" + out_branch
    res["refs_unchanged"] = {k: v for k, v in before.items() if k != own} == {k: v for k, v in after.items() if k != own}
    return res


def render(r):
    L = ["target %s @ %s, stack %s (%s branches), limit %d, out %s" % (r["target"], r["target_sha"][:10], r["stack_base"],
                                                                     r.get("stack_size"), r["limit"], r["out_branch"]),
         "| branch | applied | stopped-at | files |", "|---|---|---|---|"]
    for w in r["rows"]:
        L.append("| %s | %s %s (skipped present %d) | %s | %s |" % (w["branch"], w["status"], w["applied"], w["skipped_present"],
                                                                  (w["stopped_at"] or "-")[:10], ", ".join(w["files"][:8]) or "-"))
    L.append("LANDED %d of %d branches (limit %d); out sha %s; renumbered %d; auto-resolved hunks %d; refs unchanged: %s" % (
        r["applied_branches"], len(r["rows"]), r["limit"], (r["out_sha"] or "-")[:10], len(r["renumbered"]), len(r["auto_resolved"]), r["refs_unchanged"]))
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("repo")
    ap.add_argument("--target", required=True)
    ap.add_argument("--glob", default="origin/web/f*")
    ap.add_argument("--limit", type=int, default=8)
    ap.add_argument("--out", default="web/stack1-rb-2026-11-08")
    ap.add_argument("--no-branch", action="store_true")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--stack", type=int, default=0, help="index into stacks sorted largest first")
    ap.add_argument("--best", type=int, default=0, help="try the first K stacks (no branch), then re-run the one that lands most")
    a = ap.parse_args(argv)
    si = a.stack
    if a.best:
        trial = [(run(a.repo, a.target, a.glob, a.limit, a.out, False, i), i) for i in range(a.best)]
        for t, i in trial:
            if t.get("stack_base"):
                print("trial stack %d (%s, %s branches): landed %d" % (i, t["stack_base"], t.get("stack_size"), t["applied_branches"]))
        si = max(trial, key=lambda x: (x[0]["applied_branches"], -x[1]))[1]
    r = run(a.repo, a.target, a.glob, a.limit, a.out, not a.no_branch, si)
    print(json.dumps(r, indent=1) if a.json else render(r))
    return 0 if r["refs_unchanged"] else 3


if __name__ == "__main__":
    sys.exit(main())
