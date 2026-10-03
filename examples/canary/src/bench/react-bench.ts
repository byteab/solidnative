/**
 * The benchmark screen, React's - the same tree, the same script, React Native's own renderer.
 *
 * Written with `createElement` rather than JSX so the file goes through this project's transform
 * chain unchanged; JSX compiles to exactly these calls, so nothing about the comparison turns on
 * it. `React.memo` and other optimisations are deliberately absent, because the Solid side has
 * no equivalent applied either: both are the obvious way to write the screen.
 */
import { createElement, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { beginPhase, report, saveReport } from './fabric-instrument.ts';
import { STEPS, STEP_MS, initial, styles } from './rows.ts';

let opened = false;

export function ReactBench(): unknown {
  // The first render of the app component, which is where the Solid side opens its own phase.
  if (!opened) {
    opened = true;
    beginPhase('mount');
  }

  const [state, setState] = useState(initial);
  const [summary, setSummary] = useState('react: measuring...');

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
        console.error(`[bench] react | ${text.replace(/\n/g, ' | ')}`);
        saveReport(`[bench] react | ${text.replace(/\n/g, ' | ')}`);
        setSummary(`react\n${text}`);
      }, STEPS.length * STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return createElement(
    View,
    { style: styles.page },
    createElement(Text, { style: styles.head }, summary),
    ...state.rows.map((row) =>
      createElement(
        View,
        {
          key: row.id,
          style: row.id === state.selected ? styles.selected : row.style,
        },
        createElement(Text, { style: styles.label }, row.label),
      ),
    ),
  );
}
