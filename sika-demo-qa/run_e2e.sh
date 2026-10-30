#!/bin/bash
# Browser ACCEPT checks for apply/assistant. Serves the portal folder on 127.0.0.1:8741, then drives Windows Chrome with Windows node.
# Needs playwright-core (path in PLAYWRIGHT_CORE, a Windows or UNC path). Env ONLY=T06,T22 limits blocks.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
portal="$here/../public/demo/sika-210c0c"
[ -d "$portal" ] || { echo "no portal folder"; exit 2; }
(cd "$portal" && python3 -m http.server 8741 --bind 127.0.0.1 >/dev/null 2>&1 & echo $! > /tmp/sika_apply_srv.pid)
sleep 1
export PLAYWRIGHT_CORE="${PLAYWRIGHT_CORE:-\\\\wsl.localhost\\Ubuntu\\home\\tech2\\tn-a-site-ship\\node_modules\\playwright-core}"
export WSLENV=PLAYWRIGHT_CORE:ONLY
cd /mnt/c || exit 2
"/mnt/c/Program Files/nodejs/node.exe" "$(wslpath -w "$here/e2e_apply_assistant.mjs")" http://127.0.0.1:8741/ 'C:\Users\Public\apply_assistant_e2e'
rc=$?
kill "$(cat /tmp/sika_apply_srv.pid)" 2>/dev/null
exit $rc
