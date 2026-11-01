#!/bin/bash
# Calculator suite: unit tests per kind with mutations, the store, the bot, before/after measure; browser flow when Windows node and Chrome are present.
# usage: bash demo-tests/sika-calc/run_all.sh [--no-browser]
cd "$(dirname "$0")" || exit 2
rc=0
filter='MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings'
for t in t_calc t_store t_bot; do echo "=== $t"; node "$t.mjs" 2>&1 | grep -v "$filter" | tail -6; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
echo "=== measure (questions the advisor can work out, base against now)"; node measure.mjs 2>&1 | grep -v "$filter" | cut -c1-300; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
WN="/mnt/c/Program Files/nodejs/node.exe"
if [ -x "$WN" ] && [ "${1:-}" != "--no-browser" ]; then
  P="$(cd ../../public/demo/sika-210c0c && pwd)"; W='\\wsl.localhost\Ubuntu'$(echo "$P" | sed 's#/#\\#g')
  T='\\wsl.localhost\Ubuntu'$(echo "$PWD" | sed 's#/#\\#g'); TMPW='C:\Users\tech2\AppData\Local\Temp\kk_e2e'
  echo "=== calc_browser (Windows Chrome, 1366 and 390)"; out=$(cd /mnt/c/Users/tech2/AppData/Local/Temp && timeout 400 "$WN" "$T\\calc_browser.mjs" "$W" "$TMPW\\calc_out" 2>&1); r=$?
  echo "$out" | grep -E 'FAIL|GREEN|failed'; echo "calc_browser: $(echo "$out" | grep -c '^PASS') passed, $(echo "$out" | grep -c '^FAIL') failed"; [ $r -eq 0 ] || rc=1
fi
[ $rc -eq 0 ] && echo "CALC SUITE GREEN" || echo "CALC SUITE FAILURES"; exit $rc
