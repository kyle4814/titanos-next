#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/drain.ts must be caught by test_shop_drain.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/lib/shop/drain.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$G" "$BAK/drain.ts"
trap 'cp "$BAK/drain.ts" "$G"; rm -f "$BAK/drain.ts"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() {
  n=$((n+1)); cp "$BAK/drain.ts" "$G"; sed -i "$3" "$G"
  if cmp -s "$G" "$BAK/drain.ts"; then echo "MUTANT NOOP $1"; return; fi
  out="$(node --experimental-strip-types "$ROOT/scripts/test_shop_drain.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; fi
}
mut "newest first" 'D1|D2' 's/cmp(a.first_seen ?? "", b.first_seen ?? "")/cmp(b.first_seen ?? "", a.first_seen ?? "")/'
mut "cap ignored" 'D2' 's/todo.slice(0, limit)/todo/'
mut "terminal rows re-queued (any status processed)" 'D3|D8' 's/const isQueued = (e: DrainEntry) => .*/const isQueued = (e: DrainEntry) => e.status !== "FAILED";/'
mut "throw does not count an attempt" 'D4|D5' 's/const attempts = (e.attempts ?? 0) + 1;/const attempts = (e.attempts ?? 0) + (0 as number);/'
mut "never stops at max attempts" 'D5' 's/attempts >= MAX_ATTEMPTS ? "FAILED"/attempts >= 99 ? "FAILED"/'
mut "failing check names dropped" 'D6' 's/filter((c) => !c.ok).map((c) => c.id)/filter((c) => !c.ok).map(() => "x")/'
mut "grader fail marked pass" 'D6' 's/g.grade.pass === true \&\& failed.length === 0/true/'
mut "first throw goes straight to FAILED" 'D4|D5' 's/attempts >= MAX_ATTEMPTS ? "FAILED" : e.status/"FAILED"/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
