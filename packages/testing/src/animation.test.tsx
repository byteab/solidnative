/** @jsxImportSource @solid-native/platform/solid */
/**
 * Components using `@solid-native/components/gestures` and `/reanimated`, whose native libraries Node
 * cannot load: the register stands in for them, so the screen renders, a gesture's callbacks can be
 * called through `gestureOf`, and a worklet style settles where its animation ends.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createSignal } from 'solid-js';
import { Gesture } from 'react-native-gesture-handler';
import { Extrapolation, interpolate, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Pressable, ScrollView, Text, View } from '@solid-native/components';
import { GestureRoot, NativeGesture } from '@solid-native/components/gestures';
import {
  WorkletScroll,
  WorkletStyle,
  sharedValue,
  workletScroll,
  workletStyle,
} from '@solid-native/components/reanimated';
import { cleanup, fireEvent, gestureOf, render, screen, userEvent } from '@solid-native/testing';

afterEach(cleanup);

describe('an app wrapped in a gesture root', () => {
  function App(props: { onMove: () => void }) {
    const [count, setCount] = createSignal(0);
    const pan = Gesture.Pan()
      .minDistance(4)
      .onUpdate(() => props.onMove());
    const gesture = NativeGesture(() => pan);
    return (
      <GestureRoot>
        <View testID="card" ref={gesture}>
          <Text>{count()}</Text>
          <Pressable accessibilityRole="button" onPress={() => setCount(count() + 1)}>
            <Text>Tap</Text>
          </Pressable>
        </View>
      </GestureRoot>
    );
  }

  it('renders and takes presses', async () => {
    render(App, { props: { onMove() {} } });
    await userEvent.press(screen.getByRole('button'));
    assert.ok(screen.getByText('1'));
  });

  it('keeps the gesture view from being collapsed, and the callbacks callable', () => {
    let moved = 0;
    render(App, { props: { onMove: () => moved++ } });
    const card = screen.getByTestId('card');
    assert.equal(card.props['collapsable'], false);
    gestureOf(card).callbacks['onUpdate']!();
    assert.equal(moved, 1);
  });
});

describe('the gesture on a view', () => {
  function Swipe() {
    const [log, setLog] = createSignal<string[]>([]);
    const pan = Gesture.Pan().onEnd(() => setLog((l) => [...l, 'swiped']));
    const tap = Gesture.Tap().onEnd(() => setLog((l) => [...l, 'tapped']));
    const both = Gesture.Race(pan, Gesture.Exclusive(Gesture.LongPress(), tap));
    return (
      <View testID="row" ref={NativeGesture(() => both)}>
        <Text>{log().join(' ')}</Text>
      </View>
    );
  }

  it('is found from the view, and the one of a kind inside a composed gesture', async () => {
    render(Swipe);
    const row = screen.getByTestId('row');
    gestureOf(row, 'Pan').callbacks['onEnd']!();
    gestureOf(row, 'Tap').callbacks['onEnd']!();
    assert.equal(gestureOf(row).kind, 'Race');
    await screen.findByText('swiped tapped');
  });

  it('says so when the view has none, or none of that kind', () => {
    render(Swipe);
    assert.throws(() => gestureOf(screen.getByTestId('row'), 'Pinch'), /no Pinch gesture/);
    assert.throws(() => gestureOf(screen.getByText('')), /no gesture attached/);
  });

  it('is dropped when the view goes', () => {
    const { unmount } = render(Swipe);
    const row = screen.getByTestId('row');
    unmount();
    assert.throws(() => gestureOf(row), /no gesture attached/);
  });
});

describe('a component animated on the UI thread', () => {
  function Collapsing() {
    const [closed, setClosed] = createSignal(0);
    const offset = sharedValue(0);
    const collapse = workletStyle([offset], (y) => {
      'worklet';
      return {
        height: interpolate(y.value, [0, 100], [120, 40], Extrapolation.CLAMP),
        transform: [{ translateY: -y.value / 10 }],
      };
    });
    const track = workletScroll([offset], (event, y) => {
      'worklet';
      y.value = event.contentOffset.y;
    });
    const close = () => {
      offset.value = withTiming(100, { duration: 200 }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(() => setClosed((n) => n + 1));
      });
    };
    return (
      <View>
        <View testID="banner" ref={WorkletStyle(() => collapse)}>
          <Text>{closed()}</Text>
        </View>
        <ScrollView testID="list" ref={WorkletScroll(() => track)}>
          <Pressable accessibilityRole="button" onPress={close}>
            <Text>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  it('renders its worklet style from the shared values it reads', () => {
    render(Collapsing);
    assert.equal(screen.getByTestId('banner').props['height'], 120);
  });

  it('follows a scroll through a worklet scroll handler', async () => {
    render(Collapsing);
    await fireEvent(screen.getByTestId('list'), 'scroll', { contentOffset: { x: 0, y: 50 } });
    const banner = screen.getByTestId('banner');
    assert.equal(banner.props['height'], 80);
    assert.deepEqual(banner.props['transform'], [{ translateY: -5 }]);
  });

  it('finishes an animation at once, and calls back on the JS thread', async () => {
    render(Collapsing);
    await userEvent.press(screen.getByRole('button'));
    assert.equal(screen.getByTestId('banner').props['height'], 40);
    assert.ok(screen.getByText('1'));
  });
});
