/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Gesture } from 'react-native-gesture-handler';
import { ScrollView, Text, View } from '@solid-native/components/solid';
import { GestureRoot, NativeGesture } from '@solid-native/components/solid/gestures';
import { WorkletStyle, sharedValue, workletStyle } from '@solid-native/components/solid/reanimated';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { withNativeStyles } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import sheet from './native-gestures.native.css';

export function NativeGesturesPage() {
  const front = useService(SCREEN_IN_FRONT);
  const [taps, setTaps] = createSignal(0),
    [status, setStatus] = createSignal('a busy loop, no timers');
  let active = true;
  onCleanup(() => {
    active = false;
  });
  const x = sharedValue(0),
    y = sharedValue(0),
    held = sharedValue(0),
    origin = sharedValue(0);
  const drag = workletStyle([x, y], (dx, dy) => {
    'worklet';
    return { transform: [{ translateX: dx.value }, { translateY: dy.value }] };
  });
  const nudge = workletStyle([held], (offset) => {
    'worklet';
    return { transform: [{ translateX: offset.value }] };
  });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      if (active && front()) setTaps((n) => n + 1);
    });
  const hold = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      if (!active || !front()) return;
      const until = Date.now() + 2000;
      while (Date.now() < until) {
        /* deliberately spinning */
      }
      if (active && front()) setStatus('the box kept up, because it was never here');
    });
  const manual = Gesture.Manual()
    .onTouchesDown((event, manager) => {
      'worklet';
      origin.value = event.allTouches[0]!.absoluteX - held.value;
      manager.activate();
    })
    .onTouchesMove((event) => {
      'worklet';
      held.value = event.allTouches[0]!.absoluteX - origin.value;
    })
    .onTouchesUp((_event, manager) => {
      'worklet';
      manager.end();
    });
  const pan = Gesture.Pan().onChange((event) => {
    'worklet';
    x.value = x.value + event.changeX;
    y.value = y.value + event.changeY;
  });
  const panRef = NativeGesture(() => (front() ? pan : null)),
    dragRef = WorkletStyle(() => (front() ? drag : null));
  const manualRef = NativeGesture(() => (front() ? manual : null)),
    nudgeRef = WorkletStyle(() => (front() ? nudge : null));
  const tapRef = NativeGesture(() => (front() ? tap : null)),
    holdRef = NativeGesture(() => (front() ? hold : null));
  const box = {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const smallBox = {
    marginTop: 12,
    width: 140,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#30d158',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const label = { color: 'white', fontSize: 13 };
  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Native gestures" backTitle="Back" />
      <GestureRoot>
        <ScrollView class="screen" contentContainerStyle={page.content}>
          <Text class="hint">
            Drag the box. The pan is recognised by the platform and its callback is a worklet, so
            the drag never reaches the JavaScript thread - press hold, then drag while it is
            blocked.
          </Text>
          <View class="field-area">
            <View
              style={box}
              collapsable={false}
              ref={(ref) => {
                panRef(ref);
                dragRef(ref);
              }}
            >
              <Text style={label}>drag me</Text>
            </View>
            <View
              style={smallBox}
              collapsable={false}
              ref={(ref) => {
                manualRef(ref);
                nudgeRef(ref);
              }}
            >
              <Text style={label}>touches</Text>
            </View>
          </View>
          <View class="card" collapsable={false} ref={holdRef}>
            <Text class="button-label">block the JS thread for 2s</Text>
            <Text class="hint">{status()}</Text>
          </View>
          <View class="card" collapsable={false} ref={tapRef}>
            <Text class="button-label">tap me</Text>
            <Text class="hint">a plain callback, on the JavaScript thread. Taps: {taps()}</Text>
          </View>
        </ScrollView>
      </GestureRoot>
    </>
  ));
}
