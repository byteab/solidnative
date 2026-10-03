#!/usr/bin/env bash
# The renderer benchmark on the running Android emulator or a connected device - `run.sh` for
# Android.
#
#     src/bench/run-android.sh solid 5
#     src/bench/run-android.sh react 5
#
# Needs a Release build of the canary installed once
# (`EXPO_PUBLIC_BENCH=solid pnpm release:android`). A release APK carries its bundle inside the
# package rather than beside it, so where `run.sh` copies a file, this bundles the chosen side,
# compiles it to Hermes bytecode, puts it into a copy of the installed APK, re-signs that with the
# project's debug key (as the release variant already is) and installs it.
set -euo pipefail
side=${1:?solid or react}
runs=${2:-5}
cd "$(dirname "$0")/../.."
root=$(cd ../.. && pwd)
sdk=${ANDROID_HOME:-$HOME/Library/Android/sdk}
tools=$(ls -d "$sdk"/build-tools/* | tail -1)
adb="$sdk/platform-tools/adb"
hermesc=$(ls "$root"/node_modules/.pnpm/hermes-compiler@*/node_modules/hermes-compiler/hermesc/osx-bin/hermesc | head -1)
app=dev.solidnative.canary
out=$(mktemp -d)
# apksigner is Java; a JDK named by JAVA_HOME is enough, with or without one on the PATH.
[ -n "${JAVA_HOME:-}" ] && export PATH="$JAVA_HOME/bin:$PATH"

EXPO_PUBLIC_BENCH=$side npx expo export:embed --platform android --dev false --minify true \
  --entry-file src/main.solid.ts --bundle-output "$out/index.android.bundle" --assets-dest "$out/res" >/dev/null
mkdir -p "$out/assets"
"$hermesc" -O -emit-binary -out "$out/assets/index.android.bundle" "$out/index.android.bundle" \
  >/dev/null 2>&1
echo "bytecode: $(($(stat -f%z "$out/assets/index.android.bundle") / 1024)) KB"

"$adb" pull "$("$adb" shell pm path $app | sed 's/package://' | tr -d '\r')" "$out/base.apk" >/dev/null
(cd "$out" && zip -q base.apk assets/index.android.bundle)
"$tools/zipalign" -f 4 "$out/base.apk" "$out/aligned.apk"
"$tools/apksigner" sign --ks android/app/debug.keystore --ks-pass pass:android \
  --ks-key-alias androiddebugkey --key-pass pass:android --out "$out/signed.apk" "$out/aligned.apk"
"$adb" install -r "$out/signed.apk" >/dev/null

for i in $(seq "$runs"); do
  "$adb" shell am force-stop $app
  "$adb" logcat -c
  "$adb" shell am start -n $app/.MainActivity >/dev/null
  sleep 6
  "$adb" logcat -d -s ReactNativeJS | grep -o '\[bench\] [a-z]* |.*' | tail -1
done
