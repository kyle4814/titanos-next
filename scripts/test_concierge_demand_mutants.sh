#!/usr/bin/env bash
# Mutant gate: each mutation of lib/concierge/demand.ts must be caught by test_concierge_demand.mjs (the named test is shown).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/lib/concierge/demand.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$G" "$BAK/demand.ts"
trap 'cp "$BAK/demand.ts" "$G"; rm -f "$BAK/demand.ts"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() { # name, expected test id, sed expression
  n=$((n+1)); cp "$BAK/demand.ts" "$G"; sed -i "$3" "$G"
  if cmp -s "$G" "$BAK/demand.ts"; then echo "MUTANT NOOP $1"; return; fi
  out="$(node --experimental-strip-types "$ROOT/scripts/test_concierge_demand.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; fi
}
mut "drop distinct-asker dedupe (count records as askers)" T4 's/const askers = new Set(c.items.map((i) => i.asker));/const askers = new Set(c.items.map((_, k) => String(k)));/'
mut "skip PII strip" T6 's/const clean = stripPii(r.ask);/const clean = String(r.ask);/'
mut "allow ungraded through (stub claims it is graded and carries a pass flag)" T7e 's/status: "UNGRADED_PROPOSAL", first_seen/status: "UNGRADED_PROPOSAL", grade: { pass: true } as any, first_seen/'
mut "unstable sort (input pre-sort and tie-breaks removed, input order leaks)" 'T9|T10' '/^  items.sort(/d; s/stubs.sort((a, b) => b.distinct_askers - a.distinct_askers || b.ask_count - a.ask_count || cmp(a.label, b.label) || cmp(a.cluster_id, b.cluster_id));/stubs.sort((a, b) => b.distinct_askers - a.distinct_askers);/'
mut "off-topic guard disabled" T5 's/if (c.items.some((i) => off(i.toks))) continue;//'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
