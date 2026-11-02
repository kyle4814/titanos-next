#!/bin/bash
# Brain gate: unit checks, golden questions (>= 95%), property test (zero violations), the quality lane's 80 hand-written questions (report only).
# Browser checks need WINDOWS node (the only Chrome is the Windows one): see the last lines. Exits non-zero on any node failure.
cd "$(dirname "$0")" || exit 2
rc=0
echo "=== build is current (core.json present)"; [ -f ../../public/demo/sika-210c0c/data/brain/core.json ] || { echo "run: node scripts/sika-brain/build_brain.mjs"; exit 2; }
for t in unit_brain.mjs unit_convo.mjs unit_pick.mjs convo_opts.mjs unit_coverage.mjs run_golden.mjs; do echo "=== $t"; node "$t" 2>&1 | grep -v -i -E "MODULE_TYPELESS|Reparsing|trace-warnings|eliminate this warning" || true; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
echo "=== coverage/golden_attr.mjs (every product x every published attribute label, bar 97%)"; BAR=0.97 SHOW=5 node coverage/golden_attr.mjs 2>&1 | grep -E "GOLDEN ATTR|miss" | head -4; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
echo "=== coverage/golden_kb.mjs (every published non-product page asked by its own title, bar 90%)"; BAR=0.9 SHOW=4 node coverage/golden_kb.mjs 2>&1 | grep -E "GOLDEN KB|miss" | head -4; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
echo "=== coverage/wave2c.json (lane C: names, business pages, offices, clarifier, typos; zero WRONG, covered >= 95%)"; W2C=$(BANK=wave2c.json node coverage/run_coverage.mjs 2>&1 | grep -E "^ALL"); echo "$W2C"; echo "$W2C" | awk '{for(i=1;i<=NF;i++){if($i=="WRONG")w=$(i+1)} c=$NF; sub("%","",c); exit !(w==0 && c+0>=95)}' || rc=1
echo "=== coverage/test_measure_tools.mjs (tooling tests: judge system branch, messify, validate_bank, triage, bank shape)"; node coverage/test_measure_tools.mjs 2>&1 | grep -E "test_measure_tools|FAIL"; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
echo "=== measure.mjs --gate (bank 1,000+, blind4 150+, 35%+ messy, every expectation backed by data, every judge WRONG triaged; golden is run above)"; node measure.mjs --gate --no-golden 2>&1 | grep -E "^## (bank|blind4|blind3|blind2|extra|wild|wild2|wave2b|wave2c) |^ANSWERED|MEASURE GATE|validate_bank|^Judge WRONG" | head -45; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
echo "=== sweep_dupes.mjs (no sentence shown twice in an answer, no quoted table row without its headers; golden + every bank question)"; node sweep_dupes.mjs --json 2>&1 | grep -E "^\{"; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
echo "=== convo_score.mjs (conversation bank, 200 single-intent rows + 40 scripts, REPORT ONLY; --gate is run by hand: fails only on a social turn hitting the not-found card)"; node convo_score.mjs 2>&1 | grep -E "^(CONVO SCORE|By class|By category)"; true
echo "=== convo_score.mjs --bank convo_holdout.json (BLIND holdout, 120 single + 30 scripts, REPORT ONLY; do not tune against it: it measures real improvement)"; node convo_score.mjs --bank convo_holdout.json 2>&1 | grep -E "^(CONVO SCORE|By class|By category)"; true
echo "=== fixture80.mjs (report only)"; node fixture80.mjs 2>&1 | grep -v -i -E "MODULE_TYPELESS|Reparsing|trace-warnings|eliminate this warning" | head -12
[ $rc -eq 0 ] && echo "BRAIN NODE GREEN" || echo "BRAIN NODE FAILURES"
echo "browser: node serve_wsl.mjs <portalDir> 8751 &  then  BASE=http://127.0.0.1:8751/ WSLENV=BASE '/mnt/c/Program Files/nodejs/node.exe' '\\\\wsl.localhost\\Ubuntu<path>\\brain_e2e.mjs' x <outDir>"
exit $rc
