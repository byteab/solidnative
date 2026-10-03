/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { Show } from '@solid-native/platform/solid';
import { Pressable, ScrollView, Text, TextInput, View } from '@solid-native/components/solid';
import type { ScrollViewProps, TextInputProps } from '@solid-native/components/solid';

export function autofillFixture() {
  const [autoComplete, setAutoComplete] = createSignal<string>();
  const [textContentType, setTextContentType] = createSignal<string>();
  const [value, setValue] = createSignal('kept');
  const [selection, setSelection] = createSignal<TextInputProps['selection']>();
  const [accept, setAccept] = createSignal(false);
  const proposals: string[] = [];
  function Scene() {
    return (
      <TextInput
        testID="input"
        value={value()}
        autoComplete={autoComplete()}
        textContentType={textContentType()}
        selection={selection()}
        onValueChange={(next) => {
          proposals.push(next);
          if (accept()) setValue(next);
        }}
      />
    );
  }
  return {
    Scene,
    proposals,
    setAutoComplete,
    setTextContentType,
    setValue,
    setSelection,
    setAccept,
  };
}

export function keyboardTapFixture(initial?: ScrollViewProps['keyboardShouldPersistTaps']) {
  const [policy, setPolicy] = createSignal(initial);
  const [visible, setVisible] = createSignal(true);
  const [disabled, setDisabled] = createSignal(false);
  const [handler, setHandler] = createSignal(true);
  const counts = { presses: 0, oldScrolls: 0, newScrolls: 0 };
  function Scene() {
    return (
      <View testID="shell">
        <TextInput testID="outside-input" />
        <Show when={visible()}>
          <ScrollView
            testID="scroll"
            keyboardShouldPersistTaps={policy()}
            onScroll={handler() ? () => counts.oldScrolls++ : () => counts.newScrolls++}
          >
            <TextInput testID="input" />
            <View testID="blank" />
            <Pressable
              testID="button"
              disabled={disabled()}
              minPressDuration={0}
              onPress={() => counts.presses++}
            >
              <Text testID="label">Continue</Text>
            </Pressable>
          </ScrollView>
        </Show>
      </View>
    );
  }
  return {
    Scene,
    counts,
    setPolicy,
    setVisible,
    setDisabled,
    replaceScroll: () => setHandler(false),
  };
}

export function InvalidKeyboardTapPolicy() {
  // @ts-expect-error A native keyboard tap policy is one of the three supported strings.
  return <ScrollView keyboardShouldPersistTaps="sometimes" />;
}
