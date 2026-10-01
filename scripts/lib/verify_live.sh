# verify_live.sh - sourced by deploy.sh. verify_live_build URL BUILD_ID [TRIES] [PAUSE_SECS]
#
# 2026-10-01 (CS-2 audit G3): the old check was `curl ... | grep -q "titanos"` under `set -o pipefail`. grep -q exits
# at its first match, curl then writes into a closed pipe and exits 23, so the pipeline could fail on a healthy site
# (it did: the 16:02 Monitor deploy reported "verification inconclusive"). It also could not tell the new build from
# the old one, since every version says "titanos". Now: the page body goes into a variable (no pipe) and must contain
# this build's Next.js BUILD_ID, which proves the NEW build is what the site serves.
verify_live_build() {
  local url="$1" id="$2" tries="${3:-24}" pause="${4:-5}" body i sep="?"
  [ -n "$id" ] || { echo "  verify: no BUILD_ID to check against"; return 1; }
  case "$url" in *\?*) sep="&";; esac
  for i in $(seq 1 "$tries"); do
    body=$(curl -s --max-time 15 "${url}${sep}cb=$(date +%s%N)" || true)
    if grep -qF -- "$id" <<<"$body"; then return 0; fi
    [ "$i" -lt "$tries" ] && sleep "$pause"
  done
  return 1
}
