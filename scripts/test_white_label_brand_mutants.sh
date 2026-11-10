#!/usr/bin/env bash
# Mutation check for lib/white-label-brand.ts: every mutant must make test_white_label_brand.mjs fail.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=lib/white-label-brand.ts
T=$(mktemp -d "${TMPDIR:-/tmp}/wlbm.XXXXXX"); [ -n "$T" ] && [ -d "$T" ] || exit 2
trap 'rm -rf "${T:?}"' EXIT
node scripts/test_white_label_brand.mjs >/dev/null || { echo "baseline RED"; exit 1; }
killed=0; total=0
mut() { # name, python-free sed expression
  total=$((total+1)); cp "$SRC" "$T/m.ts"
  sed -i -E "$2" "$T/m.ts"
  if cmp -s "$SRC" "$T/m.ts"; then echo "MUTANT $1 did not change source"; exit 1; fi
  if WLB_LIB="$T/m.ts" node scripts/test_white_label_brand.mjs >/dev/null 2>&1; then echo "SURVIVED $1"; else killed=$((killed+1)); echo "killed $1"; fi
}
mut aa-threshold-loosened 's/export const AA_NORMAL = 4\.5/export const AA_NORMAL = 4.4/'
mut aa-threshold-tightened 's/export const AA_NORMAL = 4\.5/export const AA_NORMAL = 4.6/'
mut unsafe-default-kept 's/if \(!fallback \|\| contrastRatio\(fallback, background\) < AA_NORMAL\)/if (!fallback)/'
mut contrast-gate-removed 's/if \(ratio >= AA_NORMAL\) accent = want/if (true) accent = want/'
mut https-check-dropped 's/if \(u\.protocol !== "https:"\) return/if (false) return/'
mut allowlist-suffix-loose 's/host\.endsWith\("\." \+ a\)/host.endsWith(a)/'
mut query-allowed 's/if \(u\.search \|\| u\.hash\) return/if (false) return/'
mut credentials-allowed 's/if \(u\.username \|\| u\.password\) return/if (false) return/'
mut tag-strip-removed 's/s = s\.replace\(\/\[<>\]\/g, ""\);/s = s;/'
mut attribution-removed 's/export const ATTRIBUTION = "Prepared with TITANOS"/export const ATTRIBUTION = ""/'
mut escape-amp-removed 's/\.replace\(\/&\/g, "&amp;"\)//'
mut escape-quote-removed 's/\.replace\(\/"\/g, "&quot;"\)//'
mut luminance-weight 's/0\.7152/0.7/'
mut name-cap-removed 's/if \(s\.length > max\) s = s\.slice\(0, max\)\.trim\(\);//'
mut forbidden-script-off 's/\["script", \/<script\/i\]/["script", \/<nevermatch\/i]/'
echo "mutants: $killed/$total killed"
[ "$killed" -eq "$total" ]
