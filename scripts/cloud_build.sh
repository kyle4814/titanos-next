#!/usr/bin/env bash
# cloud_build.sh <40-hex SHA>: build AND fully test one exact commit on the cloud test runner, then bring the tested
# out/ and .next/BUILD_ID back, so the bytes deploy.sh publishes are the bytes the tests passed on.
# Why (Kyle 2026-11-10, after the 4th repeat): "Tests should be on cloud runner... Fix it man never let it happen
# again." The laptop deploy of 97a93e827 ran npm test locally and test_tix_e2e timed out at load 44; the laptop now
# runs no suite and no build for a deploy.
# Runner config is the kernel's (klinge-kernel bin/verify_remote.sh): host in ~/.titanos/verify_remote_host, key
# ~/.ssh/titanos_cloud, pinned known_hosts ~/.titanos/cloud_known_hosts (env VERIFY_REMOTE_* override each).
# Fails closed: a missing piece, a red step or output that did not come back exits non-zero, and out/ is removed
# first so a red run can never leave an older build behind for anyone to publish.
# Exit: 0 green + output fetched; 2 bad usage or runner not configured; anything else = not green.
set -euo pipefail
SRC="${1:-}"
[[ "$SRC" =~ ^[0-9a-f]{40}$ ]] || { echo "cloud_build: need a full 40-hex source SHA, got '${SRC}'" >&2; exit 2; }
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$REPO_ROOT"
HOST="${VERIFY_REMOTE_HOST:-$(cat "$HOME/.titanos/verify_remote_host" 2>/dev/null || true)}"
KEY="${VERIFY_REMOTE_KEY:-$HOME/.ssh/titanos_cloud}"
PIN="${VERIFY_REMOTE_KNOWN_HOSTS:-$HOME/.titanos/cloud_known_hosts}"
if [ -z "$HOST" ] || [ ! -r "$KEY" ] || [ ! -s "$PIN" ]; then
  echo "cloud_build: the cloud runner is not configured (host, key or pinned known_hosts missing); not a code failure" >&2
  exit 2
fi
git cat-file -e "$SRC^{commit}" 2>/dev/null || { echo "cloud_build: $SRC is not a commit in this repo" >&2; exit 2; }
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=8 -o ServerAliveInterval=30 -o StrictHostKeyChecking=yes
     -o "UserKnownHostsFile=$PIN" -o GlobalKnownHostsFile=/dev/null)
DIR="gates/deploy-${SRC:0:12}-$(date +%Y%m%d%H%M%S)-$$"   # [a-z0-9/-] only, safe inside the remote quoting
rm -rf -- out .next
echo "  cloud: ~/$DIR on the runner (npm ci, build, full test manifest)"
git archive --format=tar "$SRC" | "${SSH[@]}" "$HOST" "mkdir -p \"\$HOME/$DIR\" && tar -xf - -C \"\$HOME/$DIR\""
"${SSH[@]}" "$HOST" bash -s -- "$DIR" "${CLOUD_BUILD_MAX_S:-2700}" <<'REMOTE'
set -u
DIR="$1"; MAX="$2"
export PATH="$HOME/node22/bin:$PATH" CI=1
cd "$HOME/$DIR" || exit 10
timeout "$MAX" bash -c '
  npm ci --no-audit --no-fund >ci.log 2>&1 || { echo "npm ci FAILED"; tail -40 ci.log; exit 11; }
  npm run build >build.log 2>&1 || { echo "build FAILED"; tail -60 build.log; exit 12; }
  npm test >test.log 2>&1; rc=$?; tail -25 test.log; exit $rc'
REMOTE
FETCH="$(mktemp "${TMPDIR:-/tmp}/cloud_build.XXXXXX")"; trap 'rm -f -- "$FETCH"' EXIT
"${SSH[@]}" "$HOST" "cd \"\$HOME/$DIR\" && tar -cf - out .next/BUILD_ID" > "$FETCH"
[ -s "$FETCH" ] || { echo "cloud_build: the tested output did not come back" >&2; exit 13; }
tar -xf "$FETCH"
[ -s .next/BUILD_ID ] && [ -f out/index.html ] || { echo "cloud_build: the tested output did not come back" >&2; exit 13; }
echo "  cloud: GREEN at ${SRC:0:12}; publishing tested build $(cat .next/BUILD_ID) (runner dir ~/$DIR)"
