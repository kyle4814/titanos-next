#!/usr/bin/env bash
# f196: run the D1 contracts against a real local miniflare D1. Skips cleanly (exit 0, says so) when miniflare is absent.
# Not in npm test and not a production dependency. Optional: MINIFLARE_DIR=<dir with node_modules/miniflare>.
set -euo pipefail
cd "$(dirname "$0")/../portal-api"
if ! node --experimental-strip-types -e 'import("./test/miniflare_d1.ts").then(m=>process.exit(m.miniflareAvailable()?0:3))' 2>/dev/null; then
  echo "SKIP miniflare not resolvable (install: cd /tmp/x && npm i miniflare; then MINIFLARE_DIR=/tmp/x)"; exit 0
fi
exec node --test --experimental-strip-types --test-name-pattern='^miniflare:' test/miniflare_contract.test.ts
