/** @jsxImportSource react */
/**
 * The benchmark screen, React's, written the way the React team recommends for speed and compiled
 * by the React Compiler (`babel.config.js`): rows are memoized and told only whether they are
 * selected, so a step re-renders just the rows it changes; the list is its own component, so the
 * summary text does not re-render it. The same tree, steps and styles as `react-bench.ts`.
 */
import { memo, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { beginPhase, report, saveReport } from './fabric-instrument.ts';
import { STEPS, STEP_MS, initial, styles, type Row as RowData, type State } from './rows.ts';

const Row = memo(function Row({ row, selected }: { row: RowData; selected: boolean }) {
  return (
    <View style={selected ? styles.selected : row.style}>
      <Text style={styles.label}>{row.label}</Text>
    </View>
  );
});

function List({ state }: { state: State }) {
  return (
    <>
      {state.rows.map((row) => (
        <Row key={row.id} row={row} selected={row.id === state.selected} />
      ))}
    </>
  );
}

export function ReactCompiledBench() {
  // The first render opens the mount phase, as in `react-bench.ts`; a lazy initial state runs
  // exactly then, where a module flag set during render is something the compiler refuses.
  const [state, setState] = useState(() => {
    beginPhase('mount');
    return initial();
  });
  const [summary, setSummary] = useState('react-compiled: measuring...');
  useEffect(() => {
    const timers = STEPS.slice(1).map((step, i) =>
      setTimeout(
        () => {
          beginPhase(step.name);
          setState(step.apply);
        },
        (i + 1) * STEP_MS,
      ),
    );
    timers.push(
      setTimeout(() => {
        const text = report();
        console.error(`[bench] react-compiled | ${text.replace(/\n/g, ' | ')}`);
        saveReport(`[bench] react-compiled | ${text.replace(/\n/g, ' | ')}`);
        setSummary(`react-compiled\n${text}`);
      }, STEPS.length * STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <View style={styles.page}>
      <Text style={styles.head}>{summary}</Text>
      <List state={state} />
    </View>
  );
}
