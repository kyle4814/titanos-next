#!/usr/bin/env bash
# fresh_base_check.sh <branch> [integration-ref]
# Prints "BEHIND=<n> MERGE_BASE=<sha> CONFLICT=<yes|no>". Exit 0 fresh, 3 stale, 2 usage.
# Read-only: git merge-tree --write-tree never touches the worktree or index.
# Env: FRESH_MAX_BEHIND (default 25), FRESH_REMOTE (default origin).
set -u
branch="${1:-}"; int="${2:-}"
max="${FRESH_MAX_BEHIND:-25}"; remote="${FRESH_REMOTE:-origin}"
[ -n "$branch" ] || { echo "usage: fresh_base_check.sh <branch> [integration-ref]" >&2; exit 2; }
case "$max" in ''|*[!0-9]*) echo "bad FRESH_MAX_BEHIND" >&2; exit 2;; esac
bref=""
for c in "$branch" "refs/remotes/$remote/$branch" "refs/heads/$branch"; do
  if git rev-parse --verify -q "$c^{commit}" >/dev/null; then bref="$c"; break; fi
done
[ -n "$bref" ] || { echo "bad branch: $branch" >&2; exit 2; }
if [ -z "$int" ]; then
  int=$(git for-each-ref --sort=-committerdate --count=1 --format='%(refname)' "refs/remotes/$remote/web/obelisk-int*")
  [ -n "$int" ] || { echo "no integration ref found (refs/remotes/$remote/web/obelisk-int*); git fetch $remote first" >&2; exit 2; }
fi
git rev-parse --verify -q "$int^{commit}" >/dev/null || { echo "bad integration ref: $int" >&2; exit 2; }
base=$(git merge-base "$bref" "$int" 2>/dev/null) || { echo "BEHIND=? MERGE_BASE=none CONFLICT=yes"; exit 3; }
behind=$(git rev-list --count "$bref..$int")
if git merge-tree --write-tree "$int" "$bref" >/dev/null 2>&1; then conflict=no; else conflict=yes; fi
echo "BEHIND=$behind MERGE_BASE=$(git rev-parse --short "$base") CONFLICT=$conflict"
[ "$behind" -lt "$max" ] && [ "$conflict" = no ] && exit 0
exit 3
