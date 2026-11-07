#!/usr/bin/env bash
# Mutant gate: each mutation of the drain files must be caught by test_shop_drain_d1.mjs (own FAIL line named).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
for f in drain.ts drain_d1.ts shelf_generator.ts; do cp "$ROOT/lib/shop/$f" "$BAK/$f"; done
trap 'for f in drain.ts drain_d1.ts shelf_generator.ts; do cp "$BAK/$f" "$ROOT/lib/shop/$f"; rm -f "$BAK/$f"; done; rmdir "$BAK"' EXIT
n=0; caught=0
mut() { # name expected-regex file sed-expr
  n=$((n+1)); local F="$ROOT/lib/shop/$3"; cp "$BAK/$3" "$F"; sed -i "$4" "$F"
  if cmp -s "$F" "$BAK/$3"; then echo "MUTANT NOOP $1"; cp "$BAK/$3" "$F"; return; fi
  out="$(node --experimental-strip-types "$ROOT/scripts/test_shop_drain_d1.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)|Error"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; fi
  cp "$BAK/$3" "$F"
}
mut "UPSERT key dropped (conflict on label)" 'U|D4|D3' drain_d1.ts 's/ON CONFLICT(cluster_id)/ON CONFLICT(label)/'
mut "UPSERT becomes do-nothing (second save lost)" 'U1|D4|D5' drain_d1.ts 's/DO UPDATE SET label = excluded.label, first_seen = excluded.first_seen, status = excluded.status, "/DO NOTHING -- " + "/;s/attempts = excluded.attempts, failed_checks = excluded.failed_checks, last_error = excluded.last_error"/"/'
mut "attempts increment dropped" 'D4|D5' drain.ts 's/const attempts = (e.attempts ?? 0) + 1;/const attempts = (e.attempts ?? 0) + 0;/'
mut "JSON parse dropped on read" 'J1|D6' drain_d1.ts 's/failed_checks: parseChecks(r.failed_checks)/failed_checks: []/'
mut "JSON stringify dropped on write" 'J1|D6' drain_d1.ts 's/JSON.stringify(e.failed_checks ?? \[\])/(e.failed_checks ?? []).join(",")/'
mut "publish on pass (published flag saved)" 'D9' drain.ts 's/failed_checks: failed, last_error: null });/failed_checks: failed, last_error: null, published: pass });/'
mut "cap ignored" 'D2' drain.ts 's/todo.slice(0, limit)/todo/'
mut "wrong sort (newest first)" 'D1|D2' drain.ts 's/cmp(a.first_seen ?? "", b.first_seen ?? "")/cmp(b.first_seen ?? "", a.first_seen ?? "")/'
mut "flush rewrites every row (not just dirty)" 'D3|D6b' drain_d1.ts 's/for (const id of \[...this.dirty\])/for (const id of [...this.rows.keys()])/'
mut "list leaks internal arrays" 'J4' drain_d1.ts 's/return \[...this.rows.values()\].map((e) => ({ ...e, failed_checks: \[...(e.failed_checks ?? \[\])\] }));/return [...this.rows.values()];/'
mut "generator not forced synthetic" 'G4' shelf_generator.ts 's/return { ...shelf, synthetic: true };/return shelf;/;s/shelfFromConfig({ ...cfg, synthetic: true })/shelfFromConfig(cfg)/'
mut "unknown status accepted on load" 'S1' drain_d1.ts 's/if (!STATUSES.has(r.status)) throw/if (false) throw/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
