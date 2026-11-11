#!/usr/bin/env bash
# f420_c10: --all in the rendered sweeps (print+motion, keyboard focus) reads its page list from scripts/export_pages.json
# (routes_count semantics) and fails closed with exit 4, named, when the manifest is missing, stale against out/, internally
# inconsistent, or one route short. SYNTHETIC fixtures only (scripts/fixtures/allpages), localhost only.
# The browser-free failure cases always run; the good-pass case is labelled SKIP if there is no browser.
set -u
cd "$(dirname "$0")/.." || exit 2
PM=scripts/obelisk_rendered_print_motion.mjs
KB=scripts/obelisk_rendered_keyboard_focus.mjs
FX=scripts/fixtures/allpages
fail=0
ok() { echo "ok   $1"; }
no() { echo "FAIL $1"; fail=1; }
T=$(mktemp -d) && [ -n "$T" ] && [ -d "$T" ] || { echo "FAIL no scratch dir"; exit 2; }
jq_() { node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(eval(process.argv[2]))' "$1" "$2"; }
run() { # run PROBE OUT MANIFEST [extra]
  local s=$PM x=""; [ "$1" = KB ] && { s=$KB; x="--viewports desktop"; }
  node "$s" --out "$2" --all --allowlist "$FX/allowlist.json" --manifest "$3" ${4:-} $x 2>&1
}
cp -r "$FX/site" "$T/site"
node scripts/export_page_manifest.mjs --write --out "$T/site" --manifest "$T/good.json" >/dev/null

# 1. good pass: total equals the manifest routes_count (here 4 routes, 404 excluded, allowlist /404 is a no-op)
rc=0; o=$(run PM "$T/site" "$T/good.json" "--report $T/pm.json") || rc=$?
if [ "$rc" = 0 ]; then
  ok "PM good pass (rc 0)"
  [ "$(jq_ "$T/pm.json" 'd.pages_total+"/"+d.pages_swept+"/"+d.source+"/"+d.manifest_routes_count')" = "4/4/manifest/4" ] && ok "PM report total=swept=manifest routes_count=4 source=manifest" || no "PM report counts/source wrong"
  rc=0; o=$(run KB "$T/site" "$T/good.json" "--report $T/kb.json") || rc=$?
  [ "$rc" = 0 ] && ok "KB good pass (rc 0)" || no "KB good pass (rc=$rc)"
  [ "$(jq_ "$T/kb.json" 'd.pages_total+"/"+d.pages_swept+"/"+d.source')" = "4/4/manifest" ] && ok "KB report total=swept=4 source=manifest" || no "KB report counts/source wrong"
else
  echo "$o" | grep -q "chromium\|browser\|SKIP" && echo "SKIP good pass (no browser)" || { no "PM good pass should exit 0 (rc=$rc)"; echo "$o" | tail -4; }
fi

expect4() { # expect4 label PROBE MANIFEST KIND
  local rc=0 o; o=$(run "$2" "$T/site" "$3") || rc=$?
  [ "$rc" = 4 ] && echo "$o" | grep -q "MANIFEST $4" && echo "$o" | grep -q "COVERAGE FAILED" && ok "$1: $2 exits 4 naming MANIFEST $4" || { no "$1: $2 must exit 4 with MANIFEST $4 (rc=$rc)"; echo "$o" | tail -3; }
}
for P in PM KB; do
  # 2. missing manifest
  expect4 "missing manifest" $P "$T/nope.json" MISSING
  printf 'not json' > "$T/broken.json"; expect4 "unreadable manifest" $P "$T/broken.json" MISSING
  # 3. stale: a page was added to out/ after the manifest was written
  rm -rf "$T/site2"; cp -r "$T/site" "$T/site2"; echo "<html></html>" > "$T/site2/newpage.html"
  rc=0; o=$(node "$([ $P = PM ] && echo $PM || echo $KB)" --out "$T/site2" --all --allowlist "$FX/allowlist.json" --manifest "$T/good.json" 2>&1) || rc=$?
  [ "$rc" = 4 ] && echo "$o" | grep -q "MANIFEST STALE" && echo "$o" | grep -q "ADDED newpage.html" && ok "stale (page added to out): $P exits 4 naming ADDED newpage.html" || no "stale add: $P (rc=$rc)"
  # 4. MUTATION: one route removed from the manifest (and its counts fixed up) must still be caught as stale
  node -e 'const fs=require("fs");const m=JSON.parse(fs.readFileSync(process.argv[1]));m.pages=m.pages.filter(p=>p!=="about.html");m.count=m.pages.length;m.routes_count=m.pages.filter(p=>p!=="404.html").length;fs.writeFileSync(process.argv[2],JSON.stringify(m,null,2)+"\n")' "$T/good.json" "$T/minus.json"
  rc=0; o=$(run $P "$T/site" "$T/minus.json") || rc=$?
  [ "$rc" = 4 ] && echo "$o" | grep -q "MANIFEST STALE" && echo "$o" | grep -q "ADDED about.html" && ok "mutation (route removed from manifest): $P exits 4 naming about.html" || no "mutation: $P (rc=$rc)"
  # 5. a page removed from out/ but still in the manifest
  rm -rf "$T/site3"; cp -r "$T/site" "$T/site3"; rm "$T/site3/about.html"
  rc=0; o=$(node "$([ $P = PM ] && echo $PM || echo $KB)" --out "$T/site3" --all --allowlist "$FX/allowlist.json" --manifest "$T/good.json" 2>&1) || rc=$?
  [ "$rc" = 4 ] && echo "$o" | grep -q "REMOVED about.html" && ok "stale (page removed from out): $P exits 4 naming REMOVED about.html" || no "stale remove: $P (rc=$rc)"
  # 6. internally inconsistent: routes_count lies about the pages list
  node -e 'const fs=require("fs");const m=JSON.parse(fs.readFileSync(process.argv[1]));m.routes_count=99;fs.writeFileSync(process.argv[2],JSON.stringify(m))' "$T/good.json" "$T/lie.json"
  expect4 "routes_count lie" $P "$T/lie.json" INCONSISTENT
done

# 6b. the shard merger takes its expected list from the manifest too: missing manifest exits 4, named
echo '{"pages":[]}' > "$T/shard.json"
rc=0; o=$(node scripts/merge_allpages_reports.mjs --out "$T/site" --manifest "$T/nope.json" --probe x --into "$T/m.json" "$T/shard.json" 2>&1) || rc=$?
[ "$rc" = 4 ] && echo "$o" | grep -q "MERGE MANIFEST MISSING" && ok "merge: missing manifest exits 4 naming MISSING" || no "merge missing manifest (rc=$rc)"
rc=0; o=$(node scripts/merge_allpages_reports.mjs --out "$T/site" --manifest "$T/minus.json" --probe x --into "$T/m.json" "$T/shard.json" 2>&1) || rc=$?
[ "$rc" = 4 ] && echo "$o" | grep -q "MERGE MANIFEST STALE" && ok "merge: stale manifest (route removed) exits 4" || no "merge stale manifest (rc=$rc)"

# 7. the real manifest is the default (no --manifest flag) and parses; the sweeps do not enumerate a page list themselves
node --input-type=module -e '
import { DEFAULT_MANIFEST } from "./scripts/lib/allpages.mjs";
import { readManifest } from "./scripts/export_page_manifest.mjs";
const m = readManifest(DEFAULT_MANIFEST);
if (m.routes_count !== m.pages.filter((p) => p !== "404.html").length) process.exit(1);
console.log("default manifest routes_count=" + m.routes_count);' && ok "default manifest readable and self-consistent" || no "default manifest broken"
grep -q "manifestRoutes" $PM && grep -q "manifestRoutes" $KB && ! grep -q "pages = enumerateAllPages" $PM $KB && ok "both probes take --all pages from manifestRoutes, not enumerateAllPages" || no "a probe still enumerates out/ itself for --all"

rm -rf "${T:?}"
[ $fail -eq 0 ] && echo "test_sweeps_use_export_manifest: all green" || { echo "test_sweeps_use_export_manifest: RED"; exit 1; }
