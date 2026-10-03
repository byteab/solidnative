/** @jsxImportSource @solidnative/platform/solid */
import { Text, ScrollView } from '@solidnative/components/solid';
import { NativeHeader } from '@solidnative/router/solid';
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
