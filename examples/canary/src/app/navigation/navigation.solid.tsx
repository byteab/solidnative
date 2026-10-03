/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, ScrollView, Text } from '@solidnative/components/solid';
import { NativeHeader, useNavigation } from '@solidnative/router/solid';
import { page } from '../screen-styles.ts';

export function NavigationPage() {
  const nav = useNavigation();
  const push = () => {
    void nav.push('/detail');
  };
  const replace = () => {
    void nav.replace('/detail');
  };
  const presentSheet = () => {
    void nav.present('/sheet', {
      as: 'formSheet',
      presentation: {
        sheetAllowedDetents: [0.5, 1],
        sheetGrabberVisible: true,
        sheetCornerRadius: 20,
      },
    });
  };
  const presentFullScreen = () => {
    void nav.present('/sheet', {
      as: 'fullScreenModal',
      presentation: { stackAnimation: 'slide_from_bottom', gestureEnabled: false },
    });
  };
  const home = () => {
    void nav.reset('/');
  };
  return (
    <>
      <NativeHeader title="Navigation" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          Each of these lands on the same route. What changes is how the screen arrives and what it
          leaves behind.
        </Text>

        <Pressable
          class="button"
          onPress={() => {
            push();
          }}
        >
          <Text class="button-label">push</Text>
          <Text class="hint-on-accent">stacks on top; back returns here</Text>
        </Pressable>

        <Pressable
          class="card"
          onPress={() => {
            replace();
          }}
        >
          <Text class="button-label">replace</Text>
          <Text class="hint">supersedes this screen; back skips it</Text>
        </Pressable>

        <Pressable
          class="card"
          onPress={() => {
            presentSheet();
          }}
        >
          <Text class="button-label">present as a sheet</Text>
          <Text class="hint">half height, drag to resize or dismiss</Text>
        </Pressable>

        <Pressable
          class="card"
          onPress={() => {
            presentFullScreen();
          }}
        >
          <Text class="button-label">present full screen</Text>
          <Text class="hint">slides up; Close is the only way out</Text>
        </Pressable>

        <Pressable
          class="card"
          onPress={() => {
            home();
          }}
        >
          <Text class="button-label">reset to home</Text>
          <Text class="hint">empties the stack; nothing to go back to</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
