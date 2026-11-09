#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/drain_grade_tick.ts must be caught by test_drain_grade_tick.mjs (a FAIL line or a thrown Error).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/lib/shop/drain_grade_tick.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$G" "$BAK/t.ts"
trap 'cp "$BAK/t.ts" "$G"; rm -f "$BAK/t.ts"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() {
  n=$((n+1)); cp "$BAK/t.ts" "$G"; sed -i "$2" "$G"
  if cmp -s "$G" "$BAK/t.ts"; then echo "MUTANT NOOP $1"; cp "$BAK/t.ts" "$G"; return; fi
  out="$(node --experimental-strip-types --no-warnings "$ROOT/scripts/test_drain_grade_tick.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL |Error"; then caught=$((caught+1)); else echo "SURVIVED $1"; fi
  cp "$BAK/t.ts" "$G"
}
mut "save failing shelf" 's/if (pass) await store.saveGraded/if (true) await store.saveGraded/'
mut "pass ignores failed checks" 's/const pass = g.grade.pass === true \&\& failedChecks.length === 0;/const pass = true;/'
mut "ignore maxItems cap" 's/if (i >= maxItems) {/if (false) {/'
mut "ignore budget cap" 's/if (rep.spent >= budget) {/if (false) {/'
mut "ignore wall clock cap" 's/if (now() - t0 >= maxMs) {/if (false) {/'
mut "non-idempotent (queued filter drops status test)" 's/const isQueued = (e: DrainEntry) => .*/const isQueued = (_e: DrainEntry) => true;/'
mut "enabled by default" 's/env?.DRAIN_TICK_ENABLED !== "1"/env?.DRAIN_TICK_ENABLED === "0"/'
mut "enabled by truthy string" 's/env?.DRAIN_TICK_ENABLED !== "1"/!env?.DRAIN_TICK_ENABLED/'
mut "swallow generator error" 's/rep.errors.push({ cluster_id: e.cluster_id, message });\n      continue;/X/;/^      rep.errors.push({ cluster_id: e.cluster_id, message });$/{N;s/.*\n      continue;/      continue;/}'
mut "swallow store error (no abort)" 's/throw abort;/void abort;/'
mut "queue marked before store save (crash loses shelf)" 's/if (pass) await store.saveGraded(e.cluster_id, g, e.label); \/\/ the ONLY write to the publish path/queue.save({ ...e, status: "GRADED_PASS", attempts }); if (pass) await store.saveGraded(e.cluster_id, g, e.label);/'
mut "no flush per item" 's/if (queue.flush) await queue.flush();/ /'
mut "attempts never counted" 's/const attempts = (e.attempts ?? 0) + 1;/const attempts = 0;/'
mut "no duplicate-id dedupe" 's/(seen.has(e.cluster_id) ? false : (seen.add(e.cluster_id), true))/true/'
mut "builds ports when disabled" 's/if (env?.DRAIN_TICK_ENABLED !== "1") return/build(env); if (env?.DRAIN_TICK_ENABLED !== "1") return/'
mut "default cap 20 -> 200" 's/DEFAULT_MAX_ITEMS = 20/DEFAULT_MAX_ITEMS = 200/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
