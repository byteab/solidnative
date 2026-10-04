/** @jsxImportSource react */
/**
 * The screen benchmark's page, React's, compiled by the React Compiler (`babel.config.js`) and
 * written for speed: cards are memoized, and the page is its own component so the summary text
 * does not re-render it. The same tree as `react-screen-bench.ts`.
 */
import { memo, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { beginPhase, report, saveReport } from './fabric-instrument.ts';
import { STEP_MS } from './rows.ts';
import { SCREEN_STEPS, people, screenStyles as s, type Person } from './screen.ts';

const Card = memo(function Card({ person }: { person: Person }) {
  const [following, setFollowing] = useState(false);
  return (
    <Pressable style={s.card} onPress={() => {}}>
      <View style={s.avatar} />
      <View style={s.column}>
        <Text style={s.name}>{person.name}</Text>
        <Text style={s.meta}>
          {person.city} · {following ? 'following' : 'not following'}
        </Text>
      </View>
      <Pressable style={s.button} onPress={() => setFollowing(!following)}>
        <Text style={s.buttonText}>{following ? 'Following' : 'Follow'}</Text>
      </Pressable>
    </Pressable>
  );
});

function Page() {
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.title}>People</Text>
      {people.map((person) => (
        <Card key={person.id} person={person} />
      ))}
    </ScrollView>
  );
}

export function ReactCompiledScreenBench() {
  // The first render opens the mount phase (see `react-compiled-bench.tsx`).
  const [shown, setShown] = useState(() => {
    beginPhase('mount');
    return true;
  });
  const [summary, setSummary] = useState('react-compiled-screen: measuring...');
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
          console.error(`[bench] react-compiled-screen | ${text.replace(/\n/g, ' | ')}`);
          saveReport(`[bench] react-compiled-screen | ${text.replace(/\n/g, ' | ')}`);
          setSummary(`react-compiled-screen\n${text}`);
        },
        (SCREEN_STEPS.length + 1) * STEP_MS,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <View style={s.root}>
      <Text style={s.head}>{summary}</Text>
      {shown ? <Page /> : null}
    </View>
  );
}
