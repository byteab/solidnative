/** @jsxImportSource @solidnative/platform/solid */
import { batch, createSelector, createSignal } from 'solid-js';
import { For } from '@solidnative/platform/solid';

import {
  ROWS,
  initial,
  rows as makeRows,
  styles,
  type Row,
} from '../../../examples/canary/src/bench/rows.ts';

/** The canary's signals bench (`signals-bench.solid.tsx`) without its instrument or timers. */
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
export function createRawSignalsBench() {
  let step!: (name: string) => void;
  function Bench() {
    const [rows, setRows] = createSignal(initial().rows.map(live));
    const [selected, setSelected] = createSignal(-1);
    const isSelected = createSelector(selected);
    const [summary] = createSignal('solid: measuring...');
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
    step = (name) => steps[name]!();
    return (
      <view style={styles.page}>
        <text style={styles.head}>{summary()}</text>
        <For each={rows()}>
          {(row) => (
            <view style={isSelected(row.id) ? styles.selected : row.style}>
              <text style={styles.label}>{row.label()}</text>
            </view>
          )}
        </For>
      </view>
    );
  }
  return { Bench, step: (name: string) => step(name) };
}
