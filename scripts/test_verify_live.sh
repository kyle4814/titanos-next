#!/usr/bin/env bash
# test_verify_live.sh - deploy.sh's live check passes only when the site serves THIS build's BUILD_ID.
# Disposable fixture: a local python http.server on a free port. No outside network.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/vlive.XXXXXX")" || { echo "mktemp failed"; exit 97; }
case "$T" in /tmp/vlive.*|"${TMPDIR:-/tmp}"/vlive.*) ;; *) echo "refusing fixture path $T"; exit 97;; esac
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')
echo '<html><body>titanos {"b":"BUILDnew123"}</body></html>' > "$T/index.html"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$T" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf -- "$T"' EXIT
for _ in $(seq 1 50); do curl -s "http://127.0.0.1:$PORT/" >/dev/null 2>&1 && break; sleep 0.1; done
pass=0; fail=0
ok(){ if [ "$1" -eq 0 ]; then pass=$((pass+1)); echo "PASS $2"; else fail=$((fail+1)); echo "FAIL $2"; fi; }
. "$HERE/lib/verify_live.sh"
set -o pipefail   # deploy.sh runs under pipefail; the 2026-10-01 bug only showed there
verify_live_build "http://127.0.0.1:$PORT/" "BUILDnew123" 2 0; ok $? "the page serves this build: verified"
! verify_live_build "http://127.0.0.1:$PORT/" "BUILDold999" 2 0; ok $? "the page serves an older build: NOT verified (the old 'titanos' check passed this)"
! verify_live_build "http://127.0.0.1:$PORT/" "" 2 0 >/dev/null; ok $? "no BUILD_ID: never verified"
! verify_live_build "http://127.0.0.1:1/" "BUILDnew123" 2 0; ok $? "site down: not verified, no hang"
head -c 2000000 /dev/zero | tr '\0' 'x' > "$T/big.html"; echo 'BUILDbig456' >> "$T/big.html"
verify_live_build "http://127.0.0.1:$PORT/big.html" "BUILDbig456" 2 0; ok $? "a 2 MB page under pipefail still verifies (no curl exit 23)"
echo "== test_verify_live: $pass passed, $fail failed"; [ "$fail" -eq 0 ]
