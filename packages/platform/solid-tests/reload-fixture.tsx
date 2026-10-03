/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, createRenderEffect, onCleanup } from 'solid-js';
import { onNativeCleanup } from '@solidnative/platform/solid';

export function createReloadFixture(fail = false) {
  const [count, setCount] = createSignal(0);
  const cleanup = { owner: 0, native: 0, event: 0 };
  function View() {
    onCleanup(() => cleanup.owner++);
    const result = (
      <view
        testID="reload-view"
        onTouchEnd={() => {
          cleanup.event++;
          setCount((value) => value + 1);
        }}
        ref={(node) => onNativeCleanup(node, () => cleanup.native++)}
      >
        <text>{count()}</text>
      </view>
    );
    if (fail) throw new Error('broken development render');
    return result;
  }
  return { View, count, setCount, cleanup };
}

export function createCleanupFailureFixture(failMount = false) {
  const [value, setValue] = createSignal(0);
  const values: number[] = [];
  const cleanups: string[] = [];
  const duplicate = () => {
    cleanups.push('duplicate');
  };
  function View() {
    createRenderEffect(() => {
      values.push(value());
    });
    createRenderEffect(() =>
      onCleanup(() => {
        cleanups.push('throwing child');
        throw new Error('throwing owner cleanup');
      }),
    );
    onCleanup(duplicate);
    onCleanup(duplicate);
    onCleanup(() => {
      cleanups.push('root');
    });
    const node = <view />;
    if (failMount) throw new Error('failed mount');
    return node;
  }
  return { View, setValue, values, cleanups };
}
