#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/publish_gate.ts must be caught by test_publish_gate.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/lib/shop/publish_gate.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$G" "$BAK/publish_gate.ts"
trap 'cp "$BAK/publish_gate.ts" "$G"; rm -f "$BAK/publish_gate.ts"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() {
  n=$((n+1)); cp "$BAK/publish_gate.ts" "$G"; sed -i "$3" "$G"
  if cmp -s "$G" "$BAK/publish_gate.ts"; then echo "MUTANT NOOP $1"; return; fi
  out="$(node --experimental-strip-types "$ROOT/scripts/test_publish_gate.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; fi
}
mut "skip the hash check" 'G3|G12' 's/if (run.content_hash !== hash) return .*/\/\/ hash check skipped/'
mut "publish on partial pass (ignore failed checks)" 'G2|G7|G12' 's/if (bad.length) return .*/\/\/ failures ignored/'
mut "drop the label check" 'G4|G12' 's/if (!nonEmpty(d.label)) {/if (false) {/'
mut "mutate input (write grade into the drained shelf)" 'G9' 's/const run = port.lookup(id) as GradeRun;/const run = port.lookup(id) as GradeRun; (d.shelf as any).grade = run;/'
mut "non-idempotent (republish what is already live)" 'G8' 's/if (have \&\& have.content_hash === hash \&\& have.label === d.label) {/if (false) {/'
mut "assertCatalogueAllGraded swallows" 'G10' 's/  if (bad.length) throw new Error(/  if (bad.length) void (/'
mut "duplicate ids published" 'G6' 's/if ((counts.get(id) ?? 0) > 1) {/if (false) {/'
mut "partial checks accepted" 'G7' 's/if (missing.length) return .*/\/\/ partial ok/'
mut "assert ignores hash mismatch" 'G10' 's/if (e.content_hash !== h) {/if (false) {/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
