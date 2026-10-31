#!/bin/bash
# One command: golden + every bank set + blind4, per-intent rates, WRONG register, p50/p95, diff against the previous run. Writes MEASURE_<date>.md next to this script.
#   bash demo-tests/sika-brain/measure.sh [--gate] [--save]
cd "$(dirname "$0")" || exit 2
D="$(date +%F)"
node measure.mjs --md "MEASURE_${D}.md" "$@" 2>&1 | grep -v -i -E "MODULE_TYPELESS|Reparsing|trace-warnings|eliminate this warning" | tail -n 5
rc=${PIPESTATUS[0]}
echo "wrote demo-tests/sika-brain/MEASURE_${D}.md (rc ${rc})"
exit $rc
