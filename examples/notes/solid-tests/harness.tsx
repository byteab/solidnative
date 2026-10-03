/** @jsxImportSource @solid-native/platform/solid */
import assert from 'node:assert/strict';
import { createNativeRoot } from '@solid-native/platform/solid';
import { registerPlatformComponents } from '@solid-native/fabric';
import {
  ColorScheme,
  Dialogs,
  Keyboard,
  SafeArea,
  provideService,
  type KeyboardMetrics,
  type ServiceBinding,
} from '@solid-native/device/solid';
import { Database } from '@solid-native/expo/solid/database';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { Network, type NetworkStatus } from '@solid-native/expo/solid/network';
import { Storage } from '@solid-native/expo/solid/store';
import type { NativeNavigation } from '@solid-native/router/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { FakeNotesApi, NOTES_API, type NotesApi } from '../src/app/api/notes-api.solid.ts';
import { NotesApplication } from '../src/app/app.config.solid.tsx';

export const OFFLINE: NetworkStatus = { connected: false, type: 'none', reachable: false };
export const ONLINE: NetworkStatus = { connected: true, type: 'wifi', reachable: true };

const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

export interface BootOptions {
  readonly platform?: 'ios' | 'android';
  readonly network?: NetworkStatus;
  readonly api?: NotesApi;
  /** Answers to confirmation dialogs, in order; a missing answer agrees. */
  readonly answers?: boolean[];
  readonly services?: readonly ServiceBinding[];
}

/** The real application, under its own scope, against fake Fabric and fake device sources. */
export function bootNotes(options: BootOptions = {}) {
  registerPlatformComponents(options.platform ?? 'ios');
  const fabric = createFakeFabric();
  const clock = createClock();
  const errors: unknown[] = [];
  const questions: string[] = [];
  const haptics: string[] = [];
  let status = options.network ?? OFFLINE;
  let networkListener: ((value: NetworkStatus) => void) | undefined;
  let keyboardListener: ((metrics: KeyboardMetrics) => void) | undefined;
  let navigation!: NativeNavigation;
  const root = createNativeRoot({
    fabric,
    clock,
    rootTag: 1,
    engineOptions: { globalStyles: { rules: [] }, onError: (error) => errors.push(error) },
  });
  root.render(() => (
    <NotesApplication
      onError={(error) => errors.push(error)}
      onNavigation={(value) => (navigation = value)}
      services={[
        provideService(
          NOTES_API,
          () => options.api ?? new FakeNotesApi([], { latencyMs: 0, failureRate: 0 }),
        ),
        provideService(Network.SOURCE, () => ({
          current: () => status,
          subscribe(listener) {
            networkListener = listener;
            return () => (networkListener = undefined);
          },
        })),
        provideService(Storage.SOURCE, () => null),
        provideService(Database.SOURCE, () => ({
          open: () => Promise.reject(new Error('No SQLite under Node.')),
        })),
        provideService(Haptics.SOURCE, () => ({
          impactAsync: async (style) => void haptics.push(`impact:${style}`),
          notificationAsync: async (type) => void haptics.push(`notify:${type}`),
          selectionAsync: async () => void haptics.push('select'),
        })),
        provideService(Dialogs.SOURCE, () => ({
          platform: options.platform ?? 'ios',
          alert(title, _message, buttons) {
            questions.push(title);
            const agree = options.answers?.shift() ?? true;
            buttons
              .find((button) => (agree ? button.style !== 'cancel' : button.style === 'cancel'))
              ?.onPress?.();
          },
        })),
        provideService(ColorScheme.SOURCE, () => ({
          current: () => 'light',
          subscribe: () => () => {},
        })),
        provideService(SafeArea.SOURCE, () => ({
          current: () => ({
            insets: { top: 47, right: 0, bottom: 34, left: 0 },
            frame: { x: 0, y: 0, width: 402, height: 874 },
          }),
          subscribe: () => () => {},
        })),
        provideService(Keyboard.SOURCE, () => ({
          subscribe(listener) {
            keyboardListener = listener;
            return () => (keyboardListener = undefined);
          },
          dismiss() {},
        })),
        ...(options.services ?? []),
      ]}
    />
  ));
  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  const text = () =>
    nodes()
      .filter((node) => node.props['text'] !== undefined)
      .map((node) => node.props['text'])
      .join('');
  const props = () => JSON.stringify(nodes().map((node) => node.props));
  const byLabel = (label: string) =>
    nodes().find((node) => node.props['accessibilityLabel'] === label);
  function finish() {
    for (let count = 0; count < 6; count++) {
      clock.flushMicrotasks();
      for (const stack of nodes().filter((node) => node.viewName === 'RNSScreenStack'))
        fabric.emit(stack, 'topFinishTransitioning');
    }
    clock.flushMicrotasks();
  }
  function touch(label: string, type: string) {
    const node = nodes().find(
      (node) =>
        node.instanceHandle.name === 'pressable' && node.props['accessibilityLabel'] === label,
    );
    assert.ok(node, label);
    const point = { identifier: 1, pageX: 1, pageY: 1 };
    fabric.emit(node, type, {
      ...point,
      changedTouches: [point],
      touches: type === 'topTouchEnd' ? [] : [point],
    });
    clock.flushMicrotasks();
  }
  function press(label: string) {
    touch(label, 'topTouchStart');
    touch(label, 'topTouchEnd');
  }
  async function longPress(label: string) {
    touch(label, 'topTouchStart');
    await new Promise((resolve) => setTimeout(resolve, 560));
    touch(label, 'topTouchEnd');
  }
  function input(label: string, value: string, eventCount = 1) {
    const node = byLabel(label);
    assert.ok(node, label);
    fabric.emit(node, 'topChange', { text: value, eventCount });
    clock.flushMicrotasks();
  }
  async function waitFor(predicate: () => boolean, message = 'notes did not settle') {
    for (let count = 0; count < 200; count++) {
      clock.flushMicrotasks();
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.ok(predicate(), message);
  }
  return {
    fabric,
    clock,
    root,
    errors,
    questions,
    haptics,
    navigation: () => navigation,
    nodes,
    text,
    props,
    byLabel,
    finish,
    press,
    longPress,
    input,
    waitFor,
    goOnline() {
      status = ONLINE;
      networkListener?.(status);
      clock.flushMicrotasks();
    },
    keyboard(height: number) {
      keyboardListener?.({ height });
      clock.flushMicrotasks();
    },
  };
}
