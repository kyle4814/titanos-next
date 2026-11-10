#!/usr/bin/env bash
# test_c6_holdout_verify.sh - SYNTHETIC fixtures in a scratch dir (f396). Proves the independent C6 verifier agrees,
# and exits non-zero on planted disagreements (log verdict flipped, primary number altered, wrong n, log/tsv drift).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
V="$HERE/c6_holdout_verify.py"
S="$(mktemp -d /tmp/f396c6.XXXXXX)" || exit 1
case "$S" in /tmp/f396c6.*) ;; *) echo "FAIL bad scratch"; exit 1;; esac
trap 'rm -rf "${S:?}"' EXIT
pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS $1"; }
no() { fail=$((fail+1)); echo "FAIL $1"; }
# 10 synthetic asks: 6 shelf (4 right, 1 wrong-but-in-top3, 1 wrong), 2 none (1 right), 2 ask (0 right)
cat > "$S/log.jsonl" <<'J'
{"seat":"guest","expect":"portal:a","q":"s1","kind":"match","shelf":"portal:a","alts":[],"taps":[]}
{"seat":"guest","expect":"portal:b","q":"s2","kind":"match","shelf":"portal:b","alts":["portal:c"],"taps":[]}
{"seat":"owner","expect":"portal:c","q":"s3","kind":"match","shelf":"portal:c","alts":[],"taps":[]}
{"seat":"pro","expect":"offer:d","q":"s4","kind":"match","shelf":"offer:d","alts":[],"taps":[]}
{"seat":"agent","expect":"portal:e","q":"s5","kind":"match","shelf":"portal:x","alts":["portal:e"],"taps":[]}
{"seat":"enterprise","expect":"portal:f","q":"s6","kind":"unmatched","shelf":null,"alts":[],"taps":[]}
{"seat":"partner","expect":"none","q":"s7","kind":"unmatched","shelf":null,"alts":[],"taps":[]}
{"seat":"partner","expect":"none","q":"s8","kind":"match","shelf":"portal:a","alts":[],"taps":[]}
{"seat":"guest","expect":"ask","q":"s9","kind":"match","shelf":"portal:a","alts":[],"taps":[]}
{"seat":"owner","expect":"ask","q":"s10","kind":"unmatched","shelf":null,"alts":[],"taps":[]}
J
# the primary's printed numbers for exactly that log: right 5/10, top3 6/10, shelf 4/6 (top3 5), none 1/2, ask 0/2
cat > "$S/primary.txt" <<'P'
HOLDOUT n=10 model/network/random calls=0
overall right: 5/10 = 50.0% Wilson95 [23.7%, 76.3%]  top3: 6/10 = 60.0% [31.3%, 83.2%]
shelf asks right: 4/6 = 66.7% [30.0%, 90.3%]  top3: 5/6
out-of-scope kept unmatched: 1/2 [9.5%, 90.5%]   near-duplicate -> ask: 0/2 [0.0%, 65.8%]
  seat guest: 2/3
  seat owner: 1/2
  seat pro: 1/1
  seat agent: 0/1
  seat enterprise: 0/1
  seat partner: 1/2
P
v() { python3 "$V" --log "$S/log.jsonl" --primary "$S/primary.txt" "$@" >"$S/out" 2>&1; }

v; rc=$?; [ $rc = 0 ] && grep -q "AGREE n=10 right=5 top3=6" "$S/out" && ok "fixture agrees -> exit 0" || { no "agree rc=$rc"; cat "$S/out"; }

# planted disagreement 1: the primary claims one more right answer
sed 's#overall right: 5/10 = 50.0%#overall right: 6/10 = 60.0%#' "$S/primary.txt" > "$S/p2.txt"
python3 "$V" --log "$S/log.jsonl" --primary "$S/p2.txt" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && grep -q "overall.k: primary 6 vs recomputed 5" "$S/out" && ok "MUTANT primary inflated right count -> exit 1" || no "inflate rc=$rc"

