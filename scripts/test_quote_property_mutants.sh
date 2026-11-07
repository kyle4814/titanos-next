#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/quote.ts must be caught by test_quote_property.mjs (F87).
# F207: quote.ts now has quoteScoped, so the scope, minimum, cap, validity and assumptions mutants below are real.
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
mut "flip monotonicity (units lower the price)" 's/(scope.units - 1) \* stepCents/(MAX_UNITS - scope.units) * stepCents/'
mut "extras lower the price" 's/+ scope.extras \* Math.round/- scope.extras * Math.round/'
mut "clamp silently up to the minimum" 's/^  if (raw < Math.round(policy.minAud \* 100)) return refuse.*$/  if (raw < Math.round(policy.minAud * 100)) raw = Math.round(policy.minAud * 100);/'
mut "refuse at minimum too (exclusive min)" 's/raw < Math.round(policy.minAud/raw <= Math.round(policy.minAud/'
mut "skip the cap" '/return refuse("ABOVE_CAP"/d'
mut "clamp silently down to the cap" 's/^  if (raw > Math.round(policy.capAud \* 100)) return refuse.*$/  if (raw > Math.round(policy.capAud * 100)) raw = Math.round(policy.capAud * 100);/'
mut "refuse at cap too (exclusive cap)" 's/raw > Math.round(policy.capAud/raw >= Math.round(policy.capAud/'
mut "drop validity window (empty validUntil)" 's/const validUntil = addDays(now, policy.validDays);/const validUntil = "";/'
mut "validity never ends (year 9999)" 's/const validUntil = addDays(now, policy.validDays);/const validUntil = "9999-12-31";/'
mut "validity window off by one day" 's/addDays(now, policy.validDays)/addDays(now, policy.validDays + 1)/'
mut "expired only after two days" 's/return today > q.validUntil;/return today > addDays(q.validUntil, 1);/'
mut "expires on the last valid day (>=)" 's/return today > q.validUntil;/return today >= q.validUntil;/'
mut "acceptQuote ignores expiry" 's/return isExpired(q, today) ? { ok: false, reason: "EXPIRED" } : { ok: true };/return { ok: true };/'
mut "assumptions not required" 's/assumptions.length === 0 || //'
mut "blank assumptions allowed" 's/ || !assumptions.every((a) => typeof a === "string" \&\& a.trim().length > 0)//'
mut "assumptions not echoed" 's/assumptions: \[...assumptions, ...derived\]/assumptions: [...derived]/'
mut "assumptions echoed out of order" 's/assumptions: \[...assumptions, ...derived\]/assumptions: [...derived, ...assumptions]/'
mut "scope validation dropped" 's/^  if (!scope || !whole.*$//'
mut "scoped price float cents" 's/priceAud: raw \/ 100, scope/priceAud: raw \/ 100 * 1.0001, scope/'
mut "scoped quote labels itself with the wrong date" 's/validFrom: now, validUntil/validFrom: addDays(now, 1), validUntil/'
mut "scoped quote prices unpriced shelf at 0" 's/if (base.priceAud === null) return refuse.*$/if (base.priceAud === null) base.priceAud = 0;/'
mut "date validation dropped" 's/^  if (!validDay(now)) return refuse.*$//'
mut "em dash in refusal text" 's/That ask is not on a shelf yet, so/That ask is not on a shelf yet \xe2\x80\x94 so/'
echo "mutants caught $caught of $n"
[ "$bad" = 0 ] && [ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
