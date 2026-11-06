#!/bin/sh
# Run every x3 probe. From portal-api/: sh acceptance/x3/run.sh   (node 22; no network, no keys, synthetic data only)
cd "$(dirname "$0")/../.." || exit 1
node --test --experimental-strip-types acceptance/x3/*.test.ts 2>&1 | tee /tmp/x3_run.log | grep -E "^(# (tests|pass|fail)|not ok|# X3-)"
