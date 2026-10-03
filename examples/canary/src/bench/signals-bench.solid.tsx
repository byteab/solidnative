/** @jsxImportSource @solid-native/platform/solid */
import { batch, createSelector, createSignal, onCleanup } from 'solid-js';
import { For } from '@solid-native/platform/solid';
import { Text, View } from '@solid-native/components/solid';
import { beginPhase, report, saveReport } from './fabric-instrument.ts';
import { ROWS, STEPS, STEP_MS, initial, rows as makeRows, styles, type Row } from './rows.ts';

/**
 * The benchmark screen in js-framework-benchmark's Solid style, beside the store one in
 * `solid-bench.solid.tsx`: rows in a signal, each row's label a signal of its own, and
 * `createSelector` for the selection, so a select touches the two rows it changes rather than
 * every row. Each step is written as that implementation writes it - a label set on its row's
 * signal, a new list set on the rows signal - with the same result as the step in `rows.ts`.
 */
interface LiveRow {
  readonly id: number;
  readonly style: Row['style'];
  label(): string;
  setLabel(label: string): void;
}

function live(row: Row): LiveRow {
  const [label, setLabel] = createSignal(row.label);
  return { id: row.id, style: row.style, label, setLabel };
}

export function SignalsBench() {
  beginPhase('mount');
  const [rows, setRows] = createSignal(initial().rows.map(live));
  const [selected, setSelected] = createSignal(-1);
  const isSelected = createSelector(selected);
  const [summary, setSummary] = createSignal('signals: measuring...');

  /** `rows.ts`'s steps, by name, as direct writes. */
  const steps: Record<string, () => void> = {
    replace: () => setRows(makeRows(ROWS, 1).map(live)),
    update10th: () =>
      batch(() => {
        const list = rows();
        for (let i = 0; i < list.length; i += 10) list[i]!.setLabel(list[i]!.label() + ' !!!');
      }),
    select: () => setSelected(rows()[5]!.id),
    label1: () => {
      const row = rows()[500]!;
      row.setLabel(row.label() + ' ?');
    },
    swap: () => {
      const list = rows().slice();
      [list[1], list[ROWS - 2]] = [list[ROWS - 2]!, list[1]!];
      setRows(list);
    },
    remove: () => setRows(rows().filter((_, i) => i !== 5)),
    append: () => setRows([...rows(), ...makeRows(ROWS, 2).map(live)]),
    clear: () => setRows([]),
  };

  const timers = STEPS.slice(1).map((step, i) =>
    setTimeout(
      () => {
        beginPhase(step.name);
        steps[step.name]!();
      },
      (i + 1) * STEP_MS,
    ),
  );
  timers.push(
    setTimeout(() => {
      const text = report();
      console.error(`[bench] signals | ${text.replace(/\n/g, ' | ')}`);
      saveReport(`[bench] signals | ${text.replace(/\n/g, ' | ')}`);
      setSummary(`signals\n${text}`);
    }, STEPS.length * STEP_MS),
  );
  onCleanup(() => timers.forEach(clearTimeout));

  return (
    <View style={styles.page}>
      <Text style={styles.head}>{summary()}</Text>
      <For each={rows()}>
        {(row) => (
          <View style={isSelected(row.id) ? styles.selected : row.style}>
            <Text style={styles.label}>{row.label()}</Text>
          </View>
        )}
      </For>
    </View>
  );
}
