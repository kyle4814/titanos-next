#!/bin/bash
# Wave 2 site suite: QR on every sheet (node), data quality gift pack (node, PDF), install + outdoor mode (node), then the browser checks (Windows node and Chrome).
# usage: run_all.sh [--no-browser]     The print check (363 sheets, Chrome printToPDF) is separate: PV=<portal> PRINT_PORT=<free port> python3 print_check.py
cd "$(dirname "$0")" || exit 2
rc=0
for t in qr_check gift_check pwa_check; do node $t.mjs 2>&1 | grep -E 'FAIL|GREEN|failed' ; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
WN="/mnt/c/Program Files/nodejs/node.exe"
if [ -x "$WN" ] && [ "${1:-}" != "--no-browser" ]; then
  P="$(cd ../../public/demo/sika-210c0c && pwd)"; W='\\wsl.localhost\Ubuntu'$(echo "$P" | sed 's#/#\\#g')
  T='\\wsl.localhost\Ubuntu'$(echo "$PWD" | sed 's#/#\\#g')
  out=$(cd /mnt/c/Users/tech2/AppData/Local/Temp && "$WN" "$T\\w2_browser.mjs" "$W" 'C:\Users\tech2\AppData\Local\Temp\kk_e2e\w2_out' 2>&1); r=$?
  echo "$out" | grep -E 'FAIL|W2 BROWSER'; echo "browser checks: $(echo "$out" | grep -c '^PASS') passed, $(echo "$out" | grep -c '^FAIL') failed"; [ $r -eq 0 ] || rc=1
fi
[ $rc -eq 0 ] && echo "W2 SITE SUITE GREEN" || echo "W2 SITE SUITE FAILURES"; exit $rc
