#!/bin/bash
# Stock photos suite: node checks always; the browser check when Windows node and Chrome are present.
cd "$(dirname "$0")" || exit 2
rc=0; node stock_check.mjs || rc=1
WN="/mnt/c/Program Files/nodejs/node.exe"
if [ -x "$WN" ] && [ "${1:-}" != "--no-browser" ]; then
  P="$(cd ../../public/demo/sika-210c0c && pwd)"; W='\\wsl.localhost\Ubuntu'$(echo "$P" | sed 's#/#\\#g')
  T='\\wsl.localhost\Ubuntu'$(echo "$PWD" | sed 's#/#\\#g')
  out=$(cd /mnt/c/Users/tech2/AppData/Local/Temp && "$WN" "$T\\stock_browser.mjs" "$W" 'C:\Users\tech2\AppData\Local\Temp\kk_e2e\stock_out' 2>&1); r=$?
  echo "$out" | grep -E 'PASS|FAIL|STOCK'; [ $r -eq 0 ] || rc=1
fi
[ $rc -eq 0 ] && echo "STOCK SUITE GREEN" || echo "STOCK SUITE FAILURES"; exit $rc
