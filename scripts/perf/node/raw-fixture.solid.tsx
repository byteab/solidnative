/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { For } from '@solid-native/platform/solid';
import { initial, styles } from '../../../examples/canary/src/bench/rows.ts';

/** The bench tree on raw intrinsics: isolates components' cost from the renderer's. */
export function RawBench() {
  const [state] = createStore(initial());
  const [summary] = createSignal('solid: measuring...');
  return (
    <view style={styles.page}>
      <text style={styles.head}>{summary()}</text>
      <For each={state.rows}>
        {(row) => (
          <view style={row.id === state.selected ? styles.selected : row.style}>
            <text style={styles.label}>{row.label}</text>
          </view>
        )}
      </For>
    </view>
  );
}
