#!/bin/bash
# Sales engine suite: node unit and flow tests first (no browser), then the browser flow at 1366 and 390 wide (Windows node + Windows Chrome), then the
# one-page proof (real Chrome PDFs, page counts read with PyMuPDF). usage: bash demo-tests/sika-sales/run_all.sh [--no-browser]
cd "$(dirname "$0")" || exit 2
rc=0
filter='MODULE_TYPELESS\|Reparsing\|eliminate\|trace-warnings'
for t in t_intake t_quote t_mutation; do echo "=== $t"; node "$t.mjs" 2>&1 | grep -v "$filter" | tail -6; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
echo "=== shard rebuild is a no-op (the contacts shard equals what the crawl produces)"
cp ../../public/demo/sika-210c0c/data/sales/contacts.json /tmp/_contacts_before.json 2>/dev/null && node make_shard.mjs >/dev/null 2>&1 && cmp -s /tmp/_contacts_before.json ../../public/demo/sika-210c0c/data/sales/contacts.json && echo "same" || { echo "DIFFERENT"; rc=1; }
if [ "$1" != "--no-browser" ]; then
  W="/mnt/c/Program Files/nodejs/node.exe"
  if [ -x "$W" ]; then
    T='\\wsl.localhost\Ubuntu'$(pwd | sed 's#/#\\#g'); P='\\wsl.localhost\Ubuntu'$(cd ../../public/demo/sika-210c0c && pwd | sed 's#/#\\#g')
    PDF='C:\Users\tech2\AppData\Local\Temp\kk_sales_pdf'; rm -f /mnt/c/Users/tech2/AppData/Local/Temp/kk_sales_pdf/*.pdf 2>/dev/null
    echo "=== e2e_sales (Windows Chrome, 1366x768 and 390x844 touch)"
    out=$(cd /tmp && timeout 900 "$W" "$T\\e2e_sales.mjs" "$P" "$PDF" 2>&1); echo "$out" | grep -E '^FAIL|SALES E2E' | tail -12
    echo "$out" | grep -q 'SALES E2E: .* 0 failed' || rc=1
    echo "=== one-page proof (Chrome PDFs)"; python3 print_pages.py | grep -E 'ONE PAGE'; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1
  else echo "=== e2e_sales SKIPPED (no Windows node)"; fi
fi
[ $rc -eq 0 ] && echo "SALES ALL GREEN" || echo "SALES FAILURES"
exit $rc
