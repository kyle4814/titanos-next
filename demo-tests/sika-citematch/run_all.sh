#!/bin/bash
# Citematch suite: the shared matcher (unit, 68 query set, mutation, structure), the brain golden floor, the citation data checks, and the browser checks
# (search box, finder, "Show the source" at 1366 and 390 wide) when Windows node and Chrome are present. Exits non-zero on any failure.
cd "$(dirname "$0")" || exit 2
rc=0; flt() { grep -v -E "MODULE_TYPELESS|Reparsing|trace-warnings|eliminate this warning"; }
for t in match_unit.mjs structure.mjs budget.mjs brain_golden.mjs cite_unit.mjs; do echo "=== $t"; node "$t" 2>&1 | flt | grep -E "FAIL|INFO|GREEN|RED"; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
echo "=== measure.mjs (the numbers the receipt quotes)"; node measure.mjs 2>&1 | flt | head -7
WN="/mnt/c/Program Files/nodejs/node.exe"
if [ -x "$WN" ] && [ "${1:-}" != "--no-browser" ]; then
  P="$(cd ../../public/demo/sika-210c0c && pwd)"; W='\\wsl.localhost\Ubuntu'$(echo "$P" | sed 's#/#\\#g'); T='\\wsl.localhost\Ubuntu'$(echo "$PWD" | sed 's#/#\\#g')
  echo "=== citematch_browser.mjs"
  out=$(cd /mnt/c/Users/tech2/AppData/Local/Temp && "$WN" "$T\\citematch_browser.mjs" "$W" 'C:\Users\tech2\AppData\Local\Temp\kk_e2e\citematch_out' 2>&1); r=$?
  echo "$out" | grep -E "FAIL|CITEMATCH BROWSER"; [ $r -eq 0 ] || rc=1
fi
[ $rc -eq 0 ] && echo "CITEMATCH SUITE GREEN" || echo "CITEMATCH SUITE FAILURES"; exit $rc
