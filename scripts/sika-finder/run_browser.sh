#!/bin/bash
# Runs one browser check with Windows node + Windows Chrome against the local server. Usage: run_browser.sh tests/<file>.mjs
here="$(cd "$(dirname "$0")" && pwd)"
f="${here}/$1"
cd /mnt/c || exit 2
"/mnt/c/Program Files/nodejs/node.exe" "\\\\wsl.localhost\\Ubuntu${f//\//\\}" 2>&1 | grep -v -E "^(\(node:|\(Use )"
exit "${PIPESTATUS[0]}"
