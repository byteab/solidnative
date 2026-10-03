#!/usr/bin/env bash
# Installs a canary simulator build on a simulator of its own and runs the release smoke flow
# against it.
#
#     examples/canary/scripts/smoke-ios.sh <canary.app> <output dir>
#
# The iOS twin of smoke-android.sh. The app is a Release build for the simulator, which carries
# its bundle and needs no Metro. The simulator is created here, from the newest iPhone and iOS
# runtime installed, and deleted afterwards, so a run never meets another app's state or a
# simulator someone else is using. The output dir gets Maestro's screenshots and logs, and the
# app's log, which is where a release build's crash at startup is written.
set -uo pipefail

app=$1
out=$2
flows="$(dirname "$0")/../.maestro/release"
mkdir -p "$out"

# The newest runtime's first iPhone: every runtime ships a set of devices made for it.
read -r runtime type < <(xcrun simctl list devices available -j | jq -r '
  .devices | to_entries | map(select(.key | test("iOS"))) | sort_by(.key) | last
  | "\(.key) \(.value | map(select(.name | startswith("iPhone"))) | first | .deviceTypeIdentifier)"')
if [ -z "${runtime:-}" ] || [ -z "${type:-}" ] || [ "$type" = null ]; then
  echo "No iOS runtime with an iPhone simulator found (or jq is missing): see xcrun simctl list" >&2
  exit 1
fi
udid=$(xcrun simctl create canary-smoke "$type" "$runtime") || exit 1
trap 'xcrun simctl shutdown "$udid" 2>/dev/null; xcrun simctl delete "$udid"' EXIT

xcrun simctl boot "$udid" && xcrun simctl bootstatus "$udid" -b >/dev/null || exit 1
xcrun simctl install "$udid" "$app" || exit 1
# Maestro drives the simulator through an XCTest runner of its own, which a loaded CI Mac has
# been slow to start and has lost mid-flow. Both say nothing about the app, which a crash would
# fail by what it no longer shows: so the runner gets longer to start, and when it did not start
# or was lost, the flow is walked once more from the start. Its console is kept, since the
# startup failure is reported there and not in maestro.log.
export MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}
walk() {
  mkdir -p "$1"
  maestro --device "$udid" test "$flows" --test-output-dir "$1" --debug-output "$1" \
    --flatten-debug-output 2>&1 | tee "$1/console.log"
  return "${PIPESTATUS[0]}"
}
walk "$out"
status=$?
lost='DeviceUnreachableException|IOSDriverTimeoutException'
if [ "$status" -ne 0 ] && grep -qE "$lost" "$out/console.log" "$out/maestro.log" 2>/dev/null; then
  echo "Maestro lost its driver, not the app: walking the flow again" >&2
  walk "$out/retry"
  status=$?
fi
xcrun simctl spawn "$udid" log show --last 15m --style compact \
  --predicate 'process == "canary"' > "$out/canary.log" 2>&1
exit "$status"
