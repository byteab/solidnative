#!/bin/bash
set -e
cd "$(dirname "$0")"

gen() {
  name=$1; f1=$2; f2=$3; dur=$4
  fadeout=$((dur - 1))
  ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=$f1:duration=$dur" -f lavfi -i "sine=frequency=$f2:duration=$dur" \
    -filter_complex "[0:a][1:a]amix=inputs=2:weights='1 0.5'[mixed];[mixed]afade=t=in:st=0:d=0.6,afade=t=out:st=$fadeout:d=1,volume=0.5[out]" \
    -map "[out]" -ac 1 -ar 44100 -c:a aac -b:a 64k "$name.m4a"
}

gen drift-1 220 330 8
gen drift-2 246.94 370 8
gen drift-3 196 294 8
gen tide-1 261.63 392 8
gen tide-2 293.66 440 8
gen tide-3 277.18 415.3 8
gen ember-1 329.63 493.88 8
gen ember-2 349.23 523.25 8
gen ember-3 311.13 466.16 8
gen nocturne-1 174.61 261.63 8
gen nocturne-2 164.81 246.94 8
gen nocturne-3 185 277.18 8
