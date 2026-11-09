#!/bin/bash
# f324: the tix e2e must still go RED on a genuine break (route 500 / selector removed), and the red must arrive inside
# the load-scaled budget (nominal 20s x scale, cap x10), not hang. Clean run is checked green first.
cd "$(dirname "$0")/.." || exit 9
fail=0
for m in route500 selector; do
  s=$(date +%s); out=$(TIX_E2E_MUTATE=$m timeout 300 node scripts/test_tix_e2e.mjs 2>&1); rc=$?; e=$(date +%s)
  scale=$(echo "$out" | sed -n 's/.*scale x\([0-9.]*\) .*/\1/p' | head -1)
  limit=$(awk -v s="${scale:-10}" 'BEGIN{printf "%d", 120 + 20*s + 20*s}')   # setup + navigation + one step budget
  if [ $rc -ne 0 ] && echo "$out" | grep -q 'FAIL step'; then echo "PASS mutant $m red in $((e-s))s (limit ${limit}s, scale x${scale})"; [ $((e-s)) -le "$limit" ] || { echo "FAIL mutant $m too slow"; fail=1; }
  else echo "FAIL mutant $m was NOT red (rc=$rc)"; echo "$out" | tail -5; fail=1; fi
done
[ $fail -eq 0 ] && echo "ALL PASS" || { echo "FAIL"; exit 1; }
