#!/bin/bash
# Runs the actions tests. Node checks first (no browser), then the browser checks through Windows node + Windows Chrome (the only Chrome here).
# usage: bash demo-tests/sika-actions/run_all.sh [--no-browser]
cd "$(dirname "$0")" || exit 2
rc=0
filter='MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings'
for t in t_actions t_flow t_memory t_property t_cart t_cart_regression; do
  echo "=== $t"; node "$t.mjs" 2>&1 | grep -v "$filter" | tail -6; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
done
if [ "$1" != "--no-browser" ]; then
  W="/mnt/c/Program Files/nodejs/node.exe"
  if [ -x "$W" ]; then
    echo "=== e2e_actions (Windows Chrome)"
    p=$(pwd | sed 's#/#\\#g'); out=$(cd /tmp && timeout 600 "$W" "\\\\wsl.localhost\\Ubuntu${p}\\e2e_actions.mjs" 2>&1); echo "$out" | grep -v '^PASS' | tail -12
    echo "$out" | grep -q 'ACTIONS E2E: .* 0 failed' || rc=1
  else echo "=== e2e_actions SKIPPED (no Windows node)"; fi
  if [ -x "$W" ]; then
    echo "=== e2e_cart (Windows Chrome, 1440x900 and 390x844 touch)"
    p=$(pwd | sed 's#/#\\#g'); out=$(cd /tmp && timeout 600 "$W" "\\\\wsl.localhost\\Ubuntu${p}\\e2e_cart.mjs" 2>&1); echo "$out" | grep -v '^PASS' | tail -12
    echo "$out" | grep -q 'CART E2E: .* 0 failed' || rc=1
  fi
fi
# the brain's own gate (node: unit, golden, property) and its browser run with the actions layer off (?actions=off), through a fresh-port server on the WSL disk
echo "=== sika-brain run_all (node)"; bash ../sika-brain/run_all.sh 2>&1 | grep -E "GREEN|FAIL|passed|GOLDEN" | head -8; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
if [ "$1" != "--no-browser" ] && [ -x "/mnt/c/Program Files/nodejs/node.exe" ]; then
  port=$((40000 + RANDOM % 20000)); root=$(cd ../../public/demo/sika-210c0c && pwd)
  node ../sika-brain/serve_wsl.mjs "$root" "$port" >/dev/null 2>&1 & srv=$!
  sleep 2; echo "=== brain_e2e (Windows Chrome, actions off)"
  p2=$(cd ../sika-brain && pwd | sed 's#/#\\#g'); out=$(cd /tmp && BASE="http://127.0.0.1:$port/" WSLENV=BASE timeout 600 "/mnt/c/Program Files/nodejs/node.exe" "\\\\wsl.localhost\\Ubuntu${p2}\\brain_e2e.mjs" x 'C:\Users\Public\brain_out' 2>&1)
  kill "$srv" 2>/dev/null; echo "$out" | grep -E "FAIL|BRAIN E2E"; echo "$out" | grep -q 'BRAIN E2E GREEN' || rc=1
fi
[ $rc -eq 0 ] && echo "ALL GREEN" || echo "FAILURES"
exit $rc
