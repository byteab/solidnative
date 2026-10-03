#!/bin/sh
# Five fresh processes per mode, 30 iterations each (first 3 dropped); each line is that run's median,
# MEDIAN lines are the median of the five.
# Usage: sh bench.sh <label> [modes]   -> writes <label>.log next to this script.
#   NODE_EXTRA="--no-opt --no-maglev --no-sparkplug"  interpreter only: closer to Hermes, which has no JIT on iOS.
#   REGISTER=<file>       swaps the loader (the "before" runs pointed it at pre-change builds).
cd "$(dirname "$0")"
out="$1.log"; : > "$out"
echo "# node $(node -v) NODE_EXTRA=${NODE_EXTRA:-} REGISTER=${REGISTER:-./register.mjs}" >> "$out"
for mode in ${2:-solid raw plain engine}; do
  for i in 1 2 3 4 5; do
    node --no-warnings --expose-gc $NODE_EXTRA --import "${REGISTER:-./register.mjs}" run.ts "$mode" 30 >> "$out"
  done
done
node -e '
const lines=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n");
const g={};for(const l of lines){const m=l.match(/^(\S+ \S+): ([\d.]+)ms ([\d.]+)MB/);if(!m)continue;(g[m[1]]??={ms:[],mb:[]});g[m[1]].ms.push(+m[2]);g[m[1]].mb.push(+m[3]);}
const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];
for(const[k,v]of Object.entries(g))console.log(`MEDIAN ${k}: ${med(v.ms).toFixed(1)}ms ${med(v.mb).toFixed(1)}MB  (runs ${v.ms.join(" ")})`);
' "$out" | tee -a "$out"
