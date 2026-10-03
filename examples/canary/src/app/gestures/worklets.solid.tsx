/** @jsxImportSource @solid-native/platform/solid */
import { createRenderEffect, createSignal, onCleanup } from 'solid-js';
import { cancelAnimation, interpolate, withRepeat, withTiming } from 'react-native-reanimated';
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import {
  WorkletScroll,
  WorkletStyle,
  sharedValue,
  workletScroll,
  workletStyle,
} from '@solid-native/components/solid/reanimated';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { For } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';

export function WorkletsPage() {
  const front = useService(SCREEN_IN_FRONT);
  const [status, setStatus] = createSignal('a busy loop, no timers');
  const scrolled = sharedValue(0),
    offset = sharedValue(0),
    frames = sharedValue(0);
  const scroll = workletScroll([scrolled], (event, into) => {
    'worklet';
    into.value = event.contentOffset.y;
  });
  const collapse = workletStyle([scrolled], (at) => {
    'worklet';
    const shrink = interpolate(at.value, [0, 120], [1, 0.35], 'clamp');
    return { opacity: shrink, transform: [{ scaleY: shrink }] };
  });
  // Count into a captured value, not an input to this mapper: that would feed back into itself.
  const slide = workletStyle([offset], (at) => {
    'worklet';
    frames.value = frames.value + 1;
    return { transform: [{ translateX: at.value }] };
  });
  const bannerRef = WorkletStyle(() => (front() ? collapse : null));
  const slideRef = WorkletStyle(() => (front() ? slide : null));
  const scrollRef = WorkletScroll(() => (front() ? scroll : null));
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    cancelAnimation(offset);
  };
  createRenderEffect(() => {
    if (!front()) stop();
  });
  onCleanup(() => {
    active = false;
    stop();
  });
  const run = () => {
    if (active && front()) offset.value = withRepeat(withTiming(200, { duration: 800 }), -1, true);
  };
  const block = () => {
    if (!active || !front()) return;
    clearTimeout(timer);
    // A separate task lets Fabric mount before deliberately blocking the JS runtime.
    timer = setTimeout(() => {
      timer = undefined;
      if (!active || !front()) return;
      const before = frames.value,
        until = Date.now() + 2000;
      while (Date.now() < until) {
        /* deliberately spinning */
      }
      if (active && front())
        setStatus(`${frames.value - before} worklet frames while it was blocked`);
    }, 400);
  };
  const track = { height: 64, justifyContent: 'center' };
  const box = {
    width: 72,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const label = { color: 'white', fontSize: 12 };
  const banner = {
    height: 90,
    backgroundColor: '#30d158',
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <>
      <NativeHeader title="Worklets" backTitle="Back" />
      <View style={banner} ref={bannerRef}>
        <Text class="button-label">scroll me</Text>
      </View>
      <ScrollView
        class="screen"
        contentContainerStyle={page.content}
        ref={scrollRef}
        scrollEventThrottle={16}
      >
        <Text class="hint">
          The box below is moved by a worklet: a function of ours running on the UI thread's own
          runtime, not an animation React Native was told to run.
        </Text>
        <View style={track}>
          <View style={box} ref={slideRef}>
            <Text style={label}>worklet</Text>
          </View>
        </View>
        <Pressable class="button" onPress={run}>
          <Text class="button-label">run</Text>
        </Pressable>
        <Pressable class="card" onPress={block}>
          <Text class="button-label">block the JS thread for 2s</Text>
          <Text class="hint">{status()}</Text>
        </Pressable>
        <Text class="hint">
          Scroll: the banner above collapses from a worklet reading the scroll offset. Block the
          thread and scroll - it keeps up, because none of it is here.
        </Text>
        <For each={Array.from({ length: 24 }, (_, i) => i)}>
          {(row) => (
            <View style={{ paddingVertical: 10 }}>
              <Text class="hint">row {row}</Text>
            </View>
          )}
        </For>
      </ScrollView>
    </>
  );
}
