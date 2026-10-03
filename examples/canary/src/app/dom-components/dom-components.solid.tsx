/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { DomComponent } from '@solidnative/expo/solid/dom-component';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import { NativeHeader } from '@solidnative/router/solid';
import signature from './signature.dom.tsx';
import { page } from '../screen-styles.ts';

export function DomComponentsPage() {
  const foreground = useService(SCREEN_IN_FRONT);
  const [name, setName] = createSignal('Ada Lovelace');
  const [ink, setInk] = createSignal('#1c1c1e');
  const [strokes, setStrokes] = createSignal(0);
  return (
    <>
      <NativeHeader title="DOM components" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          The pad is a Solid component rendered by a browser, in a web view. The rest of the screen
          is native.
        </Text>
        <DomComponent
          src={signature}
          style={{ height: 240 }}
          foreground={foreground}
          inputs={{ name: name(), ink: ink() }}
          outputs={{ strokes: (count: number) => setStrokes(count), cleared: () => setStrokes(0) }}
        />
        <Text class="body">{strokes()} strokes (native text, from an output)</Text>
        <View style={page.row}>
          <Pressable
            class="button"
            onPress={() =>
              setName((value) => (value === 'Ada Lovelace' ? 'Grace Hopper' : 'Ada Lovelace'))
            }
          >
            <Text class="button-label">Change name</Text>
          </Pressable>
          <Pressable
            class="button"
            onPress={() => setInk((value) => (value === '#1c1c1e' ? '#c4002d' : '#1c1c1e'))}
          >
            <Text class="button-label">Change ink</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
