# Mount performance

Branch `perf/mount-styles`, October 2026. Goal: Solid mounting as fast as React, or faster. Builds on
[performance.md](performance.md), which has the harness and earlier work.

**Verdict.** On mount, Solid's total time is level with React's (iOS 52.9 vs 52.8 ms, Android 2%
behind), with renderer JavaScript 2 ms behind. It wins on append and on every update phase, and
still loses on replace's renderer time (iOS) and on clear. Ranked proposals that close clear and
most of replace are at the end. The rest of the gap is this project's
renderer layers (the platform's style handling and the engine's prop merge and CSS cascade), not
Solid.

## Where mount time goes

Headless Hermes profile, signals bench, 1000 rows, no CSS sheet:

| layer                                                      | share of mount |
| ---------------------------------------------------------- | -------------- |
| engine (commit: prop merge, cascade, transitions, colours) | ~42%           |
| platform (style copy 14%, renderer, `setProperty`)         | ~27%           |
| Solid core (a third of it is `createSelector`)             | ~20%           |
| `solid-js/universal`                                       | ~2.5%          |

## Against React, after this work

Device, Release, interleaved launches, 10 rounds each, both sides spinning the CPU 15 ms before
every phase (`beginPhase`). Renderer JavaScript ms (total ms):

| phase      | iOS React   | iOS Solid       | Android React | Android Solid   |
| ---------- | ----------- | --------------- | ------------- | --------------- |
| mount      | 13.6 (52.8) | 15.6 (52.9)     | 13.1 (73.3)   | 15.6 (74.8)     |
| replace    | 23.3 (68.0) | 29.5 (67.6)     | 14.2 (60.0)   | 18.5 (62.7)     |
| update10th | 13.6 (19.1) | **1.3 (8.3)**   | 12.5 (19.1)   | **1.4 (8.4)**   |
| select     | 15.8 (18.0) | **1.3 (4.5)**   | 17.2 (20.6)   | **1.0 (5.6)**   |
| append     | 36.8 (76.2) | **27.4 (68.6)** | 37.8 (81.2)   | **22.8 (62.7)** |
| clear      | 4.4 (6.0)   | 8.4 (9.5)       | 1.3 (5.7)     | 4.4 (8.9)       |

Without the spin, a step after the 400 ms idle reached Fabric on a cooled core unless the
renderer's own work had warmed it, which favoured React on small updates (item 6 below). With it,
React's renderer time drops 2-6 ms on iOS updates and replace (28.2 -> 23.3); Solid's replace drops
38.0 -> 29.5. Android label1 still lands in a slow moment 1.6 s in (item 7).

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
| Use a style already in native form as it stands           | `platform/src/solid/styles.ts` | headless mount, replace, append -4%; iOS renderer -3 to -7%   |
| Literal props on raw `<view>`/`<text>` too, unless spread | `metro/solid-lower.cjs`        | with a literal style per row: headless mount -7%, replace -5% |

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
8. **iOS replace, split.** Of Solid's renderer replace (timed inside the bench), new-row creation
   is 8.8 ms, as on mount, old-row teardown 2.0, `insert`'s removals and insertions 1.8, and row
   data plus the commit the rest. The simulator runs replace in two modes, 20 ms or 31 ms, with
   every part scaling together; React does too (14 or 23). On Hermes, creation is 43% of replace,
   commit 28%, insert 11%, teardown 5%, and a sixth of creation is young-generation GC. Each row
   builds its own style object, so the per-object flatten cache missed on every row and copied
   and cached each one; a style already in native form is now used as it stands (table above).
   Android mount -4%, replace and append within noise.
9. **Statics for raw intrinsics.** `<view>` and `<text>` written directly now get the same
   build-time statics, when no attribute is a spread. Headless, the raw fixture with a literal
   label style mounts 10.2 -> 9.5 ms, replaces 13.2 -> 12.6, appends 11.2 -> 10.6; with no literal,
   the output is unchanged. The canary's shop screen renders the same on Android.

## Later, for Tailwind

- **Compile static classes at build time.** A fixed class string with no state, media or position
  selectors becomes a style object in the Metro transform and skips the cascade (NativeWind's
  approach).
- **Memoize the cascade by class set.** Rows sharing classes cascade once per list.

## Proposals to reach React, ranked

October 2026, after item 9. Each prototype is a commit on `perf/mount-proposals`; 1 and 2 are
now implemented here (below). Device numbers are interleaved launches (iOS 12 rounds, Android 10)
of React, the branch head and each variant, with renderer JavaScript ms.

