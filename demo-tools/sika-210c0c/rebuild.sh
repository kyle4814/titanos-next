#!/bin/bash
# Re-runnable over readable sources: regenerates dist/, inline CSS, the split data and sw.js. Run after ANY change to the portal folder
# (after the hours placeholder is filled, after merging a sibling branch). Idempotent: a second run changes nothing.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/build_alias.mjs" "${1:-$here/../../public/demo/sika-210c0c}"
node "$here/add_images.mjs" "${1:-$here/../../public/demo/sika-210c0c}"
node "$here/build_speed.mjs" "${1:-$here/../../public/demo/sika-210c0c}"
node "$here/build_sw.mjs" "${1:-$here/../../public/demo/sika-210c0c}"
