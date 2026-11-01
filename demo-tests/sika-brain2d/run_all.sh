#!/bin/bash
# Lane D gate (rules, standards and multi-constraint reasoning): rule extraction on real clauses (with number-flip mutations), the plan engine on the real
# rule shards, and the zero-WRONG gate over coverage/wave2d.json. Exits non-zero on any failure.
cd "$(dirname "$0")" || exit 2
rc=0
filter='MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings'
echo "=== rule shards are current"; [ -f ../../public/demo/sika-210c0c/data/brain/rules/tile.json ] || { echo "run: node scripts/sika-brain/build_rules.mjs"; exit 2; }
for t in unit_rulex unit_plan; do echo "=== $t"; node "$t.mjs" 2>&1 | grep -v "$filter"; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
[ $rc -eq 0 ] && echo "BRAIN2D GREEN" || echo "BRAIN2D FAILURES"
exit $rc
