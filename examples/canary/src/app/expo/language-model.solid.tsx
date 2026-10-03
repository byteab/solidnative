/** @jsxImportSource @solid-native/platform/solid */
import { createRenderEffect, createSignal, onCleanup } from 'solid-js';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { LanguageModel, type LanguageModelStream } from '@solid-native/expo/solid/language-model';
import { Show } from '@solid-native/platform/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';

const REASONS: Record<string, string> = {
  notEligible: 'This device or OS version cannot run the on-device model.',
  notEnabled: 'Apple Intelligence is switched off in Settings.',
  notReady: 'The model is still being prepared by the system.',
  downloadRequired: 'Gemini Nano needs downloading first.',
  downloading: 'Gemini Nano is downloading.',
  unknown: 'The platform gave a reason expo-local-llm does not name.',
  notInstalled: 'expo-local-llm is not in this build.',
};

export function LanguageModelPage() {
  const model = useService(LanguageModel),
    front = useService(SCREEN_IN_FRONT);
  const [prompt, setPrompt] = createSignal('Write a haiku about the Thames.');
  const [answer, setAnswer] = createSignal<LanguageModelStream | null>(null);
  let active = true,
    request = 0;
  createRenderEffect(() => {
    if (!front()) {
      request++;
      answer()?.cancel();
    }
  });
  onCleanup(() => {
    active = false;
    request++;
    answer()?.cancel();
  });
  const ask = () => {
    if (!active || !front()) return;
    const token = ++request;
    const next = model.stream(prompt(), { instructions: 'Answer briefly, in British English.' });
    if (active && front() && token === request) setAnswer(next);
    else next.cancel();
  };
  return (
    <>
      <NativeHeader title="On-device AI" />
      <KeyboardAvoidingView class="screen" keyboardVerticalOffset={100}>
        <ScrollView class="screen" contentContainerStyle={page.content}>
          <Text class="body">Availability: {model.availability()}</Text>
          <Show when={!model.available()}>
            <Text class="hint">{REASONS[model.availability()] ?? ''}</Text>
            <Pressable class="card" onPress={() => model.refresh()}>
              <Text class="button-label">Check again</Text>
            </Pressable>
          </Show>
          <TextInput
            class="field prompt"
            value={prompt()}
            onValueChange={setPrompt}
            placeholder="Ask something"
            placeholderTextColor="#6c6c78"
            multiline
            accessibilityLabel="On-device AI prompt"
          />
          <View style={page.row}>
            <Pressable class="button" style={{ flex: 1 }} onPress={ask}>
              <Text class="button-label">Ask</Text>
            </Pressable>
            <Show when={answer()?.status() === 'streaming'}>
              <Pressable class="card" style={{ flex: 1 }} onPress={() => answer()?.cancel()}>
                <Text class="button-label">Stop</Text>
              </Pressable>
            </Show>
          </View>
          <Show when={answer()}>
            {(stream) => (
              <>
                <Text class="hint">{stream().status()}</Text>
                <Text class="body">{stream().text()}</Text>
                <Show when={stream().error()}>
                  {(error) => <Text class="body danger">{error()}</Text>}
                </Show>
              </>
            )}
          </Show>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
