import assert from 'node:assert/strict';
import { registerPlatformComponents } from '@solidnative/fabric';
import { DeepLinks, provideService, type ConditionSources } from '@solidnative/device/solid';
import { Haptics } from '@solidnative/expo/solid/haptics';
import { SecureStorage } from '@solidnative/expo/solid/store';
import type { NativeNavigation } from '@solidnative/router/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { mountWallet } from '../src/bootstrap.solid.tsx';

export const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

/** Text a node shows, its own and its descendants'. */
export const textOf = (node: FakeNode) =>
  flatten([node])
    .map((child) => child.props['text'] ?? '')
    .join('');

export interface BootOptions {
  readonly platform?: 'ios' | 'android';
  readonly scheme?: 'light' | 'dark';
  readonly launchUrl?: string | null;
  /** The keychain, as JSON strings by key. */
  readonly keychain?: Map<string, string>;
}

/** The real entry's mount, against fake Fabric and fake native sources. */
export function bootWallet(options: BootOptions = {}) {
  const platform = options.platform ?? 'ios';
  registerPlatformComponents(platform);
  const fabric = createFakeFabric();
  const clock = createClock();
  const keychain = options.keychain ?? new Map<string, string>();
  const haptics: string[] = [];
  const errors: unknown[] = [];
  let navigation!: NativeNavigation;
  const conditions: ConditionSources = {
    screen: {
      current: () => ({ window: { width: 402, height: 874 }, screen: { width: 402, height: 874 } }),
      subscribe: () => () => {},
    },
    colors: { current: () => options.scheme ?? 'light', subscribe: () => () => {} },
    settings: { current: () => ({ reduceMotion: false, fontScale: 1 }), subscribe: () => () => {} },
    fontScale: () => 1,
  };
  const root = mountWallet({
    fabric,
    clock,
    rootTag: 1,
    tailwind: { rules: [] },
    conditions,
    engineOptions: { onError: (error) => errors.push(error) },
    onError: (error) => errors.push(error),
    onNavigation: (value) => (navigation = value),
    services: [
      provideService(SecureStorage.SOURCE, () => ({
        get: async (key) => keychain.get(key) ?? null,
        set: async (key, value) => void keychain.set(key, value),
        remove: async (key) => void keychain.delete(key),
        getSync: (key) => keychain.get(key) ?? null,
      })),
      provideService(Haptics.SOURCE, () => ({
        impactAsync: async (style) => void haptics.push(`impact:${style}`),
        notificationAsync: async (type) => void haptics.push(`notify:${type}`),
        selectionAsync: async () => void haptics.push('select'),
      })),
      provideService(DeepLinks.SOURCE, () => ({
        launchUrl: async () => options.launchUrl ?? null,
        subscribe: () => () => {},
        open() {},
      })),
    ],
  });
  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  const renderedText = () => nodes().map(textOf).join('\n');
  function finish() {
    for (let count = 0; count < 6; count++) {
      clock.flushMicrotasks();
      for (const stack of nodes().filter((node) => node.viewName === 'RNSScreenStack'))
        fabric.emit(stack, 'topFinishTransitioning');
    }
    clock.flushMicrotasks();
  }
  async function settle(predicate: () => boolean, what = 'wallet operation') {
    for (let count = 0; count < 100; count++) {
      finish();
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.ok(predicate(), `${what} did not settle`);
  }
  const byLabel = (label: string) => nodes().filter((n) => n.props['accessibilityLabel'] === label);
  const byText = (text: string, scope?: FakeNode) =>
    (scope ? flatten([scope]) : nodes()).filter((n) => n.props['text'] === text);
  const byTestId = (id: string) => nodes().find((n) => n.props['testID'] === id);
  /** Pressables, by role, whose own label or text matches. */
  function pressables(role: string, name: string | RegExp, scope?: FakeNode) {
    return (scope ? flatten([scope]) : nodes()).filter((node) => {
      if (node.instanceHandle.name !== 'pressable' || node.props['accessibilityRole'] !== role)
        return false;
      const label = String(node.props['accessibilityLabel'] ?? textOf(node));
      return typeof name === 'string' ? label === name : name.test(label);
    });
  }
  function press(node: FakeNode | undefined) {
    assert.ok(node, 'nothing to press');
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
  let eventCount = 0;
  function type(node: FakeNode | undefined, text: string) {
    assert.ok(node, 'nothing to type into');
    fabric.emit(node, 'topFocus', {});
    fabric.emit(node, 'topChange', { text, eventCount: ++eventCount });
    fabric.emit(node, 'topBlur', {});
    clock.flushMicrotasks();
  }
  return {
    fabric,
    clock,
    root,
    keychain,
    haptics,
    errors,
    navigation: () => navigation,
    nodes,
    renderedText,
    finish,
    settle,
    byLabel,
    byText,
    byTestId,
    pressables,
    press,
    type,
  };
}
export type Wallet = ReturnType<typeof bootWallet>;