# planted disagreement 2: a router verdict in the raw log flips (primary unchanged)
sed 's#"q":"s7","kind":"unmatched","shelf":null#"q":"s7","kind":"match","shelf":"portal:a"#' "$S/log.jsonl" > "$S/l2.jsonl"
python3 "$V" --log "$S/l2.jsonl" --primary "$S/primary.txt" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && grep -q "none.k: primary 1 vs recomputed 0" "$S/out" && ok "MUTANT raw-log verdict flipped -> exit 1" || no "flip rc=$rc"

# planted disagreement 3: only a Wilson bound is doctored
sed 's#\[23.7%, 76.3%\]#[23.7%, 80.0%]#' "$S/primary.txt" > "$S/p3.txt"
python3 "$V" --log "$S/log.jsonl" --primary "$S/p3.txt" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && grep -q "overall.hi" "$S/out" && ok "MUTANT doctored Wilson bound -> exit 1" || no "wilson rc=$rc"

# planted disagreement 4: seat tally and n header
sed 's#seat pro: 1/1#seat pro: 0/1#; s#HOLDOUT n=10#HOLDOUT n=11#' "$S/primary.txt" > "$S/p4.txt"
python3 "$V" --log "$S/log.jsonl" --primary "$S/p4.txt" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && grep -q "seat_pro.k" "$S/out" && grep -q "n: primary 11" "$S/out" && ok "MUTANT seat tally and n header -> exit 1" || no "seat rc=$rc"

# a missing primary line is a disagreement, never a silent pass
grep -v '^  seat guest' "$S/primary.txt" > "$S/p5.txt"
python3 "$V" --log "$S/log.jsonl" --primary "$S/p5.txt" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && ok "missing primary line -> exit 1" || no "missing rc=$rc"

# log drift from holdout.tsv (expectation changed in the log) is caught
printf 'guest\tportal:a\ts1\nguest\tportal:b\ts2\n' > "$S/h.tsv"
head -2 "$S/log.jsonl" > "$S/l6.jsonl"; sed -i 's#"expect":"portal:b"#"expect":"portal:z"#' "$S/l6.jsonl"
python3 "$V" --log "$S/l6.jsonl" --primary "$S/primary.txt" --tsv "$S/h.tsv" >"$S/out" 2>&1; rc=$?
[ $rc = 1 ] && grep -q "holdout.tsv" "$S/out" && ok "log drift from holdout.tsv -> exit 1" || no "drift rc=$rc"

# unusable input exits 2
python3 "$V" --log "$S/nope" --primary "$S/primary.txt" >"$S/out" 2>&1; rc=$?
[ $rc = 2 ] && ok "unreadable log -> exit 2" || no "unusable rc=$rc"
: > "$S/empty"; python3 "$V" --log "$S/empty" --primary "$S/primary.txt" >"$S/out" 2>&1; rc=$?
[ $rc = 2 ] && ok "empty log -> exit 2" || no "empty rc=$rc"

# independence: no import of, and no shared scoring text with, the primary
grep -v '^//' "$HERE/concierge_asklog_dump.mjs" | grep -q 'concierge_holdout' && no "dump imports primary" || ok "raw dump does not import the primary scorer"
grep -q 'wilson\|ok:\|in3' "$HERE/concierge_asklog_dump.mjs" && no "dump scores" || ok "raw dump carries no scoring"

# live: real router + real primary + real holdout.tsv agree
( cd "$HERE/.." && python3 scripts/c6_holdout_verify.py ) >"$S/out" 2>&1; rc=$?
[ $rc = 0 ] && grep -q "AGREE n=120" "$S/out" && ok "live holdout (n=120): independent recompute agrees with primary" || { no "live rc=$rc"; cat "$S/out"; }

echo "c6 holdout verify: $pass passed, $fail failed"
[ $fail = 0 ]
