/** @jsxImportSource @solidnative/platform/solid */
import { batch, createSelector, createSignal } from 'solid-js';
import { For } from '@solidnative/platform/solid';
import { Text, View } from '@solidnative/components/solid';
import type { StyleRule, StyleSheet } from '@solidnative/fabric';
import tailwind from '../../../examples/canary/.solidnative/app.tailwind.js';
import {
  ROWS,
  initial,
  rows as makeRows,
  type Row,
} from '../../../examples/canary/src/bench/rows.ts';

/**
 * The signals bench styled the way a Tailwind app styles it: every element by `class`, under a
 * global sheet. The sheet is the canary's real Tailwind output with the utilities these rows use
 * appended, compiled as the Metro plugin compiles them; the tree and steps are the signals
 * bench's.
 */
const utilities: Record<string, Record<string, unknown>> = {
  'flex-1': { flex: 1 },
  'pt-15': { paddingTop: 60 },
  'px-3': { paddingHorizontal: 12 },
  'bg-black': { backgroundColor: '#000000' },
  'text-white': { color: '#ffffff' },
  'text-[11px]': { fontSize: 11 },
  'mb-2': { marginBottom: 8 },
  'py-1.5': { paddingVertical: 6 },
  'px-2.5': { paddingHorizontal: 10 },
  'rounded-lg': { borderRadius: 8 },
  'mb-1': { marginBottom: 4 },
  'bg-tint-0': { backgroundColor: '#1c1c1e' },
  'bg-tint-1': { backgroundColor: '#232326' },
  'bg-tint-2': { backgroundColor: '#2a2a33' },
  'bg-accent': { backgroundColor: '#0a84ff' },
  'text-label': { color: '#e5e5ea' },
  'text-xs': { fontSize: 12 },
};
const base = tailwind.rules.length;
export const sheet: StyleSheet = {
  ...tailwind,
  rules: [
    ...tailwind.rules,
    ...Object.entries(utilities).map(([name, declarations], i): StyleRule => ({
      compounds: [{ classes: [name] }],
      combinators: [],
      specificity: 1000,
      order: base + i,
      declarations,
    })),
  ],
};

const ROW = 'py-1.5 px-2.5 rounded-lg mb-1';
const TINTS = ['#1c1c1e', '#232326', '#2a2a33'];
const tintClass = (style: Row['style']) =>
  `${ROW} bg-tint-${TINTS.indexOf(style['backgroundColor'] as string)}`;

interface LiveRow {
  readonly id: number;
  readonly style: Row['style'];
  readonly cls: string;
  label(): string;
  setLabel(label: string): void;
}
function live(row: Row): LiveRow {
  const [label, setLabel] = createSignal(row.label);
  return { id: row.id, style: row.style, cls: tintClass(row.style), label, setLabel };
}

export function createTailwindBench() {
  let step!: (name: string) => void;
  function Bench() {
    const [rows, setRows] = createSignal(initial().rows.map(live));
    const [selected, setSelected] = createSignal(-1);
    const isSelected = createSelector(selected);
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
      <View class="flex-1 pt-15 px-3 bg-black">
        <Text class="text-white text-[11px] mb-2">tailwind: measuring...</Text>
        <For each={rows()}>
          {(row) => (
            <View class={isSelected(row.id) ? `${ROW} bg-accent` : row.cls}>
              <Text class="text-label text-xs">{row.label()}</Text>
            </View>
          )}
        </For>
      </View>
    );
  }
  return { Bench, step: (name: string) => step(name) };
}
