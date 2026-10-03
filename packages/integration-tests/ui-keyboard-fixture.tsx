/** @jsxImportSource @solid-native/platform/solid */
import {
  Keyboard,
  LayoutAnimation,
  ServiceScope,
  provideService,
  type KeyboardMetrics,
  type NativeLayoutAnimation,
} from '@solid-native/device';
import { KeyboardAvoidingView, ScrollView, Text, View } from '@solid-native/components';
import { withNativeStyles } from '@solid-native/platform/solid';
import type { StyleSheet } from '@solid-native/fabric';

export type Behavior = 'padding' | 'height' | 'position';

/** `.padded { padding-bottom: 8px; border-top-width: 2px }`, as a compiled sheet. */
const padded: StyleSheet = {
  rules: [
    {
      compounds: [{ classes: ['padded'] }],
      combinators: [],
      specificity: 10,
      order: 0,
      declarations: { paddingBottom: 8, borderTopWidth: 2 },
    },
  ],
};

/**
 * One keyboard-avoiding view over a fake keyboard (and optionally a fake layout animation), in
 * the three shapes the cases need: a plain one with a caller offset, an editor with a body and a
 * bar, and one over a style and class of its own.
 */
export function createKeyboardFixture(options: {
  shape: 'offset' | 'editor' | 'styled';
  behavior?: Behavior;
  layout?: NativeLayoutAnimation;
}) {
  let emit: (metrics: KeyboardMetrics) => void = () => {};
  const services = [
    provideService(Keyboard.SOURCE, () => ({
      subscribe: (fn: (metrics: KeyboardMetrics) => void) => ((emit = fn), () => {}),
      dismiss: () => {},
    })),
    ...(options.layout
      ? [provideService(LayoutAnimation.SOURCE, () => options.layout as NativeLayoutAnimation)]
      : []),
  ];
  function Body() {
    if (options.shape === 'offset')
      return (
        <KeyboardAvoidingView keyboardVerticalOffset={20}>
          <View style={{ flex: 1 }}>
            <Text>rows</Text>
          </View>
        </KeyboardAvoidingView>
      );
    if (options.shape === 'editor')
      return (
        <KeyboardAvoidingView nativeID="avoider" behavior={options.behavior}>
          <ScrollView style={{ flex: 1 }}>
            <Text>body</Text>
          </ScrollView>
          <View style={{ height: 44 }}>
            <Text>12 words</Text>
          </View>
        </KeyboardAvoidingView>
      );
    return withNativeStyles(padded, () => (
      <KeyboardAvoidingView
        nativeID="avoider"
        class="padded"
        behavior={options.behavior}
        style={{ flex: 1, height: 900, paddingBottom: 12, backgroundColor: 'red' }}
        contentContainerStyle={{ flex: 1, bottom: 4 }}
      >
        <Text>body</Text>
      </KeyboardAvoidingView>
    ));
  }
  function View_() {
    return (
      <ServiceScope services={services}>
        <Body />
      </ServiceScope>
    );
  }
  return { View: View_, emit: (metrics: KeyboardMetrics) => emit(metrics) };
}
