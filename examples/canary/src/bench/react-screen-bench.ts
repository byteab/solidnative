/**
 * The screen benchmark's page (`screen.ts`), React's: the same tree with React Native's own
 * components and renderer. `createElement` rather than JSX, as in `react-bench.ts`.
 */
import { createElement, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { beginPhase, report, saveReport } from './fabric-instrument.ts';
import { STEP_MS } from './rows.ts';
import { SCREEN_STEPS, people, screenStyles as s, type Person } from './screen.ts';

let opened = false;

function Card({ person }: { person: Person }) {
  const [following, setFollowing] = useState(false);
  return createElement(
    Pressable,
    { style: s.card, onPress: () => {} },
    createElement(View, { style: s.avatar }),
    createElement(
      View,
      { style: s.column },
      createElement(Text, { style: s.name }, person.name),
      createElement(
        Text,
        { style: s.meta },
        person.city,
        ' · ',
        following ? 'following' : 'not following',
      ),
    ),
    createElement(
      Pressable,
      { style: s.button, onPress: () => setFollowing(!following) },
      createElement(Text, { style: s.buttonText }, following ? 'Following' : 'Follow'),
    ),
  );
}

function Page() {
  return createElement(
    ScrollView,
    { style: s.page, contentContainerStyle: s.content },
    createElement(Text, { style: s.title }, 'People'),
    ...people.map((person) => createElement(Card, { key: person.id, person })),
  );
}

export function ReactScreenBench(): unknown {
  if (!opened) {
    opened = true;
    beginPhase('mount');
  }
  const [shown, setShown] = useState(true);
  const [summary, setSummary] = useState('react-screen: measuring...');
  useEffect(() => {
    const timers = SCREEN_STEPS.map((step, i) =>
      setTimeout(
        () => {
          beginPhase(step);
          setShown(step.startsWith('remount'));
        },
        (i + 1) * STEP_MS,
      ),
    );
    timers.push(
      setTimeout(
        () => {
          const text = report();
          console.error(`[bench] react-screen | ${text.replace(/\n/g, ' | ')}`);
          saveReport(`[bench] react-screen | ${text.replace(/\n/g, ' | ')}`);
          setSummary(`react-screen\n${text}`);
        },
        (SCREEN_STEPS.length + 1) * STEP_MS,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return createElement(
    View,
    { style: s.root },
    createElement(Text, { style: s.head }, summary),
    shown ? createElement(Page) : null,
  );
}