| #   | proposal                               | iOS mount, replace, clear | Android mount, replace, clear | status          |
| --- | -------------------------------------- | ------------------------- | ----------------------------- | --------------- |
|     | React                                  | 13.4, 23.2, 3.8-4.9       | 13.1, 14.7, 1.3               |                 |
|     | head                                   | 14.5, 28.5, 8.0           | 15.1, 19.2, 4.4               |                 |
| 1   | dispose removed rows after the commit  | 15.7, 26.6, **1.8**       | 14.8, 16.6, **1.1**           | measured, take  |
| 2   | share merged props by (statics, style) | 14.4, 28.0, =             | 15.0, 18.1, =                 | measured, take  |
| 3   | fold a row's text into its prop effect | 14.9, 27.3, =             | 15.3, 18.3, =                 | measured, maybe |
|     | 1 + 2                                  | 14.5, 25.9, 2.5           | 15.0, 16.0, 1.1               | measured, take  |
|     | 1 + 2 + 3                              | 14.4, **25.2**, **2.5**   | 14.8, **15.5**, **1.0**       |                 |

Row 1 is from its own run, against head at 14.5, 28.6, 7.8 (iOS) and 15.2, 18.3, 4.4 (Android);
mount does not run the code it changes, and is 14.4 in the combined run. The 1 + 2 row is from a
later run (head 14.0, 28.5, 8.3 on iOS; 15.2, 18.5, 4.2 on Android). With all three, Solid clears
faster than React on both platforms (total 3.9 vs 6.3 ms on iOS, 5.6 vs 6.1 on Android) and
replaces within 0.8-2 ms of it. Mount stays 1-1.7 ms behind.

**Implemented: 1 and 2.** The platform's `For` (`platform/src/solid/for.ts`) and the engine's
shared props (`plainProps`), each run against React and head in one session:

| phase   | iOS React | iOS head | iOS 1 + 2 | Android React | Android head | Android 1 + 2 |
| ------- | --------- | -------- | --------- | ------------- | ------------ | ------------- |
| mount   | 13.6      | 15.1     | 15.0      | 13.5          | 15.2         | 15.2          |
| replace | 21.9      | 25.6     | 25.5      | 15.1          | 18.5         | 16.8          |
| clear   | 2.9       | 6.6      | **2.4**   | 1.3           | 4.2          | 1.4           |

That iOS run caught the simulator in its fast mode for replace (head 25.6, against 28.5-28.9 in the
other runs); in the previous one the first version of the implementation took replace from 28.9
to 26.3 ms and clear from 8.4 to 4.1. Select reads 2-4 ms slower on iOS with it, and swap as much
faster: the collection head takes during swap (gc 3.1-4.4 ms) lands in select instead (2.5-3.6),
the same work a phase later. Android shows neither.

**1. Dispose removed rows after the commit.** A phase ends at `completeRoot`, and on clear most of
what comes before it is Solid disposing each row's owner. Headless (Hermes sampling profiler),
clear is ~85% `cleanNode` and the cleanups it runs: `createSelector`'s per-row `Map`/`Set`
deletes 16%, the platform's `drop` 14%; engine removals and the commit under 2%. The prototype is
Solid's `mapArray` in the platform's `For`, with each removed row's disposer queued and run from
one `afterCommit` callback: the rows leave the tree and the commit goes out first, as React runs
passive-effect unmounts after its commit. Headless, time to commit: clear 2.86 -> 0.54 ms, replace
12.7 -> 11.7; the total work is unchanged. On iOS the UI thread mounts while JavaScript disposes.

- One trap, measured: the disposals run inside the flush, where `schedule()` is a no-op, so the
  nodes they drop waited for the next phase's flush and update10th grew 0.3 ms headless, 0.6 iOS,
  1.0 Android. The implementation has the root dispose retired rows right after `engine.commit()`
  and release what they dropped in the same flush; update10th is unchanged.
