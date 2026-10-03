/** @jsxImportSource @solidnative/platform/solid */
import { Show } from '@solidnative/platform/solid';
import { View } from '@solidnative/components';
import { GestureRoot, NativeGesture } from '@solidnative/components/solid/gestures';

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
