#!/bin/bash
# Wave 2b gate: the data sheet field extractor, numeric ranking, product-less quantities and the recommend -> quantity -> cart chain.
# Needs a built brain (data/brain/num): run demo-tools/sika-210c0c/rebuild.sh first. Exits non-zero on any failure.
cd "$(dirname "$0")" || exit 2
rc=0
filter='MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings'
[ -f ../../public/demo/sika-210c0c/data/brain/num/index.json ] || { echo "run: node scripts/sika-brain/build_brain.mjs (builds data/brain/num)"; exit 2; }
echo "=== gen_wave2b.mjs is current (wave2b.json byte-identical to a fresh generation)"
node gen_wave2b.mjs --check || rc=1
for t in t_extract t_rank t_qty t_bank; do echo "=== $t"; node "$t.mjs" 2>&1 | grep -v "$filter" | tail -8; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
[ $rc -eq 0 ] && echo "BRAIN2B GREEN" || echo "BRAIN2B FAILURES"
exit $rc
