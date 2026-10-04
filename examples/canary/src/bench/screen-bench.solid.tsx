/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { For, Show } from '@solidnative/platform/solid';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { beginPhase, report, saveReport } from './fabric-instrument.ts';
import { STEP_MS } from './rows.ts';
import { SCREEN_STEPS, people, screenStyles as s, type Person } from './screen.ts';

/** The screen benchmark's page (`screen.ts`), Solid's. */
function Card(props: { person: Person }) {
  const [following, setFollowing] = createSignal(false);
  return (
    <Pressable style={s.card} onPress={() => {}}>
      <View style={s.avatar} />
      <View style={s.column}>
        <Text style={s.name}>{props.person.name}</Text>
        <Text style={s.meta}>
          {props.person.city} · {following() ? 'following' : 'not following'}
        </Text>
      </View>
      <Pressable style={s.button} onPress={() => setFollowing(!following())}>
        <Text style={s.buttonText}>{following() ? 'Following' : 'Follow'}</Text>
      </Pressable>
    </Pressable>
  );
}

function Page() {
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.title}>People</Text>
      <For each={people}>{(person) => <Card person={person} />}</For>
    </ScrollView>
  );
}

export function ScreenBench() {
  beginPhase('mount');
  const [shown, setShown] = createSignal(true);
  const [summary, setSummary] = createSignal('signals-screen: measuring...');
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
        console.error(`[bench] signals-screen | ${text.replace(/\n/g, ' | ')}`);
        saveReport(`[bench] signals-screen | ${text.replace(/\n/g, ' | ')}`);
        setSummary(`signals-screen\n${text}`);
      },
      (SCREEN_STEPS.length + 1) * STEP_MS,
    ),
  );
  onCleanup(() => timers.forEach(clearTimeout));
  return (
    <View style={s.root}>
      <Text style={s.head}>{summary()}</Text>
      <Show when={shown()}>
        <Page />
      </Show>
    </View>
  );
}
