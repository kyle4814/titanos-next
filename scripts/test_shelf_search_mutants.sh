#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/search.ts must be caught by test_shelf_search.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/lib/shop/search.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$G" "$BAK/search.ts"
trap 'cp "$BAK/search.ts" "$G"; rm -f "$BAK/search.ts"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() { # name, sed expression
  n=$((n+1)); cp "$BAK/search.ts" "$G"; sed -i "$2" "$G"
  if cmp -s "$G" "$BAK/search.ts"; then echo "MUTANT NOOP $1"; return; fi
  if node "$ROOT/scripts/test_shelf_search.mjs" >/dev/null 2>&1; then echo "SURVIVED $1"; else caught=$((caught+1)); fi
}
mut "seat filter off (leak)" 's/if (d.seats.has(seat)) out.push/if (true) out.push/'
mut "unknown seat falls to owner-like access" 's/? (opts.seat as Seat) : "guest"/? (opts.seat as Seat) : "enterprise"/'
mut "index ungraded shelves" 's/if (!raw.grade || raw.grade.pass !== true) {/if (false) {/'
mut "skip the re-grade (forged pass flag)" 's/if (!gradeShelf(shelf).pass) {/if (false) {/'
mut "tie-break dropped (id order lost)" 's/ || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)//'
mut "typo tolerance dropped" 's/if (tok.length >= TYPO_MIN_LEN) for/if (false) for/'
mut "typo on short tokens (min len 5 -> 3)" 's/export const TYPO_MIN_LEN = 5;/export const TYPO_MIN_LEN = 3;/'
mut "query length cap removed" 's/query.slice(0, MAX_QUERY_CHARS)/query/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
