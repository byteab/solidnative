# Mount performance

Branch `perf/mount-styles`, October 2026. Goal: Solid mounting as fast as React, or faster. Builds on
[performance.md](performance.md), which has the harness and earlier work.

**Verdict.** On mount, Solid's total time is now level with React's (2% behind on iOS, 2% ahead on
Android), with renderer JavaScript 2 ms behind. It wins on append and on every update phase, and still loses on replace (iOS) and
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
| mount      | 14.2 (51.2) | 16.0 (52.3)     | 14.1 (71.0)   | 16.3 (69.6)     |
| replace    | 28.2 (76.4) | 38.0 (78.4)     | 14.9 (65.1)   | 21.1 (64.5)     |
| update10th | 15.4 (20.9) | **3.2 (9.5)**   | 13.6 (20.9)   | **1.8 (10.2)**  |
| select     | 21.7 (25.3) | **2.7 (10.1)**  | 19.2 (23.0)   | **1.0 (5.3)**   |
| append     | 45.5 (86.7) | **34.5 (77.3)** | 34.2 (81.8)   | **22.9 (64.7)** |
| clear      | 7.4 (10.2)  | 15.1 (16.7)     | 1.6 (6.9)     | 5.6 (10.5)      |

## What worked

| change                                                    | where                          | measured                                                      |
| --------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| Flatten each style object once; cache style names, values | `platform/src/solid/styles.ts` | device renderer mount -6% iOS, -12% Android; replace -10% iOS |
| Memoize custom-property scopes by identity                | `fabric/src/css.ts`            | Tailwind mount 50 -> 35 ms (headless)                         |
| Check a rule's parent class before its position test      | `fabric/src/css.ts`            | with the next two, Tailwind mount 35 -> 18 ms                 |
| Re-mark only siblings whose position a selector read      | `fabric/src/engine.ts`         | Tailwind remove 24 -> 11 ms, select by class 21 -> 0.4 ms     |
| Keep a node's answer when it matches as before            | `fabric/src/css.ts`            | Tailwind remove 11 -> 1.7 ms, append 30 -> 19 ms              |
| Merge props in one pass for nodes no CSS reaches          | `fabric/src/engine.ts`         | headless mount -4.7%, replace -3.5%; iOS sim within noise     |
| Literal props made with the element, compiled at build    | `metro/solid-lower.cjs`        | see below                                                     |

**Static props at build time.** A lowered View or Text's literal attributes, a literal style
among them, go into one module-level object, the style flattened and its numbers parsed as the
platform would, which `createElement` copies into the node: no `setProp` apiece and no style
flatten per node. Colours stay converted at run time, through the engine's cache, since only the
host's `processColor` knows their native form. The bench's only literal per row is Text's
`accessible`: headless mount -3%, replace -3%; device mount within noise, Android replace -8%,
append -7%. With a literal label style per row instead of a shared one, headless mount drops 11.6
-> 10.2 ms (-12%), faster than the shared style it replaces.

The four CSS changes matter only under a sheet, and the canary's device bench has none. Headless,
a global Tailwind sheet made an inline-styled mount 4.3x slower (11.6 -> 49.9 ms). It is now 18 ms.
Class-styled rows are 36 ms, against 12 ms for inline styles with no sheet.

## Tried and not kept

- **One cleanup per owner instead of a closure per node** (`ownNode`): 0.09 MB less, no faster.
- **Batched removals for replace.** O(1) removal (order ignored) bounds the gain at 0.84 ms of a
  13.5 ms headless replace. Hermes's native `splice` is the fast way to shift: a JS loop costs
  +4.6 ms, `copyWithin` +5.7 ms. Deferring the shift needs every reader of `children` to see it,
  and a getter on `children` costs +0.4 ms on mount and +0.7 ms on replace by itself.
- **A C++ commit path:** measured earlier ([performance.md](performance.md)); at most ~2 ms of a
  61 ms mount.

## Next, for inline styles

Tailwind is set aside for now; these target inline-styled views.

1. **Done: engine fast path** (`plainProps`). Smaller than the ~18% the merge steps cost, because
   most of their work was the copying, which a node still needs once. The table above includes it.
2. **Done: static props at build time** (above).
3. **Done, not kept: batched removals** (above).
4. **Clear on device, profiled.** Not GC: Hermes counts no collection during it. Of a 13 ms iOS
   clear, the synchronous `setRows([])` is 9-13 ms, engine removals 1 ms, flush and commit 2.5 ms.
   Runs vary 3.5-13.6 ms with every part scaling together, removals and commit included, so the
   spread is the CPU after the bench's 400 ms idle, not a slow path. What is left is Solid's
   teardown of each row's owner (`cleanNode`), then `createSelector`'s per-row cleanup and the
   platform's `drop`.
5. **`createSelector`, measured: not worth replacing.** Rows reading `selected()` directly, no
   selector at all, mount 0.09 ms faster of 10.6 headless (0.37 MB less), so a lighter selector
   cannot move mount time. Clear is no faster without it either (2.76 vs 2.73 ms).
6. **Android small updates, measured.** Our commit sends what React's does: on label1 one clone
   with `{text}` (React makes a new text node), the same three clones up the tree and ~1003
   `appendChild`. Most of the Fabric gap is the CPU, not the calls: React's 17 ms of renderer work
   warms it, Solid reaches Fabric 2 ms after the bench's 400 ms idle. A 15 ms spin before each
   Solid step brings swap's Fabric time to React's (12.7 vs 12.9 ms) and label1's from 7.4 to 5.6
   (React 3.6). What remained: the same ~1000 `appendChild` calls took 2.5 ms for Solid and 1.0
   for React.
7. **That `appendChild`, profiled natively: not ours.** A callstack profile of the emulator
   (simpleperf; Perfetto's sampler lost the freshly forked app) shows the same Fabric code on
   both sides: each row appended to a new page revision is cloned (`adoptYogaChild` ->
   `ShadowNode::clone`), because its Yoga node is still owned by the previous page. React pays it
   too, and passes the same handles in the same order: the call sequences match but for the raw
   text, which React creates and Solid clones. The gap follows the clock, not the step: with
   select and label1 swapped, label1 at 1.2 s appends in 1.4 ms (React 1.5) and select at 1.6 s
   takes 5.0 ms, its commit 8.8 instead of 3.7. The instrument now reports `append`.

## Later, for Tailwind

- **Compile static classes at build time.** A fixed class string with no state, media or position
  selectors becomes a style object in the Metro transform and skips the cascade (NativeWind's
  approach).
- **Memoize the cascade by class set.** Rows sharing classes cascade once per list.

## Measuring

- Headless Hermes: `scripts/perf/hermes/ab.sh` modes `signals`, `twinline` (signals bench under a
  global Tailwind sheet) and `twclass` (rows styled by class).
- Device: `scripts/perf/build.sh`, then `ab-ios.sh` / `ab-android.sh`, on a Release canary.
