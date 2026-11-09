#!/usr/bin/env python3
"""soak_drift_guard.py - READ-ONLY standing check: has the integration head moved past the soak pin? (f338, C10, 2026-11-09)

The soak pins ONE build sha (f217 bin/soak_sha_pin.py, PIN.json {sha, ref, started, ...}); any change merged during the soak restarts it.
f235 only guards merges that go through its own check. This compares the pinned sha against the NEWEST origin/web/obelisk-int* head
so a merge that landed outside the freeze is seen.

  soak_drift_guard.py <PIN.json> [--repo DIR] [--head REF]

Prints ONE line, never writes anything (no fetch, no re-pin):
  HELD    pinned == head                                   exit 0
  DRIFT   head moved (pin is an ancestor, N commits ahead) exit 3
  DRIFT   pin is not an ancestor of head (diverged/rewritten) exit 3
  UNKNOWN pin missing/unreadable/bad sha, or head unresolvable, or pin object absent  exit 4   (never HELD)
Newest head = the remote-tracking ref origin/web/obelisk-int* with the latest committer date (--head overrides).
Run `git fetch origin` first if you want the freshest view; this tool does not.
"""
import json, re, subprocess, sys
from pathlib import Path

SHA = re.compile(r"[0-9a-f]{7,40}")


def git(repo, *a):
    r = subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True)
    return r.returncode, r.stdout.strip()


def newest_head(repo):
    rc, out = git(repo, "for-each-ref", "--sort=-committerdate", "--format=%(refname:short)", "refs/remotes/origin/web/obelisk-int*")
    names = out.split() if rc == 0 else []
    return names[0] if names else None


def verdict(pin_path, repo, head_ref=None):
    """-> (word, exit_code, detail)"""
    try:
        d = json.loads(Path(pin_path).read_text())
    except (OSError, ValueError) as e:
        return "UNKNOWN", 4, "pin unreadable: %s (%s)" % (pin_path, type(e).__name__)
    sha = d.get("sha") if isinstance(d, dict) else None
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        return "UNKNOWN", 4, "pin has no valid sha"
    ref = head_ref or newest_head(repo)
    if not ref:
        return "UNKNOWN", 4, "no origin/web/obelisk-int* ref found in %s" % repo
    rc, head = git(repo, "rev-parse", "--verify", "--quiet", ref + "^{commit}")
    if rc != 0 or not head:
        return "UNKNOWN", 4, "cannot resolve head %s" % ref
    rc, pinned = git(repo, "rev-parse", "--verify", "--quiet", sha + "^{commit}")
    if rc != 0 or not pinned:
        return "UNKNOWN", 4, "pinned sha %s is not a commit in this repo" % sha[:9]
    tail = "pinned %s head %s (%s)" % (pinned, head, ref)
    if pinned == head:
        return "HELD", 0, tail + " ahead 0"
    rc, _ = git(repo, "merge-base", "--is-ancestor", pinned, head)
    if rc == 0:
        rc, n = git(repo, "rev-list", "--count", "%s..%s" % (pinned, head))
        return "DRIFT", 3, tail + " ahead %s" % (n if rc == 0 else "?")
    rc, n = git(repo, "rev-list", "--count", "%s..%s" % (pinned, head))
    return "DRIFT", 3, tail + " pin NOT an ancestor of head (diverged), %s commits in head not in pin" % (n if rc == 0 else "?")


def main(argv):
    args, repo, head = [], Path.cwd(), None
    i = 0
    while i < len(argv):
        if argv[i] == "--repo" and i + 1 < len(argv):
            repo = Path(argv[i + 1]); i += 2
        elif argv[i] == "--head" and i + 1 < len(argv):
            head = argv[i + 1]; i += 2
        else:
            args.append(argv[i]); i += 1
    if len(args) != 1:
        print("UNKNOWN usage: soak_drift_guard.py <PIN.json> [--repo DIR] [--head REF]")
        return 4
    word, code, detail = verdict(args[0], repo, head)
    print("%s %s" % (word, detail))
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
