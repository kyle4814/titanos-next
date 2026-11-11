#!/usr/bin/env bash
# test_visitor_diff.sh - visitor_diff.py on a fixture pair of built sites (and a gh-pages ref export). No network.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/vdiff.XXXXXX")" || { echo "mktemp failed"; exit 97; }
case "$T" in /tmp/vdiff.*|"${TMPDIR:-/tmp}"/vdiff.*) ;; *) echo "refusing fixture path $T"; exit 97;; esac
trap 'rm -rf -- "$T"' EXIT
pass=0; fail=0
ok(){ if [ "$1" -eq 0 ]; then pass=$((pass+1)); echo "PASS $2"; else fail=$((fail+1)); echo "FAIL $2"; sed 's/^/     | /' "$T/out" | tail -8; fi; }
mkdir -p "$T/old/pricing" "$T/old/_next" "$T/new/pricing" "$T/new/blog"
cat > "$T/old/index.html" <<'H'
<html><body><script>var x="AU$ 999"</script><h1>Hello</h1><h2>Pricing</h2><p>AU$1,500 AU$ 2,500 AU$5,000</p><h2>Proof</h2></body></html>
H
echo '<html><h1>Plans</h1><p>AU$149</p></html>' > "$T/old/pricing/index.html"
echo '<html><h1>junk AU$ 1 AU$ 2</h1></html>' > "$T/old/_next/x.html"
cat > "$T/new/index.html" <<'H'
<html><body><h1>Hello</h1><h2>Proof</h2><h2>Start</h2><p>AU$1,500</p></body></html>
H
echo '<html><h1>Plans</h1><p>AU$149</p></html>' > "$T/new/pricing/index.html"
echo '<html><h1>Notes</h1></html>' > "$T/new/blog/index.html"
python3 -I "$HERE/visitor_diff.py" "$T/old" "$T/new" > "$T/out" 2>&1; rc=$?
[ $rc -eq 0 ] && grep -q '^/: AU\$ mentions 3 -> 1, removed: "Pricing", added: "Start"' "$T/out"; ok $? "home page: prices 3 -> 1 (script text ignored), Pricing heading removed, Start added"
grep -q '^+ NEW PAGE /blog (0 AU\$ mentions)' "$T/out"; ok $? "a new page is listed"
! grep -q '^/pricing' "$T/out" && ! grep -q '_next' "$T/out"; ok $? "an unchanged page and _next are not listed"
grep -q '^VISITOR DIFF: 2 -> 3 pages, AU\$ mentions 4 -> 2' "$T/out"; ok $? "the header carries page and AU\$ totals"
python3 -I "$HERE/visitor_diff.py" "$T/new" "$T/new" > "$T/out" 2>&1; grep -q 'No visible page' "$T/out"; ok $? "identical sites: says no changes"
rm -rf "$T/new/pricing"; python3 -I "$HERE/visitor_diff.py" "$T/old" "$T/new" > "$T/out" 2>&1; grep -q '^- PAGE GONE /pricing (had 1 AU\$ mentions)' "$T/out"; ok $? "a removed page is listed with its price count"
# gh-pages:<ref> export
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
git init -q "$T/r"; cp -r "$T/old/." "$T/r/"; git -C "$T/r" add -A; git -C "$T/r" -c user.name=t -c user.email=t@t commit -qm o
python3 -I "$HERE/visitor_diff.py" gh-pages:HEAD "$T/old" --repo "$T/r" > "$T/out" 2>&1; grep -q 'No visible page' "$T/out"; ok $? "gh-pages:<ref> export equals the same dir (page _next skipped)"
python3 -I "$HERE/visitor_diff.py" "$T/nope" "$T/old" > "$T/out" 2>&1; [ $? -ne 0 ]; ok $? "a missing dir fails"
echo "== test_visitor_diff: $pass passed, $fail failed"; [ "$fail" -eq 0 ]
