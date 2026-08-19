#!/bin/bash
# Deploy the built static site to titanos.tech (GitHub Pages, gh-pages branch).
#
# Rollback: git push --force origin gh-pages-backup-2026-08-10:gh-pages
#
# SAFETY — why the guards below exist. On 2026-08-20 this deploy pushed the
# SOURCE repo to gh-pages instead of the built site, taking the live site
# down until it was caught. Root cause: `out/` is gitignored in the parent
# repo, and `out/.git` had gone missing, so every git command run from
# inside out/ silently walked UP to the parent repo. `git add -A` then
# added nothing (out/ is ignored), and the force-push shipped the parent's
# source tree to gh-pages. Nothing errored — it just deployed the wrong
# thing. The guards make that failure loud instead of silent.
set -euo pipefail

OUT_DIR="$HOME/titanos_launch/titanos-next/out"
cd "$OUT_DIR"

# Guard 1: the build output must actually exist. Deploying an empty or
# half-built out/ is the other way to take the site down.
[ -f index.html ] || { echo "FATAL: $OUT_DIR/index.html missing — run 'npm run build' first."; exit 1; }
[ -f CNAME ]      || { echo "FATAL: CNAME missing from out/ — custom domain would break."; exit 1; }

git init -q 2>/dev/null || true

# Guard 2: after init, git commands run from here MUST resolve to out/
# itself, never the parent repo. This is the exact check that would have
# caught the 2026-08-20 incident before it shipped.
TOPLEVEL="$(git rev-parse --show-toplevel)"
[ "$TOPLEVEL" = "$OUT_DIR" ] || {
  echo "FATAL: git in $OUT_DIR resolves to '$TOPLEVEL', not out/ itself."
  echo "       out/.git is missing or broken — refusing to deploy, this would"
  echo "       push the SOURCE repo to gh-pages and take the live site down."
  exit 1
}

git checkout -q -B deploy
git add -A

# Guard 3: a real build is thousands of files. If we're about to push a
# handful, something is wrong — bail rather than wipe the live site.
FILE_COUNT="$(git diff --cached --name-only | wc -l)"
[ "$FILE_COUNT" -gt 20 ] || {
  echo "FATAL: only $FILE_COUNT files staged — that isn't a real build. Refusing to deploy."
  exit 1
}

git -c user.email=kyle@titanos.tech -c user.name="Kyle" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/kyle4814/titanos-next.git
git push --force origin deploy:gh-pages

echo "Deployed ($FILE_COUNT files) — live in ~1-2 min at https://titanos.tech"
echo "Rollback: git push --force origin gh-pages-backup-2026-08-10:gh-pages"
