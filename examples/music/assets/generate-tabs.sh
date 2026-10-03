#!/bin/bash
set -e
cd "$(dirname "$0")"

make_icon() {
  glyph=$1; name=$2; scale=$3
  size=$((24 * scale))
  fontsize=$((size * 65 / 100))
  ffmpeg -y -loglevel error -f lavfi -i "color=c=black@0:s=${size}x${size}" \
    -vf "drawtext=fontfile=/System/Library/Fonts/Apple Symbols.ttf:text=${glyph}:fontsize=${fontsize}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
    -frames:v 1 "${name}.png"
}

make_icon "♫" tab-library 1
make_icon "♫" tab-library@2x 2
make_icon "♫" tab-library@3x 3
make_icon "⚙" tab-settings 1
make_icon "⚙" tab-settings@2x 2
make_icon "⚙" tab-settings@3x 3
