#!/usr/bin/env bash
# Mutant gate: each mutation of the grader's type checks must be caught by test_shelf_types.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/lib/shop/grader.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$G" "$BAK/grader.ts"
trap 'cp "$BAK/grader.ts" "$G"; rm -f "$BAK/grader.ts"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() { # name, sed expression
  n=$((n+1)); cp "$BAK/grader.ts" "$G"; sed -i "$2" "$G"
  if cmp -s "$G" "$BAK/grader.ts"; then echo "MUTANT NOOP $1"; return; fi
  if node "$ROOT/scripts/test_shelf_types.mjs" >/dev/null 2>&1; then echo "SURVIVED $1"; else caught=$((caught+1)); fi
}
# isFinite, typeof and the cents checks overlap on purpose (defence in depth), so a single removal is an equivalent mutant.
# The real regression is removing the overlapping guards together; each such pair must be caught.
mut "drop isFinite + safe-cents (Infinity must still be caught by nothing: caught by test)" 's/Number.isFinite(v) && //; s/ && Number.isSafeInteger(Math.round(v \* 100))//; s/ && Math.abs(v \* 100 - Math.round(v \* 100)) < 1e-6//'
mut "drop isFinite + typeof (string 49 must be caught)" 's/typeof v === "number" && Number.isFinite(v) && //'
mut "drop >= 0" 's/ && v >= 0//'
mut "drop safe-integer cents" 's/ && Number.isSafeInteger(Math.round(v \* 100))//'
mut "drop whole-cent" 's/ && Math.abs(v \* 100 - Math.round(v \* 100)) < 1e-6//'
mut "drop unknown-key check" 's/Object.keys(o).filter((k) => !ALLOWED_KEYS.has(k))/[]/'
mut "drop tags array check" 's/strArr(o.tags) && //'
mut "drop title string check" 's/isStr(o.name) && //'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
