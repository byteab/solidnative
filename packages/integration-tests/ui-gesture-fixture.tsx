/** @jsxImportSource @solid-native/platform/solid */
import { Show } from '@solid-native/platform/solid';
import { View } from '@solid-native/components';
import { GestureRoot, NativeGesture } from '@solid-native/components/solid/gestures';

/** A view carrying whichever gesture it is given, inside the gesture handler's root view. */
export function GestureHost(props: { gesture: unknown; shown?: boolean }) {
  return (
    <GestureRoot testID="root">
      <Show when={props.shown !== false}>
        <View testID="target" ref={NativeGesture(() => props.gesture as never)} />
      </Show>
    </GestureRoot>
  );
}
