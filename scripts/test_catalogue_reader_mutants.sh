#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/catalogue_reader.ts must be caught by test_catalogue_reader.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/lib/shop/catalogue_reader.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$G" "$BAK/catalogue_reader.ts"
trap 'cp "$BAK/catalogue_reader.ts" "$G"; rm -f "$BAK/catalogue_reader.ts"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() {
  n=$((n+1)); cp "$BAK/catalogue_reader.ts" "$G"; sed -i "$3" "$G"
  if cmp -s "$G" "$BAK/catalogue_reader.ts"; then echo "MUTANT NOOP $1"; return; fi
  out="$(node --experimental-strip-types --no-warnings "$ROOT/scripts/test_catalogue_reader.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; fi
}
mut "skip the graded check" 'R3|R3b|R3c|R3d' 's/^  assertCatalogueAllGraded(cat);.*/  void cat;/'
mut "swallow the parse error (treat as absent)" 'R4' 's/catch (e) { throw new Error("shelf_catalogue.json is not valid JSON: .*/catch { return null; }/'
mut "ignore the fallback" 'R2' 's/const shelves: GradedShelf\[\] = fromCat ?? fallback;/const shelves: GradedShelf[] = fromCat ?? [];/'
mut "unsorted output" 'R1|R6' 's/const sorted = \[\.\.\.cat\.entries\]\.sort(byClusterId);/const sorted = [...cat.entries];/'
mut "return ungraded entries (drop the shape+graded gate on entries)" 'R3|R3b|R3c|R3d' 's/^  assertCatalogueAllGraded(cat);.*/  \/\/ gate removed/'
mut "empty entries throw instead of fallback" 'R2' 's/if (entries.length === 0) return null;/if (entries.length === 0) throw new Error("empty");/'
mut "unknown slug returns first shelf" 'R5' 's/getShelf: (slug) => bySlug.get(slug),/getShelf: (slug) => bySlug.get(slug) ?? shelves[0],/'
mut "duplicate slug allowed" 'R4d' 's/if (dup.length) throw/if (false) throw/'
mut "from flag always catalogue" 'R2' 's/from: fromCat ? "catalogue" : "fallback",/from: "catalogue",/'
mut "search ignores the shelves" 'R7' 's/index ??= buildShelfIndex(shelves as never);/index ??= buildShelfIndex([]);/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
