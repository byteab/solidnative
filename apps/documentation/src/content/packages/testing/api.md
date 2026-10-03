---
title: API reference
summary: Everything @solid-native/testing exports - render, renderWith, screen, the queries, fireEvent, userEvent, waitFor, the fake Fabric and clock - and its register and Vitest entry points.
---

# API reference

Entry points: `.` (this page), `./register` (the Node hook) and `./vitest` (`solidNative()`); see
[Setup](/packages/testing/setup).

## `render()`

```ts
function render<P extends object>(
  component: (props: P) => NativeChild,
  options?: RenderOptions<P>,
): ComponentRenderResult<P>;
```

Mounts `component` with `createNativeRoot()` onto a fresh `createFakeFabric()`, committing the first
frame synchronously. Any function returning native children works, e.g. one adding a `ServiceScope`.

### `RenderOptions`

| Option          | Type                 | What it does                                                                                   |
| --------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `props`         | `P`                  | The component's props. Reactive: `setProps` updates them in place.                             |
| `platform`      | `'ios' \| 'android'` | Which platform's view names and component defaults to use. `'ios'` by default.                 |
| `engineOptions` | `EngineOptions`      | What the engine takes on a device: `globalStyles`, `conditions`, `tokens`, `onError` and more. |
| `clock`         | `NativeClock`        | A clock to drive by hand, from `createClock()`. By default, real microtasks and frames.        |
| `rootTag`       | `number`             | The surface to commit to. `1` by default.                                                      |

After an Android render, an iOS `render()` throws: separate files. `engineOptions.onError` receives
errors from commits and handlers; assert none were collected to catch silent handler throws.

### `RenderResult`

Every query on this page, bound to this render, plus:

| Member           | What it does                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `fabric`         | The `FakeFabric` this render committed to.                                                  |
| `root`           | What was mounted: the `NativeRoot` for `render()`, the boot's result for `renderWith()`.    |
| `flush()`        | Commits whatever is pending now, without waiting for the scheduler.                         |
| `debug(node?)`   | Prints the committed tree, or one node's subtree.                                           |
| `unmount()`      | Disposes the root, running every `onCleanup`.                                               |
| `setProps(next)` | `render()` only. Merges `next` into the props the component was rendered with, and commits. |

<!-- api: render -->

## `renderWith()`

```ts
function renderWith<R extends Mountable>(
  boot: (host: RenderHost) => R,
  options?: HostOptions,
): RenderResult<R>;

interface RenderHost {
  readonly fabric: FakeFabric;
  readonly rootTag: number;
  readonly clock?: NativeClock;
}

interface Mountable {
  dispose(): void;
  flush?(): boolean;
}
```

Mounts whatever `boot` mounts, typically the app's entry with all its services. `HostOptions` is
`platform`, `clock` and `rootTag`.

<!-- api: renderWith -->

## `screen` and `within()`

```ts
const screen: BoundQueries & { debug(node?: FakeFabricNode): void };
function within(node: FakeFabricNode): BoundQueries;
```

`screen` queries the latest render still mounted, throwing "Nothing is rendered" if none.
`within(node)` queries one node's subtree in the current commit.

<!-- api: screen -->

<!-- api: within -->

## Queries

`BoundQueries` is every combination of six forms and six kinds:

| Form          | No match | One match | Several     |
| ------------- | -------- | --------- | ----------- |
| `getBy*`      | Throws   | The node  | Throws      |
| `getAllBy*`   | Throws   | `[node]`  | All of them |
| `queryBy*`    | `null`   | The node  | Throws      |
| `queryAllBy*` | `[]`     | `[node]`  | All of them |

| Kind              | Arguments                                           | Matches                                                       |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `Role`            | `(role, { name?, exact?, includeHiddenElements? })` | `accessibilityRole`; `name` is the label, or the text inside. |
| `Text`            | `(text, options?)`                                  | A `Paragraph`'s whole text, nested runs included.             |
| `TestId`          | `(testId, options?)`                                | `testID` or `nativeID`.                                       |
| `LabelText`       | `(label, options?)`                                 | `accessibilityLabel`.                                         |
| `PlaceholderText` | `(placeholder, options?)`                           | `placeholder`.                                                |
| `DisplayValue`    | `(value, options?)`                                 | A text input's `text`.                                        |

