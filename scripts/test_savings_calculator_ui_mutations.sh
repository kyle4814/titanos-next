#!/usr/bin/env bash
# Mutants of the f271 UI must each fail test_savings_calculator_ui.mjs: M1 ceiling only, M2 clamp notes dropped,
# M3 method line dropped from the component, M4 error shows a raw code. The unmutated tree must pass.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
VIEW="$ROOT/lib/savings-view.ts"; COMP="$ROOT/components/EnterpriseSavingsCalculator.tsx"
TMP="$(mktemp -d)"; [ -n "$TMP" ] && [ -d "$TMP" ] || { echo "FAIL no tmp dir"; exit 1; }
trap 'rm -r "${TMP:?}"' EXIT
fails=0
# The view imports types from ./savings-calculator, which is erased; copies need no sibling.
node "$HERE/test_savings_calculator_ui.mjs" >/dev/null 2>&1 && echo "PASS baseline passes" || { echo "FAIL baseline fails"; fails=$((fails+1)); }
run() { # name, env assignments...
  local n="$1"; shift
  env "$@" node "$HERE/test_savings_calculator_ui.mjs" >/dev/null 2>&1 && { echo "FAIL $n survived"; fails=$((fails+1)); } || echo "PASS $n killed"
}
sed 's/hoursBand: `${hrs(h.floor)} to ${hrs(h.ceiling)} hours/hoursBand: `${hrs(h.ceiling)} hours/' "$VIEW" > "$TMP/m1.ts"
cmp -s "$VIEW" "$TMP/m1.ts" && { echo "FAIL M1 no change"; fails=$((fails+1)); }; run "M1 (ceiling only)" SAVCALCUI_VIEW="$TMP/m1.ts"
sed 's/notes: r.clamped.map(/notes: [].map(/' "$VIEW" > "$TMP/m2.ts"
cmp -s "$VIEW" "$TMP/m2.ts" && { echo "FAIL M2 no change"; fails=$((fails+1)); }; run "M2 (clamp notes dropped)" SAVCALCUI_VIEW="$TMP/m2.ts"
grep -v 'data-savings-method' "$COMP" > "$TMP/m3.tsx"
cmp -s "$COMP" "$TMP/m3.tsx" && { echo "FAIL M3 no change"; fails=$((fails+1)); }; run "M3 (method line dropped)" SAVCALCUI_COMP="$TMP/m3.tsx"
sed 's/message: where \&\& r.error.code !== "NOT_AN_OBJECT" ? `${where}: ${base}` : base/message: r.error.code/' "$VIEW" > "$TMP/m4.ts"
cmp -s "$VIEW" "$TMP/m4.ts" && { echo "FAIL M4 no change"; fails=$((fails+1)); }; run "M4 (raw error code)" SAVCALCUI_VIEW="$TMP/m4.ts"
[ "$fails" -eq 0 ] && echo "ALL PASS" || { echo "FAILED $fails"; exit 1; }
