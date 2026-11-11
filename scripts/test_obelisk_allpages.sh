#!/usr/bin/env bash
# f414_c10: the --all mode of the rendered probes (f406 print+motion, f407 keyboard focus) must sweep EVERY exported page.
# Mutations proven here: a page dropped from the sweep list is caught (exit 4, COVERAGE FAILED); a planted-bad page is reported
# per page; an allowlist entry without a reason, or naming a page that does not exist, fails; the real allowlist is well formed.
# SYNTHETIC fixtures only (scripts/fixtures/allpages + kbfocus + rendpm), localhost only. Labelled SKIP (exit 0) if no browser.
set -u
cd "$(dirname "$0")/.." || exit 2
PM=scripts/obelisk_rendered_print_motion.mjs
KB=scripts/obelisk_rendered_keyboard_focus.mjs
FX=scripts/fixtures/allpages
fail=0
ok() { echo "ok   $1"; }
no() { echo "FAIL $1"; fail=1; }
jq_() { node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(eval(process.argv[2]))' "$1" "$2"; }
T=$(mktemp -d) && [ -n "$T" ] && [ -d "$T" ] || { echo "FAIL no scratch dir"; exit 2; }

o=$(node "$KB" --out "$FX/site" --pages /index.html --viewports desktop 2>&1); echo "$o" | grep -q "^KBFOC SKIP" && { echo "SKIP test_obelisk_allpages (no browser)"; exit 0; }

# 1. good site, both probes: every non-allowlisted page swept, nested route included, counts independent
for P in PM KB; do
  S=$PM; [ $P = KB ] && S=$KB
  extra=""; [ $P = KB ] && extra="--viewports desktop"
  o=$(node "$S" --out "$FX/site" --all --allowlist "$FX/allowlist.json" --report "$T/$P.json" $extra 2>&1); rc=$?
  [ "$rc" = 0 ] && ok "$P good site passes (rc 0)" || { no "$P good site should pass (rc=$rc)"; echo "$o" | tail -5; }
  [ "$(jq_ "$T/$P.json" 'd.pages_total+"/"+d.pages_swept+"/"+d.pages_allowlisted+"/"+d.pages_enumerated')" = "4/4/1/5" ] && ok "$P report total=4 swept=4 allowlisted=1 enumerated=5" || no "$P report counts wrong"
  [ "$(jq_ "$T/$P.json" 'd.pages.some(p=>p.route==="/blog/post"&&p.swept)')" = true ] && ok "$P swept nested /blog/post" || no "$P missed nested route"
  [ "$(jq_ "$T/$P.json" 'd.pages.some(p=>p.route==="/404")')" = false ] && ok "$P skipped only the allowlisted /404" || no "$P swept or listed the allowlisted page"
done

# 2. MUTATION: drop one page from the enumeration; the independent total must catch it
for P in PM KB; do
  S=$PM; [ $P = KB ] && S=$KB
  extra=""; [ $P = KB ] && extra="--viewports desktop"
  o=$(node "$S" --out "$FX/site" --all --allowlist "$FX/allowlist.json" --report "$T/d$P.json" --mutate-drop /about $extra 2>&1); rc=$?
  [ "$rc" = 4 ] && ok "$P dropped page exits 4" || no "$P dropped page must exit 4 (rc=$rc)"
  echo "$o" | grep -q "COVERAGE FAILED" && echo "$o" | grep -q "NOT SWEPT /about" && ok "$P names /about as NOT SWEPT" || no "$P did not name the dropped page"
  [ "$(jq_ "$T/d$P.json" 'd.pages_total+"/"+d.pages_swept')" = "4/3" ] && ok "$P report shows swept 3 of 4" || no "$P report did not show 3 of 4"
done

# 3. MUTATION: a planted-bad page added to a copy of the site is found and named per page
mkdir -p "$T/site" && cp -r "$FX/site/." "$T/site/" && cp scripts/fixtures/kbfocus/bad_outline.html "$T/site/planted_bad.html" && cp scripts/fixtures/rendpm/bad/index.html "$T/site/planted_pm_bad.html"
o=$(node "$KB" --out "$T/site" --all --allowlist "$FX/allowlist.json" --report "$T/kbbad.json" --viewports desktop 2>&1); rc=$?
[ "$rc" = 1 ] && ok "KB planted-bad page exits 1" || no "KB planted-bad should exit 1 (rc=$rc)"
[ "$(jq_ "$T/kbbad.json" 'd.pages.find(p=>p.route==="/planted_bad").defects.some(x=>x.startsWith("NO_INDICATOR"))')" = true ] && ok "KB per-page defect NO_INDICATOR on /planted_bad" || no "KB per-page defect missing"
[ "$(jq_ "$T/kbbad.json" 'd.pages_swept===d.pages_total')" = true ] && ok "KB still sweeps every page with a defect present" || no "KB coverage should be full"
o=$(node "$PM" --out "$T/site" --all --allowlist "$FX/allowlist.json" --report "$T/pmbad.json" 2>&1); rc=$?
[ "$rc" = 1 ] && ok "PM planted-bad page exits 1" || no "PM planted-bad should exit 1 (rc=$rc)"
[ "$(jq_ "$T/pmbad.json" 'd.pages.find(p=>p.route==="/planted_pm_bad").defects.some(x=>x.startsWith("PRINT-CHROME"))')" = true ] && ok "PM per-page defect PRINT-CHROME on /planted_pm_bad" || no "PM per-page defect missing"
[ "$(jq_ "$T/pmbad.json" 'd.pages.find(p=>p.route==="/about").defects.length')" = 0 ] && ok "PM clean pages stay clean" || no "PM clean page polluted"

# 4. allowlist rules: reasonless entry fails, stale entry fails, unreadable file fails
printf '%s\n' '{"skipped":[{"route":"/404","reason":"x"}]}' > "$T/noreason.json"
printf '%s\n' '{"skipped":[{"route":"/does-not-exist","reason":"This page is not exported at all, stale entry."}]}' > "$T/stale.json"
printf '%s\n' 'not json' > "$T/broken.json"
for A in noreason stale broken; do
  o=$(node "$PM" --out "$FX/site" --all --allowlist "$T/$A.json" 2>&1); rc=$?
  [ "$rc" = 4 ] && echo "$o" | grep -q "PROBLEM" && ok "allowlist $A fails the run (exit 4)" || no "allowlist $A must fail with PROBLEM (rc=$rc)"
done

# 5. the real allowlist is well formed, every entry has a reason
node --input-type=module -e '
import { loadAllowlist } from "./scripts/lib/allpages.mjs";
const { entries, problems } = loadAllowlist();
if (problems.length) { console.error(problems.join("; ")); process.exit(1); }
console.log("real allowlist entries: " + entries.length);' && ok "real allowlist well formed" || no "real allowlist invalid"

[ $fail -eq 0 ] && echo "test_obelisk_allpages: all green" || { echo "test_obelisk_allpages: RED"; exit 1; }
