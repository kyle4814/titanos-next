#!/usr/bin/env bash
# Two mutants of lib/savings-calculator.ts must each make test_savings_calculator.mjs fail:
#   M1 drops the clamp, M2 swaps floor and ceiling. The unmutated module must pass.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
SRC="$ROOT/lib/savings-calculator.ts"
TMP="$(mktemp -d)"
[ -n "$TMP" ] && [ -d "$TMP" ] || { echo "FAIL no tmp dir"; exit 1; }
trap 'rm -r "${TMP:?}"' EXIT
fails=0

node "$HERE/test_savings_calculator.mjs" >/dev/null 2>&1 && echo "PASS baseline module passes" || { echo "FAIL baseline module fails"; fails=$((fails+1)); }

# M1: drop the clamp (c = n).
sed 's/const c = Math.min(max, Math.max(min, n));/const c = n;/' "$SRC" > "$TMP/m1.ts"
cmp -s "$SRC" "$TMP/m1.ts" && { echo "FAIL M1 did not change the source"; fails=$((fails+1)); }
SAVCALC_MODULE="$TMP/m1.ts" node "$HERE/test_savings_calculator.mjs" >/dev/null 2>&1 && { echo "FAIL M1 (no clamp) survived"; fails=$((fails+1)); } || echo "PASS M1 (no clamp) killed"

# M2: swap floor and ceiling in the capture band.
sed 's/export const CAPTURE = { floor: 0.3, ceiling: 0.7 }/export const CAPTURE = { floor: 0.7, ceiling: 0.3 }/' "$SRC" > "$TMP/m2.ts"
cmp -s "$SRC" "$TMP/m2.ts" && { echo "FAIL M2 did not change the source"; fails=$((fails+1)); }
SAVCALC_MODULE="$TMP/m2.ts" node "$HERE/test_savings_calculator.mjs" >/dev/null 2>&1 && { echo "FAIL M2 (swap) survived"; fails=$((fails+1)); } || echo "PASS M2 (swap floor and ceiling) killed"

[ "$fails" -eq 0 ] && echo "ALL PASS" || { echo "FAILED $fails"; exit 1; }
