#!/bin/bash
# Lane C suite (wave 2): scripted conversations, names, clarifier and recommend, spelling. Exits non-zero on any failure.
cd "$(dirname "$0")" || exit 2
rc=0
for t in conv.mjs names.mjs clarifier.mjs spelling.mjs; do echo "=== $t"; node "$t" 2>&1 | grep -v -i -E "MODULE_TYPELESS|Reparsing|trace-warnings|eliminate this warning"; [ "${PIPESTATUS[0]}" -eq 0 ] || rc=1; done
[ $rc -eq 0 ] && echo "BRAIN2C GREEN" || echo "BRAIN2C FAILURES"
exit $rc
