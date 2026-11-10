#!/usr/bin/env bash
# f407_c10: planted-bad fixtures MUST fail the rendered keyboard sweep with the right code; the good fixture MUST pass.
# Fixtures are SYNTHETIC (scripts/fixtures/kbfocus). Needs chromium; prints a labelled SKIP (exit 0) when absent, like render_spy.
set -u
cd "$(dirname "$0")/.." || exit 2
FX=scripts/fixtures/kbfocus
S=scripts/obelisk_rendered_keyboard_focus.mjs
fail=0
run() { node "$S" --out "$FX" --pages "/$1.html" --viewports desktop 2>&1; }
o=$(run good); echo "$o" | grep -q "^KBFOC SKIP" && { echo "$o" | head -1; echo "SKIP test_obelisk_rendered_keyboard_focus (no browser)"; exit 0; }
echo "$o" | grep -q "^KBFOC OK" || { echo "FAIL good fixture did not pass"; echo "$o"; fail=1; }
check() { # fixture code
  o=$(run "$1")
  if echo "$o" | grep -q "^KBFOC FAILED" && echo "$o" | grep -q "VIOLATION $2 "; then echo "ok   $1 killed by $2"
  else echo "FAIL $1 survived or wrong code (want $2)"; echo "$o" | head -8; fail=1; fi
}
check bad_outline NO_INDICATOR
check bad_trap TRAP
check bad_reverse REVERSE_MISMATCH
check bad_escape ESCAPE
check bad_skip SKIP_LINK
check bad_unreachable UNREACHABLE
# a requested page that is not exported must fail the run (uncovered page is never silently green)
o=$(node "$S" --out "$FX" --pages /nope.html --viewports desktop 2>&1); echo "$o" | grep -q "^KBFOC FAILED" && echo "ok   missing page fails" || { echo "FAIL missing page passed"; fail=1; }
[ $fail -eq 0 ] && echo "test_obelisk_rendered_keyboard_focus: all green" || { echo "test_obelisk_rendered_keyboard_focus: RED"; exit 1; }
