#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# titanos-next → titanos.tech deploy
#
# Codified 2026-06-30 after the "naked-site" GH Pages failure — the
# orphan-branch-inside-repo pattern staged node_modules. This script
# uses an EXISTING worktree at /tmp/titanos-ghpages so the deploying
# tree is always clean.
#
# Usage:  DEPLOY_APPROVAL_REF=<ref> ./scripts/deploy.sh   (a card Kyle APPROVED; publish_due.py runs it this way)
#         DEPLOY_INTERACTIVE=1 ./scripts/deploy.sh        (Kyle at a terminal; he types the short SHA to confirm)
#
# PUBLISH GATE (2026-10-01, CS-2 S1; TITANOS_CRITICAL_FUNCTION_SWITCH_GATE: publication sits behind code, checked
# at two points). This script force-pushes the PUBLIC site and nothing inside it used to ask, so the unattended
# runner could deploy by running it. Before it builds anything it now refuses unless:
#   1. DEPLOY_APPROVAL_REF is set and `approval.py check <ref>` exits 0 (APPROVED by kyle), or DEPLOY_INTERACTIVE=1
#      with a real terminal and the typed short SHA;
#   2. the branch is main, the tree is clean (untracked files count), and HEAD == origin/main after a fetch, so what
#      ships is exactly what the public source shows.
# The gh-pages commit carries the source SHA and the approval ref. APPROVAL_CHECK_CMD swaps approval.py for a test
# stub and is refused unless origin is a local path, so a stub can never ship the real site.
# Exit: 0 deployed and verified (or nothing to publish); 1 refused or failed before the push; 3 pushed, NOT verified.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE="${WORKTREE:-/tmp/titanos-ghpages}"

cd "$REPO_ROOT"

