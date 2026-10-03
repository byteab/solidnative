/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { View, Text, ScrollView, Pressable } from '@solidnative/components/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { Example, Section } from '../example.solid.tsx';
import { page } from '../screen-styles.ts';
import sheet from './css-engine.native.css';
import { withNativeStyles } from '@solidnative/platform/solid';

export function CssEnginePage() {
  const [moved, setMoved] = createSignal(false);

  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="CSS engine" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          Compiled at build time, resolved at match time. No parser ships to the device.
        </Text>

        <Section title="Units">
          <Example
            title="px and rem"
            note="rem is 16px, the web default. Native has no root font size to read, so one is
                chosen rather than guessed at."
            code={'width: 64px | 4rem'}
          >
            <View class="u-px"></View>
            <View class="u-rem"></View>
          </Example>
          <Example
            title="Percentages"
            note="Resolved during native layout against the parent, not at build time."
            code={'width: 40%'}
          >
            <View class="u-pct"></View>
          </Example>
          <Example
            title="Viewport units"
            note="vw and vh are the window, and they follow it: rotate the simulator and these
                change without anything re-rendering."
            code={'width: 50vw; height: 4vh'}
          >
            <View class="u-vw"></View>
          </Example>
          <Example
            title="em, against the font size in scope"
            note="The inner box is 2em of the text around it, so it grows with the paragraph rather
                than with the root."
            code={'width: 2em'}
          >
            <View class="em-host">
              <Text class="em-text">18px text</Text>
              <View class="em-box"></View>
            </View>
            <View class="em-host em-large">
              <Text class="em-text">28px text</Text>
              <View class="em-box"></View>
            </View>
          </Example>
        </Section>

        <Section title="Custom properties">
          <Example
            title="A token, and a rule that beats it"
            note="Both boxes read --brand. The second also carries a more specific rule, which has
                to win - a token is resolved late, and late is not the same as important."
            code={':root { --brand: ... }  and  .tinted.override { ... }'}
          >
            <View class="tinted"></View>
            <View class="tinted override"></View>
          </Example>
          <Example
            title="Arithmetic around one"
            note="calc() and max() over a token are folded at build time into a scale, an offset and
                a floor, so the device never sees an expression."
            code={'width: calc(var(--gap) * 8); height: max(var(--gap), 20px)'}
          >
            <View class="computed"></View>
          </Example>
        </Section>

        <Section title="Media queries">
          <Example
            title="prefers-color-scheme"
            note="Switch the simulator between light and dark: this repaints with no code involved,
                because the engine re-resolves the cascade when the condition changes."
            code={'@media (prefers-color-scheme: dark) { ... }'}
          >
            <View class="scheme">
              <Text class="scheme-label">light or dark</Text>
            </View>
          </Example>
          <Example
            title="width"
            note="Rotate the device. The engine keeps the conditions in step through
                watchConditions, which an app calls once next to mount."
            code={'@media (min-width: 500px) { ... }'}
          >
            <View class="wide">
              <Text class="wide-label">narrow or wide</Text>
            </View>
          </Example>
        </Section>

        <Section title="Motion">
          <Example
            title="transition"
            note="The property is eased on the JS thread and committed per frame. Tap to move it;
                tap again mid-flight and it carries on from where it had got to rather than
                snapping back."
            code={'transition: transform 400ms ease-in-out'}
          >
            <View class="track">
              <View class="slider" classList={{ 'slider-end': moved() }}></View>
            </View>
            <Pressable class="button" onPress={() => setMoved(!moved())}>
              <Text class="button-label">Move it</Text>
            </Pressable>
          </Example>
          <Example
            title="@keyframes"
            note="A named animation, running on repeat. Compiled to the same commits a transition
                makes, so nothing here is a native animation driver."
            code={'animation: pulse 1.2s ease-in-out infinite'}
          >
            <View class="pulse"></View>
          </Example>
        </Section>

        <Section title="Inheritance">
          <Example
            title="What crosses a boundary and what does not"
            note="Colour and font size inherit down through views to the text inside them; a border
                does not, because native has no notion of inheriting one."
            code={'the outer view sets color and fontSize'}
          >
            <View class="inherits">
              <Text>inherited from the view above</Text>
              <View>
                <Text>and through another view</Text>
              </View>
            </View>
          </Example>
        </Section>
      </ScrollView>
    </>
  ));
}
