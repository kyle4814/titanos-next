#!/bin/bash
# Job builder + compare mode gate. Node checks first (parser, job, compare with its mutation, golden jobs), then the browser check through Windows node + Windows Chrome
# (the only Chrome here), desktop 1366x768 and phone 390x844 touch.
# usage: bash demo-tests/sika-jobcompare/run_all.sh [--no-browser]
cd "$(dirname "$0")" || exit 2
rc=0
filter='MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings'
for t in t_parser t_job t_compare t_golden_job; do
  echo "=== $t"; node "$t.mjs" 2>&1 | grep -v "$filter" | tail -8; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
done
W="/mnt/c/Program Files/nodejs/node.exe"
if [ "$1" != "--no-browser" ]; then
  if [ -x "$W" ]; then
    echo "=== e2e_jobcompare (Windows Chrome, 1366x768 and 390x844 touch)"
    p=$(pwd | sed 's#/#\\#g'); out=$(cd /tmp && timeout 600 "$W" "\\\\wsl.localhost\\Ubuntu${p}\\e2e_jobcompare.mjs" 2>&1); echo "$out" | grep -v '^PASS' | tail -12
    echo "$out" | grep -q 'JOBCOMPARE E2E: .* 0 failed' || rc=1
  else echo "=== e2e_jobcompare SKIPPED (no Windows node)"; fi
fi
[ $rc -eq 0 ] && echo "ALL GREEN" || echo "FAILURES"
exit $rc
