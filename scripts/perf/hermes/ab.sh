#!/usr/bin/env bash
# Hermes A/B: build the current tree to <label>.hbc and run it interleaved against other labels.
#   ab.sh build <label>            bundle the working tree as <label>
#   ab.sh run <mode> <rounds> <label>...   interleaved runs, medians per phase
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${HBC_DIR:-$here/out}
mkdir -p "$out"
if [ "$1" = build ]; then node "$here/build.mjs" "$here/entry.ts" "$out/$2.hbc" 2>&1 | grep -v -E 'warning|console|\^' || true; exit; fi
mode=$2 rounds=$3; shift 3
log=$(mktemp)
for r in $(seq "$rounds"); do for l in "$@"; do echo "$l $("$here/host" "$out/$l.hbc" "$mode" 13)" >> "$log"; done; done
node -e '
const lines=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n");const g={};
for(const l of lines){const label=l.split(" ")[0];for(const m of l.matchAll(/(\w+) ([\d.]+)ms ([\d.]+)MB/g)){((g[label]??={})[m[1]]??={ms:[],mb:[]});g[label][m[1]].ms.push(+m[2]);g[label][m[1]].mb.push(+m[3]);}}
const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];const labels=Object.keys(g);
console.log("phase".padEnd(11)+labels.map(l=>l.padStart(20)).join(""));
for(const p of Object.keys(g[labels[0]]))console.log(p.padEnd(11)+labels.map(l=>(med(g[l][p].ms).toFixed(2)+"ms "+med(g[l][p].mb).toFixed(2)+"MB").padStart(20)).join(""));
' "$log"
