# ghpages_worktree.sh - sourced by deploy.sh. ensure_ghpages_worktree REPO_ROOT WORKTREE
#
# 2026-10-01: the first Monitor-fix deploy died at "fatal: not a git repository" because /tmp/titanos-ghpages was a
# worktree from August whose .git file pointed at metadata the 2026-09-30 re-clone no longer had. deploy.sh only
# checked that a .git entry EXISTED, so it skipped `git worktree add` and then failed. Nothing was published.
# Now: the folder must be a working checkout of THIS repo; anything else is moved aside (never deleted) and rebuilt.
ensure_ghpages_worktree() {
  local repo="$1" wt="$2" common want stale
  git -C "$repo" worktree prune
  want="$(cd "$repo" && cd "$(git rev-parse --git-common-dir)" && pwd -P)"
  common="$(cd "$wt" 2>/dev/null && cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)"
  if [ -n "$common" ] && [ "$common" = "$want" ]; then
    return 0
  fi
  if [ -e "$wt" ]; then
    stale="$wt.stale-$(date +%Y%m%d-%H%M%S)"
    echo "  stale deploy worktree at $wt (not a checkout of this repo): moved aside to $stale"
    mv "$wt" "$stale"
  fi
  # detached at origin/gh-pages, not on the branch: git allows a branch in ONE worktree only, and a second deploy
  # folder (e.g. one made with WORKTREE=... after a failure) would otherwise block this add. deploy.sh pushes
  # HEAD:gh-pages, so a detached HEAD deploys the same way.
  git -C "$repo" worktree add --detach "$wt" origin/gh-pages
}
