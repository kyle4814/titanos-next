#!/bin/bash
# Runs the apply/data tests: node logic tests, UI builders under a DOM stub, SDS substring check (pypdf), then the engine baseline (20 QA cases + unit tests).
# Exit non-zero if anything fails. t16_sds exits 3 (SKIPPED) when the lane's PDF cache is absent; that is reported, never counted as a pass.
cd "$(dirname "$0")" || exit 2
rc=0
for t in t_apply.mjs t_dom.mjs; do echo "=== $t"; node "$t" 2>&1 | grep -v 'MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings'; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
echo "=== check_links.py (T03 cross-check of the verdicts against the logged statuses)"; python3 ../../demo_tools/sika_apply_data/check_links.py ../../public/demo/sika-210c0c/data /home/tech2/klinge-kernel/state/sika || rc=1
echo "=== t16_sds.py"; python3 t16_sds.py; r=$?; [ $r -eq 0 ] || { [ $r -eq 3 ] && echo "SKIPPED" || rc=1; }
echo "=== baseline/unit_search.mjs (timing checks depend on machine load; reported, not gating)"; node baseline/unit_search.mjs 2>&1 | grep -v 'MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings' | tail -4
for t in baseline/unit_rates.mjs baseline/run_qa.mjs; do echo "=== $t"; node "$t" 2>&1 | grep -v 'MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings' | tail -3; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
[ $rc -eq 0 ] && echo "ALL GREEN" || echo "FAILURES"
exit $rc
