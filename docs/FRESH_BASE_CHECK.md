# Fresh-base check (merge-conflict prevention)

Fills cut from a stale base caused 61-73 conflicts per website merge batch. `scripts/fresh_base_check.sh [branch]` compares a branch with the newest `origin/web/obelisk-int*` (by committer date).

| Output | Exit | Meaning |
|---|---|---|
| `FRESH` | 0 | int head is an ancestor of the branch |
| `STALE behind=<n> commits, int=<ref>` | 1 | rebase onto `<ref>` before pushing |
| `NOINT` | 0 | no int branch present locally |

Run `git fetch origin` first; the script is read-only and never touches the network.

## Opt-in pre-push hook
Per clone only, never global, no `~/.gitconfig` edits:

    cp scripts/pre-push.fresh-base.sample "$(git rev-parse --git-path hooks)/pre-push"
    chmod +x "$(git rev-parse --git-path hooks)/pre-push"

It checks only `web/*` branches. Bypass once with `git push --no-verify`. Remove by deleting that file.

Test: `bash scripts/test_fresh_base_check.sh` (scratch-repo fixtures; `MUTATE=1` breaks the ancestor check and must go red).
