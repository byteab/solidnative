/**
 * `fireEvent` and `userEvent`, as React Native Testing Library names them, emitting the Fabric
 * events the native side would.
 *
 * Each goes through `fabric.emit`, which is the handler the renderer registered with Fabric, so an
 * event takes the real route: the engine's responder negotiation for a touch, its bubbling for the
 * rest, then the component's listener. Nothing here calls a handler directly, and a disabled
 * pressable ignores a press here for the same reason it does on a phone.
 *
 * Both are async where RNTL's `fireEvent` is not. The renderer commits on a microtask, and a
 * handler may start async work, so an event has to be awaited before the tree it changed is read.
 */
import { runEventWorklets } from './native-internals.ts';
import { currentOf, ownerOf, settle } from './render.ts';
import { flatten, isTextInput } from './queries.ts';
import type { FakeFabricNode } from './test-utils.ts';

/** A payload as a handler would see it (`{ nativeEvent }`), or the native event itself. */
export type EventPayload = Record<string, unknown>;

const nativeOf = (payload: EventPayload | undefined): Record<string, unknown> =>
  ((payload && 'nativeEvent' in payload ? payload['nativeEvent'] : payload) as Record<
    string,
    unknown
  >) ?? {};

function emit(node: FakeFabricNode, type: string, nativeEvent: Record<string, unknown> = {}): void {
  const event = { target: node.reactTag, ...nativeEvent };
  // A worklet handler on the view (`WorkletScroll`) sees the event first, as on the UI thread.
  runEventWorklets(node.reactTag, type, event);
  ownerOf(node).fabric.emit(node, type, event);
}

/** `press` -> `topPress`: the naming the renderer uses for `(touchEnd)` and every other event. */
const topLevel = (name: string): string =>
  name.startsWith('top') ? name : `top${name[0]!.toUpperCase()}${name.slice(1)}`;

/** One finger, as Fabric reports it. The press machine reads `pageX`/`pageY`. */
function touch(node: FakeFabricNode, phase: 'start' | 'end'): Record<string, unknown> {
  const point = {
    identifier: 0,
    target: node.reactTag,
    pageX: 0,
    pageY: 0,
    locationX: 0,
    locationY: 0,
    timestamp: Date.now(),
  };
  return { ...point, touches: phase === 'start' ? [point] : [], changedTouches: [point] };
}

/** The navigation bar's search field, which reports text as `topChangeText` with no count. */
const isSearchBar = (node: FakeFabricNode): boolean => node.viewName === 'RNSSearchBar';

/** The text field at or under a node, so a query for its wrapper still reaches the input. */
function fieldOf(node: FakeFabricNode): FakeFabricNode {
  const current = currentOf(node) ?? node;
  const field = flatten([current]).find((n) => isTextInput(n) || isSearchBar(n));
  if (!field) throw new Error(`No TextInput or search bar at or under this ${node.viewName}.`);
  return field;
}

/** The count native would send next: one past the last one JS echoed back. */
const nextCount = (field: FakeFabricNode): number =>
  Number((currentOf(field) ?? field).props['mostRecentEventCount'] ?? 0) + 1;

function changeText(field: FakeFabricNode, text: string): void {
  if (isSearchBar(field)) emit(field, 'topChangeText', { text });
  else emit(field, 'topChange', { text, eventCount: nextCount(field) });
}

async function press(node: FakeFabricNode): Promise<void> {
  emit(node, 'topTouchStart', touch(node, 'start'));
  emit(node, 'topTouchEnd', touch(node, 'end'));
  await settle();
}

const named = {
  press,
  async changeText(node: FakeFabricNode, text: string): Promise<void> {
    changeText(fieldOf(node), text);
    await settle();
  },
  async scroll(node: FakeFabricNode, payload?: EventPayload): Promise<void> {
    emit(node, 'topScroll', nativeOf(payload));
    await settle();
  },
  async focus(node: FakeFabricNode): Promise<void> {
    emit(node, 'topFocus');
    await settle();
  },
  async blur(node: FakeFabricNode): Promise<void> {
    emit(node, 'topBlur');
    await settle();
  },
};

