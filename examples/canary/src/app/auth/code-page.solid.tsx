/** @jsxImportSource @solidnative/platform/solid */
import { createSignal, onCleanup } from 'solid-js';
import { Show } from '@solidnative/platform/solid';
import { Pressable, ScrollView, Text, TextInput } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { Session } from './session.solid.ts';

export function CodePage() {
  const session = useService(Session);
  const [code, setCode] = createSignal('');
  const [problem, setProblem] = createSignal<string | null>(null);
  const [checking, setChecking] = createSignal(false);
  const validation = new AbortController();
  let active = true;
  onCleanup(() => {
    active = false;
    validation.abort();
  });
  async function check() {
    if (!active || checking()) return;
    setChecking(true);
    setProblem(null);
    try {
      const accepted = await session.checkCode(code(), validation.signal);
      if (active && !accepted) setProblem('That code is not right.');
    } catch {
      if (active) setProblem('Sign in could not finish. Try again.');
    } finally {
      if (active) setChecking(false);
    }
  }
  return (
    <>
      <NativeHeader title="Enter the code" />
      <ScrollView
        class="screen"
        contentContainerStyle={{ padding: 20, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          class="field"
          accessibilityLabel="Code"
          placeholder="6-digit code"
          value={code()}
          onValueChange={setCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
        />
        <Show when={problem()}>
          {(message) => (
            <Text class="danger" accessibilityRole="alert">
              {message()}
            </Text>
          )}
        </Show>
        <Pressable
          class="button"
          accessibilityRole="button"
          disabled={checking()}
          onPress={() => {
            void check();
          }}
        >
          <Text class="button-label">Continue</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
