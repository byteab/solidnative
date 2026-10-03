import assert from 'node:assert/strict';
import { registerPlatformComponents } from '@solid-native/fabric';
import {
  ColorScheme,
  Dialogs,
  provideService,
  type ServiceBinding,
} from '@solid-native/device/solid';
import { Database, type SQLiteDatabase } from '@solid-native/expo/solid/database';
import { Haptics } from '@solid-native/expo/solid/haptics';
import type { NativeNavigation } from '@solid-native/router/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { mountHabits } from '../src/bootstrap.solid.tsx';

export const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const sameSources = (scheme: 'light' | 'dark') => ({
  screen: {
    current: () => ({ window: { width: 402, height: 874 }, screen: { width: 402, height: 874 } }),
    subscribe: () => () => {},
  },
  colors: { current: () => scheme, subscribe: () => () => {} },
  settings: {
    current: () => ({ reducedMotion: false, boldText: false, highContrast: false }),
    subscribe: () => () => {},
  },
  fontScale: () => 1,
});

export interface BootOptions {
  readonly services?: readonly ServiceBinding[];
  readonly platform?: 'ios' | 'android';
  readonly scheme?: 'light' | 'dark';
  readonly confirm?: boolean;
  /** Where the SQLite fake lands; absent, opening the database fails as it does in Node. */
  readonly database?: SQLiteDatabase;
}

/** The real entry's mount, against fake Fabric and fake native sources. */
export function bootHabits(options: BootOptions = {}) {
  registerPlatformComponents(options.platform ?? 'ios');
  const fabric = createFakeFabric();
  const clock = createClock();
  const errors: unknown[] = [];
  const haptics: string[] = [];
  const alerts: string[] = [];
  let navigation!: NativeNavigation;
  const scheme = options.scheme ?? 'light';
  const root = mountHabits({
    fabric,
    clock,
    rootTag: 1,
    tailwind: { rules: [] },
    conditions: sameSources(scheme) as never,
    engineOptions: { onError: (error) => errors.push(error) },
    onError: (error) => errors.push(error),
    onNavigation: (value) => (navigation = value),
    services: [
      provideService(ColorScheme.SOURCE, () => ({
        current: () => scheme,
        subscribe: () => () => {},
      })),
      provideService(Haptics.SOURCE, () => ({
        impactAsync: async (style) => void haptics.push(`impact:${style}`),
        notificationAsync: async (type) => void haptics.push(`notify:${type}`),
        selectionAsync: async () => void haptics.push('select'),
      })),
      provideService(Dialogs.SOURCE, () => ({
        alert: (title, _message, buttons) => {
          alerts.push(title);
          const button = buttons?.find(
            (one) => (options.confirm ?? true) === (one.style !== 'cancel'),
          );
          button?.onPress?.();
        },
      })),
      provideService(Database.SOURCE, () => ({
        open: async () => {
          if (!options.database) throw new Error('expo-sqlite is not installed');
          return options.database;
        },
      })),
      ...(options.services ?? []),
    ],
  });
  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  const textOf = (node: FakeNode) =>
    flatten([node])
      .filter((one) => one.props['text'] !== undefined)
      .map((one) => one.props['text'])
      .join('');
  const renderedText = () =>
    nodes()
      .filter((one) => one.props['text'] !== undefined)
      .map((one) => one.props['text'])
      .join('');
  /** Settle lazy routes, microtasks and every native stack transition. */
  function finish() {
    for (let count = 0; count < 6; count++) {
      clock.flushMicrotasks();
      for (const stack of nodes().filter((node) => node.viewName === 'RNSScreenStack'))
        fabric.emit(stack, 'topFinishTransitioning');
    }
    clock.flushMicrotasks();
  }
  async function settle() {
    for (let count = 0; count < 4; count++) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      finish();
    }
  }
  /** The nodes on the screen in front: other retained screens stay mounted, detached. */
  const byLabel = (label: string, role?: string) =>
    nodes().filter(
      (node) =>
        node.props['accessibilityLabel'] === label &&
        (role === undefined || node.props['accessibilityRole'] === role),
    );
  function one(label: string, role?: string) {
    const found = byLabel(label, role);
    assert.ok(found.length > 0, `no ${role ?? 'node'} labelled ${label}`);
    return found.at(-1)!;
  }
  function pressNode(node: FakeNode) {
    for (const type of ['topTouchStart', 'topTouchEnd']) {
      const touch = { identifier: 1, pageX: 1, pageY: 1 };
      fabric.emit(node, type, {
        ...touch,
        changedTouches: [touch],
        touches: type === 'topTouchEnd' ? [] : [touch],
      });
    }
    clock.flushMicrotasks();
  }
  /** A pressable by its own label, or by the text it contains. */
  function press(label: string, role?: string) {
    const labelled = byLabel(label, role).filter(
      (node) => node.instanceHandle.name === 'pressable',
    );
    const node =
      labelled.at(-1) ??
      nodes()
        .filter((node) => node.instanceHandle.name === 'pressable' && textOf(node) === label)
        .at(-1);
    assert.ok(node, `no pressable ${label}`);
    pressNode(node);
  }
  let eventCount = 0;
  function type(label: string, text: string) {
    const node = one(label);
    fabric.emit(node, 'topFocus', {});
    fabric.emit(node, 'topChange', { text, eventCount: ++eventCount });
    fabric.emit(node, 'topBlur', {});
    clock.flushMicrotasks();
  }
  function toggle(label: string, value: boolean) {
    fabric.emit(one(label, 'switch'), 'topChange', { value });
    clock.flushMicrotasks();
  }
  async function waitFor(predicate: () => boolean, message = 'habits operation did not settle') {
    for (let count = 0; count < 100; count++) {
      finish();
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.ok(predicate(), message);
  }
  return {
    fabric,
    clock,
    root,
    errors,
    haptics,
    alerts,
    navigation: () => navigation,
    nodes,
    renderedText,
    finish,
    settle,
    byLabel,
    one,
    press,
    pressNode,
    type,
    toggle,
    waitFor,
  };
}
export type HabitsHarness = ReturnType<typeof bootHabits>;

/** `accessibilityState` read back through one shape. */
export const stateOf = (node: FakeNode) =>
  (node.props['accessibilityState'] ?? {}) as {
    checked?: boolean;
    disabled?: boolean;
    selected?: boolean;
  };