type FireEvent = ((node: FakeFabricNode, name: string, payload?: unknown) => Promise<void>) &
  typeof named;

/**
 * `fireEvent(node, 'press')`, `fireEvent(node, 'changeText', 'Ada')`, or any other event by name -
 * `fireEvent(node, 'submitEditing', { text })` emits `topSubmitEditing`.
 */
export const fireEvent: FireEvent = Object.assign(
  async (node: FakeFabricNode, name: string, payload?: unknown): Promise<void> => {
    if (name === 'changeText') return named.changeText(node, String(payload));
    if (name === 'press' || name === 'scroll' || name === 'focus' || name === 'blur') {
      return named[name](node, payload as EventPayload);
    }
    emit(node, topLevel(name), nativeOf(payload as EventPayload));
    await settle();
  },
  named,
);

/** Options for `userEvent.type`, named as React Native Testing Library names them. */
export interface TypeOptions {
  /** Leave the field focused afterwards. By default typing ends with the field blurring. */
  skipBlur?: boolean;
  /** Press return at the end: `topSubmitEditing`, before any blur. */
  submitEditing?: boolean;
}

/**
 * Interactions as a person performs them: several events, a task apart, in the order the platform
 * sends them. Slower than `fireEvent`, and closer to what a device does.
 */
export interface UserEvent {
  /** A finger down and up, a task apart, through the responder. */
  press(node: FakeFabricNode): Promise<void>;
  /** A finger held for `duration` ms (500, the long-press delay, by default). */
  longPress(node: FakeFabricNode, options?: { duration?: number }): Promise<void>;
  /** Focus the field, then one change per character, each with the next `eventCount`. */
  type(node: FakeFabricNode, text: string, options?: TypeOptions): Promise<void>;
  /** Focus the field, empty it, and blur. */
  clear(node: FakeFabricNode): Promise<void>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function hold(node: FakeFabricNode, duration: number): Promise<void> {
  emit(node, 'topTouchStart', touch(node, 'start'));
  await settle();
  if (duration) await sleep(duration);
  emit(node, 'topTouchEnd', touch(node, 'end'));
  await settle();
}

async function endEditing(field: FakeFabricNode, text: string): Promise<void> {
  emit(field, 'topEndEditing', { text });
  emit(field, 'topBlur');
  await settle();
}

const user: UserEvent = {
  press: (node) => hold(node, 0),
  longPress: (node, { duration = 500 } = {}) => hold(node, duration),
  async type(node, text, options = {}) {
    const field = fieldOf(node);
    if (field.props['editable'] === false) return;
    emit(field, 'topFocus');
    await settle();
    const maxLength = field.props['maxLength'];
    const limit = typeof maxLength === 'number' ? maxLength : Infinity;
    let value = String((currentOf(field) ?? field).props['text'] ?? '');
    for (const key of text) {
      // `maxLength` is enforced natively: the field never calls back with text past it, so a key
      // pressed once the limit is reached is swallowed the same way it would be on a device.
      if (value.length >= limit) continue;
      value += key;
      emit(field, 'topKeyPress', { key });
      changeText(field, value);
      await settle();
    }
    if (options.submitEditing) emit(field, 'topSubmitEditing', { text: value });
    if (!options.skipBlur) await endEditing(field, value);
    else await settle();
  },
  async clear(node) {
    const field = fieldOf(node);
    if (field.props['editable'] === false) return;
    emit(field, 'topFocus');
    changeText(field, '');
    await settle();
    await endEditing(field, '');
  },
};

/** RNTL's `userEvent`: `userEvent.setup()` for an instance, or the same calls directly. */
export const userEvent: UserEvent & { setup(): UserEvent } = { ...user, setup: () => user };
