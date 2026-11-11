#!/usr/bin/env bash
# f406 mutation test: the probe must PASS the good fixture and FAIL the planted-bad fixture for every
# defect class (print chrome, print clip, slow motion, autoplay video). Synthetic fixtures only, localhost.
set -u
cd "$(dirname "$0")/.." || exit 2
P=scripts/obelisk_rendered_print_motion.mjs
F=scripts/fixtures/rendpm
fail=0
ok() { echo "ok   $1"; }
no() { echo "FAIL $1"; fail=1; }

out=$(node "$P" --out "$F/good" --pages / 2>&1); rc=$?
[ "$rc" = 0 ] && ok "good fixture passes" || { no "good fixture should pass (rc=$rc)"; echo "$out"; }

out=$(node "$P" --out "$F/bad" --pages / 2>&1); rc=$?
[ "$rc" = 1 ] && ok "bad fixture exits 1" || no "bad fixture must exit 1 (rc=$rc)"
for cls in PRINT-CHROME PRINT-CLIP MOTION VIDEO; do
  echo "$out" | grep -q "$cls" && ok "bad fixture flags $cls" || no "bad fixture missed $cls"
done

node "$P" --out "$F/nonexistent" >/dev/null 2>&1; rc=$?
[ "$rc" = 2 ] && ok "missing out dir is harness error (2)" || no "missing dir should exit 2 (rc=$rc)"

node "$P" --out "$F/good" --pages /nope >/dev/null 2>&1; rc=$?
[ "$rc" = 1 ] && ok "404 page fails (1)" || no "404 page should fail (rc=$rc)"

[ "$fail" = 0 ] && echo "test_obelisk_rendered_print_motion: PASS" || echo "test_obelisk_rendered_print_motion: FAILED"
exit $fail
