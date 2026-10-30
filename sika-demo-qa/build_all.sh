#!/bin/bash
# Regenerates every derived file of apply/assistant, in the order that matters (sw.js last, it hashes everything before it).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/build_problems.mjs"
node "$here/build_rules.mjs"
node "$here/build_sw.mjs"
