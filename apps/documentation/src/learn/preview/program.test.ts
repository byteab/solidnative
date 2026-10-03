import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, userEvent } from '@solid-native/testing';
import { libraries } from './native-entry.ts';
import { createProgram, ProblemError, type Problem } from './program.ts';

const ROW = `import { Pressable, Text } from '@solid-native/components/solid';

export function HabitRow(props: { name: string; done?: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => props.onToggle()}>
      <Text>{props.name}{props.done ? ' (done)' : ''}</Text>
    </Pressable>
  );
}
`;

const APP = `import { createMemo, createSignal } from 'solid-js';
import { Text, View } from '@solid-native/components/solid';
import { For } from '@solid-native/platform/solid';
import { HabitRow } from './habit-row';

export function App() {
  const [habits, setHabits] = createSignal([{ name: 'Walk', done: false }, { name: 'Read', done: true }]);
  const done = createMemo(() => habits().filter((h) => h.done).length);
  const flip = (name: string) =>
    setHabits((list) => list.map((h) => (h.name === name ? { ...h, done: !h.done } : h)));
  return (
    <View>
      <Text>{done()} done</Text>
      <For each={habits()}>
        {(habit) => <HabitRow name={habit.name} done={habit.done} onToggle={() => flip(habit.name)} />}
      </For>
    </View>
  );
}
`;

function problemOf(run: () => void): Problem {
  try {
    run();
  } catch (error) {
    if (error instanceof ProblemError) return error.problem;
    throw error;
  }
  throw new Error('Expected a problem');
}

const LIBRARIES = libraries();
const program = (files: Record<string, string>) => createProgram({ files, libraries: LIBRARIES });

describe('createProgram', () => {
  afterEach(() => cleanup());

  it('compiles two files that import each other and renders them with signals and props', async () => {
    const { App } = program({ 'app.tsx': APP, 'habit-row.tsx': ROW }).load('app.tsx') as {
      App: () => never;
    };
    render(App);
    expect(screen.getByText('1 done')).toBeTruthy();
    await userEvent.press(screen.getByText('Walk'));
    expect(screen.getByText('2 done')).toBeTruthy();
    expect(screen.getByText('Walk (done)')).toBeTruthy();
  });

  it('reports a syntax error at its line in the file', () => {
    const problem = problemOf(() =>
      program({ 'app.tsx': 'export function App() {\n  return <View>;\n}\n' }).load('app.tsx'),
    );
    expect(problem).toMatchObject({ kind: 'syntax', file: 'app.tsx', line: 2 });
  });

  it('says which files there are when an import names one that is not', () => {
    const problem = problemOf(() =>
      program({ 'app.tsx': "import { Row } from './row';\nexport const App = Row;" }).load(
        'app.tsx',
      ),
    );
    expect(problem.kind).toBe('import');
    expect(problem.message).toContain('app.tsx');
  });

  it('says what can be imported when a package is not available', () => {
    const problem = problemOf(() =>
      program({ 'app.tsx': "import { useState } from 'react';" }).load('app.tsx'),
    );
    expect(problem.kind).toBe('import');
    expect(problem.message).toContain('@solid-native/components/solid');
  });

  it('reports an error thrown while a file runs at its line', () => {
    const problem = problemOf(() =>
      program({ 'app.tsx': 'const a = 1;\n\nthrow new Error("broken");\n' }).load('app.tsx'),
    );
    expect(problem).toMatchObject({ kind: 'runtime', message: 'broken', file: 'app.tsx' });
    expect(problem.line).toBe(3);
  });

  it('stops a loop that never ends', () => {
    const problem = problemOf(() =>
      createProgram({
        files: { 'app.tsx': 'while (true) {}' },
        libraries: LIBRARIES,
        loopBudgetMs: 50,
      }).load('app.tsx'),
    );
    expect(problem.message).toContain('loop');
  });

  it('answers a .native.css import with what css makes of it', () => {
    const { sheet } = createProgram({
      files: {
        'app.tsx': "import sheet from './app.native.css';\nexport { sheet };",
        'app.native.css': '.a { flex: 1 }',
      },
      libraries: LIBRARIES,
      css: (file, source) => ({ file, source }),
    }).load('app.tsx');
    expect(sheet).toEqual({ file: 'app.native.css', source: '.a { flex: 1 }' });
  });
});
