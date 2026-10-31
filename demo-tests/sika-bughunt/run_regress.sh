#!/bin/bash
# usage: run_regress.sh <baseUrl>
here="$(cd "$(dirname "$0")" && pwd)"; w=$(echo "$here" | sed 's#/#\\#g')
cd /mnt/c/Users/tech2/AppData/Local/Temp && timeout 300 "/mnt/c/Program Files/nodejs/node.exe" "\\\\wsl.localhost\\Ubuntu${w}\\regress.mjs" "$1" 2>&1
