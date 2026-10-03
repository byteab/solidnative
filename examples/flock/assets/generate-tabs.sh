#!/bin/bash
# Android tab bar icons: Lucide SVGs drawn white, so the bar tints them as template masks.
# iOS uses SF Symbols instead. `sips` rasterizes with macOS's own SVG renderer.
set -e
cd "$(dirname "$0")"
icons=../node_modules/lucide-static/icons
tmp=$(mktemp -d)
for pair in home:house explore:search notifications:bell profile:user; do
  name=${pair%%:*}; icon=${pair##*:}
  for scale in 1 2 3; do
    px=$((24 * scale)); suffix=$([ $scale = 1 ] && echo "" || echo "@${scale}x")
    sed "s/currentColor/white/g; s/width=\"24\"/width=\"$px\"/; s/height=\"24\"/height=\"$px\"/" \
      "$icons/$icon.svg" > "$tmp/icon.svg"
    sips -s format png "$tmp/icon.svg" --out "tab-$name$suffix.png" > /dev/null
  done
done
rm -rf "$tmp"
