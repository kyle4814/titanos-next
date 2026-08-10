#!/bin/bash
# Deploy the "Every door is open" ladder to titanos.tech
# Backup already taken: gh-pages-backup-2026-08-10
# Source already committed + pushed to main (b7971be)
# out/ already built and verified (61 files, CNAME + .nojekyll present)
set -e
cd ~/titanos_launch/titanos-next/out
git init -q 2>/dev/null || true
git checkout -q -B deploy
git add -A
git -c user.email=kyle@titanos.tech -c user.name="Kyle" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ) — Every door ladder"
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/kyle4814/titanos-next.git
git push --force origin deploy:gh-pages
echo "✅ deployed — live in ~1-2 min at https://titanos.tech"
echo "   rollback: git push --force origin gh-pages-backup-2026-08-10:gh-pages"
