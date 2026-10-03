#!/usr/bin/env bash
# Drive the booted simulator with idb. Keeps the incantations in one place.
#
#   scripts/sim.sh reset             restart idb's companion (do this after a Simulator restart)
#   scripts/sim.sh reload            reload the canary in Expo Go
#   scripts/sim.sh shot [out.png]    screenshot
#   scripts/sim.sh tree              accessibility tree, one line per element
#   scripts/sim.sh tap X Y           tap at a point (points, not pixels)
#   scripts/sim.sh type "text"       type into the focused field
#   scripts/sim.sh swipe X1 Y1 X2 Y2 drag, for scrolling
#
# The simulator must have its hardware keyboard disabled for the software one to appear:
#   defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
# then restart Simulator.
#
# What these cannot tell you:
# - A synthetic tap is instantaneous and perfectly still; a thumb travels twenty points or more on
#   a large control. When a report does not reproduce with `tap`, reproduce the movement with a
#   short `swipe` instead: a press-cancel threshold once passed every automated tap and failed for
#   people.
# - idb cannot synthesise a screen-edge pan UIKit accepts, so the swipe-back gesture is unverified
#   by tooling.
# - A screenshot takes about half a second, so a burst of them across a 350ms transition shows only
#   the before and after, which looks exactly like no animation at all. For "did it scroll", bind
#   `(scroll)` and log the offset rather than comparing screenshots: anything animating on screen
#   makes every pair of frames differ.
set -euo pipefail

udid() { xcrun simctl list devices booted -j | python3 -c "import json,sys; d=json.load(sys.stdin)['devices']; print([x['udid'] for v in d.values() for x in v if x['state']=='Booted'][0])"; }
U="$(udid)"

case "${1:-}" in
  reset)
    # idb caches a companion per device; it goes stale when the simulator restarts and then
    # every tap silently succeeds while doing nothing at all.
    idb kill >/dev/null 2>&1 || true
    pkill -f idb_companion >/dev/null 2>&1 || true
    echo "companion reset" ;;
  reload)
    xcrun simctl terminate booted host.exp.Exponent >/dev/null 2>&1 || true
    xcrun simctl openurl booted "exp://127.0.0.1:8081" ;;
  shot)  xcrun simctl io booted screenshot "${2:-/tmp/sim.png}" >/dev/null 2>&1; echo "${2:-/tmp/sim.png}" ;;
  tree)
    idb ui describe-all --udid "$U" | python3 -c "
import json, sys
for e in json.load(sys.stdin):
    f = e.get('frame', {})
    label = e.get('AXLabel') or e.get('AXValue') or ''
    print(f\"{e.get('type',''):<15} {str(label)[:32]:<34} \"
          f\"centre=({round(f.get('x',0)+f.get('width',0)/2)},{round(f.get('y',0)+f.get('height',0)/2)})\")
" ;;
  tap)   idb ui tap --udid "$U" "$2" "$3" ;;
  type)  idb ui text --udid "$U" "$2" ;;
  swipe) idb ui swipe --udid "$U" "$2" "$3" "$4" "$5" ;;
  *)     sed -n '2,16p' "$0" ; exit 1 ;;
esac
