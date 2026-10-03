#!/usr/bin/env bash
# Bundle the canary bench from the current working tree to Hermes bytecode.
#   build.sh ios|android solid|react|signals <out-file>
set -euo pipefail
platform=$1 side=$2 dest=$(cd "$(dirname "$3")" && pwd)/$(basename "$3")
cd "$(dirname "$0")/../../examples/canary"
root=$(cd ../.. && pwd)
hermesc=$(ls "$root"/node_modules/.pnpm/hermes-compiler@*/node_modules/hermes-compiler/hermesc/osx-bin/hermesc | head -1)
out=$(mktemp -d)
EXPO_PUBLIC_BENCH=$side npx expo export:embed --platform "$platform" --dev false --minify true \
  --entry-file src/main.solid.ts --bundle-output "$out/main.js" --assets-dest "$out/assets" >/dev/null 2>&1
"$hermesc" -O -emit-binary -out "$dest" "$out/main.js" >/dev/null 2>&1
echo "$dest: $(($(stat -f%z "$dest") / 1024)) KB"
