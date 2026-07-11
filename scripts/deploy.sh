#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# titanos-next → titanos.tech deploy
#
# Codified 2026-06-30 after the "naked-site" GH Pages failure — the
# orphan-branch-inside-repo pattern staged node_modules. This script
# uses an EXISTING worktree at /tmp/titanos-ghpages so the deploying
# tree is always clean.
#
# Usage:  ./scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE="${WORKTREE:-/tmp/titanos-ghpages}"

cd "$REPO_ROOT"

echo "▸ Clean build"
rm -rf .next out node_modules/.cache
if [ ! -d node_modules ]; then
  npm ci
fi
npm run build

echo "▸ Verify out/ artefacts"
for f in out/.nojekyll out/CNAME out/index.html; do
  [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
done
[ -d out/_next ] || { echo "MISSING: out/_next"; exit 1; }
CSS_COUNT=$(find out/_next/static/chunks -maxdepth 1 -name '*.css' 2>/dev/null | wc -l)
if [ "$CSS_COUNT" -lt 1 ]; then
  echo "MISSING: out/_next/static/chunks/*.css"
  exit 1
fi
echo "  ok — index.html + CNAME + .nojekyll + _next present ($CSS_COUNT CSS chunk(s))"

echo "▸ Backup gh-pages"
BACKUP=$(date +%Y%m%d-%H%M)
git fetch origin gh-pages
git branch "gh-pages-backup-$BACKUP" origin/gh-pages 2>/dev/null || true
git push origin "gh-pages-backup-$BACKUP" 2>&1 | tail -3 || true
echo "  backup branch: gh-pages-backup-$BACKUP"

echo "▸ Deploy via worktree at $WORKTREE"
if [ ! -d "$WORKTREE/.git" ] && [ ! -f "$WORKTREE/.git" ]; then
  git worktree add "$WORKTREE" gh-pages
fi
git -C "$WORKTREE" fetch origin gh-pages
git -C "$WORKTREE" reset --hard origin/gh-pages
find "$WORKTREE" -mindepth 1 -not -path '*/.git*' -delete
cp -r out/. "$WORKTREE/"
[ -f "$WORKTREE/.nojekyll" ] || { echo "MISSING in worktree: .nojekyll"; exit 1; }
[ -f "$WORKTREE/CNAME" ]      || { echo "MISSING in worktree: CNAME"; exit 1; }
[ -f "$WORKTREE/index.html" ] || { echo "MISSING in worktree: index.html"; exit 1; }
[ -d "$WORKTREE/_next" ]      || { echo "MISSING in worktree: _next"; exit 1; }

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "  no changes to publish"
  exit 0
fi
git -C "$WORKTREE" commit -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git -C "$WORKTREE" push origin HEAD:gh-pages --force

echo "▸ Verify live (cache-busted, waits for propagation)"
# Bounded retries — the unbounded loop hung three deploys on 2026-07-11
# (push succeeded, but curl inside the script kept missing while
# foreground curls passed). 24 × 5s = 2 min, then warn and exit 0:
# the push already landed, so verification failure is not deploy failure.
CB=$(date +%s%N)
sleep 6
VERIFY_OK=0
for _ in $(seq 1 24); do
  if curl -s --max-time 15 "https://titanos.tech/?cb=$(date +%s%N)" | grep -q "titanos"; then
    VERIFY_OK=1
    break
  fi
  sleep 5
done
if [ "$VERIFY_OK" -ne 1 ]; then
  echo "  WARN: live verification did not confirm within 2 min — check https://titanos.tech manually"
  echo "▸ Done (push succeeded; verification inconclusive). Backup branch: gh-pages-backup-$BACKUP"
  exit 0
fi
CB=$(date +%s%N)
echo -n "  .nojekyll: "; curl -s -o /dev/null -w "%{http_code}\n" "https://titanos.tech/.nojekyll?cb=$CB"
CSS=$(curl -s "https://titanos.tech/?cb=$CB" | grep -oE '/_next/[^"]*\.css' | head -1)
if [ -n "$CSS" ]; then
  echo -n "  CSS ($CSS): "; curl -s -o /dev/null -w "%{http_code}\n" "https://titanos.tech$CSS?cb=$CB"
else
  echo "  WARN: no CSS reference in homepage"
fi

echo "▸ Done. Backup branch: gh-pages-backup-$BACKUP"
echo "  Rollback:  git -C $WORKTREE reset --hard origin/gh-pages-backup-$BACKUP && git -C $WORKTREE push origin HEAD:gh-pages --force"
