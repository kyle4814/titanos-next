#!/usr/bin/env bash
# Mutant gate: each mutation of lib/concierge/genqueue.ts must be caught by test_concierge_genqueue.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/lib/concierge/genqueue.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$G" "$BAK/genqueue.ts"
trap 'cp "$BAK/genqueue.ts" "$G"; rm -f "$BAK/genqueue.ts"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() {
  n=$((n+1)); cp "$BAK/genqueue.ts" "$G"; sed -i "$3" "$G"
  if cmp -s "$G" "$BAK/genqueue.ts"; then echo "MUTANT NOOP $1"; return; fi
  out="$(node --experimental-strip-types "$ROOT/scripts/test_concierge_genqueue.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; fi
}
mut "counts add on re-run instead of snapshot" 'Q4|Q5' 's/ask_count: Math.max(old.ask_count, acc.ask_count)/ask_count: old.ask_count + acc.ask_count/'
mut "always write (no change detection)" Q4 's/if (changed) queue.replaceAll(after);/queue.replaceAll(after);/'
mut "no near-duplicate merge by label" 'Q5|Q6' 's/if (idx < 0) idx = out.findIndex((_, i) => jac(sets\[i\], st) >= jacMin);//'
mut "ranking reversed" Q1 's/b.distinct_askers - a.distinct_askers || b.ask_count - a.ask_count/a.distinct_askers - b.distinct_askers || a.ask_count - b.ask_count/'
mut "last_seen never advances" Q5 's/last_seen: maxS(old.last_seen, acc.last_seen)/last_seen: old.last_seen/'
mut "shorter log shrinks demand" Q7 's/ask_count: Math.max(old.ask_count, acc.ask_count)/ask_count: acc.ask_count/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