A string `Matcher` matches the whole trimmed, whitespace-collapsed text (`exact: false`:
case-insensitive substring). `display: none`, `accessibilityElementsHidden`, `aria-hidden` and
`importantForAccessibility="no-hide-descendants"` hide nodes unless `includeHiddenElements`.
`findBy*`/`findAllBy*` retry in `waitFor`, taking `WaitForOptions` third.

## `fireEvent`

```ts
fireEvent(node, name, payload?): Promise<void>;
fireEvent.press(node): Promise<void>;
fireEvent.changeText(node, text): Promise<void>;
fireEvent.scroll(node, payload?): Promise<void>;
fireEvent.focus(node): Promise<void>;
fireEvent.blur(node): Promise<void>;
```

One event, then `settle()`. Names get a `top` prefix; a payload's `nativeEvent` is sent if present.
`press` is both touches in one task; `changeText` sends `topChange` to the input at or under `node`,
editable or not.

<!-- api: fireEvent -->

## `userEvent`

| Method                          | What it sends                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `press(node)`                   | A finger down and, a task later, up, through the responder.                    |
| `longPress(node, { duration })` | The same, held `duration` ms, 500 by default.                                  |
| `type(node, text, options?)`    | Focus, then a key press and a change per character, then end editing and blur. |
| `clear(node)`                   | Focus, an empty change, then end editing and blur.                             |

`type` takes `{ skipBlur?, submitEditing? }`, skips `editable: false` fields (as does `clear`) and
stops at `maxLength`. `userEvent.setup()` returns the same methods, for RNTL compatibility.

<!-- api: userEvent -->

## `waitFor()` and `waitForElementToBeRemoved()`

```ts
function waitFor<T>(callback: () => T | Promise<T>, options?: WaitForOptions): Promise<T>;
function waitForElementToBeRemoved(
  target:
    | FakeFabricNode
    | readonly FakeFabricNode[]
    | (() => FakeFabricNode | readonly FakeFabricNode[] | null | undefined),
  options?: WaitForOptions,
): Promise<void>;

interface WaitForOptions {
  timeout?: number; // 1000
  interval?: number; // 50
}
```

`waitFor` retries `callback` until it stops throwing and resolves with its result, or rejects with
its last error after `timeout`. `waitForElementToBeRemoved` rejects at once if the node is absent.

<!-- api: waitFor -->

<!-- api: waitForElementToBeRemoved -->

## `settle()`, `flushRenders()` and `cleanup()`

`settle()` waits a macrotask, then commits; `flushRenders()` commits now. `cleanup()` unmounts every
render, newest first, and self-registers where a global `afterEach` exists.

<!-- api: settle -->

<!-- api: flushRenders -->

<!-- api: cleanup -->

## `gestureOf()`

```ts
function gestureOf(node: FakeFabricNode, kind?: string): TestGesture;
```

The `NativeGesture` on a view, or its composed gesture of `kind`. A `TestGesture` has `kind`,
`gestures` and `callbacks`: call `gestureOf(card, 'Pan').callbacks['onEnd']!(event)`.

<!-- api: gestureOf -->

## `createFakeFabric()`

The `FabricUIManager` every render commits to, exported for a test that mounts a root itself.

| Member                  | What it is                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `committed`             | The root child set from the most recent `completeRoot`.                            |
| `find(viewName)`        | The first committed node with that view name.                                      |
| `render({ props? })`    | An indented view-name tree, with the flattened props if asked, for golden asserts. |
| `emit(node, type, ev?)` | Sends an event through the registered handler, as the C++ side would.              |
| `calls`                 | How many `createNode`, clone and `completeRoot` calls were made.                   |
| `responderCalls`        | Every `setIsJSResponder`, in order.                                                |
| `commands`              | Every `dispatchCommand`, in order: `focus`, `scrollTo` and the rest.               |
| `frames`                | What `measureInWindow` answers, keyed by `nativeID` or view name. Set by the test. |
| `reset()`               | Zeroes `calls`.                                                                    |

A `FakeFabricNode` has `reactTag`, `viewName`, `props` and `children`.

<!-- api: createFakeFabric -->

## `createClock()`

```ts
function createClock(): ManualClock;

interface ManualClock extends NativeClock {
  flushMicrotasks(): void;
  frame(time: number): void;
}
```

Queues commits until `flushMicrotasks()`, `flush()` or `settle()`, and frames until `frame(time)`,
which runs each requested frame once at that timestamp.

<!-- api: createClock -->
