#!/usr/bin/env bash
# Mutant gate (f317): each mutation of the build entry point, its CLI, or the error classes must be caught by test_catalogue_build_entry.mjs.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BAK="$(mktemp -d)"; [ -n "$BAK" ] && [ -d "$BAK" ] || { echo "no scratch"; exit 1; }
FILES=("lib/shop/catalogue_build_entry.ts" "scripts/build_shelf_catalogue.mjs" "lib/shop/retraction.ts" "lib/shop/graded_store.ts")
for f in "${FILES[@]}"; do mkdir -p "$BAK/$(dirname "$f")"; cp "$ROOT/$f" "$BAK/$f"; done
restore() { for f in "${FILES[@]}"; do cp "$BAK/$f" "$ROOT/$f"; done; }
trap 'restore; rm -rf "${BAK:?}"' EXIT
n=0; caught=0; bad=0
mut() { # name expected-regex file sed-expr
  n=$((n+1)); restore; local F="$ROOT/$3"; sed -i "$4" "$F"
  if cmp -s "$F" "$BAK/$3"; then echo "MUTANT NOOP $1"; bad=$((bad+1)); return; fi
  out="$(node --experimental-strip-types --no-warnings "$ROOT/scripts/test_catalogue_build_entry.mjs" 2>&1)"
  if echo "$out" | grep -Eq "FAIL ($2)|Error"; then caught=$((caught+1)); else echo "SURVIVED $1 (expected $2 to fail)"; bad=$((bad+1)); fi
}
E=lib/shop/catalogue_build_entry.ts; C=scripts/build_shelf_catalogue.mjs
mut "default age limit disabled (huge)" 'E2' $E 's/DEFAULT_MAX_AGE_DAYS = 90/DEFAULT_MAX_AGE_DAYS = 36500/'
mut "maxAgeDays validation removed" 'E3' $E 's/|| maxAgeDays <= 0) throw/|| false) throw/'
mut "maxAgeDays finite check removed" 'E3' $E 's/!Number.isFinite(maxAgeDays) || //'
mut "now validation removed" 'E3' $E 's/!Number.isFinite(Date.parse(cfg.now))) throw/false) throw/'
mut "retract policy not passed to the build" 'E2|E3' $E 's/retract: { now: cfg.now, maxAgeDays,/retract: undefined, unused: { now: cfg.now, maxAgeDays,/'
mut "explicit maxAgeDays dropped from the policy" 'E2' $E 's/retract: { now: cfg.now, maxAgeDays,/retract: { now: cfg.now,/'
mut "activeClusterIds not passed" 'E2' $E 's/, activeClusterIds: cfg.activeClusterIds }/ }/'
mut "maxRetractFraction not passed" 'E4' $E 's/maxRetractFraction: cfg.maxRetractFraction, //'
mut "empty-shelf guard removed" 'E5' $E 's/if (!cfg.allowEmptyShelf \&\& base.entries.length > 0/if (false \&\& base.entries.length > 0/'
mut "allowEmptyShelf override ignored" 'E5' $E 's/if (!cfg.allowEmptyShelf \&\& /if (/'
mut "empty-shelf ignores the live base" 'E5' $E 's/ \&\& base.entries.length > 0 \&\& / \&\& /'
mut "cap kind exits as blocked" 'E4|E9' $E 's/o.kind === "cap" ? EXIT.cap/o.kind === "cap" ? EXIT.blocked/'
mut "empty-shelf exits as blocked" 'E5|E10' $E 's/o.kind === "empty-shelf" ? EXIT.emptyShelf/o.kind === "empty-shelf" ? EXIT.blocked/'
mut "ok outcome exits non-zero" 'E2' $E 's/if (o.ok) return EXIT.ok;/if (o.ok) return 9;/'
mut "cap error misclassified" 'E4' $E 's/if (e instanceof RetractionCapError) return/if (false) return/'
mut "blocked offenders dropped" 'E6' $E 's/kind: "blocked", offenders: e.offenders,/kind: "blocked", offenders: [],/'
mut "sidecar replaced by empty" 'E2|E7' $E 's/"retractions.json": files\["retractions.json"\]/"retractions.json": "{}"/'
mut "cap error class loses its type" 'E4' lib/shop/retraction.ts 's/throw new RetractionCapError(/throw new Error(/'
mut "blocked error offenders mis-split" 'E6' lib/shop/graded_store.ts 's/cluster_id: b.slice(0, i)/cluster_id: b.slice(0, 0)/'
mut "CLI sidecar not written" 'E7|E8|E10' $C 's/\[\[side, outcome.files\["retractions.json"\]\], /[/'
mut "CLI sidecar written away from the catalogue" 'E7|E10' $C 's/const side = join(dirname(out), "retractions.json");/const side = join(dirname(dirname(out)), "retractions.json");/'
mut "CLI ignores --allow-empty-shelf" 'E10' $C 's/allowEmptyShelf: flag("--allow-empty-shelf")/allowEmptyShelf: false/'
mut "CLI ignores --max-age-days" 'E8' $C 's/now, base, expectIds, maxAgeDays,/now, base, expectIds,/'
mut "CLI ignores --active-clusters" 'E7' $C 's/maxRetractFraction, activeClusterIds,/maxRetractFraction,/'
mut "CLI ignores --max-retract-fraction" 'E9|E10' $C 's/maxAgeDays, maxRetractFraction, activeClusterIds,/maxAgeDays, activeClusterIds,/'
mut "CLI failing build exits 0" 'E9|E10' $C 's/process.exit(exitCodeFor(outcome));/process.exit(0);/'
mut "CLI writes before failing" 'E9' $C 's/^if (!outcome.ok) {$/if (!outcome.ok) { writeFileSync(out, "{}");/'
mut "CLI calls the store builder directly (bypass)" 'E3' $C 's/await runCatalogueBuild(new StaticGradedStore(rows), {/await buildCatalogueFromStore(new StaticGradedStore(rows), {/'
mut "CLI bad number accepted" 'E8' $C 's/if (!Number.isFinite(n)) die/if (false) die/'
mut "CLI ignores existing catalogue" 'E7|E10' $C 's/^if (existsSync(out)) {/if (false) {/'
echo "mutants caught $caught of $n"
[ "$bad" -eq 0 ] && echo "MUTANTS OK" || { echo "MUTANTS FAILED"; exit 1; }