refuse() { echo "REFUSED: $*" >&2; echo "  nothing was built or pushed." >&2; exit 1; }
is_local_path() { case "$1" in /*) return 0;; *) return 1;; esac; }

echo "▸ Publish gate"
ORIGIN_FETCH=$(git remote get-url origin 2>/dev/null || true)
ORIGIN_PUSH=$(git remote get-url --push origin 2>/dev/null || true)
if [ -n "${APPROVAL_CHECK_CMD:-}" ] && ! { is_local_path "$ORIGIN_FETCH" && is_local_path "$ORIGIN_PUSH"; }; then
  refuse "APPROVAL_CHECK_CMD is a test hook; it is not honoured when origin is '$ORIGIN_PUSH'"
fi
REAL_HOME=$(getent passwd "$(id -un)" 2>/dev/null | cut -d: -f6 || true); REAL_HOME=${REAL_HOME:-$HOME}
APPROVED_BY=""
if [ -n "${DEPLOY_APPROVAL_REF:-}" ]; then
  [[ "$DEPLOY_APPROVAL_REF" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$ ]] || refuse "DEPLOY_APPROVAL_REF is not a card ref"
  if [ -n "${APPROVAL_CHECK_CMD:-}" ]; then
    read -r -a CHECK <<<"$APPROVAL_CHECK_CMD"
  else   # the real ledger, whatever HOME / KLINGE_STATE / PYTHON* the caller exported
    CHECK=(env -u KLINGE_STATE -u KLINGE_RESEARCH_LOG HOME="$REAL_HOME" python3 -I "$REAL_HOME/klinge-kernel/bin/approval.py")
  fi
  "${CHECK[@]}" check "$DEPLOY_APPROVAL_REF" || refuse "card $DEPLOY_APPROVAL_REF is not APPROVED by kyle (approval.py check)"
  APPROVED_BY="approval $DEPLOY_APPROVAL_REF"
elif [ "${DEPLOY_INTERACTIVE:-}" = 1 ]; then
  { [ -t 0 ] && [ -t 1 ]; } || refuse "DEPLOY_INTERACTIVE=1 needs a real terminal (Kyle running it by hand); none attached"
  APPROVED_BY="interactive"
else
  refuse "no DEPLOY_APPROVAL_REF (a card Kyle APPROVED) and no DEPLOY_INTERACTIVE=1"
fi
BRANCH=$(git symbolic-ref --short -q HEAD || echo "a detached HEAD")
[ "$BRANCH" = main ] || refuse "on $BRANCH, not main"
[ -z "$(git status --porcelain --untracked-files=all)" ] || refuse "the working tree is not clean (see git status)"
git fetch -q origin main || refuse "git fetch origin main failed, so HEAD cannot be proved equal to origin/main"
SRC_SHA=$(git rev-parse HEAD)
[ "$SRC_SHA" = "$(git rev-parse origin/main)" ] || refuse "HEAD ${SRC_SHA:0:12} is not origin/main $(git rev-parse --short=12 origin/main); push or pull first"
if [ "$APPROVED_BY" = interactive ]; then
  SHORT=$(git rev-parse --short=7 HEAD)
  printf '  Deploy %s "%s" to the live site with no approval card? Type %s to confirm: ' "$SHORT" "$(git log -1 --format=%s)" "$SHORT"
  read -r ANSWER || ANSWER=""
  [ "$ANSWER" = "$SHORT" ] || refuse "confirmation did not match $SHORT"
  APPROVED_BY="interactive, SHA typed at a terminal"   # no username: gh-pages history is public
fi
echo "  gate ok: main @ ${SRC_SHA:0:12} == origin/main, clean tree, $APPROVED_BY"

echo "▸ Clean build"
rm -rf .next out node_modules/.cache
if [ ! -d node_modules ]; then
  npm ci
fi
echo "▸ Tests (a red test never ships)"
npm test
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
. "$REPO_ROOT/scripts/lib/ghpages_worktree.sh"
ensure_ghpages_worktree "$REPO_ROOT" "$WORKTREE"
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
git -C "$WORKTREE" commit -m "Deploy ${SRC_SHA:0:12} ($APPROVED_BY)" \
  -m "source: $SRC_SHA" -m "approval: ${DEPLOY_APPROVAL_REF:-$APPROVED_BY}" -m "built: $(date -u +%Y-%m-%dT%H:%MZ)"
git -C "$WORKTREE" push origin HEAD:gh-pages --force

echo "▸ Verify live (cache-busted, waits for propagation)"
# Bounded retries (the unbounded loop hung three deploys on 2026-07-11): 24 x 5s = 2 min, then warn and exit 3 (not 0),
# because the push already landed. The check proves THIS build is live: the page must carry its BUILD_ID.
. "$REPO_ROOT/scripts/lib/verify_live.sh"
BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null || true)
sleep "${DEPLOY_PROPAGATION_WAIT:-6}"
if ! verify_live_build "https://titanos.tech/" "$BUILD_ID" 24 5; then
  echo "  WARN: titanos.tech does not show build ${BUILD_ID:-?} after 2 min. The push landed; check the site by hand."
  echo "▸ PUSHED, NOT VERIFIED. Backup branch: gh-pages-backup-$BACKUP"
  exit 3   # distinct from 0, so an automated caller (publish_due.py) never reads this as a verified deploy
fi
echo "  live site serves build $BUILD_ID"
CB=$(date +%s%N)
echo -n "  .nojekyll: "; curl -s -o /dev/null -w "%{http_code}\n" "https://titanos.tech/.nojekyll?cb=$CB"
HOME_HTML=$(curl -s "https://titanos.tech/?cb=$CB" || true)
CSS=$(grep -oE '/_next/[^"]*\.css' <<<"$HOME_HTML" | head -1 || true)
if [ -n "$CSS" ]; then
  echo -n "  CSS ($CSS): "; curl -s -o /dev/null -w "%{http_code}\n" "https://titanos.tech$CSS?cb=$CB"
else
  echo "  WARN: no CSS reference in homepage"
fi

echo "▸ Done. Backup branch: gh-pages-backup-$BACKUP"
echo "  Rollback:  git -C $WORKTREE reset --hard origin/gh-pages-backup-$BACKUP && git -C $WORKTREE push origin HEAD:gh-pages --force"
