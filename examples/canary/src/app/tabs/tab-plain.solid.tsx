/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
} from '@solidnative/components/solid';
import { Keyboard, useService } from '@solidnative/device/solid';
import { Unread } from './unread.solid.ts';
import { page } from '../screen-styles.ts';

export function TabSearch() {
  const keyboard = useService(Keyboard);
  return (
    <SafeAreaView class="screen" edges={['top']}>
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="heading">Search</Text>
        <TextInput
          class="field"
          placeholder="Type something, then switch tabs"
          placeholderTextColor="#6c6c78"
        />
        <Text class="hint">
          The keyboard is {keyboard.visible() ? `${keyboard.height()}pt tall` : 'down'}. This tab
          has no stack: it is one screen behind a bar item.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export function TabProfile() {
  const unread = useService(Unread);
  const [taps, setTaps] = createSignal(0);
  function tap() {
    setTaps((value) => value + 1);
    unread.add();
  }
  return (
    <SafeAreaView class="screen" edges={['top']}>
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="heading">Profile</Text>
        <Text class="body">Tapped {taps()} times.</Text>
        <Pressable class="button" onPress={tap}>
          <Text class="button-label">Tap me, then switch tabs</Text>
        </Pressable>
        <Pressable class="card" onPress={() => unread.clear()}>
          <Text class="button-label">Clear the badge</Text>
        </Pressable>
        <Text class="hint">
          The badge on this tab is bound to a signal this page changes, which is why the tabs are
          declared in a template rather than in the route config.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
