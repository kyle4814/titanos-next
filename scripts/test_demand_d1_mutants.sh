#!/usr/bin/env bash
# Mutant gate (f301): each mutation of portal-api/src/d1_demand.ts or the 0017 migration must be caught by portal-api/test/demand_d1.test.ts.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/portal-api/src/d1_demand.ts"; M="$ROOT/portal-api/migrations/0017_unmatched_demand.sql"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
cp "$A" "$BAK/a.ts"; cp "$M" "$BAK/m.sql"
trap 'cp "$BAK/a.ts" "$A"; cp "$BAK/m.sql" "$M"; rm -f "$BAK/a.ts" "$BAK/m.sql"; rmdir "$BAK"' EXIT
n=0; caught=0
mut() {   # name file sed-expr
  n=$((n+1)); cp "$BAK/a.ts" "$A"; cp "$BAK/m.sql" "$M"; sed -i "$3" "$2"
  if cmp -s "$2" "$BAK/a.ts" || cmp -s "$2" "$BAK/m.sql"; then echo "MUTANT NOOP $1"; return; fi
  if (cd "$ROOT/portal-api" && node --test --experimental-strip-types test/demand_d1.test.ts >/dev/null 2>&1); then echo "SURVIVED $1"; else caught=$((caught+1)); fi
}
mut "askerId never bound (all anon)" "$A" 's/s.askerId ? String(s.askerId) : ANON/ANON/'
mut "first_seen_at overwritten by every repeat" "$A" 's/first_seen_at = " + earlier("first_seen_at")/first_seen_at = excluded.first_seen_at/'
mut "last_seen_at never moves" "$A" 's/last_seen_at = " + later("last_seen_at")/last_seen_at = unmatched_log.last_seen_at/'
mut "repeat does not bump seen_count" "$A" 's/seen_count = unmatched_log.seen_count + 1/seen_count = unmatched_log.seen_count/'
mut "primary key drops asker_id (one row per ask)" "$M" 's/PRIMARY KEY (normalised, asker_id)/PRIMARY KEY (normalised)/'
mut "anon read back as the string anon" "$A" 's/String(r.asker_id) === ANON ? null : String(r.asker_id)/String(r.asker_id)/'
mut "queue replace without delete" "$A" 's/"DELETE FROM generator_queue"/"SELECT 1"/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
