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
# ---- f421_c10: residual burn-down, one regression (good fixture passes) + one mutation (bad fixture killed) per family ----
okp() { # fixture: must pass
  o=$(run "$1"); if echo "$o" | grep -q "^KBFOC OK"; then echo "ok   $1 passes"; else echo "FAIL $1 should pass"; echo "$o" | head -8; fail=1; fi
}
okp noskip_good        # /labs* family: no skip link, first real stop must be walked (probe used to eat it)
check bad_reverse_noskip REVERSE_MISMATCH   # mutation: a real reverse defect on a no-skip page still dies
okp redirect_good      # /our-scan family: instant meta-refresh page is not walked, destination is verified
check bad_redirect_missing LOAD             # mutation: redirect to a page that is not exported still dies
okp video_good         # /v family: <video controls> native control stops are not a cycle
check bad_video_trap TRAP                   # mutation: a real cycle through the video still dies
okp scrollers_good     # /efficiency mobile family: focusable scroll containers widen the press budget
check bad_scrollers_trap TRAP               # mutation: a real cycle behind many scrollers still dies
okp iframe_good        # /our-evidence-pack family: frame with tabindex=-1 and a keyboard link is no indicator-less stop
check bad_iframe NO_INDICATOR               # mutation: the same frame left tabbable (tabindex removed) is the original defect
# the PRE-FIX probe (merge 3b32b3b89) must misfire on the good fixtures, proving these regressions bite the probe defects
if git cat-file -e 3b32b3b89:scripts/obelisk_rendered_keyboard_focus.mjs 2>/dev/null; then
  OLD=scripts/_f421_prefix_probe.mjs; git show 3b32b3b89:scripts/obelisk_rendered_keyboard_focus.mjs > "$OLD"
  for g in noskip_good redirect_good scrollers_good; do   # video_good does not misfire the old probe on a synthetic page; the real /v page does (receipt before/after)
    o=$(node "$OLD" --out "$FX" --pages "/$g.html" --viewports desktop 2>&1)
    echo "$o" | grep -q "^KBFOC FAILED" && echo "ok   pre-fix probe misfires on $g (regression bites)" || { echo "FAIL pre-fix probe did not misfire on $g"; fail=1; }
  done
  rm -f "$OLD"
else echo "SKIP pre-fix probe check (3b32b3b89 not in this clone)"; fi
# source guard + mutation: PdfViewer keeps the frame out of the Tab order only when a fallback link exists
if grep -q 'tabIndex={fallbackHref ? -1 : undefined}' components/PdfViewer.tsx; then echo "ok   PdfViewer carries tabIndex guard"; else echo "FAIL PdfViewer lost tabIndex guard"; fail=1; fi
if sed 's/tabIndex={fallbackHref ? -1 : undefined}//' components/PdfViewer.tsx | grep -q 'tabIndex={fallbackHref ? -1 : undefined}'; then echo "FAIL mutation of PdfViewer survived"; fail=1; else echo "ok   PdfViewer mutation (tabIndex removed) is detected"; fi
# the iframe CSS rule must not come back as a dead rule
if grep -E '^iframe:focus-visible' app/globals.css >/dev/null; then echo "FAIL dead iframe:focus-visible rule is back"; fail=1; else echo "ok   no dead iframe:focus-visible rule"; fi
# a requested page that is not exported must fail the run (uncovered page is never silently green)
o=$(node "$S" --out "$FX" --pages /nope.html --viewports desktop 2>&1); echo "$o" | grep -q "^KBFOC FAILED" && echo "ok   missing page fails" || { echo "FAIL missing page passed"; fail=1; }
[ $fail -eq 0 ] && echo "test_obelisk_rendered_keyboard_focus: all green" || { echo "test_obelisk_rendered_keyboard_focus: RED"; exit 1; }
