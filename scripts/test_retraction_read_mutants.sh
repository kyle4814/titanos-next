#!/usr/bin/env bash
# Mutant gate: each mutation of the retraction read side in lib/shop/catalogue_reader.ts must be caught by test_retraction_read.mjs.
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
  out="$(node --experimental-strip-types --no-warnings "$ROOT/scripts/test_retraction_read.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; fi
}
mut "drop the retraction filter" 'X2|X3' 's/\.filter((b) => !b\.key\.some((k) => gone\.has(k)))/.filter(() => true)/'
mut "ignore a malformed sidecar (serve the catalogue anyway)" 'X5' 's/const shelves: GradedShelf\[\] = error ? \[\] :/const shelves: GradedShelf[] = false ? [] :/'
mut "swallow a JSON parse error as absent" 'X5' 's/catch (e) { return bad("is not valid JSON: .*/catch { return { notes: null, error: null }; }/'
mut "swallow a count mismatch" 'X5 count (lower|higher)' 's/if (o\.count !== o\.retractions\.length) return bad(/if (false) return bad(/'
mut "blank sidecar treated as absent" 'X5 blank' 's/if (text === null) return { notes: null, error: null };/if (text === null || text.trim() === "") return { notes: null, error: null };/'
mut "unknown reason accepted" 'X5 unknown reason' 's/!(RETRACT_REASONS as readonly string\[\])\.includes(x\.reason)/false/'
mut "duplicate id accepted" 'X5 duplicate' 's/if (seen\.has(x\.id)) return bad/if (false) return bad/'
mut "policy object not required" 'X5 policy' 's/if (!o\.policy || typeof o\.policy !== "object" || Array\.isArray(o\.policy)) return bad/if (false) return bad/'
mut "stale slug no longer maps to the retracted id" 'X3 getShelf|X4' 's/for (const b of base) { const hit/for (const b of []) { const hit/'
mut "retracted() unsorted/uncopied is not the bug: it returns nothing" 'X2|X3|X4' 's/retracted: () => (error || !notes ? \[\] : notes\.map/retracted: () => (true ? [] : notes!.map/'
mut "getWithdrawn always undefined (404 mystery)" 'X4' 's/getWithdrawn: (key) => { const n = gone\.get(key);/getWithdrawn: (key) => { const n = undefined as RetractionNote | undefined;/'
mut "withdrawn line drops the reason" 'X4 withdrawn line' 's/ has been withdrawn (" + r\.reason + ")/ has been withdrawn (x)/'
mut "closed reader still returns shelves from search" 'X5' 's/if (!shelves\.length) return \[\];/index ??= buildShelfIndex(base.map((b) => b.shelf) as never); if (!shelves.length) return runSearch(index, q, opts).map((h: Hit) => base.map((b) => b.shelf).find((s) => s.id === h.id)).filter((s): s is GradedShelf => !!s);/'
mut "absent sidecar fallback broken: absent now closes" 'X1' 's/if (text === null) return { notes: null, error: null };/if (text === null) return { notes: null, error: "absent" };/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
