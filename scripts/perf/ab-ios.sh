#!/usr/bin/env bash
# Interleaved device A/B on the booted iOS simulator: each round launches every bundle once.
#   ab-ios.sh <rounds> <log> label=bundle.hbc ...
set -euo pipefail
rounds=$1 log=$2; shift 2
app=dev.solidnative.canary sim=${SIM:-booted}
dir=$(xcrun simctl get_app_container "$sim" $app)
# The full report, from the file the bench saves: the system log truncates a long line.
report="$(xcrun simctl get_app_container "$sim" $app data)/Documents/bench.txt"
for r in $(seq "$rounds"); do
  for pair in "$@"; do
    label=${pair%%=*} file=${pair#*=}
    cp "$file" "$dir/main.jsbundle"
    xcrun simctl terminate "$sim" $app 2>/dev/null || true
    rm -f "$report"
    xcrun simctl launch "$sim" $app >/dev/null
    # Written once every phase has run, a few seconds after launch.
    for _ in $(seq 20); do sleep 0.5; [ -s "$report" ] && break; done
    sleep 0.3
    line=$(cat "$report" 2>/dev/null || true)
    echo "$label $line" | tee -a "$log"
  done
done
node "$(dirname "$0")/summarize.mjs" "$log"
