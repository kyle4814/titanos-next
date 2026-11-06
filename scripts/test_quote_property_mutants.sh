#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/quote.ts must be caught by test_quote_property.mjs (F87).
# Spec mutants "flip monotonicity", "clamp silently", "drop validity", "skip the cap" have NO code to mutate (quote.ts has no scope,
# min, cap or validity); they are listed in the F87 receipt as NOT APPLICABLE. The mutants below are the ones quote.ts can express.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
Q="$ROOT/lib/shop/quote.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$Q" "$BAK/quote.ts"
trap 'cp "$BAK/quote.ts" "$Q"; rm -f "$BAK/quote.ts"; rmdir "$BAK"' EXIT
n=0; caught=0; bad=0
mut() { # name, sed expression
  n=$((n+1)); cp "$BAK/quote.ts" "$Q"; sed -i "$2" "$Q"
  if cmp -s "$Q" "$BAK/quote.ts"; then echo "MUTANT NOOP $1"; bad=1; return; fi
  if node "$ROOT/scripts/test_quote_property.mjs" >/dev/null 2>&1; then echo "SURVIVED $1"; bad=1; else caught=$((caught+1)); fi
}
mut "ignore ungraded shelves" 's/    if (!s.grade.pass) continue;.*$//'
mut "float cents (price x 1.0001)" 's/priceAud: priced ? best.priceAud : null/priceAud: priced ? best.priceAud * 1.0001 : null/'
mut "invented price (fallback 49)" 's/priceAud: priced ? best.priceAud : null/priceAud: best.priceAud ?? 49/'
mut "label PUBLISHED always" 's/priceLabel: priced ? "PUBLISHED" : "QUOTE"/priceLabel: "PUBLISHED"/'
mut "drop tie-break (order dependent)" 's/(n === bestN \&\& best \&\& s.id < best.id \&\& n > 0)/false/'
mut "nondeterministic stub id" 's/-\${now}`/-${now}${Math.random()}`/'
mut "drop PROPOSED guard (D1 revert)" 's/best.priceLabel === "PUBLISHED" \&\& isValidPrice(best.priceAud) \&\& //'
mut "drop price validity guard (D2 revert)" 's/ \&\& isValidPrice(best.priceAud)//'
mut "unmatched stub invents price 0" 's/priceAud: null, synthetic: false/priceAud: 0, synthetic: false/'
mut "lower match threshold to 0 (junk matches)" 's/const minHits = ask.size <= 1 ? 1 : 2;/const minHits = 0;/'
echo "mutants caught $caught of $n"
[ "$bad" = 0 ] && [ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
