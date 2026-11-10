#!/usr/bin/env bash
# f334 mutant gate: each mutation of the drain tick Worker host (and the tick core it calls) must make portal-api/test/drain_tick_worker.test.ts fail.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="$ROOT/portal-api/src/shop/drain_tick_worker.ts"; C="$ROOT/lib/shop/drain_grade_tick.ts"; I="$ROOT/portal-api/src/index.ts"; D="$ROOT/lib/shop/graded_store.ts"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$W" "$BAK/w.ts"; cp "$C" "$BAK/c.ts"; cp "$I" "$BAK/i.ts"; cp "$D" "$BAK/d.ts"
trap 'cp "$BAK/w.ts" "$W"; cp "$BAK/c.ts" "$C"; cp "$BAK/i.ts" "$I"; cp "$BAK/d.ts" "$D"; rm -f "$BAK"/*.ts; rmdir "$BAK"' EXIT
n=0; caught=0
mut() { # name file backup sed
  n=$((n+1)); cp "$BAK/w.ts" "$W"; cp "$BAK/c.ts" "$C"; cp "$BAK/i.ts" "$I"; cp "$BAK/d.ts" "$D"; sed -i "$4" "$2"
  if cmp -s "$2" "$3"; then echo "MUTANT NOOP $1"; return; fi
  out="$(cd "$ROOT" && node --experimental-strip-types --no-warnings --test portal-api/test/drain_tick_worker.test.ts 2>&1)"
  if echo "$out" | grep -Eq "^# fail [1-9]"; then caught=$((caught+1)); else echo "SURVIVED $1"; fi
}
mut "drop item cap" "$W" "$BAK/w.ts" 's/maxItems: opts.maxItems ?? DEFAULT_MAX_ITEMS/maxItems: 1000000/'
mut "drop cost budget" "$W" "$BAK/w.ts" 's/budget: opts.budget ?? DEFAULT_BUDGET/budget: 1e9/'
mut "drop wall-clock budget" "$W" "$BAK/w.ts" 's/maxMs: opts.maxMs ?? DEFAULT_MAX_MS/maxMs: 1e12/'
mut "swallow D1 error (report ok)" "$W" "$BAK/w.ts" 's/return { ran: true, ok: false, reason: "D1_ERROR", report, error: msg(e) };/return { ran: true, ok: true, reason: "OK", report };/'
mut "rethrow D1 error (not fail-closed result)" "$W" "$BAK/w.ts" 's/note("d1_error", {/throw e; note("d1_error", {/'
mut "enabled by default" "$W" "$BAK/w.ts" 's/DRAIN_TICK_ENABLED !== "1"/DRAIN_TICK_ENABLED === "0"/'
mut "enabled by truthy string" "$W" "$BAK/w.ts" 's/DRAIN_TICK_ENABLED !== "1"/!(env as { DRAIN_TICK_ENABLED?: string }).DRAIN_TICK_ENABLED/;s/(env as { DRAIN_TICK_ENABLED?: string }).DRAIN_TICK_ENABLED !== "1"/false/'
mut "run without DB" "$W" "$BAK/w.ts" 's/if (!env.DB) {/if (false) {/'
mut "ok ignores per-item errors" "$W" "$BAK/w.ts" 's/ok: report.errors.length === 0/ok: true/'
mut "cron routing drops guard" "$I" "$BAK/i.ts" 's/if (isDrainTick(event))/if (true)/'
mut "monitor cron swallowed" "$I" "$BAK/i.ts" 's/await workerScheduled(event, env);/void 0;/'
mut "tick core: drop item cap" "$C" "$BAK/c.ts" 's/if (i >= maxItems) {/if (false) {/'
mut "tick core: drop budget" "$C" "$BAK/c.ts" 's/if (rep.spent >= budget) {/if (false) {/'
mut "tick core: drop clock" "$C" "$BAK/c.ts" 's/if (now() - t0 >= maxMs) {/if (false) {/'
mut "tick core: queued filter dropped (re-grades done rows)" "$C" "$BAK/c.ts" 's/const isQueued = (e: DrainEntry) => .*/const isQueued = (_e: DrainEntry) => true;/'
mut "tick core: swallow store error" "$C" "$BAK/c.ts" 's/throw abort;/void abort;/'
mut "tick core: queue flushed before store save (crash loses shelf)" "$C" "$BAK/c.ts" 's/if (pass) await store.saveGraded(e.cluster_id, g, e.label); \/\/ the ONLY write to the publish path/queue.save({ ...e, status: "GRADED_PASS", attempts }); if (queue.flush) await queue.flush(); if (pass) await store.saveGraded(e.cluster_id, g, e.label);/'
mut "double grade on retry (upsert rewrites graded_at)" "$D" "$BAK/d.ts" 's/graded_at = CASE WHEN graded_run.content_hash = excluded.content_hash THEN graded_run.graded_at ELSE excluded.graded_at END/graded_at = excluded.graded_at/'
echo "mutants $n caught $caught"
[ "$n" -eq "$caught" ]
