/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { For, Show } from '@solidnative/platform/solid';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import {
  SCREEN_STEPS,
  people,
  screenStyles as s,
  type Person,
} from '../../../examples/canary/src/bench/screen.ts';

/** The canary's screen bench (`screen-bench.solid.tsx`) without its instrument or timers. */
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

export const SCREEN_PHASES = ['mount', ...SCREEN_STEPS];

export function createScreenBench() {
  let step!: (name: string) => void;
  function Bench() {
    const [shown, setShown] = createSignal(true);
    step = (name) => setShown(name.startsWith('remount'));
    return (
      <View style={s.root}>
        <Show when={shown()}>
          <ScrollView style={s.page} contentContainerStyle={s.content}>
            <Text style={s.title}>People</Text>
            <For each={people}>{(person) => <Card person={person} />}</For>
          </ScrollView>
        </Show>
      </View>
    );
  }
  return { Bench, step: (name: string) => step(name) };
}
