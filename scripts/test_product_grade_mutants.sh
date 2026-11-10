#!/usr/bin/env bash
# C5 mutant gate: each mutation of the grader or build must make scripts/test_product_grade.mjs FAIL. A surviving mutant fails this gate.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$(mktemp -d)" || exit 1
case "$BASE" in /tmp/*|"${TMPDIR:-/tmp}"/*) ;; *) echo "bad tmp $BASE"; exit 1;; esac
trap 'rm -rf "${BASE:?}"' EXIT
n=0; survived=0
run_mutant() { # name file sed-expression
  local name="$1" file="$2" expr="$3" d="$BASE/m$n"; n=$((n+1))
  mkdir -p "$d/scripts" && cp -r "$HERE/lib" "$d/lib" && cp "$HERE/scripts/build_shop.mjs" "$HERE/scripts/test_product_grade.mjs" "$d/scripts/"
  ( cd "$d" && sed -i -E "$expr" "$file" )
  if cmp -s "$HERE/$file" "$d/$file"; then echo "MUTANT $name: sed changed nothing (bad mutant)"; survived=$((survived+1)); return; fi
  if ROOT="$d" node "$d/scripts/test_product_grade.mjs" >/dev/null 2>&1; then echo "MUTANT $name: SURVIVED"; survived=$((survived+1)); else echo "MUTANT $name: killed"; fi
}
run_mutant "skip price check"        lib/shop/entry_grade.ts 's/add\("price-table", !!row &&/add("price-table", true ||/'
run_mutant "skip refund line"        lib/shop/entry_grade.ts 's/add\("refund-line", str\(e.refundLine\) &&/add("refund-line", true ||/'
run_mutant "allow live-mode link"    lib/shop/entry_grade.ts 's/const stripeOk = !!s &&/const stripeOk = !!s \&\& s.mode === "live" ||/'
run_mutant "show ungraded entry"     lib/shop/entry_grade.ts 's/e.status === "READY" && verifyReady\(e, ctx\).length === 0 &&/e.status === "READY" \&\&/'
run_mutant "build skips READY check" scripts/build_shop.mjs 's/for \(const prob of verifyReady\(e, REAL_CTX\)\)/for (const prob of [])/'
run_mutant "skip income claim check" lib/shop/entry_grade.ts 's/INCOME_CLAIM.test\(t\) \|\| //'
run_mutant "seal ignores content"    lib/shop/entry_grade.ts 's/else if \(e.seal !== sealOf\(e\)\)/else if (false)/'
[ "$survived" -eq 0 ] && { echo "MUTANTS OK $n killed"; exit 0; } || { echo "MUTANTS FAILED $survived survived"; exit 1; }
