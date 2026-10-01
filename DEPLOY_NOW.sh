#!/bin/bash
# DEPLOY_NOW.sh - kept as a name only. It runs scripts/deploy.sh, which carries the publish gate.
#
# Until 2026-10-01 this script ran `git init` inside out/ and force-pushed an orphan commit to gh-pages with no
# approval check, no tests and no backup branch. On 2026-08-20 it pushed the SOURCE tree to gh-pages and took the
# site down; on 2026-10-01 the CS-2 audit (G9) matched the unreceipted 10:05 deploy to it. Two deploy paths meant
# the gate in deploy.sh could be walked around, so there is now one path and one gate:
#   DEPLOY_APPROVAL_REF=<ref> ./DEPLOY_NOW.sh      (a card Kyle APPROVED)
#   DEPLOY_INTERACTIVE=1 ./DEPLOY_NOW.sh          (Kyle at a terminal, types the short SHA)
# deploy.sh pushes a gh-pages-backup-<time> branch before every deploy and prints the rollback command.
exec bash "$(cd "$(dirname "$0")" && pwd)/scripts/deploy.sh" "$@"
