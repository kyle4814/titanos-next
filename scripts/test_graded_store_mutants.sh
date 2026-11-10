#!/usr/bin/env bash
# Mutant gate: each mutation of lib/shop/graded_store.ts (or publish_gate.ts) must be caught by test_graded_store.mjs (a named FAIL line or a thrown Error).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
for f in graded_store.ts publish_gate.ts; do cp "$ROOT/lib/shop/$f" "$BAK/$f"; done
trap 'for f in graded_store.ts publish_gate.ts; do cp "$BAK/$f" "$ROOT/lib/shop/$f"; rm -f "$BAK/$f"; done; rmdir "$BAK"' EXIT
n=0; caught=0
mut() { # name expected-regex file sed-expr
  n=$((n+1)); local F="$ROOT/lib/shop/$3"; cp "$BAK/$3" "$F"; sed -i "$4" "$F"
  if cmp -s "$F" "$BAK/$3"; then echo "MUTANT NOOP $1"; cp "$BAK/$3" "$F"; return; fi
  out="$(node --experimental-strip-types "$ROOT/scripts/test_graded_store.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)|Error"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; fi
  cp "$BAK/$3" "$F"
}
mut "UPSERT key dropped (conflict on label)" 'S1' graded_store.ts 's/ON CONFLICT(cluster_id)/ON CONFLICT(label)/'
mut "UPSERT becomes do-nothing (second save lost)" 'S1' graded_store.ts 's/ON CONFLICT(cluster_id) DO UPDATE SET label = excluded.label, "/ON CONFLICT(cluster_id) DO NOTHING -- "/'
mut "UPSERT always rewrites graded_at" 'S1' graded_store.ts 's/WHEN graded_run.content_hash = excluded.content_hash THEN graded_run.graded_at/WHEN 0 THEN graded_run.graded_at/'
mut "memory store loses idempotent graded_at" 'S1' graded_store.ts 's/if (have \&\& have.content_hash === rec.content_hash) rec.graded_at = have.graded_at;/ /'
mut "JSON parse dropped on read" 'S2|S4' graded_store.ts 's/try { return JSON.parse(raw) as T; }/try { return fallback; }/'
mut "JSON stringify dropped on write (checks)" 'S2|S4' graded_store.ts 's/JSON.stringify(r.checks)/String(r.checks)/'
mut "skip assertCatalogueAllGraded" 'S5' graded_store.ts 's/^  assertCatalogueAllGraded(catalogue);/  void res;/'
mut "publish on fail (pass forced true)" 'S6|S4b' graded_store.ts 's/pass: run.pass, checks: run.checks, shelf: clone(graded)/pass: true, checks: run.checks, shelf: clone(graded)/'
mut "publish on fail (publish_gate failure check dropped)" 'S6|S4b' publish_gate.ts 's/if (bad.length) return "failed checks: " + bad.join(",");/ /'
mut "wrong cluster_id saved" 'S3|S7' graded_store.ts 's/await store.saveGraded(o.cluster_id, g, row.label);/await store.saveGraded(result.processed[0].cluster_id, g, row.label);/'
mut "content_hash dropped" 'S2|S8|S1' graded_store.ts 's/content_hash: run.content_hash, pass: run.pass/content_hash: "", pass: run.pass/'
mut "integrity holds no longer block" 'S5' graded_store.ts 's/if (opts.strict || !FAIL_ONLY.test(h.reason)) bad.push/if (opts.strict) bad.push/'
mut "expected-but-missing cluster ignored" 'S5' graded_store.ts 's/for (const id of opts.expectIds ?? \[\]) if (!have.has(id))/for (const id of []) if (!have.has(id))/'
mut "persist ignores GRADED_FAIL rows" 'S4b|S6' graded_store.ts 's/if (o.status !== "GRADED_PASS" \&\& o.status !== "GRADED_FAIL") continue;/if (o.status !== "GRADED_PASS") continue;/'
echo "mutants caught $caught of $n"
[ "$caught" = "$n" ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
