/**
 * What a test gets for the gesture handler's and Reanimated's internal modules that
 * `@solidnative/components/gestures` and `/reanimated` require by path: the register resolves each of
 * those paths here. Node cannot load their React Native source, and there is no UI thread anyway.
 *
 * - A gesture attached to a view is kept by the view's tag, for `gestureOf`.
 * - An event worklet registered for a view (a `WorkletScroll`) is kept by tag and event name, and
 *   `fireEvent` runs it for the matching event before the event reaches JS, as Reanimated does.
 * - `updateProps` writes a worklet style straight onto the engine node behind the shadow node it is
 *   given, and commits, so a query sees the style an animation settles on.
 *
 * State lives on `globalThis` so the copy `require` loads and the copy `import` loads agree.
 */
import type { EngineNode } from '@solidnative/fabric';

interface Registration {
  readonly worklet: (event: never) => void;
  readonly eventName: string;
  readonly tag: number;
}

interface State {
  next: number;
  readonly gestures: Map<number, unknown>;
  readonly prepared: WeakMap<object, number>;
  readonly events: Map<number, Registration>;
  readonly written: WeakMap<EngineNode, readonly string[]>;
}

const KEY = Symbol.for('solidnative.testing.native');
export const nativeState: State = ((globalThis as Record<symbol, State | undefined>)[KEY] ??= {
  next: 0,
  gestures: new Map(),
  prepared: new WeakMap(),
  events: new Map(),
  written: new WeakMap(),
});

// react-native-gesture-handler/src/handlers/gestures/GestureDetector/attachHandlers.ts
export function attachHandlers(config: {
  preparedGesture: object;
  gestureConfig: unknown;
  viewTag: number;
}): void {
  nativeState.gestures.set(config.viewTag, config.gestureConfig);
  nativeState.prepared.set(config.preparedGesture, config.viewTag);
}

// react-native-gesture-handler/src/handlers/gestures/GestureDetector/dropHandlers.ts
export function dropHandlers(prepared: object): void {
  const tag = nativeState.prepared.get(prepared);
  if (tag !== undefined) nativeState.gestures.delete(tag);
  nativeState.prepared.delete(prepared);
}

// react-native-gesture-handler/src/init.ts
export function maybeInitializeFabric(): void {}

// react-native-gesture-handler/src/handlers/gestures/gestureStateManager.ts
export const GestureStateManager = {
  create: () => ({ begin() {}, activate() {}, fail() {}, end() {} }),
};

// react-native-reanimated/src/core.ts
export function registerEventHandler(
  worklet: (event: never) => void,
  eventName: string,
  tag: number,
): number {
  const id = ++nativeState.next;
  nativeState.events.set(id, { worklet, eventName, tag });
  return id;
}

export function unregisterEventHandler(id: number): void {
  nativeState.events.delete(id);
}

/** Run the event worklets registered for `topScroll` (as `onScroll`) and the rest on a view. */
export function runEventWorklets(tag: number, topLevelType: string, nativeEvent: unknown): void {
  const name = 'on' + topLevelType.replace(/^top/, '');
  for (const registration of [...nativeState.events.values()]) {
    if (registration.tag === tag && registration.eventName === name)
      registration.worklet(nativeEvent as never);
  }
}

// react-native-reanimated/src/updateProps/index.ts
export function updateProps(
  descriptors: { value: readonly { shadowNodeWrapper: unknown }[] },
  updates: Record<string, unknown>,
): void {
  for (const { shadowNodeWrapper } of descriptors.value) {
    const node = (shadowNodeWrapper as { instanceHandle?: EngineNode }).instanceHandle;
    const engine = node?.host as
      | { setProp(node: EngineNode, key: string, value: unknown): void; commit(): boolean }
      | undefined;
    if (!node || !engine) continue;
    for (const key of nativeState.written.get(node) ?? [])
      if (!(key in updates)) engine.setProp(node, key, undefined);
    for (const [key, value] of Object.entries(updates)) engine.setProp(node, key, value);
    nativeState.written.set(node, Object.keys(updates));
    engine.commit();
  }
}
