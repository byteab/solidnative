/** @jsxImportSource @solid-native/platform/solid */
// The stand-ins for the native gesture and animation libraries, through the Vitest plugin: a
// worklet scroll drives a worklet style, and a gesture is found on its view.
import { afterEach, expect, test } from 'vitest';
import { Gesture } from 'react-native-gesture-handler';
import { ScrollView, View } from '@solid-native/components';
import { NativeGesture } from '@solid-native/components/gestures';
import {
  WorkletScroll,
  WorkletStyle,
  sharedValue,
  workletScroll,
  workletStyle,
} from '@solid-native/components/reanimated';
import { cleanup, fireEvent, gestureOf, render, screen } from '@solid-native/testing';

afterEach(cleanup);

test('a worklet scroll drives a worklet style, and a gesture is found on its view', async () => {
  const offset = sharedValue(0);
  const style = workletStyle([offset], (y) => ({ height: y.value }));
  const track = workletScroll([offset], (event, y) => {
    y.value = event.contentOffset.y;
  });
  const pan = Gesture.Pan();
  render(() => (
    <View>
      <View testID="banner" ref={WorkletStyle(() => style)} />
      <ScrollView testID="list" ref={WorkletScroll(() => track)} />
      <View testID="card" ref={NativeGesture(() => pan)} />
    </View>
  ));
  await fireEvent(screen.getByTestId('list'), 'scroll', { contentOffset: { x: 0, y: 7 } });
  expect(screen.getByTestId('banner').props['height']).toBe(7);
  expect(gestureOf(screen.getByTestId('card')).kind).toBe('Pan');
});
