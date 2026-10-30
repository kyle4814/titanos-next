#!/bin/bash
# Runs every test: QA fixture, rate parser, search. Exits non-zero if any fails.
cd "$(dirname "$0")/.." || exit 2
rc=0
for t in tests/unit_rates.mjs tests/unit_search.mjs tests/run_qa.mjs tests/apply_assistant.mjs; do
  echo "=== $t"
  node "$t" || rc=1
done
[ $rc -eq 0 ] && echo "ALL GREEN" || echo "FAILURES"
exit $rc
