import assert from 'node:assert/strict';
import { createSignal } from 'solid-js';
import { registerPlatformComponents } from '@solid-native/fabric';
import type { PlayerState } from '@solid-native/expo/solid/player';
import {
  ColorScheme,
  DeepLinks,
  HardwareBack,
  SafeArea,
  Screen,
  provideService,
  type ConditionSources,
} from '@solid-native/device/solid';
import { registerExpoUiViews } from '@solid-native/expo/views';
import { KeepAwake } from '@solid-native/expo/solid/keep-awake';
import type { NativeNavigation } from '@solid-native/router/solid';
import {
  createClock,
  createFakeFabric,
  type FakeNode,
} from '../../../packages/platform/solid-tests/fake-fabric.ts';
import { mountMusic } from '../src/bootstrap.solid.tsx';
import {
  TRACK_PLAYER,
  fakeTrackPlayer,
  type TrackPlayer,
} from '../src/app/player/track-player.solid.ts';

export interface RecordingPlayer extends TrackPlayer {
  /** What a decoder would report on its own: the end of a track. */
  report(change: Partial<PlayerState>): void;
}

/** `fakeTrackPlayer`, with every call logged and decoder reports injectable. */
function recordingPlayer(base: TrackPlayer, calls: string[]): RecordingPlayer {
  const [reported, setReported] = createSignal<Partial<PlayerState>>({});
  const log =
    <A extends unknown[]>(name: string, run: (...args: A) => void) =>
    (...args: A) => {
      calls.push([name, ...args].join(' '));
      setReported({});
      run(...args);
    };
  return {
    state: () => ({ ...base.state(), ...reported() }),
    replace: log('replace', base.replace),
    play: log('play', base.play),
    pause: log('pause', base.pause),
    seekTo: log('seek', base.seekTo),
    setLoop: log('loop', base.setLoop),
    report: setReported,
  };
}

export const flatten = (nodes: readonly FakeNode[]): FakeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

/** The real entry (`mountMusic`) over fake Fabric; only device sources and audio are faked. */
export function bootMusic(platform: 'ios' | 'android' = 'ios') {
  registerPlatformComponents(platform);
  registerExpoUiViews(platform);
  const fabric = createFakeFabric();
  const clock = createClock();
  const errors: unknown[] = [];
  const awake: string[] = [];
  const players: RecordingPlayer[] = [];
  const calls: string[] = [];
  let scheme: 'light' | 'dark' = 'light';
  const schemeListeners = new Set<(value: 'light' | 'dark') => void>();
  const colors = {
    current: () => scheme,
    subscribe: (listener: (value: 'light' | 'dark') => void) => {
      schemeListeners.add(listener);
      return () => schemeListeners.delete(listener);
    },
  };
  const backHandlers: (() => boolean)[] = [];
  const window = { width: 402, height: 874 };
  const conditions: ConditionSources = {
    screen: { current: () => ({ window, screen: window }), subscribe: () => () => {} },
    colors,
    settings: { current: () => ({ reduceMotion: false, fontScale: 1 }), subscribe: () => () => {} },
    fontScale: () => 1,
  };
  let navigation!: NativeNavigation;
  const root = mountMusic({
    fabric,
    clock,
    rootTag: 1,
    tailwind: { rules: [] },
    conditions,
    engineOptions: { tokens: {}, onError: (error) => errors.push(error) },
    onError: (error) => errors.push(error),
    onNavigation: (value) => (navigation = value),
    services: [
      provideService(TRACK_PLAYER, () => (initial: number) => {
        const player = recordingPlayer(fakeTrackPlayer(initial), calls);
        players.push(player);
        return player;
      }),
      provideService(KeepAwake.SOURCE, () => ({
        activate: async (tag: string) => void awake.push(`activate ${tag}`),
        deactivate: async (tag: string) => void awake.push(`deactivate ${tag}`),
      })),
      provideService(ColorScheme.SOURCE, () => colors),
      provideService(DeepLinks.SOURCE, () => ({
        launchUrl: () => Promise.resolve(null),
        subscribe: () => () => {},
        open: () => {},
      })),
      provideService(HardwareBack.SOURCE, () => ({
        subscribe: (listener: () => boolean) => {
          backHandlers.push(listener);
          return () => backHandlers.splice(backHandlers.indexOf(listener), 1);
        },
      })),
      provideService(Screen.SOURCE, () => conditions.screen),
      provideService(SafeArea.SOURCE, () => ({ current: () => null, subscribe: () => () => {} })),
    ],
  });

  const nodes = () => flatten(fabric.roots.get(1) ?? []);
  const texts = (scope?: FakeNode) =>
    (scope ? flatten([scope]) : nodes())
      .filter((node) => node.props['text'] !== undefined)
      .map((node) => String(node.props['text']));
  const byTestId = (id: string) => {
    const node = nodes().find((node) => node.props['testID'] === id);
    assert.ok(node, `testID ${id}`);
    return node;
  };
  const queryTestId = (id: string) => nodes().find((node) => node.props['testID'] === id);
  /** A pressable named by its accessibility label, or by the text inside it. */
  const button = (name: string | RegExp, scope?: FakeNode) => {
    const matches = (value: unknown) =>
      typeof name === 'string' ? value === name : name.test(String(value ?? ''));
    const candidates = (scope ? flatten([scope]) : nodes()).filter(
      (node) => node.instanceHandle.name === 'pressable',
    );
    const node =
      candidates.find((node) => matches(node.props['accessibilityLabel'])) ??
      candidates.find((node) => texts(node).some(matches));
    assert.ok(node, `button ${String(name)}`);
    assert.equal(node.props['accessibilityRole'], 'button');
    return node;
  };
  function settle() {
    for (let count = 0; count < 8; count++) {
      clock.flushMicrotasks();
      for (const stack of nodes().filter((node) => node.viewName === 'RNSScreenStack'))
        fabric.emit(stack, 'topFinishTransitioning');
    }
    clock.flushMicrotasks();
  }
  async function idle() {
    for (let count = 0; count < 12; count++) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      settle();
    }
  }
  async function press(name: string | RegExp, scope?: FakeNode) {
    const node = button(name, scope);
    for (const type of ['topTouchStart', 'topTouchEnd']) {
      const touch = { identifier: 1, pageX: 1, pageY: 1 };
      fabric.emit(node, type, {
        ...touch,
        changedTouches: [touch],
        touches: type === 'topTouchEnd' ? [] : [touch],
      });
    }
    await idle();
  }
  function theme(value: 'light' | 'dark') {
    scheme = value;
    for (const listener of schemeListeners) listener(value);
    clock.flushMicrotasks();
  }
  return {
    fabric,
    clock,
    root,
    errors,
    awake,
    players,
    calls,
    backHandlers,
    navigation: () => navigation,
    nodes,
    texts,
    byTestId,
    queryTestId,
    button,
    press,
    settle,
    idle,
    theme,
  };
}
