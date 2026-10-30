#!/bin/bash
# Brain gate: unit checks, golden questions (>= 95%), property test (zero violations), the quality lane's 80 hand-written questions (report only).
# Browser checks need WINDOWS node (the only Chrome is the Windows one): see the last lines. Exits non-zero on any node failure.
cd "$(dirname "$0")" || exit 2
rc=0
echo "=== build is current (core.json present)"; [ -f ../../public/demo/sika-210c0c/data/brain/core.json ] || { echo "run: node scripts/sika-brain/build_brain.mjs"; exit 2; }
for t in unit_brain.mjs unit_coverage.mjs run_golden.mjs; do echo "=== $t"; node "$t" 2>&1 | grep -v -i -E "MODULE_TYPELESS|Reparsing|trace-warnings|eliminate this warning" || true; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
echo "=== fixture80.mjs (report only)"; node fixture80.mjs 2>&1 | grep -v -i -E "MODULE_TYPELESS|Reparsing|trace-warnings|eliminate this warning" | head -12
[ $rc -eq 0 ] && echo "BRAIN NODE GREEN" || echo "BRAIN NODE FAILURES"
echo "browser: node serve_wsl.mjs <portalDir> 8751 &  then  BASE=http://127.0.0.1:8751/ WSLENV=BASE '/mnt/c/Program Files/nodejs/node.exe' '\\\\wsl.localhost\\Ubuntu<path>\\brain_e2e.mjs' x <outDir>"
exit $rc
