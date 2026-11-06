#!/usr/bin/env bash
# Real routes against `wrangler dev --local` (Miniflare D1). Usage: DEVLOG=/path/to/wrangler.log BASE=http://localhost:8817 scripts/local_e2e.sh
# The login link is read from the Worker's own log (LOCAL_DEV console mailer): nothing is emailed. Fixture data only.
set -euo pipefail
BASE=${BASE:-http://localhost:8817}; DEVLOG=${DEVLOG:?set DEVLOG to the wrangler dev log}
EMAIL="e2e+$(date +%s)@example.invalid"; fails=0
call() { # method path [token] [json]  -> prints "METHOD path -> status body"
  local m=$1 p=$2 t=${3:-} b=${4:-}; local args=(-s -o /tmp/e2e_body -w '%{http_code}' -X "$m" "$BASE$p")
  [ -n "$t" ] && args+=(-H "authorization: Bearer $t"); [ -n "$b" ] && args+=(-H 'content-type: application/json' -d "$b")
  CODE=$(curl "${args[@]}"); printf '%-5s %-22s -> %s %s\n' "$m" "$p" "$CODE" "$(head -c 150 /tmp/e2e_body)"
}
want() { [ "$CODE" = "$1" ] || { echo "   ^ EXPECTED $1"; fails=$((fails+1)); }; }
call GET /health; want 200
call GET /catalogue; want 200
call POST /auth/request "" "{\"email\":\"$EMAIL\"}"; want 202
sleep 1; TOKEN=$(grep -o 'token=ll_[0-9a-f]*' "$DEVLOG" | tail -1 | cut -d= -f2)
call POST /auth/verify "" "{\"token\":\"$TOKEN\"}"; want 200
SESSION=$(sed -E 's/.*"session":"([^"]+)".*/\1/' /tmp/e2e_body)
call GET /me "$SESSION"; want 200
call POST /domains "$SESSION" '{"domain":"e2e-fixture.com.au"}'; want 201
call GET /domains "$SESSION"; want 200
call POST /checkout "$SESSION" '{"product":"leads_growth"}'; want 201
call GET /billing "$SESSION"; want 200
call POST /keys "$SESSION" '{"scopes":["catalogue:read"]}'; want 201
call GET /keys "$SESSION"; want 200
call POST /keys "$SESSION" '{"scopes":["catalogue:read"]}'; want 201
APIKEY=$(sed -E 's/.*"key":"(tk_[0-9a-f]+)".*/\1/' /tmp/e2e_body)
call POST /mcp "$APIKEY" '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"catalogue_list","arguments":{}}}'; want 200
echo "$SESSION" > /tmp/e2e_session
call GET /agent/credits "$SESSION"; want 200
call GET /me ""; want 401
echo "e2e failures: $fails"; [ "$fails" = 0 ]
