#!/bin/bash
# Finder lane test runner: node checks (pure logic, data, static pages) then browser checks (Windows Chrome via node.exe).
# Usage: scripts/sika-finder/run_all.sh [--no-browser]. Exits non-zero if anything fails.
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here" || exit 2
rc=0
PORT="${PORT:-8765}"
for t in tests/*.mjs; do
  case "$t" in *_browser.mjs|*probe*) continue;; esac
  echo "=== $t"; node "$t" || rc=1
done
if [ "$1" != "--no-browser" ]; then
  if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html"; then node serve.mjs "$PORT" >/dev/null 2>&1 & srv=$!; sleep 1; fi
  for t in tests/*_browser.mjs; do echo "=== $t"; out=$(./run_browser.sh "$t"); r=$?; if [ $r -ne 0 ] && ! echo "$out" | grep -q " failed"; then echo "(browser did not report, retrying once)"; out=$(./run_browser.sh "$t"); r=$?; fi; echo "$out"; [ $r -ne 0 ] && rc=1; done
  [ -n "$srv" ] && kill "$srv" 2>/dev/null
fi
[ $rc -eq 0 ] && echo "ALL GREEN" || echo "FAILURES"
exit $rc
