#!/usr/bin/env bash
# test_deploy_gate.sh - deploy.sh publishes only on an APPROVED card (or Kyle at a terminal), and only the exact
# source origin/main holds (CS-2 S1, 2026-10-01). Disposable fixture: a bare origin + clone under mktemp, with stub
# npm, curl and approval check on PATH. No network: origin is a local path, every approval check goes to the stub,
# and the one non-local origin used below is on the reserved .invalid domain.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/dgate.XXXXXX")" || { echo "mktemp failed"; exit 97; }
case "$T" in /tmp/dgate.*|"${TMPDIR:-/tmp}"/dgate.*) ;; *) echo "refusing fixture path $T"; exit 97;; esac
trap 'rm -rf -- "$T"' EXIT
pass=0; fail=0
ok(){ if [ "$1" -eq 0 ]; then pass=$((pass+1)); echo "PASS $2"; else fail=$((fail+1)); echo "FAIL $2"; sed 's/^/     | /' "$T/out" 2>/dev/null | tail -6; fi; }
printf '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n' > "$T/gitconfig"
export GIT_CONFIG_GLOBAL="$T/gitconfig" GIT_CONFIG_NOSYSTEM=1
G(){ git "$@"; }

mkdir -p "$T/bin"
cat > "$T/bin/npm" <<'EOS'
#!/usr/bin/env bash
echo "npm $*" >> "$STUB_LOG"
if [ "$*" = "run build" ]; then          # a minimal static export, with a fresh BUILD_ID like next build
  id="BUILD$(date +%s%N)"; mkdir -p .next out/_next/static/chunks
  echo "$id" > .next/BUILD_ID; : > out/.nojekyll; echo titanos.tech > out/CNAME
  echo "<html>$id</html>" > out/index.html; : > out/_next/static/chunks/a.css
