#!/usr/bin/env bash
# Interleaved device A/B on the running Android emulator: installs each variant's APK in turn.
#   ab-android.sh <rounds> <log> label=bundle.hbc ...   (bundles from build.sh android)
set -euo pipefail
rounds=$1 log=$2; shift 2
sdk=${ANDROID_HOME:-$HOME/Library/Android/sdk}
tools=$(ls -d "$sdk"/build-tools/* | tail -1)
adb="$sdk/platform-tools/adb" app=dev.solidnative.canary
canary=$(cd "$(dirname "$0")/../../examples/canary" && pwd)
[ -n "${JAVA_HOME:-}" ] && export PATH="$JAVA_HOME/bin:$PATH"
work=$(mktemp -d)
base=${BASE_APK:-$work/base.apk}
[ -f "$base" ] || "$adb" pull "$("$adb" shell pm path $app | sed 's/package://' | tr -d '\r' | head -1)" "$base" >/dev/null
for pair in "$@"; do
  label=${pair%%=*} file=${pair#*=}
  mkdir -p "$work/$label/assets"; cp "$file" "$work/$label/assets/index.android.bundle"
  cp "$base" "$work/$label/base.apk"
  (cd "$work/$label" && zip -q base.apk assets/index.android.bundle)
  "$tools/zipalign" -f 4 "$work/$label/base.apk" "$work/$label/aligned.apk"
  "$tools/apksigner" sign --ks "$canary/android/app/debug.keystore" --ks-pass pass:android \
    --ks-key-alias androiddebugkey --key-pass pass:android --out "$work/$label.apk" "$work/$label/aligned.apk"
done
for r in $(seq "$rounds"); do
  for pair in "$@"; do
    label=${pair%%=*}
    "$adb" install -r "$work/$label.apk" >/dev/null
    "$adb" shell am force-stop $app; "$adb" logcat -c
    "$adb" shell am start -n $app/.MainActivity >/dev/null
    line=
    for _ in $(seq 40); do
      sleep 0.5
      line=$("$adb" logcat -d -s ReactNativeJS | grep -o '\[bench\] [a-z]* |.*' | tail -1 || true)
      [ -n "$line" ] && break
    done
    echo "$label $line" | tee -a "$log"
  done
done
node "$(dirname "$0")/summarize.mjs" "$log"