- A second, found by the canary's tests: a row commonly looks itself up in the list it was removed
  from (the shop basket's `lines().find(...)!`). Solid disposes the row before its effects can run
  again; deferred, they ran and threw, and the update failed. So a removed row is quieted at once:
  each of its computations gets a function that returns the value it has (Solid's internal `fn`),
  so a re-run does nothing and unsubscribes it. That walk is the price of safety: headless clear to
  commit 0.77 ms against the prototype's 0.54, on iOS 3.4 against 2.5. Hanging the row's owner on
  its disposer function instead of a parallel array cost another 0.6 ms on iOS.
- Semantics: a removed row's `onCleanup`s run after the commit, not inside the write that removed
  it; `apps/documentation` says so where `For` is described.
- Next: the same for `Index`, `Show`/`Switch` branches and a router pop; disposal in idle slices
  (`requestIdleCallback`, ~2 ms each) so 2000 rows' teardown cannot delay the next frame's input.

**2. Share merged props by identity.** `plainProps` builds the same object for every node made
from the same compiled statics and the same style object. Keep the last result per statics object
(a node set no other prop) and hand it out when the style matches: no copy, no colour lookup, one
props object for all of them, which Fabric only reads. Headless mount -5.3% (9.84 vs 10.39 ms),
replace -3%, append -4.6%, with only the 1000 labels hitting, since the bench gives every row view
its own style object; with rows sharing `styles.row`, mount -12% (8.91 vs 10.15 ms), replace -9%,
append -11%. On device the bench's case is within noise. Off when an inline `direction` exists,
since a paragraph's alignment then depends on its ancestors.

**3. One computation per row.** The compiler emits `insert(text, () => row.label())` as a render
effect of its own beside the row's prop `effect`. Folded in (the raw text node made with the
element, its text set from the same effect), a row has one computation, one closure and two fewer
arrays. Hand-compiled: headless mount -2.6%, 0.54 MB less (-8.5%), clear -6%; device allocation
7.3 -> 6.7 MB (iOS), 4.7 -> 4.3 (Android), time within noise. The compiler cannot tell text from
an element in `{expr}`, so it needs a runtime fallback to `insert` for a non-text value: worth it
for the allocation, not for time.

**Not prototyped, with bounds:**

4. **Garbage collection is a third of the mount gap.** Device GC during mount is 1.7 ms for React
   and 2.4 for Solid on iOS (1.2 vs 1.8-1.9 on Android) at the same 7.2-7.3 MB: React's mount
   garbage dies young, Solid's owners, computations and closures survive. Proposal 3's 0.5 MB did
   not move it measurably; fewer surviving objects per row is the lever (a closure-free owner per
   node was tried and was flat, above). A larger Hermes young generation is host configuration and
   helps React equally.
5. **Create Fabric nodes as the tree is built**, as React's `completeWork` does, instead of in the
   commit walk. Headless the engine alone is 5.5 of a 10 ms mount, and the walk's own frames
   (`reconcile`, `reconcileChildren`, `reconcileUnder`, flags) are ~15% of that, so ~0.8 ms at
   most, less what creation still needs. Conflicts with a cascade that can restyle a node before
   its first commit, so only for nodes no sheet reaches.
6. **A C++ command-buffer path** remains the only route to a mount clearly faster than React's,
   bounded at ~2 ms on iOS and 5.5 on Android ([performance.md](performance.md)), at the cost of
   a native module in every app.
7. **A lighter `createSelector`** would cut 16% of clear's disposal, but item 5 found clear no
   faster without any selector, and with proposal 1 that work is off the commit path anyway.

The headless profiles came from a scratch copy of the Hermes host with the sampling profiler on
(`RuntimeConfig` `withEnableSampleProfiling(true)`, the root API's `enableSamplingProfiler` around
a phase, then `sampledTraceToStreamInDevToolsFormat` to a `.cpuprofile`). It charges a young-
generation collection to the allocating function, so `createComputation` and `createMemo` lead a
mount profile on allocation, not work.

## A page, as navigation mounts one

The row bench is a thousand identical rows of plain views. A page an app navigates to is a few
dozen cards with pressables, nested text and components, and there the picture was different:
`examples/canary/src/bench/screen.ts` (`EXPO_PUBLIC_BENCH=signals-screen` / `react-screen`) is 40
cards, each a `Pressable` holding an avatar, two lines of text and a `Pressable` button, mounted,
hidden (a pop) and shown again (a push). Renderer JavaScript ms, interleaved, iOS 12 rounds and
Android 10:

| phase    | iOS React | iOS before | iOS now | Android React | Android before | Android now |
| -------- | --------- | ---------- | ------- | ------------- | -------------- | ----------- |
| mount    | 4.9       | 6.5        | **3.0** | 6.3           | 6.5            | **3.3**     |
| unmount  | 0.9       | 1.9        | 0.9     | 0.4           | 1.4            | 0.6         |
| remount  | 7.2       | 10.8       | 8.0     | 7.0           | 14.4           | **4.9**     |
| remount2 | 6.3       | 11.8       | **5.5** | 6.4           | 12.2           | 8.0         |

"Before" is the branch with the row work above; the three changes below brought the page from 1.3-2x
React's time to ahead of it on mount. Headless, the page's mount went 3.63 -> 1.88 ms and its
allocation 2.67 -> 1.07 MB.

1. **`Pressable` built its children twice.** It read `props.children` once to test for a function
   and again to use it; compiled children are a getter that builds them on every read, so each
   card was built twice and both copies kept, and a `Pressable` inside a `Pressable` four times.
   `TouchableOpacity` had the same. Headless mount -34%, allocation -38%, unmount -45%.
2. **Press retention is measured when a press starts**, as React Native's Pressability does, rather
   than with a `topLayout` listener on every pressable that had native report each layout of each
   button to JavaScript; hover is listened for once something reads it. Listeners per page
   243 -> 3, memos 164 -> 4; headless mount -13%, allocation -18%.
3. **One object per pressable.** The gesture's state and the responder handlers are a class whose
   methods the engine calls, rather than some twenty closures; `pressed`/`hovered` become signals
   only when read; the props carry only what is set; the owner's cleanup replaces a per-node
   native lifetime. Headless mount -9%, allocation -20%.

A popped screen's owner is now disposed after the commit that removes its screen, as `For`'s rows
are (`retireRoute` in the router), so a pop's commit is not held up by the page's teardown; a route
that never showed (a cancelled push, a failed presentation) is still torn down at once. Checked by
the router's tests and on the Android emulator (push, basket edits, pop), not benchmarked.

### Garbage collection on a page, measured

The 0.8 ms left on the first remount was not the page's survivors. With the bench run for six
push/pop cycles (interleaved, iOS 10-12 rounds, Android 8-10), that collection is the app's first:
Solid's mount has none, so the first remount promotes everything alive since boot (2.2 ms); React
pays its first in mount. Later iOS collections cost 1.0-1.2 ms against React's 0.6-0.9, and Solid
collects every second remount where React collects in three of four.

On Android a Solid collection cost 4-6 ms against React's 1.2-1.6 (2 collections, 11.5 ms over the
run, against React's 4 and 4.7 ms on twice the allocation). A native profile (root simpleperf, the
unstripped `libhermesvm.so` from the Gradle cache) put 62% of that young-generation pause in
`finalizeYoungGenObjects`, `deleteShared(NativeState)` and `~ShadowNodeWrapper`: a destroyed
node's Fabric handle died young, so its finalizer, and with it the native node's teardown, ran inside
the pause on the JavaScript thread. React's handles outlive a collection and are finalized by the
old generation's sweep on the collector's thread (`~ShadowNodeWrapper` 0.02% of React's JavaScript
thread, 1.50% of Solid's). Evacuation, what the survivor count drives, was about equal.

**Kept: destroyed handles wait for a collection** (`Engine.graveyard`, `EngineOptions.collections`,
Hermes's `js_numGCs` by default). The engine holds each destroyed node's handle until the count
changes, so it is promoted and dies in the old generation. Young-gen work on the JavaScript thread
went from 122 samples to 66 (React 75). Final branch against React and the session's start, ms:

| page bench, GC per collection | iOS React | iOS before | iOS now | Android React | Android before | Android now |
| ----------------------------- | --------- | ---------- | ------- | ------------- | -------------- | ----------- |
| first remount (boot's GC)     | 0.9       | 2.2        | 1.8     | 0 (in mount)  | 0              | 0           |
| later collections             | 0.8-0.9   | 1.2        | 0.8     | 1.1-1.2       | 2.1-3.3        | 1.0-1.7     |
| GC over the whole run         | 4.4       | 4.6        | 3.4     | 2.9           | 5.4            | 2.7         |

With it, Solid's total time per phase beats React's in every phase of the iOS run, and its JS-thread
GC on Android is below React's.

**Also fixed: a popped page was retained.** `applyUntracked` kept the last node and value it set in
module variables, and through a ScrollView's handlers that held the whole popped page (490 nodes)
until the next spread write. Headless, 5 nodes now remain after a pop. It did not change GC time.

Both were checked by hand on the iOS simulator (shop, product push, size, basket add and remove to
empty, two more push/pops, back), with no errors logged.

**Tried and not kept** (side branch `perf/mount-survivors`, no device gain):

- Forget a render effect whose first run read no signal (122 of 612 computations per page): iOS
  within noise. A text node made in an `insert` keeps its computation alive through `hostData`.
- One cleanup per owner for the nodes it makes, not a closure per node: more survivors headless
  (an array per owner), not fewer.
- Responder handlers on the node rather than in a `WeakMap`: within noise.
- Engine nodes as a sized object literal: a no-op. Hermes sizes class-field storage once (344
  bytes for 36 fields); only `this.x =` assignments in a constructor grow it (624).

**The list.** G does not move the 1000-row bench. In this session iOS mount was level (renderer
13.6 vs React 13.4 ms, total 49.4 vs 50.8). Android mount is 1.5 ms behind (14.7 vs 13.2): 0.5 ms
GC, 1.2 ms other renderer work, total level (70.8 vs 70.5).

## Measuring

- Headless Hermes: `scripts/perf/hermes/ab.sh` modes `signals`, `twinline` (signals bench under a
  global Tailwind sheet), `twclass` (rows styled by class) and `screen` (the page bench). Run it
  from its own directory (the host's rpath is relative). It runs no young-generation collection in
  a phase and its Fabric handles have no finalizers, so GC questions need a device.
- Device: `scripts/perf/build.sh`, then `ab-ios.sh` / `ab-android.sh`, on a Release canary.
