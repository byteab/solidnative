/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from '@solidnative/components/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { captureGuard, Slider } from './slider.solid.tsx';
import { page } from '../screen-styles.ts';

export function Gestures() {
  const [taps, setTaps] = createSignal(0),
    [last, setLast] = createSignal('nothing yet');
  const [value, setValue] = createSignal(0.35),
    [locked, setLocked] = createSignal(false);
  const guard = captureGuard(locked);
  const tap = (source: string) => {
    setTaps((n) => n + 1);
    setLast(source);
  };
  return (
    <>
      <NativeHeader title="Gestures" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="body">
          taps: <Text class="strong">{taps()}</Text> - last: <Text class="strong">{last()}</Text>
        </Text>
        <Pressable class="button" onPress={() => tap('pressable')}>
          <Text class="button-label">tap me (pressable)</Text>
        </Pressable>
        <TouchableOpacity class="card" onPress={() => tap('touchable-opacity')}>
          <Text class="button-label">tap me (touchable-opacity)</Text>
        </TouchableOpacity>
        <Pressable
          class="card"
          hitSlop={20}
          delayLongPress={400}
          onPress={() => tap('press')}
          onLongPress={() => tap('long press')}
        >
          <Text class="button-label">hold me (long press), or tap just outside</Text>
        </Pressable>
        <Text class="body" onPress={() => tap('text')}>
          a pressable text run
        </Text>
        <Text class="hint">
          Drag the slider: it blocks the scroll view and refuses to hand the gesture back. Lock it
          and an ancestor pre-empts it in the capture pass.
        </Text>
        <Text class="body">
          slider: <Text class="strong">{value().toFixed(2)}</Text>
        </Text>
        <View ref={guard}>
          <Slider value={value()} onValueChange={setValue} />
        </View>
        <Pressable class="card" onPress={() => setLocked(!locked())}>
          <Text class="button-label">{locked() ? 'capture ON' : 'capture OFF'}</Text>
        </Pressable>
        <Text class="hint">
          Drag starting on a button scrolls the page and must not fire a press.
        </Text>
      </ScrollView>
    </>
  );
}
