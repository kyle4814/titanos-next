#!/bin/bash
# Runs the simulated-user suite through Windows node + Windows Chrome against a base URL. usage: run.sh <baseUrl> <outDirWindows> [seed] [sizes]
here="$(cd "$(dirname "$0")" && pwd)"; w=$(echo "$here" | sed 's#/#\\#g')
cd /mnt/c/Users/tech2/AppData/Local/Temp && timeout 900 "/mnt/c/Program Files/nodejs/node.exe" "\\\\wsl.localhost\\Ubuntu${w}\\bughunt.mjs" "$1" "$2" "${3:-20261031}" "${4:-1440x900,1920x1080,390x844,768x1024}" 2>&1
