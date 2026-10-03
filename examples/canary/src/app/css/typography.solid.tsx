/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { View, Text, ScrollView } from '@solid-native/components/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { Example, Section } from '../example.solid.tsx';
import { page } from '../screen-styles.ts';
import sheet from './typography.native.css';
import { For, withNativeStyles } from '@solid-native/platform/solid';

const SAMPLE =
  'The quick brown fox jumps over the lazy dog, and then keeps going for long enough to wrap.';

export function TypographyPage() {
  const sample = SAMPLE;
  const sizes = [12, 14, 16, 20, 28];
  const weights = ['300', '400', '600', '800'] as const;
  const alignments = ['left', 'center', 'right', 'justify'] as const;
  const [taps, setTaps] = createSignal(0);

  const italic = { fontSize: 17, fontStyle: 'italic' };
  const twoUp = { flexDirection: 'row', gap: 12 };
  const col = { fontSize: 13, flex: 1 };
  const colLoose = { fontSize: 13, flex: 1, lineHeight: 30 };
  const tracked = { fontSize: 16, letterSpacing: 2 };
  const tightTracked = { fontSize: 16, letterSpacing: -0.5 };
  const underline = {
    fontSize: 16,
    textDecorationLine: 'underline',
  };
  const strike = {
    fontSize: 16,
    textDecorationLine: 'line-through',
  };
  const upper = { fontSize: 16, textTransform: 'uppercase' };
  const caps = { fontSize: 16, textTransform: 'capitalize' };
  const paragraph = { fontSize: 16, lineHeight: 24 };
  const strong = { fontWeight: '700' };
  const pill = {
    width: 30,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#c83ca0',
  };
  const link = { fontSize: 16, textDecorationLine: 'underline' };

  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Typography" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint">
          Real text nodes, laid out by the platform. Everything here is a property of the text, not
          of a box around it.
        </Text>

        <Section title="Size and weight">
          <Example title="A type scale" code={'fontSize: 12 | 14 | 16 | 20 | 28'}>
            <For each={sizes}>
              {(size) => (
                <>
                  <Text class="ink" style={{ fontSize: size }}>
                    {size}px sample
                  </Text>{' '}
                </>
              )}
            </For>
          </Example>
          <Example
            title="Weights"
            note="Native maps these onto the family's real cuts; a family with no medium cut will
                round to the nearest it has."
            code={"fontWeight: '300' ... '800'"}
          >
            <For each={weights}>
              {(weight) => (
                <>
                  <Text class="ink" style={{ fontSize: 17, fontWeight: weight }}>
                    {weight} - the quick brown fox
                  </Text>{' '}
                </>
              )}
            </For>
          </Example>
          <Example title="Italic" code={"fontStyle: 'italic'"}>
            <Text class="ink" style={italic}>
              Slanted, from the family's own italic cut
            </Text>
          </Example>
        </Section>

        <Section title="Spacing">
          <Example
            title="lineHeight"
            note="Left is default, right is 30. Compare the gap between wrapped lines."
            code={'lineHeight: 30'}
          >
            <View style={twoUp}>
              <Text class="soft" style={col}>
                {sample}
              </Text>
              <Text class="soft" style={colLoose}>
                {sample}
              </Text>
            </View>
          </Example>
          <Example title="letterSpacing" code={'letterSpacing: 2'}>
            <Text class="ink" style={tracked}>
              Widely tracked heading
            </Text>
            <Text class="ink" style={tightTracked}>
              Tightly tracked heading
            </Text>
          </Example>
        </Section>

        <Section title="Alignment and truncation">
          <Example title="textAlign" code={"textAlign: 'left' | 'center' | 'right' | 'justify'"}>
            <For each={alignments}>
              {(align) => (
                <>
                  <Text class="soft" style={{ fontSize: 14, textAlign: align }}>
                    {align} - {sample}
                  </Text>{' '}
                </>
              )}
            </For>
          </Example>
          <Example
            title="numberOfLines"
            note="Truncation happens in native layout, so the ellipsis lands where the platform
                would put it rather than where a JavaScript guess would."
            code={'numberOfLines={1} and 2'}
          >
            <Text class="body" numberOfLines={1}>
              {sample}
            </Text>
            <Text class="body" numberOfLines={2}>
              {sample}
            </Text>
          </Example>
          <Example title="ellipsizeMode: head" code={'ellipsizeMode="head"'}>
            <Text class="body" numberOfLines={1} ellipsizeMode="head">
              {sample}
            </Text>
          </Example>
        </Section>

        <Section title="Decoration and transform">
          <Example title="textDecorationLine" code={"textDecorationLine: 'underline'"}>
            <Text class="ink" style={underline}>
              Underlined
            </Text>
            <Text class="muted" style={strike}>
              Struck through
            </Text>
          </Example>
          <Example
            title="textTransform"
            note="Applied by the platform, so it follows the locale's casing rules rather than
                JavaScript's."
            code={"textTransform: 'uppercase' | 'capitalize'"}
          >
            <Text class="ink" style={upper}>
              shouted quietly
            </Text>
            <Text class="ink" style={caps}>
              each word capitalised
            </Text>
          </Example>
        </Section>

        <Section title="Nesting" note="Text inside text inherits and continues the same line.">
          <Example
            title="Inherited style"
            note="The inner spans keep the outer size and only change what they name."
            code={'<Text><Text style={bold}>...</Text></Text>'}
          >
            <Text class="soft" style={paragraph}>
              A sentence with{' '}
              <Text class="ink" style={strong}>
                bold
              </Text>{' '}
              and <Text class="link">coloured</Text> words set inside it, wrapping as one paragraph
              rather than as three boxes.
            </Text>
          </Example>
          <Example
            title="A view cannot be text"
            note="The pill is a view inside text, which native lays out as an inline block. It does
                not inherit the font."
            code={'<Text><View /></Text>'}
          >
            <Text class="soft" style={paragraph}>
              Before the pill <View style={pill}></View> and after it, still one line box.
            </Text>
          </Example>
        </Section>

        <Section title="Selection and interaction">
          <Example
            title="selectable"
            note="Long-press to select. Off by default, because on native it changes what a
                long-press means."
            code={'selectable={true}'}
          >
            <Text class="body" selectable={true}>
              Long-press to select this line.
            </Text>
          </Example>
          <Example title="A tap handler on text" code={'onPress'}>
            <Text
              class="link"
              accessibilityLabel="Typography tap counter"
              style={link}
              onPress={() => setTaps(taps() + 1)}
            >
              Tapped {taps()} times
            </Text>
          </Example>
        </Section>
      </ScrollView>
    </>
  ));
}
