#!/usr/bin/env bash
# The renderer benchmark on a physical iPhone - `run.sh` for real hardware.
#
#     src/bench/run-device.sh solid 5 <device-id> <team-id>
#     src/bench/run-device.sh react 5 <device-id> <team-id>
#
# `xcrun devicectl list devices` gives the device's identifier; the team is the `OU` of your
# Apple Development certificate. A device app cannot have its bundle swapped the way a simulator's
# can, since the app is signed as a whole, so this builds a signed Release for the chosen side:
# the first build is long, a second only re-bundles and re-signs. The report comes back through a
# file (`saveReport`), because a device's JavaScript log is not something `devicectl` can stream.
set -euo pipefail
side=${1:?solid or react}
runs=${2:-5}
device=${3:?device identifier, from xcrun devicectl list devices}
team=${4:?development team id}
cd "$(dirname "$0")/../.."
app=dev.solidnative.canary
out=$(mktemp -d)

EXPO_PUBLIC_BENCH=$side xcodebuild -workspace ios/canary.xcworkspace -scheme canary \
  -configuration Release -destination 'generic/platform=iOS' -derivedDataPath /tmp/canary-device \
  DEVELOPMENT_TEAM="$team" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates build >"$out/build.log" 2>&1 ||
  { grep -E 'error:' "$out/build.log" | head; exit 1; }
xcrun devicectl device install app --device "$device" \
  /tmp/canary-device/Build/Products/Release-iphoneos/canary.app >/dev/null

for i in $(seq "$runs"); do
  xcrun devicectl device process launch --device "$device" --terminate-existing $app >/dev/null
  sleep 7
  xcrun devicectl device copy from --device "$device" --domain-type appDataContainer \
    --domain-identifier $app --source Documents/bench.txt --destination "$out/bench.txt" >/dev/null
  cat "$out/bench.txt"
  echo
done
