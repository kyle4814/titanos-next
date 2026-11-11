#!/usr/bin/env bash
# test_cloud_build.sh - scripts/cloud_build.sh (the deploy's build + tests on the cloud runner, 2026-11-10) fails
# closed and brings back exactly the tested output. No network: a stub ssh on PATH plays the runner.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/cbuild.XXXXXX")" || { echo "mktemp failed"; exit 97; }
case "$T" in /tmp/cbuild.*|"${TMPDIR:-/tmp}"/cbuild.*) ;; *) echo "refusing fixture path $T"; exit 97;; esac
trap 'rm -rf -- "$T"' EXIT
pass=0; fail=0
ok(){ if [ "$1" -eq 0 ]; then pass=$((pass+1)); echo "PASS $2"; else fail=$((fail+1)); echo "FAIL $2"; tail -6 "$T/out" 2>/dev/null | sed 's/^/     | /'; fi; }
printf '[user]\n\tname = t\n\temail = t@t\n' > "$T/gitconfig"; export GIT_CONFIG_GLOBAL="$T/gitconfig" GIT_CONFIG_NOSYSTEM=1
mkdir -p "$T/repo/scripts" "$T/home/.titanos" "$T/home/.ssh" "$T/bin" "$T/runner/out/_next" "$T/runner/.next"
cp "$HERE/cloud_build.sh" "$T/repo/scripts/"; echo src > "$T/repo/app.txt"
git -C "$T/repo" init -q && git -C "$T/repo" add -A && git -C "$T/repo" commit -qm src
SRC=$(git -C "$T/repo" rev-parse HEAD)
echo "runner@example.invalid" > "$T/home/.titanos/verify_remote_host"; echo key > "$T/home/.ssh/titanos_cloud"
echo "example.invalid ssh-ed25519 AAAA" > "$T/home/.titanos/cloud_known_hosts"
echo TESTEDBUILD > "$T/runner/.next/BUILD_ID"; echo "<html>tested</html>" > "$T/runner/out/index.html"
cat > "$T/bin/ssh" <<'EOS'
#!/usr/bin/env bash
echo "ssh $*" >> "$STUB_LOG"
case "$*" in
  *"tar -xf -"*) cat > "$STUB_DIR/upload.tar";;
  *"bash -s"*) cat > /dev/null; echo "runner: tests ran"; exit "${STUB_RUN_RC:-0}";;
  *"tar -cf -"*) [ -n "${STUB_NO_OUTPUT:-}" ] && exit 0; tar -cf - -C "$STUB_DIR/runner" out .next/BUILD_ID;;
  *) exit 99;;
esac
EOS
chmod +x "$T/bin/ssh"
run(){ : > "$T/log"; (cd "$T/repo" && env -u VERIFY_REMOTE_HOST -u VERIFY_REMOTE_KEY -u VERIFY_REMOTE_KNOWN_HOSTS \
        HOME="$T/home" PATH="$T/bin:$PATH" STUB_LOG="$T/log" STUB_DIR="$T" "$@" bash scripts/cloud_build.sh "${ARG-$SRC}") >"$T/out" 2>&1; }

ARG=abc run; [ $? -eq 2 ] && grep -q "need a full 40-hex source SHA" "$T/out" && [ ! -s "$T/log" ]; ok $? "a short or bad SHA: exit 2, the runner is never contacted"
ARG="$SRC;touch $T/pwned" run; [ $? -eq 2 ] && [ ! -e "$T/pwned" ]; ok $? "a SHA with shell characters: exit 2, nothing runs"
mv "$T/home/.titanos/verify_remote_host" "$T/hostfile"; run; rc=$?; mv "$T/hostfile" "$T/home/.titanos/verify_remote_host"
[ "$rc" -eq 2 ] && grep -q "not configured" "$T/out" && [ ! -s "$T/log" ]; ok $? "no runner configured: exit 2 (not a code failure), nothing contacted"
run; rc=$?
[ "$rc" -eq 0 ] && [ "$(cat "$T/repo/.next/BUILD_ID")" = TESTEDBUILD ] && grep -q tested "$T/repo/out/index.html" \
  && tar -tf "$T/upload.tar" | grep -qx app.txt && grep -q "GREEN at ${SRC:0:12}" "$T/out"
ok $? "green: the exact commit is uploaded and the tested out/ + BUILD_ID come back"
[ "$(grep -c '^ssh ' "$T/log")" -eq 3 ] && head -1 "$T/log" | grep -q "tar -xf -" && sed -n 2p "$T/log" | grep -q "bash -s" && sed -n 3p "$T/log" | grep -q "tar -cf -"
ok $? "order: upload, then build + tests, then fetch (never fetch before the tests ran)"
grep -q "StrictHostKeyChecking=yes" "$T/log" && grep -q "UserKnownHostsFile=$T/home/.titanos/cloud_known_hosts" "$T/log"
ok $? "the runner's host key is pinned (no trust-on-first-use)"
run STUB_RUN_RC=1; rc=$?
[ "$rc" -ne 0 ] && [ ! -e "$T/repo/out" ] && [ ! -e "$T/repo/.next" ] && ! grep -q "tar -cf -" "$T/log"
ok $? "red tests: non-zero, the older out/ is gone and nothing is fetched"
run STUB_NO_OUTPUT=1; rc=$?
[ "$rc" -eq 13 ] && grep -q "did not come back" "$T/out"; ok $? "green but no output came back: exit 13, never a silent pass"
echo "== test_cloud_build: $pass passed, $fail failed"; [ "$fail" -eq 0 ]
