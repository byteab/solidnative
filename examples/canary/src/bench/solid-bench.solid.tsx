/** @jsxImportSource @solid-native/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { createStore, reconcile, unwrap } from 'solid-js/store';
import { For } from '@solid-native/platform/solid';
import { Text, View } from '@solid-native/components/solid';
import { beginPhase, report, saveReport } from './fabric-instrument.ts';
import { STEPS, STEP_MS, initial, styles } from './rows.ts';

/**
 * The benchmark screen, Solid's - the same tree and script as the React side, rendered by this
 * project's Solid native renderer.
 *
 * `reconcile` keyed by `id` is Solid's equivalent of React's `key`:
 * a step's fresh row objects update the existing row's label in place instead of replacing its
 * native views. The mount phase opens at the top of the component, where React opens its own.
 */
export function SolidBench() {
  beginPhase('mount');
  const [state, setState] = createStore(initial());
  const [summary, setSummary] = createSignal('solid: measuring...');

  const timers = STEPS.slice(1).map((step, i) =>
    setTimeout(
      () => {
        beginPhase(step.name);
        setState(reconcile(step.apply(unwrap(state)), { key: 'id' }));
      },
      (i + 1) * STEP_MS,
    ),
  );
  timers.push(
    setTimeout(() => {
      const text = report();
      console.error(
        `[bench] keys ${(globalThis as { __bench?: { gcKeys(): string } }).__bench?.gcKeys()}`,
      );
      console.error(`[bench] solid | ${text.replace(/\n/g, ' | ')}`);
      saveReport(`[bench] solid | ${text.replace(/\n/g, ' | ')}`);
      setSummary(`solid\n${text}`);
    }, STEPS.length * STEP_MS),
  );
  onCleanup(() => timers.forEach(clearTimeout));

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
