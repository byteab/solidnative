/** @jsxImportSource @solid-native/platform/solid */
import { Text, ScrollView } from '@solid-native/components/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { CssDemo } from './css-demo.solid.tsx';
import { page } from '../screen-styles.ts';

export function CssPage() {
  return (
    <>
      <NativeHeader title="CSS" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          Everything below is styled by a styles: block. No bound style objects.
        </Text>
        <CssDemo />
      </ScrollView>
    </>
  );
}
