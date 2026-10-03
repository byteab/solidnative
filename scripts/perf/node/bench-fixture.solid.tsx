/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { createStore, reconcile, unwrap } from 'solid-js/store';
import { For } from '@solid-native/platform/solid';
import { Text, View } from '@solid-native/components/solid';
import { STEPS, initial, styles } from '../../../examples/canary/src/bench/rows.ts';

/** The canary SolidBench tree and steps without device instrumentation or timers. */
export function createBench() {
  let step!: (name: string) => void;
  function Bench() {
    const [state, setState] = createStore(initial());
    const [summary] = createSignal('solid: measuring...');
    step = (name) => {
      const s = STEPS.find((x) => x.name === name)!;
      setState(reconcile(s.apply(unwrap(state)), { key: 'id' }));
    };
    return (
      <View style={styles.page}>
        <Text style={styles.head}>{summary()}</Text>
        <For each={state.rows}>
          {(row) => (
            <View style={row.id === state.selected ? styles.selected : row.style}>
              <Text style={styles.label}>{row.label}</Text>
            </View>
          )}
        </For>
      </View>
    );
  }
  return { Bench, step: (name: string) => step(name) };
}

/** Diagnosis only (not the benchmark): the same tree from a plain signal, to price the store. */
export function PlainBench() {
  const [state] = createSignal(initial());
  return (
    <View style={styles.page}>
      <Text style={styles.head}>plain</Text>
      <For each={state().rows}>
        {(row) => (
          <View style={row.id === state().selected ? styles.selected : row.style}>
            <Text style={styles.label}>{row.label}</Text>
          </View>
        )}
      </For>
    </View>
  );
}
