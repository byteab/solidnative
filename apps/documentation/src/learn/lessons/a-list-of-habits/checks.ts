import { render, screen, type FakeFabricNode } from '@solid-native/testing';
import { expect } from 'vitest';
import { check, parentOf } from '../../check.ts';
import { App } from './solution/app.tsx';

const HABITS = ['Drink water', 'Read ten pages', 'Walk'];

/** Every node above `node`, nearest first. */
function ancestorsOf(roots: readonly FakeFabricNode[], node: FakeFabricNode): FakeFabricNode[] {
  const found: FakeFabricNode[] = [];
  for (let parent = parentOf(roots, node); parent; parent = parentOf(roots, parent)) {
    found.push(parent);
  }
  return found;
}

const isScrollView = (node: FakeFabricNode) => node.viewName.endsWith('ScrollView');

check(
  1,
  'Every habit in the list is on screen',
  () => {
    render(App);
    for (const name of HABITS) expect(screen.getByText(name)).toBeTruthy();
  },
  'Add the habits signal to App, and wrap the card in <For each={habits()}>{(habit) => ...}</For>.',
);

check(
  1,
  'Each habit has a card of its own',
  () => {
    const { fabric } = render(App);
    const rows = HABITS.map((name) => parentOf(fabric.committed, screen.getByText(name)));
    expect(new Set(rows).size).toBe(3);
    for (const row of rows) expect(row?.props['flexDirection']).toBe('row');
  },
  'The whole <View class="habit"> goes inside the <For>, with {habit.name} in its first text.',
  { readsStyles: true },
);

check(
  2,
  'Each card says whether the habit is done',
  () => {
    render(App);
    expect(screen.getAllByText('To do')).toHaveLength(2);
    expect(screen.getAllByText('Done')).toHaveLength(1);
  },
  "Write {habit.done ? 'Done' : 'To do'} in the status text.",
);

check(
  2,
  'The count comes from the list',
  ({ file }) => {
    expect(file('app.tsx')).not.toMatch(/>\s*\d+ left to do/);
    render(App);
    expect(screen.getByText('2 left to do')).toBeTruthy();
  },
  'Add remaining = createMemo(() => ...) counting the habits that are not done, and show {remaining()} in place of the 3.',
);

check(
  2,
  'An empty list says so',
  ({ file }) => {
    expect(file('app.tsx')).toMatch(/fallback=\{[\s\S]*No habits yet/);
    render(App);
    expect(screen.queryByText('No habits yet')).toBeNull();
  },
  'Give the <For> a fallback, a <Text> that says No habits yet, for when the list is empty.',
);

check(
  3,
  'The habits scroll, and the title and count stay put',
  () => {
    const { fabric } = render(App);
    for (const name of HABITS) {
      expect(ancestorsOf(fabric.committed, screen.getByText(name)).some(isScrollView)).toBe(true);
    }
    for (const text of ['Today', '2 left to do']) {
      expect(ancestorsOf(fabric.committed, screen.getByText(text)).some(isScrollView)).toBe(false);
    }
  },
  'Import ScrollView, and put the <For> inside a <ScrollView>. Leave the title and the count above it.',
);

check(
  3,
  'The scrolling content spaces its rows',
  () => {
    const { fabric } = render(App);
    const row = parentOf(fabric.committed, screen.getByText('Drink water'))!;
    const content = parentOf(fabric.committed, row);
    expect(content && parentOf(fabric.committed, content)?.viewName).toMatch(/ScrollView$/);
    expect(content?.props['gap'] ?? content?.props['rowGap']).toBeGreaterThan(0);
  },
  'Give the scroll view contentContainerStyle={{ gap: 8 }}: the gap goes on the view that holds the rows, not on the scroll view itself.',
);
