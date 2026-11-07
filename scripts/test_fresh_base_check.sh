#!/usr/bin/env bash
# Fixture-only test for fresh_base_check.sh. MUTATE=1 swaps in a broken ancestor check (suite must go RED).
set -u
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SRC=$HERE/fresh_base_check.sh
T=$(mktemp -d "${TMPDIR:-/tmp}/fbc-test.XXXXXX") || exit 97
case "$T" in */fbc-test.??????) ;; *) echo "bad fixture root '$T'" >&2; exit 97 ;; esac
[ -d "$T" ] || exit 97
cleanup() { case "${T:-}" in */fbc-test.??????) [ -d "$T" ] && { rm -rf -- "${T:?}/o.git" "${T:?}/w" "${T:?}/chk.sh"; rmdir "$T"; } ;; esac; }
trap cleanup EXIT
CHK=$T/chk.sh
if [ "${MUTATE:-0}" = 1 ]; then
  sed 's/git merge-base --is-ancestor "\$int" "\$branch"/false/' "$SRC" > "$CHK"
  cmp -s "$SRC" "$CHK" && { echo "mutation did not apply"; exit 97; }
else cp "$SRC" "$CHK"; fi
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
git init -q --bare "$T/o.git" && git clone -q "$T/o.git" "$T/w" 2>/dev/null && cd "$T/w" || exit 97
git config commit.gpgsign false
fail=0; n=0
check() { # name want_rc want_out_prefix branch
  n=$((n+1)); out=$(bash "$CHK" "$4" 2>&1); rc=$?
  if [ "$rc" = "$2" ] && [[ "$out" == "$3"* ]]; then echo "ok $n $1: $out"; else echo "FAIL $n $1: rc=$rc out='$out' want rc=$2 '$3'"; fail=1; fi
}
cm() { GIT_COMMITTER_DATE="$1" GIT_AUTHOR_DATE="$1" git commit -q --allow-empty -m "$2"; }
cm "2026-01-01T00:00:00" base; git branch -M main; git push -q origin main
git branch old-work
check "no int branch" 0 NOINT main
git checkout -q -b web/obelisk-int-a; cm "2026-02-01T00:00:00" int-a1; git push -q origin web/obelisk-int-a
git checkout -q -b web/obelisk-int2-b; cm "2026-03-01T00:00:00" int-b1; cm "2026-03-02T00:00:00" int-b2; git push -q origin web/obelisk-int2-b
git fetch -q origin
git checkout -q -b fresh-work origin/web/obelisk-int2-b; cm "2026-03-03T00:00:00" w1
check "fresh branch" 0 FRESH fresh-work
check "stale off main, two ints, picks newest, behind=3" 1 "STALE behind=3 commits, int=origin/web/obelisk-int2-b" old-work
git checkout -q -b mid-work origin/web/obelisk-int-a
check "behind older int only, behind=2" 1 "STALE behind=2 commits, int=origin/web/obelisk-int2-b" mid-work
check "branch equal to int head is fresh" 0 FRESH origin/web/obelisk-int2-b
check "unknown branch errors" 2 "ERROR" nope-branch
[ $fail = 0 ] && echo "ALL $n PASS" || echo "SUITE RED"
exit $fail
