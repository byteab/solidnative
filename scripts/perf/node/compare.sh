#!/bin/sh
# Interleaved A/B: before and after alternate process by process, so machine load hits both alike.
# Usage: BEFORE_REGISTER=<file> sh compare.sh <label> <mode> [runs]   (NODE_EXTRA as in bench.sh)
cd "$(dirname "$0")"
out="$1.log"; : > "$out"
echo "# node $(node -v) mode=$2 NODE_EXTRA=${NODE_EXTRA:-} before=${BEFORE_REGISTER}" >> "$out"
for i in $(seq 1 "${3:-7}"); do
  node --no-warnings --expose-gc $NODE_EXTRA --import "$BEFORE_REGISTER" run.ts "$2" 30 | sed 's/^/before /' >> "$out"
  node --no-warnings --expose-gc $NODE_EXTRA --import ./register.mjs run.ts "$2" 30 | sed 's/^/after /' >> "$out"
done
node -e '
const lines=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n");
const g={};for(const l of lines){const m=l.match(/^(\S+) (\S+ \S+): ([\d.]+)ms ([\d.]+)MB/);if(!m)continue;const k=m[2]+" "+m[1];(g[k]??={ms:[],mb:[]});g[k].ms.push(+m[3]);g[k].mb.push(+m[4]);}
const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];
for(const k of Object.keys(g).sort())console.log(`MEDIAN ${k}: ${med(g[k].ms).toFixed(1)}ms ${med(g[k].mb).toFixed(1)}MB  (runs ${g[k].ms.join(" ")})`);
' "$out" | tee -a "$out"
