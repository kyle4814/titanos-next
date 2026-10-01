#!/usr/bin/env bash
# test_no_orphan_scripts.sh - every scripts/test_* file must be referenced by
# package.json's "test" script, or it is DEFINED but never EXECUTED by `npm
# test` (and therefore never gates anything). Built 2026-10-01 for the
# SELF-RECOVERY CLOSURE / TEST-IN-GATE audit: titanos-next had no structural
# check of this kind, unlike titanos (foundation/sentinel.py
# check_ci_matrix_coverage) and klinge-kernel (bin/test_verify_parallel.sh's
# ORPHAN CHECK). At audit time all five scripts/test_* files were already
# referenced, so this is a regression gate, not a fix for an existing orphan.
#
# Folder containment is not proof of execution: a file can sit in scripts/
# and never be invoked by anything. This check reads package.json's own
# "test" string and asks whether each file's basename literally appears in
# it, the same question `npm test` itself answers when it runs.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
PKG="$ROOT/package.json"

if [ ! -f "$PKG" ]; then
  echo "FAIL no package.json at $PKG"
  exit 1
fi

TEST_SCRIPT=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).scripts.test || '')" "$PKG" 2>/dev/null)
if [ -z "$TEST_SCRIPT" ]; then
  echo "FAIL package.json has no scripts.test"
  exit 1
fi

pass=0
fail=0
orphans=""
for f in "$HERE"/test_*; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"
  case "$TEST_SCRIPT" in
    *"$base"*)
      pass=$((pass + 1))
      echo "PASS $base is referenced by npm test"
      ;;
    *)
      fail=$((fail + 1))
      orphans="$orphans $base"
      echo "FAIL $base is DEFINED (exists in scripts/) but not referenced by npm test -- it is never EXECUTED"
      ;;
  esac
done

if [ "$pass" -eq 0 ] && [ "$fail" -eq 0 ]; then
  echo "FAIL no scripts/test_* files found -- check is not exercising anything"
  exit 1
fi

echo "== test_no_orphan_scripts: $pass referenced, $fail orphaned (${orphans:- none})"
[ "$fail" -eq 0 ]
