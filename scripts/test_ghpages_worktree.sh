#!/usr/bin/env bash
# test_ghpages_worktree.sh - deploy.sh's gh-pages worktree survives a stale folder (2026-10-01 deploy failure).
# Disposable fixture only: a bare origin + clone under a fresh mktemp dir. No network, nothing outside the fixture.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/ghpwt.XXXXXX")" || { echo "mktemp failed"; exit 97; }
case "$T" in /tmp/ghpwt.*|"${TMPDIR:-/tmp}"/ghpwt.*) ;; *) echo "refusing fixture path $T"; exit 97;; esac
trap 'rm -rf -- "$T"' EXIT
pass=0; fail=0
ok(){ if [ "$1" -eq 0 ]; then pass=$((pass+1)); echo "PASS $2"; else fail=$((fail+1)); echo "FAIL $2"; fi; }
G(){ git -c user.name=t -c user.email=t@t -c init.defaultBranch=main "$@"; }
. "$HERE/lib/ghpages_worktree.sh"
G init -q --bare "$T/origin.git"
G clone -q "$T/origin.git" "$T/seed" 2>/dev/null
echo app > "$T/seed/a"; G -C "$T/seed" add a; G -C "$T/seed" commit -qm main; G -C "$T/seed" push -q origin main
G -C "$T/seed" checkout -q --orphan gh-pages; G -C "$T/seed" rm -rqf .; echo site > "$T/seed/index.html"
G -C "$T/seed" add index.html; G -C "$T/seed" commit -qm site; G -C "$T/seed" push -q origin gh-pages
G clone -q "$T/origin.git" "$T/repo" 2>/dev/null
valid(){ [ "$(git -C "$1" rev-parse HEAD 2>/dev/null)" = "$(git -C "$T/repo" rev-parse origin/gh-pages)" ] && [ -f "$1/index.html" ]; }

# 1 control: a fresh path gets a real gh-pages worktree
ensure_ghpages_worktree "$T/repo" "$T/wt1" >/dev/null 2>&1; valid "$T/wt1"; ok $? "fresh path: gh-pages worktree created (control)"

# 2 the 2026-10-01 shape: a .git FILE pointing at worktree metadata that no longer exists
mkdir -p "$T/wt2"; echo "gitdir: $T/gone/.git/worktrees/wt2" > "$T/wt2/.git"; echo old > "$T/wt2/index.html"
! git -C "$T/wt2" status >/dev/null 2>&1; ok $? "the stale folder reproduces the failure: git cannot read it"
[ -f "$T/wt2/.git" ]; ok $? "and the old check ([ -f WORKTREE/.git ]) would have called it fine"
out=$(ensure_ghpages_worktree "$T/repo" "$T/wt2" 2>&1); valid "$T/wt2"; ok $? "stale folder: replaced by a working gh-pages worktree"
ls -d "$T"/wt2.stale-* >/dev/null 2>&1 && [ "$(cat "$T"/wt2.stale-*/index.html)" = old ]; ok $? "stale folder moved aside with its content, never deleted"
echo "$out" | grep -q "moved aside"; ok $? "the move is reported"

# 2b the shape that would have failed the NEXT deploy: gh-pages already checked out as a branch in another worktree
G -C "$T/repo" worktree add -q "$T/other" gh-pages 2>/dev/null
ensure_ghpages_worktree "$T/repo" "$T/wt5" >/dev/null 2>&1; valid "$T/wt5"; ok $? "gh-pages checked out elsewhere does not block a new deploy worktree"

# 3 a valid worktree is left alone
before=$(ls -d "$T"/wt1* | wc -l); ensure_ghpages_worktree "$T/repo" "$T/wt1" >/dev/null 2>&1
[ "$(ls -d "$T"/wt1* | wc -l)" = "$before" ] && valid "$T/wt1"; ok $? "a valid worktree is kept as is"

# 4 a checkout of a different repo is not trusted
G init -q "$T/wt4"; ensure_ghpages_worktree "$T/repo" "$T/wt4" >/dev/null 2>&1
valid "$T/wt4" && ls -d "$T"/wt4.stale-* >/dev/null 2>&1; ok $? "a foreign repo at the path is moved aside, not deployed into"

echo "== test_ghpages_worktree: $pass passed, $fail failed"; [ "$fail" -eq 0 ]