fi
exit 0
EOS
cat > "$T/bin/curl" <<'EOS'
#!/usr/bin/env bash
echo "curl $*" >> "$STUB_LOG"
case " $* " in *" -w "*) echo 200; exit 0;; esac
echo "<html>$(cat "$STUB_REPO/.next/BUILD_ID" 2>/dev/null) <link href=\"/_next/static/chunks/a.css\"></html>"
EOS
cat > "$T/bin/approval_stub" <<'EOS'
#!/usr/bin/env bash
echo "approval $*" >> "$STUB_LOG"
[ "${1:-}" = check ] && grep -qxF -- "${2:-}" "$STUB_APPROVED" && { echo APPROVED; exit 0; }
echo "NOT APPROVED"; exit 1
EOS
chmod +x "$T"/bin/*
: > "$T/approved"

G init -q --bare "$T/origin.git"
G clone -q "$T/origin.git" "$T/seed" 2>/dev/null
mkdir -p "$T/seed/scripts/lib"
cp "$HERE/deploy.sh" "$T/seed/scripts/"; cp "$HERE"/lib/*.sh "$T/seed/scripts/lib/"; cp "$HERE/../DEPLOY_NOW.sh" "$T/seed/"
printf '/node_modules\n/.next/\n/out/\n' > "$T/seed/.gitignore"; echo app > "$T/seed/app.txt"
G -C "$T/seed" add -A; G -C "$T/seed" commit -qm src; G -C "$T/seed" push -q origin main 2>/dev/null
G -C "$T/seed" checkout -q --orphan gh-pages; G -C "$T/seed" rm -rqf .; echo old > "$T/seed/index.html"
G -C "$T/seed" add index.html; G -C "$T/seed" commit -qm site; G -C "$T/seed" push -q origin gh-pages 2>/dev/null
G clone -q "$T/origin.git" "$T/repo" 2>/dev/null; mkdir -p "$T/repo/node_modules"
[ "$(G -C "$T/repo" symbolic-ref --short HEAD)" = main ] && [ -f "$T/repo/scripts/deploy.sh" ] || { echo "fixture setup failed"; exit 97; }

STUBENV=(PATH="$T/bin:$PATH" STUB_LOG="$T/stub.log" STUB_APPROVED="$T/approved" STUB_REPO="$T/repo"
         APPROVAL_CHECK_CMD="$T/bin/approval_stub" WORKTREE="$T/wt" DEPLOY_PROPAGATION_WAIT=0)
run(){    # run [VAR=value ...]: the fixture deploy.sh, no terminal, every knob explicit (never the caller's env)
  : > "$T/stub.log"
  env -u DEPLOY_APPROVAL_REF -u DEPLOY_INTERACTIVE "${STUBENV[@]}" "$@" bash "$T/repo/scripts/deploy.sh" </dev/null >"$T/out" 2>&1
}
built(){ grep -q '^npm ' "$T/stub.log"; }
refused(){ [ "$1" -eq 1 ] && ! built && grep -q "REFUSED: $2" "$T/out"; }

# --- the approval half --------------------------------------------------------------------------------------
run; refused $? "no DEPLOY_APPROVAL_REF"; ok $? "no approval ref: refused before the build"
run DEPLOY_APPROVAL_REF=morning-7bb2; rc=$?
refused $rc "card morning-7bb2 is not APPROVED" && grep -qx "approval check morning-7bb2" "$T/stub.log"
ok $? "a ref approval.py does not APPROVE: refused before the build (the check was asked)"
run DEPLOY_APPROVAL_REF="x;touch $T/pwned"; rc=$?
refused $rc "DEPLOY_APPROVAL_REF is not a card ref" && [ ! -e "$T/pwned" ] && ! grep -q '^approval' "$T/stub.log"
ok $? "a ref with shell characters: refused, never passed to the check"
run DEPLOY_INTERACTIVE=1; refused $? "DEPLOY_INTERACTIVE=1 needs a real terminal"
ok $? "DEPLOY_INTERACTIVE=1 with no terminal (an unattended run): refused before the build"
G -C "$T/repo" remote set-url origin https://example.invalid/kyle4814/titanos-next.git
echo ok-1 > "$T/approved"; run DEPLOY_APPROVAL_REF=ok-1; rc=$?
refused $rc "APPROVAL_CHECK_CMD is a test hook" && ! grep -q '^approval' "$T/stub.log"
ok $? "the stub check is refused when origin is not a local path (a stub can never ship the real site)"
G -C "$T/repo" remote set-url origin "$T/origin.git"

# --- the source half (card approved, the tree is wrong) -------------------------------------------------------
G -C "$T/repo" checkout -q -b feature; run DEPLOY_APPROVAL_REF=ok-1; refused $? "on feature, not main"
ok $? "approved, but on another branch: refused before the build"; G -C "$T/repo" checkout -q main
echo edit >> "$T/repo/app.txt"; run DEPLOY_APPROVAL_REF=ok-1; refused $? "the working tree is not clean"
ok $? "approved, but a tracked file is modified: refused"; G -C "$T/repo" checkout -q -- app.txt
echo draft > "$T/repo/draft.md"; run DEPLOY_APPROVAL_REF=ok-1; refused $? "the working tree is not clean"
ok $? "approved, but an untracked file would be built: refused"; rm -f -- "$T/repo/draft.md"
echo local >> "$T/repo/app.txt"; G -C "$T/repo" commit -qam unpushed
run DEPLOY_APPROVAL_REF=ok-1; refused $? "HEAD .* is not origin/main"
ok $? "approved, but HEAD is a commit origin/main does not have: refused"; G -C "$T/repo" reset -q --hard origin/main
: > "$T/stub.log"; env -u DEPLOY_APPROVAL_REF -u DEPLOY_INTERACTIVE "${STUBENV[@]}" bash "$T/repo/DEPLOY_NOW.sh" </dev/null >"$T/out" 2>&1
refused $? "no DEPLOY_APPROVAL_REF"; ok $? "DEPLOY_NOW.sh goes through the same gate (one path, one gate)"

# --- control: an approved card on a clean main publishes, and says what it published -------------------------
SRC=$(G -C "$T/repo" rev-parse HEAD)
run DEPLOY_APPROVAL_REF=ok-1; rc=$?
[ "$rc" -eq 0 ] && built && grep -q "gate ok: main @ ${SRC:0:12}" "$T/out"; ok $? "approved card + clean main == origin/main: builds and deploys (control)"
MSG=$(G -C "$T/origin.git" log -1 --format=%B gh-pages)
grep -q "source: $SRC" <<<"$MSG" && grep -q "approval: ok-1" <<<"$MSG" && grep -q "^Deploy ${SRC:0:12} (approval ok-1)" <<<"$MSG"
ok $? "the gh-pages commit carries the source SHA and the approval ref"
[ "$(G -C "$T/origin.git" show gh-pages:index.html)" = "<html>$(cat "$T/repo/.next/BUILD_ID")</html>" ]; ok $? "origin gh-pages holds this build"
G -C "$T/origin.git" for-each-ref --format='%(refname:short)' 'refs/heads/gh-pages-backup-*' | grep -q .; ok $? "a backup branch was pushed before the deploy"
cat > "$T/bin/curl" <<'EOS'
#!/usr/bin/env bash
echo "curl $*" >> "$STUB_LOG"; echo "<html>BUILDold</html>"
EOS
sed -i 's/verify_live_build "https:\/\/titanos.tech\/" "$BUILD_ID" 24 5/verify_live_build "https:\/\/titanos.tech\/" "$BUILD_ID" 2 0/' "$T/repo/scripts/deploy.sh"
if grep -q '"$BUILD_ID" 2 0' "$T/repo/scripts/deploy.sh"; then   # else the next run would wait 2 min for nothing
  G -C "$T/repo" commit -qam "fixture: short verify"; G -C "$T/repo" push -q origin main 2>/dev/null
  run DEPLOY_APPROVAL_REF=ok-1; rc=$?
  [ "$rc" -eq 3 ] && grep -q "PUSHED, NOT VERIFIED" "$T/out"; ok $? "pushed but the live site shows an old build: exit 3, never 0"
else
  ok 1 "fixture could not shorten the verify loop (deploy.sh's verify line changed): update this test"
fi

# --- Kyle at a real terminal (a pty via script(1)) ------------------------------------------------------------
if command -v script >/dev/null 2>&1; then
  SHORT=$(G -C "$T/repo" rev-parse --short=7 HEAD)
  pty(){ : > "$T/stub.log"; printf '%s\n' "$1" | env -u DEPLOY_APPROVAL_REF "${STUBENV[@]}" DEPLOY_INTERACTIVE=1 \
         script -qec "bash $T/repo/scripts/deploy.sh" /dev/null >"$T/out" 2>&1; }
  pty wrong123; ! built && grep -q "REFUSED: confirmation did not match" "$T/out"; ok $? "interactive, wrong SHA typed: refused before the build"
  pty "$SHORT"; built && grep -q "gate ok: .*interactive, SHA typed at a terminal" "$T/out"; ok $? "interactive, the short SHA typed at a terminal: passes the gate"
  G -C "$T/origin.git" log -1 --format=%B gh-pages | grep -q "approval: interactive, SHA typed at a terminal" && ! G -C "$T/origin.git" log -1 --format=%B gh-pages | grep -q "$(id -un)"; ok $? "an interactive deploy is stamped as interactive, with no local username in public history"
else
  ok 1 "script(1) missing: the interactive path cannot be proven (FAIL, not skip)"
fi
echo "== test_deploy_gate: $pass passed, $fail failed"; [ "$fail" -eq 0 ]
