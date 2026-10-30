#!/bin/bash
# Quality gate for the Sika demo portal (blocks T05, T18, T08, T12, T01, T02). Node tests only; browser checks are run separately
# (walkthrough.mjs, a11y.mjs, weight.mjs need a base URL). Exits non-zero if any step fails.
cd "$(dirname "$0")" || exit 2
rc=0
for t in hygiene.mjs golden_qa.mjs props.mjs props_mutation.mjs coverage.mjs contrast.mjs coverage_panel_test.mjs; do
  [ -f "$t" ] || continue
  echo "=== $t"
  node "$t" || rc=1
done
# v2 advisor suites live in the repo next to the portal: demo-tests/sika-brain (unit, 4,659 golden questions, property test) and demo-tests/sika-actions (actions, flow, memory, property); node parts only here, the browser parts run in final/battery.sh
W="$(dirname "$(readlink -f ../../public)")"
for d in sika-brain sika-actions; do
  if [ -f "$W/demo-tests/$d/run_all.sh" ]; then echo "=== $d (node)"; if [ "$d" = sika-actions ]; then bash "$W/demo-tests/$d/run_all.sh" --no-browser > /tmp/$d.out 2>&1; else bash "$W/demo-tests/$d/run_all.sh" > /tmp/$d.out 2>&1; fi; r=$?; tail -3 /tmp/$d.out; [ $r -eq 0 ] || rc=1; fi
done
# apply/speed: the byte budgets only apply to a tree that has the speed build (assets/dist/main.js)
if [ -f ../../public/demo/sika-210c0c/assets/dist/main.js ] && [ -f speed_budget.mjs ]; then echo "=== speed_budget.mjs"; node speed_budget.mjs > /tmp/speed_budget.out 2>&1; r=$?; tail -4 /tmp/speed_budget.out; [ $r -eq 0 ] || rc=1; fi
if [ -f category_coverage.py ]; then echo "=== category_coverage.py"; python3 -I category_coverage.py --check || rc=1; fi
[ $rc -eq 0 ] && echo "ALL GREEN" || echo "FAILURES"
exit $rc
