/** @jsxImportSource @solid-native/platform/solid */
import { For } from '@solid-native/platform/solid';
import { Pressable, ScrollView, Text } from '@solid-native/components/solid';
import { NativeHeader, type NativeRouteProps } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import { features } from './home-features.ts';

declare const __DEV__: boolean;

/** The full feature index; each existing feature retains its own native route. */
export function Home(props: NativeRouteProps) {
  const build = [
    `${typeof __DEV__ !== 'undefined' && __DEV__ ? 'dev' : 'release'} build`,
    'Solid native renderer',
    `first screen ${Date.now() - ((globalThis as { __started?: number }).__started ?? Date.now())}ms after the bundle started`,
  ].join(', ');
  return (
    <>
      <NativeHeader title="Solid Native" largeTitle />
      <ScrollView
        class="screen"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={page.content}
      >
        <Text class="hint">
          Real native views, no React in the render path. Pick a feature to exercise it.
        </Text>
        <For each={features}>
          {(feature) => (
            <Pressable
              class="card"
              onPress={() => {
                void props.navigation.push(feature.path);
              }}
            >
              <Text class="button-label">{feature.title}</Text>
              <Text class="hint">{feature.blurb}</Text>
            </Pressable>
          )}
        </For>
        <Text class="hint">{build}</Text>
      </ScrollView>
    </>
  );
}
