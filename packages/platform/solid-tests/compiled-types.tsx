/** @jsxImportSource @solid-native/platform/solid */
import { For, Show } from '@solid-native/platform/solid';

export function NativeTypes() {
  return (
    <view>
      {/* @ts-expect-error DOM elements are not native elements. */}
      <div />
      {/* @ts-expect-error DOM attributes do not leak into native props. */}
      <view innerHTML="forbidden" />
      {/* @ts-expect-error For item type comes from each. */}
      <For each={[1]}>{(id: string) => <text>{id}</text>}</For>
      <Show when={{ name: 'native' }} keyed>
        {(item) => <text>{item.name}</text>}
      </Show>
    </view>
  );
}
