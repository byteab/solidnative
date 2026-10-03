#!/usr/bin/env bash
# Installs a canary APK on the booted emulator and runs the release smoke flow against it.
#
#     examples/canary/scripts/smoke-android.sh <apk> <output dir>
#
# CI runs this inside the emulator step, which runs each line of its script as a shell of its own,
# so the sequence lives here. The output dir gets Maestro's screenshots and logs, and the device
# log, which is where a release build's crash at startup is written.
set -uo pipefail

apk=$1
out=$2
flows="$(dirname "$0")/../.maestro/release"

mkdir -p "$out"
adb install -r "$apk" || exit 1
maestro test "$flows" --test-output-dir "$out" --debug-output "$out" --flatten-debug-output
status=$?
adb logcat -d > "$out/logcat.txt"
exit "$status"
