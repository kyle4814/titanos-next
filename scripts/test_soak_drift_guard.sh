#!/usr/bin/env bash
# test_soak_drift_guard.sh - fixture repos in a scratch dir only; never touches real soak state (f338).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
G="$HERE/soak_drift_guard.py"
S="$(mktemp -d /tmp/f338drift.XXXXXX)" || exit 1
case "$S" in /tmp/f338drift.*) ;; *) echo "FAIL bad scratch"; exit 1;; esac
trap 'rm -rf "${S:?}"' EXIT
pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS $1"; }
no() { fail=$((fail+1)); echo "FAIL $1"; }
expect() { # name want_word want_exit guard
  local name="$1" w="$2" c="$3" g="$4" out rc
  out="$(python3 "$g" "$S/PIN.json" --repo "$S/r" 2>&1)"; rc=$?
  case "$out" in "$w "*) [ "$rc" = "$c" ] && ok "$name ($out)" || no "$name exit $rc want $c: $out";; *) no "$name want $w got: $out";; esac
}
R="$S/r"; git init -q "$R"; cd "$R" || exit 1
git config user.email t@t; git config user.name t
git commit -q --allow-empty -m c1; C1=$(git rev-parse HEAD)
git update-ref refs/remotes/origin/web/obelisk-int3-2026-11-07 "$C1"
pin() { printf '{"sha": "%s", "ref": "web/obelisk-int3-2026-11-07", "started": "2026-11-09T00:00:00+10:00"}\n' "$1" > "$S/PIN.json"; }
pin "$C1"; expect "pinned equals head" HELD 0 "$G"
git commit -q --allow-empty -m c2
GIT_COMMITTER_DATE="2030-01-01T00:00:00" git commit -q --allow-empty -m c3; C3=$(git rev-parse HEAD)
git update-ref refs/remotes/origin/web/obelisk-int3-2026-11-07 "$C3"
expect "merges after pin" DRIFT 3 "$G"
python3 "$G" "$S/PIN.json" --repo "$R" | grep -q "ahead 2" && ok "commit count 2" || no "commit count 2"
# older int ref must not win over the newest
git update-ref refs/remotes/origin/web/obelisk-int-2026-11-06 "$C1"
python3 "$G" "$S/PIN.json" --repo "$R" | grep -q "obelisk-int3" && ok "newest ref chosen by date" || no "newest ref chosen by date"
# diverged pin
git checkout -q --detach "$C1"; git commit -q --allow-empty -m side; SIDE=$(git rev-parse HEAD)
pin "$SIDE"; expect "pin not ancestor" DRIFT 3 "$G"
python3 "$G" "$S/PIN.json" --repo "$R" | grep -q "NOT an ancestor" && ok "diverged wording" || no "diverged wording"
# missing / bad pin
rm -f "$S/PIN.json"; expect "missing pin" UNKNOWN 4 "$G"
echo '{bad' > "$S/PIN.json"; expect "malformed pin" UNKNOWN 4 "$G"
echo '{"ref":"x"}' > "$S/PIN.json"; expect "no sha" UNKNOWN 4 "$G"
pin 0123456789abcdef0123456789abcdef01234567; expect "pin object absent" UNKNOWN 4 "$G"
# read-only: refs unchanged
B=$(git for-each-ref | md5sum); pin "$C1"; python3 "$G" "$S/PIN.json" --repo "$R" >/dev/null; [ "$B" = "$(git for-each-ref | md5sum)" ] && ok "read-only (refs unchanged)" || no "read-only"
# no int ref at all
R2="$S/r2"; git init -q "$R2"; (cd "$R2" && git config user.email t@t && git config user.name t && git commit -q --allow-empty -m a)
out="$(python3 "$G" "$S/PIN.json" --repo "$R2")"; rc=$?; case "$out" in UNKNOWN*) [ $rc = 4 ] && ok "no int ref" || no "no int ref rc";; *) no "no int ref: $out";; esac
# MUTATION: flip the comparison; the suite's core cases must then fail
M="$S/mut.py"; sed 's/if pinned == head:/if pinned != head:/' "$G" > "$M"
cmp -s "$G" "$M" && no "mutation did not change file"
pin "$C1"; git update-ref refs/remotes/origin/web/obelisk-int3-2026-11-07 "$C1"
out="$(python3 "$M" "$S/PIN.json" --repo "$R" 2>&1)"; case "$out" in "HELD "*) no "mutant 1 survived";; *) ok "mutation (flip ==) caught: HELD case now '${out%% *}'";; esac
M2="$S/mut2.py"; sed 's/return "UNKNOWN", 4, "pin unreadable/return "HELD", 0, "pin unreadable/' "$G" > "$M2"
rm -f "$S/PIN.json"; out="$(python3 "$M2" "$S/PIN.json" --repo "$R" 2>&1)"; case "$out" in UNKNOWN*) no "mutant 2 survived";; *) ok "mutation (missing pin -> HELD) caught";; esac
echo "== test_soak_drift_guard: $pass pass, $fail fail"
[ "$fail" -eq 0 ]
