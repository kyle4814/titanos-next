#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/retraction.ts (or the build wiring in graded_store.ts) must be caught by test_retraction.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
for f in retraction.ts graded_store.ts; do cp "$ROOT/lib/shop/$f" "$BAK/$f"; done
trap 'for f in retraction.ts graded_store.ts; do cp "$BAK/$f" "$ROOT/lib/shop/$f"; rm -f "$BAK/$f"; done; rmdir "$BAK"' EXIT
n=0; caught=0; bad=0
mut() { # name expected-regex file sed-expr
  n=$((n+1)); local F="$ROOT/lib/shop/$3"; cp "$BAK/$3" "$F"; sed -i "$4" "$F"
  if cmp -s "$F" "$BAK/$3"; then echo "MUTANT NOOP $1"; bad=$((bad+1)); cp "$BAK/$3" "$F"; return; fi
  out="$(node --experimental-strip-types "$ROOT/scripts/test_retraction.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)|Error"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; bad=$((bad+1)); fi
  cp "$BAK/$3" "$F"
}
mut "reason cluster removed disabled" 'R5' retraction.ts 's/if (active \&\& !active.has(id)) hit/if (false) hit/'
mut "reason regrade failed disabled" 'R2|R8' retraction.ts 's/else if (run \&\& (run.pass !== true/else if (false \&\& (run.pass !== true/'
mut "reason regrade failed ignores a pass=false flag" 'R8' retraction.ts 's/run.pass !== true || //'
mut "reason live-entry content_hash mismatch disabled" 'R3' retraction.ts 's/} else if (!e.shelf || e.content_hash !== contentHash(e.shelf)) {/} else if (false) {/'
mut "reason stored-shelf content_hash mismatch disabled" 'R3b' retraction.ts 's/} else if (run \&\& run.shelf \&\& run.content_hash !== contentHash(run.shelf)) {/} else if (false) {/'
mut "reason grade too old disabled" 'R4' retraction.ts 's/} else if (run \&\& policy?.maxAgeDays !== undefined) {/} else if (false) {/'
mut "age boundary off by one (>=)" 'R4' retraction.ts 's/age > policy.maxAgeDays/age >= policy.maxAgeDays/'
mut "cap removed" 'R4|R6' retraction.ts 's/if (total > 0 \&\& count \/ total > cap) {/if (false) {/'
mut "cap boundary off by one (>=)" 'R6' retraction.ts 's/count \/ total > cap/count \/ total >= cap/'
mut "default cap raised to 1" 'R6' retraction.ts 's/DEFAULT_MAX_RETRACT_FRACTION = 0.2/DEFAULT_MAX_RETRACT_FRACTION = 1/'
mut "cap ignores policy override" 'R6' retraction.ts 's/policy?.maxRetractFraction ?? DEFAULT_MAX_RETRACT_FRACTION;$/DEFAULT_MAX_RETRACT_FRACTION;/'
mut "retracted ids not removed from the catalogue" 'R2|R3|R5' retraction.ts 's/return { entries: catalogue.entries.filter((e) => !gone.has(e.cluster_id)) };/return catalogue;/'
mut "sidecar skipped (no files)" 'R1|R2' graded_store.ts 's/const files = opts.retract ? renderCatalogueFiles(catalogue, retractions, opts.retract.now, opts.retract) : null;/const files = null as any;/'
mut "sidecar only when something retracted" 'R1' graded_store.ts 's/const files = opts.retract ? render/const files = opts.retract \&\& retractions.length ? render/'
mut "sidecar drops the reason" 'R2' retraction.ts 's/id: r.id, reason: r.reason, detail: r.detail/id: r.id, detail: r.detail/'
mut "sidecar drops the detail" 'R2' retraction.ts 's/id: r.id, reason: r.reason, detail: r.detail/id: r.id, reason: r.reason/'
mut "plan not wired into the build" 'R2|R3|R5' graded_store.ts 's/retractions = planRetractions(stored, opts.retract.now, opts.retract, catalogue);/retractions = [];/'
mut "cap check not wired into the build" 'R4|R6' graded_store.ts 's/^    assertRetractionCap(retractions.length, catalogue.entries.length, opts.retract);/    void 0;/'
mut "retracted entries still listed as published" 'R7b' graded_store.ts 's/const published = res.published.filter(.*$/const published = res.published;/'
mut "invalid now accepted" 'R7' retraction.ts 's/if (!Number.isFinite(nowMs)) throw/if (false) throw/'
mut "plan unsorted and mutating" 'R8' retraction.ts 's/return out.sort(.*$/return out.reverse();/'
echo "mutants caught $caught of $n"
[ "$bad" -eq 0 ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
