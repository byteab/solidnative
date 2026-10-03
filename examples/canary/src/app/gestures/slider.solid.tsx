/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { View, type NativeRef } from '@solid-native/components/solid';
import { useHostAdapter, withNativeStyles } from '@solid-native/platform/solid';
import type { NativeSyntheticEvent } from '@solid-native/fabric';
import sheet from './slider.native.css';

const pageX = (event: NativeSyntheticEvent<{ pageX?: number }>) => event.nativeEvent?.pageX ?? 0;
export function Slider(props: { value: number; onValueChange: (value: number) => void }) {
  const adapter = useHostAdapter();
  const [width, setWidth] = createSignal(1);
  let startX = 0,
    startValue = 0;
  const bind = (ref: NativeRef) => {
    const stop = adapter.engine.setResponder(ref.node, {
      onStartShouldSetResponder: () => true,
      onResponderGrant: (event) => {
        startX = pageX(event);
        startValue = props.value;
      },
      onResponderMove: (event) => {
        const delta = (pageX(event) - startX) / width();
        props.onValueChange(Math.min(1, Math.max(0, startValue + delta)));
      },
      onResponderTerminationRequest: () => false,
      blockNativeResponder: true,
    });
    onCleanup(stop);
  };
  return withNativeStyles(sheet, () => (
    <View
      class="slider-track"
      ref={bind}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: 1, now: props.value }}
      style={{ height: 36, justifyContent: 'center', borderRadius: 18, overflow: 'hidden' }}
      onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout?.width ?? 1))}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.round(props.value * 100)}%`,
          backgroundColor: '#3b6ef5',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: `${Math.round(props.value * 100)}%`,
          marginLeft: -14,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#ffffff',
        }}
      />
    </View>
  ));
}

/** Ancestor capture wins before the slider is allowed to claim a touch. */
export function captureGuard(locked: () => boolean) {
  const adapter = useHostAdapter();
  return (ref: NativeRef) => {
    const stop = adapter.engine.setResponder(ref.node, {
      onStartShouldSetResponderCapture: locked,
      onResponderGrant: () => {},
      onResponderRelease: () => {},
    });
    onCleanup(stop);
  };
}
