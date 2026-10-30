#!/bin/bash
# Runs the actions tests. Node checks first (no browser), then the browser checks through Windows node + Windows Chrome (the only Chrome here).
# usage: bash demo-tests/sika-actions/run_all.sh [--no-browser]
cd "$(dirname "$0")" || exit 2
rc=0
filter='MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings'
for t in t_actions t_flow t_memory t_property; do
  echo "=== $t"; node "$t.mjs" 2>&1 | grep -v "$filter" | tail -6; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
done
if [ "$1" != "--no-browser" ]; then
  W="/mnt/c/Program Files/nodejs/node.exe"
  if [ -x "$W" ]; then
    echo "=== e2e_actions (Windows Chrome)"
    p=$(pwd | sed 's#/#\\#g'); out=$(cd /tmp && timeout 600 "$W" "\\\\wsl.localhost\\Ubuntu${p}\\e2e_actions.mjs" 2>&1); echo "$out" | grep -v '^PASS' | tail -12
    echo "$out" | grep -q 'ACTIONS E2E: .* 0 failed' || rc=1
  else echo "=== e2e_actions SKIPPED (no Windows node)"; fi
fi
[ $rc -eq 0 ] && echo "ALL GREEN" || echo "FAILURES"
exit $rc
