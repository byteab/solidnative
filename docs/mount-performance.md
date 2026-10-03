# Mount performance

Branch `perf/mount-styles`, October 2026. Goal: Solid mounting as fast as React, or faster. Builds on
[performance.md](performance.md), which has the harness and earlier work.

**Verdict.** On mount, Solid's total time is now within 1-3% of React's, with renderer JavaScript
2-3 ms behind. It wins on append and on every update phase, and still loses on replace (iOS) and
clear. The rest of the gap is this project's renderer layers (the platform's style handling and the
engine's prop merge and CSS cascade), not Solid.

## Where mount time goes

Headless Hermes profile, signals bench, 1000 rows, no CSS sheet:

| layer                                                      | share of mount |
| ---------------------------------------------------------- | -------------- |
| engine (commit: prop merge, cascade, transitions, colours) | ~42%           |
| platform (style copy 14%, renderer, `setProperty`)         | ~27%           |
| Solid core (a third of it is `createSelector`)             | ~20%           |
| `solid-js/universal`                                       | ~2.5%          |

## Against React, after this work

Device, Release, interleaved launches, 10 rounds each. Renderer JavaScript ms (total ms):

| phase      | iOS React   | iOS Solid       | Android React | Android Solid   |
| ---------- | ----------- | --------------- | ------------- | --------------- |
| mount      | 15.0 (53.9) | 17.2 (55.3)     | 13.8 (73.7)   | 17.0 (74.2)     |
| replace    | 22.3 (61.6) | 39.3 (81.7)     | 17.1 (65.4)   | 21.4 (63.9)     |
| update10th | 15.2 (21.0) | **1.4 (7.6)**   | 15.3 (23.0)   | **2.0 (12.1)**  |
| select     | 19.7 (22.3) | **2.6 (9.9)**   | 23.4 (27.5)   | **4.1 (8.4)**   |
| append     | 43.3 (86.6) | **33.9 (78.6)** | 45.8 (90.5)   | **29.1 (74.6)** |
| clear      | 6.2 (8.9)   | 13.8 (14.7)     | 1.4 (6.3)     | 5.0 (10.1)      |

## What worked

| change                                                    | where                          | measured                                                      |
| --------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| Flatten each style object once; cache style names, values | `platform/src/solid/styles.ts` | device renderer mount -6% iOS, -12% Android; replace -10% iOS |
| Memoize custom-property scopes by identity                | `fabric/src/css.ts`            | Tailwind mount 50 -> 35 ms (headless)                         |
| Check a rule's parent class before its position test      | `fabric/src/css.ts`            | with the next two, Tailwind mount 35 -> 18 ms                 |
| Re-mark only siblings whose position a selector read      | `fabric/src/engine.ts`         | Tailwind remove 24 -> 11 ms, select by class 21 -> 0.4 ms     |
| Keep a node's answer when it matches as before            | `fabric/src/css.ts`            | Tailwind remove 11 -> 1.7 ms, append 30 -> 19 ms              |
| Merge props in one pass for nodes no CSS reaches          | `fabric/src/engine.ts`         | headless mount -4.7%, replace -3.5%; iOS sim within noise     |

The four CSS changes matter only under a sheet, and the canary's device bench has none. Headless,
a global Tailwind sheet made an inline-styled mount 4.3x slower (11.6 -> 49.9 ms). It is now 18 ms.
Class-styled rows are 36 ms, against 12 ms for inline styles with no sheet.

## Tried and not kept

- **One cleanup per owner instead of a closure per node** (`ownNode`): 0.09 MB less, no faster.
- **A C++ commit path:** measured earlier ([performance.md](performance.md)); at most ~2 ms of a
  61 ms mount.

## Next, for inline styles

Tailwind is set aside for now; these target inline-styled views.

1. **Done: engine fast path** (`plainProps`). Smaller than the ~18% the merge steps cost, because
   most of their work was the copying, which a node still needs once. Android device numbers
   pending: the emulator degraded mid-run (every phase 5-7x slower, React's too).
2. **Static props merged at build time.** `solid-lower.cjs` already rewrites templates. Merge a
   template element's static props and literal styles once, normalized and colour-converted, so a
   node lays only its dynamic props over a copy. This is how Solid's DOM renderer beats React, and
   the likeliest way past parity.
3. **Replace is O(n²).** Universal removes old rows from the front, one `splice` each (5.5% of
   replace). Batch the removals in the engine, with every reader of `children` seeing the batch.
4. **Clear on device.** Renderer clear is 13.8 ms on iOS but 2.7 ms headless, where GC runs
   before each phase. Profile on device before changing teardown.
5. **`createSelector`.** Allocates a `Set`, a map entry and a closure per row, ~10% of the bench's
   mount. A lighter platform selector, or Solid 2.0's core.
6. **Android small updates.** Fabric time on label1 and swap is 2-3x React's for the same change:
   find out what our commit sends.

## Later, for Tailwind

- **Compile static classes at build time.** A fixed class string with no state, media or position
  selectors becomes a style object in the Metro transform and skips the cascade (NativeWind's
  approach).
- **Memoize the cascade by class set.** Rows sharing classes cascade once per list.

## Measuring

- Headless Hermes: `scripts/perf/hermes/ab.sh` modes `signals`, `twinline` (signals bench under a
  global Tailwind sheet) and `twclass` (rows styled by class).
- Device: `scripts/perf/build.sh`, then `ab-ios.sh` / `ab-android.sh`, on a Release canary.
