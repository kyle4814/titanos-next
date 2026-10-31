#!/bin/bash
# Thumb bar and device voice suite (Windows node + Windows Chrome, like sika-actions). usage: bash demo-tests/sika-thumbvoice/run_all.sh
cd "$(dirname "$0")" || exit 2
W="/mnt/c/Program Files/nodejs/node.exe"
[ -x "$W" ] || { echo "BLOCKED: no Windows node at $W"; exit 2; }
p=$(pwd | sed 's#/#\\#g')
out=$(cd /tmp && timeout 600 "$W" "\\\\wsl.localhost\\Ubuntu${p}\\e2e_thumbvoice.mjs" 2>&1)
echo "$out" | grep -v '^PASS'
echo "$out" | grep -q 'THUMBVOICE E2E: .* 0 failed' && exit 0 || exit 1
