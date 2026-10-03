# Performance

Measured on the canary benchmark (`examples/canary/src/bench`): 1000 rows, the
js-framework-benchmark operations, Release builds, Hermes bytecode, medians of interleaved
launches. Two Solid screens are measured: **signals** (rows in a signal, a signal per label,
`createSelector`) and **store** (`createStore` + `reconcile`).

## Results

Total / renderer (all JavaScript) ms. Fabric's own time, the rest of the total, is the same for
every side.

| phase      | iOS React   | iOS Solid signals | Android React | Android Solid signals |
| ---------- | ----------- | ----------------- | ------------- | --------------------- |
| mount      | 61.4 / 16.7 | 64.3 / 20.6       | 72.8 / 13.6   | 75.3 / 18.5           |
| replace    | 57.7 / 17.1 | 67.3 / 26.5       | 62.0 / 15.1   | 69.4 / 21.9           |
| update10th | 19.5 / 13.5 | 6.9 / 1.2         | 14.1 / 8.5    | 6.3 / 1.1             |
| select     | 17.8 / 15.8 | 6.9 / 1.8         | 17.8 / 15.0   | 4.5 / 2.2             |
| swap       | 20.2 / 17.9 | 9.0 / 3.1         | 21.8 / 14.5   | 15.4 / 2.4            |
| append     | 75.1 / 33.5 | 69.1 / 27.0       | 68.2 / 26.9   | 59.0 / 22.1           |
| clear      | 7.0 / 4.5   | 12.0 / 10.9       | 5.5 / 1.1     | 8.0 / 3.8             |
| MB, mount  | 7.2         | 7.6               | 4.5           | 4.8                   |

- With signals, Solid mounts within 3-5% of React, appends 8-13% faster and runs every update
  phase in about a third of React's time.
- It is behind on `replace` and `clear`, where Solid disposes the old rows' reactive graph. Part of
  `clear` is a per-node cleanup that releases a detached subtree's native handles (a router pop
  needs it), so that cost is kept.
- The store screen is 13-44% faster than before this work but still slower than React on creation;
  about a fifth of its mount is `solid-js/store` itself.

## What made it faster

- **Build-time lowering.** A `<View>` or `<Text>` whose attributes the component would forward
  unchanged compiles straight to the intrinsic it renders (`packages/metro/solid-lower.cjs`). Mount
  -32%. Off with `transformSolid(..., { lowerPrimitives: false })`.
- **Sibling index hints** make `nextSibling` and removal O(1) instead of a scan.
- **Lifetimes on demand.** A node gets a `NodeLifetime` only when it gains a listener, a native
  resource or class styling; otherwise it keeps just its owner and one cleanup.
- **Colours converted once**, where props are merged, through a 512-entry cache.
- **Store styles read untracked**, instead of subscribing to every key of every style.

## Tried and not kept

- **A C++ commit path** ([symbiote-native](https://github.com/OneEyed1366/symbiote-native)'s command
  buffer, C++ tree and `RawProps(folly::dynamic)`). Measured instead of built: handing every
  `createNode` one shared `{}` bounds it at about 2 ms of a 61 ms iOS mount and 5.5 of 75 on
  Android. The rest of Fabric's time is ShadowNode construction and `completeRoot` layout, which
  React pays too. Moving the engine's walk to C++ does not help either: `mergeProps` and the CSS
  cascade are JS work, and getting props into C++ is the same JSI crossing.
- **Native cell handles** (a C++ TurboModule keeping handle identity across clones so ancestors
  re-clone lazily). Cut JSI calls for a one-row update from 1009 to 3, but was only about 1 ms
  faster on small updates and up to 8 ms slower on Android appends.
- Slimmer node objects, passing styles through uncopied, `textContent` for `<Text>{expr}</Text>`,
  hoisting literal style objects: flat or worse on Hermes.

## Running it

The harness is in `scripts/perf/`.

- `build.sh ios|android solid|signals|react <out.hbc>` bundles the canary bench and compiles it to
  Hermes bytecode.
- `ab-ios.sh <rounds> <log> label=bundle ...` runs interleaved launches on the booted simulator;
  `ab-android.sh` does the same on the emulator. `summarize.mjs <log>` prints the medians.
- `hermes/` runs the bench headless on the app's own Hermes VM, about a second a run, tracking the
  simulator closely. `ab.sh build <label>`, then `ab.sh run <mode> <rounds> <label>...`. Build its
  host once (after `pod install` in the canary):

  ```sh
  D=examples/canary/ios/Pods/hermes-engine/destroot
  J=examples/canary/node_modules/react-native/ReactCommon/jsi
  clang++ -std=c++20 -O2 -I$D/include -I$J host.cpp $J/jsi/jsi.cpp \
    -F$D/Library/Frameworks/macosx -framework hermesvm -Wl,-rpath,$D/Library/Frameworks/macosx -o host
  ```

- `node/` runs the store screen under Node against the fake Fabric (`node/bench.sh <label>`).
