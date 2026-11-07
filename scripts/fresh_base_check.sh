#!/usr/bin/env bash
# fresh_base_check.sh [branch]  (default HEAD)
# Finds the newest origin/web/obelisk-int* by committer date. Prints:
#   FRESH                                  that head is an ancestor of the branch (exit 0)
#   STALE behind=<n> commits, int=<ref>    it is not (exit 1)
#   NOINT                                  no such ref present (exit 0)
# Read-only: never fetches (run `git fetch origin` first), never writes config.
# Env: FRESH_BASE_INT_GLOB overrides the ref glob (default refs/remotes/origin/web/obelisk-int*).
set -u
branch=${1:-HEAD}
glob=${FRESH_BASE_INT_GLOB:-refs/remotes/origin/web/obelisk-int*}
git rev-parse --verify --quiet "$branch^{commit}" >/dev/null || { echo "ERROR: unknown branch '$branch'" >&2; exit 2; }
int=$(git for-each-ref --sort=-committerdate --count=1 --format='%(refname:short)' "$glob")
if [ -z "$int" ]; then echo "NOINT"; exit 0; fi
if git merge-base --is-ancestor "$int" "$branch"; then
  echo "FRESH"; exit 0
fi
n=$(git rev-list --count "$branch..$int")
echo "STALE behind=$n commits, int=$int"
exit 1
