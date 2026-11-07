#!/usr/bin/env bash
# Mutation: plant the heavy static import in Concierge.tsx; the static guard AND the built-output check must both go red.
# Restores the file on exit. Rebuilds out/ (about 1-2 min); run `npx next build` again afterwards for a clean out/.
set -u
cd "$(dirname "$0")/.."
F=components/Concierge.tsx
cp "$F" "$F.orig" || exit 2
trap 'mv -f "$F.orig" "$F"' EXIT
sed -i '0,/^import { useRef/s//import { makeAsk as __heavy } from "@\/lib\/concierge\/catalogue";\nvoid __heavy;\nimport { useRef/' "$F"
grep -q __heavy "$F" || { echo "MUTANT NOT PLANTED"; exit 2; }
node scripts/test_faq_js_budget.mjs >/dev/null 2>&1 && { echo "SURVIVED (static guard stayed green)"; exit 1; }
echo "KILLED by static guard"
if [ "${1:-}" = "--build" ]; then
  npx next build >/dev/null 2>&1
  node scripts/test_faq_js_budget.mjs --built out >/tmp/faq_mut.log 2>&1 && { echo "SURVIVED (built check stayed green)"; exit 1; }
  grep -E "first-load|FAIL" /tmp/faq_mut.log; echo "KILLED by built check"
fi
echo "faq js budget mutants: all killed"
