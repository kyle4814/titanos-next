#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/build_catalogue.ts or scripts/build_shelf_catalogue.mjs must be caught by test_build_shelf_catalogue.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/lib/shop/build_catalogue.ts"; CLI="$ROOT/scripts/build_shelf_catalogue.mjs"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$LIB" "$BAK/lib.ts"; cp "$CLI" "$BAK/cli.mjs"
trap 'cp "$BAK/lib.ts" "$LIB"; cp "$BAK/cli.mjs" "$CLI"; rm -f "$BAK/lib.ts" "$BAK/cli.mjs"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() { # name, which (lib|cli), expected-FAIL-regex, sed expr
  n=$((n+1)); cp "$BAK/lib.ts" "$LIB"; cp "$BAK/cli.mjs" "$CLI"
  local f="$LIB" b="$BAK/lib.ts"; [ "$2" = cli ] && { f="$CLI"; b="$BAK/cli.mjs"; }
  sed -i "$4" "$f"
  if cmp -s "$f" "$b"; then echo "MUTANT NOOP $1"; return; fi
  out="$(node --experimental-strip-types --no-warnings "$ROOT/scripts/test_build_shelf_catalogue.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($3)"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $3 to fail)"; fi
}
mut "skip assertCatalogueAllGraded" lib 'L2' 's/try { assertCatalogueAllGraded(r.catalogue); }/try { void 0; }/'
mut "ignore exit code (failure exits 0)" cli 'B2|B3|B4|B6' 's/process.exit(exitCodeFor(outcome));/process.exit(0);/'
mut "write catalogue before the gate" cli 'B2' 's/^if (!outcome.ok) {$/if (!outcome.ok) { writeFileSync(out, "{\\"entries\\":[]}");/'
mut "drop id listing" lib 'L1' 's/`OFFENDER ${o.cluster_id}: ${o.reason}`/`OFFENDER: ${o.reason}`/'
mut "non-deterministic order (no entry sort)" lib 'B8|S3|S1c' 's/const entries = \[...c.entries\].sort(.*);/const entries = [...c.entries];/'
mut "non-deterministic keys (no key sort)" lib 'B8' 's/\.sort()\.map((k) => \[k, stable/.map((k) => [k, stable/'
mut "ignore held shelves" lib 'B2|B3|B4|B5|S2' 's/const offenders: Offender\[\] = r.held.map(.*);/const offenders: Offender[] = [];/'
mut "ignore existing catalogue on disk" cli 'B6' 's/^if (existsSync(out)) {/if (false) {/'
mut "D1 store drops the stored run" lib 'D3|D5|D7' 's/if (run) runs\[r.cluster_id\] = run;/if (false) runs[r.cluster_id] = run;/'
mut "D1 UPSERT loses its conflict key" lib 'D4b' 's/ON CONFLICT(cluster_id) DO UPDATE SET label = excluded.label, shelf_json = excluded.shelf_json, run_json = excluded.run_json/ON CONFLICT(cluster_id) DO NOTHING/'
mut "assert error swallowed into success" lib 'L2' 's/if (offenders.length || assertError) return/if (offenders.length) return/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
