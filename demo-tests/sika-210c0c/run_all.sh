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
if [ -f category_coverage.py ]; then echo "=== category_coverage.py"; python3 -I category_coverage.py --check || rc=1; fi
[ $rc -eq 0 ] && echo "ALL GREEN" || echo "FAILURES"
exit $rc
