#!/usr/bin/env bash
# Proves the leak test bites: a fixture page holding one CORE.md line must FAIL it; a clean page must PASS.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
KERNEL="${KERNEL_DIR:-$HOME/klinge-kernel}"
T="$(mktemp -d)" || exit 97
[ -n "$T" ] && [ -d "$T" ] || exit 97
trap 'rm -rf -- "$T"' EXIT
mkdir -p "$T/clean" "$T/dirty"
echo '<html><body><p>Every symbol on this site means something. We do not explain them.</p></body></html>' > "$T/clean/index.html"
LINE="$(grep -m1 '^GATE9 ' "$KERNEL/CORE.md" | sed 's/^GATE9 //')"
[ -n "$LINE" ] || { echo "FAIL could not pick a CORE line"; exit 1; }
printf '<html><body><div><p>%s</p></div></body></html>\n' "$LINE" > "$T/dirty/index.html"
node "$HERE/test_no_doctrine_leak.mjs" "$T/clean" >/dev/null || { echo "FAIL clean fixture did not pass"; exit 1; }
if node "$HERE/test_no_doctrine_leak.mjs" "$T/dirty" >/dev/null; then echo "FAIL leak test did NOT bite on a CORE line"; exit 1; fi
echo "PASS leak test bites (CORE line fails, clean page passes)"
