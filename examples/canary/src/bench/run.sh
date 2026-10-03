#!/usr/bin/env bash
# Run the renderer benchmark on the booted iOS simulator, without an Xcode build per side.
#
#     src/bench/run.sh solid 10
#     src/bench/run.sh react 10
#
# Needs a Release build of the canary installed once (`EXPO_PUBLIC_BENCH=solid pnpm release:ios`
# - the instrument polyfill is only in a bench bundle). After that, this bundles the chosen side,
# compiles it to Hermes bytecode as a release build would, swaps it into the installed app and
# launches it N times, printing each run's `[bench]` report from the simulator log.
#
# metro.config.js keys Metro's cache on `EXPO_PUBLIC_BENCH`, so switching sides needs no
# `--reset-cache`: one side's cached transform can never stand in for the other's.
set -euo pipefail
side=${1:?solid or react}
runs=${2:-5}
cd "$(dirname "$0")/../.."
root=$(cd ../.. && pwd)
hermesc=$(ls "$root"/node_modules/.pnpm/hermes-compiler@*/node_modules/hermes-compiler/hermesc/osx-bin/hermesc | head -1)
out=$(mktemp -d)
app=dev.solidnative.canary
sim=${SIM:-booted}  # a UDID keeps the run off any other booted simulator

EXPO_PUBLIC_BENCH=$side npx expo export:embed --platform ios --dev false --minify true \
  --entry-file src/main.solid.ts --bundle-output "$out/main.js" --assets-dest "$out/assets" >/dev/null
"$hermesc" -O -emit-binary -max-diagnostic-width=80 -out "$out/main.jsbundle" "$out/main.js" >/dev/null 2>&1
echo "bytecode: $(($(stat -f%z "$out/main.jsbundle") / 1024)) KB"
cp "$out/main.jsbundle" "$(xcrun simctl get_app_container "$sim" $app)/main.jsbundle"

for i in $(seq "$runs"); do
  xcrun simctl terminate "$sim" $app 2>/dev/null || true
  started=$(date '+%Y-%m-%d %H:%M:%S')
  xcrun simctl launch "$sim" $app >/dev/null
  sleep 5
  xcrun simctl spawn "$sim" log show --style compact --start "$started" \
    --predicate 'eventMessage CONTAINS "[bench]"' 2>/dev/null | grep -v predicate |
    grep -o '\[bench\].*' | tail -1
done
