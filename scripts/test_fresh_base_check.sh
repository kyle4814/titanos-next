#!/usr/bin/env bash
# Fixture-only test for fresh_base_check.sh, plus 2 mutation checks. Never touches a live repo.
set -u
here="$(cd "$(dirname "$0")" && pwd)"; G="$here/fresh_base_check.sh"
T=$(mktemp -d) || exit 1
[ -n "$T" ] && [ -d "$T" ] && [ "$T" != "/" ] && [ "$T" != "$HOME" ] && [ -z "$(ls -A "$T")" ] || { echo "bad tmp"; exit 1; }
trap 'rm -rf "${T:?}"' EXIT
fail=0; n=0
ok(){ n=$((n+1)); if [ "$2" = "$3" ]; then echo "ok $n $1"; else echo "FAIL $n $1 (want $3 got $2)"; fail=$((fail+1)); fi; }
F="$T/fx"; mkdir -p "$F"; cd "$F" || exit 1
git init -q -b main r && cd r && git config user.email t@t && git config user.name t
echo a > a; echo b > b; git add -A; git commit -qm base
base=$(git rev-parse HEAD)
git branch fresh; git branch behind; git branch conf
git switch -q -c intx; echo i > i; git add i; git commit -qm i1; sleep 1
echo changed > a; git commit -qam i2
git update-ref refs/remotes/origin/web/obelisk-int-new HEAD
git update-ref refs/remotes/origin/web/obelisk-int-old "$base"
git switch -q fresh; git merge -q --ff-only intx; echo f > f; git add f; git commit -qm f
git switch -q conf; echo mine > a; git commit -qam conf
git switch -q behind; echo z > z; git add z; git commit -qm z
# make intx 30 ahead of behind via extra commits
git switch -q intx; for k in $(seq 1 30); do echo $k > "x$k"; git add "x$k"; git commit -qm "x$k"; done
git update-ref refs/remotes/origin/web/obelisk-int-new HEAD
git switch -q main
before=$(git status --porcelain | wc -l)

git switch -q -c tipfresh intx; echo t > t; git add t; git commit -qm t; git switch -q main
out=$(bash "$G" tipfresh); rc=$?; ok "fresh rc" $rc 0
case "$out" in "BEHIND=0 MERGE_BASE="*" CONFLICT=no") ok "fresh line shape" y y;; *) ok "fresh line shape: $out" n y;; esac
# fresh branched from intx before the 30: behind=30 -> need threshold above
FRESH_MAX_BEHIND=31 bash "$G" fresh >/dev/null; rc=$?; ok "fresh under raised threshold" $rc 0
bash "$G" fresh >/dev/null; rc=$?; ok "default threshold 25 vs behind 30 is stale" $rc 3
out=$(bash "$G" behind); rc=$?; ok "behind-only rc stale" $rc 3
case "$out" in *"CONFLICT=no") ok "behind-only no conflict" y y;; *) ok "behind-only no conflict: $out" n y;; esac
FRESH_MAX_BEHIND=100 bash "$G" behind >/dev/null; rc=$?; ok "behind-only passes with big threshold" $rc 0
out=$(FRESH_MAX_BEHIND=100 bash "$G" conf); rc=$?; ok "conflicting rc stale even under threshold" $rc 3
case "$out" in *"CONFLICT=yes") ok "conflict yes" y y;; *) ok "conflict yes: $out" n y;; esac
out=$(bash "$G" nosuchbranch 2>&1); rc=$?; ok "bad branch rc" $rc 2
bash "$G" >/dev/null 2>&1; rc=$?; ok "no args rc" $rc 2
bash "$G" fresh refs/remotes/origin/nope >/dev/null 2>&1; rc=$?; ok "bad int ref rc" $rc 2
bash "$G" "bad name;" >/dev/null 2>&1; rc=$?; ok "hostile branch name rc" $rc 2
# default ref picks newest by date (new, not old)
out=$(FRESH_MAX_BEHIND=100 bash "$G" fresh); case "$out" in *"BEHIND=30"*) ok "newest int picked" y y;; *) ok "newest int picked: $out" n y;; esac
after=$(git status --porcelain | wc -l); ok "worktree untouched" "$after" "$before"
# no integration ref
for r in $(git for-each-ref --format='%(refname)' refs/remotes/origin/web); do git update-ref -d "$r"; done
bash "$G" fresh >/dev/null 2>&1; rc=$?; ok "no integration ref rc" $rc 2
git update-ref refs/remotes/origin/web/obelisk-int-new intx
# mutations
sed 's/\[ "\$behind" -lt "\$max" \] && //' "$G" > "$T/m_thr.sh"
sed 's/^if git merge-tree --write-tree[^;]*; then/if true; then/' "$G" > "$T/m_con.sh"
FRESH_MAX_BEHIND=25 bash "$T/m_thr.sh" fresh >/dev/null; rc=$?
[ "$rc" = 0 ] && { n=$((n+1)); echo "ok $n mutation threshold-ignored turns test red (stale branch now rc 0)"; } || { fail=$((fail+1)); echo "FAIL mutation threshold survived"; }
FRESH_MAX_BEHIND=100 bash "$T/m_con.sh" conf >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && { n=$((n+1)); echo "ok $n mutation conflict-ignored turns test red (conflicting branch now rc 0)"; } || { fail=$((fail+1)); echo "FAIL mutation conflict survived (rc $rc)"; }
echo "TOTAL $n ok, $fail fail"; [ "$fail" = 0 ] && echo "PASS" || echo "FAILED"; exit $fail
