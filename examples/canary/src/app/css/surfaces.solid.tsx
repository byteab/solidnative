/** @jsxImportSource @solid-native/platform/solid */
import { createSignal } from 'solid-js';
import { View, Text, ScrollView, Pressable } from '@solid-native/components/solid';
import { NativeHeader } from '@solid-native/router/solid';
import { Example, Section } from '../example.solid.tsx';
import { page } from '../screen-styles.ts';
import sheet from './surfaces.native.css';
import { For, withNativeStyles } from '@solid-native/platform/solid';

export function SurfacesPage() {
  const radii = [0, 6, 16, 999];
  const opacities = [1, 0.6, 0.25];
  const [held, setHeld] = createSignal(false);

  const row = { flexDirection: 'row', gap: 10, alignItems: 'center' };
  const tallRow = { flexDirection: 'row', gap: 24, height: 90, alignItems: 'center' };

  const swatch = { width: 56, height: 56, borderRadius: 8 };
  const solid = { ...swatch, borderWidth: 2, borderColor: '#3b6ef5' };
  const dashed = {
    ...swatch,
    borderWidth: 2,
    borderColor: '#c83ca0',
    borderStyle: 'dashed',
  };
  const dotted = {
    ...swatch,
    borderWidth: 2,
    borderColor: '#2fbf9f',
    borderStyle: 'dotted',
  };

  const accentEdge = {
    borderLeftWidth: 4,
    borderLeftColor: '#3b6ef5',
    borderBottomWidth: 1,
    paddingLeft: 12,
    paddingVertical: 8,
  };
  const rule = { height: 1 };
  const onePx = { height: 1, backgroundColor: '#78788c' };

  const bubble = {
    width: 140,
    height: 56,
    backgroundColor: '#3b6ef5',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
  };

  const shadowRow = { flexDirection: 'row', gap: 16, paddingVertical: 10 };
  const cardBase = {
    width: 96,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const card = {
    ...cardBase,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  };
  const cardHard = {
    ...cardBase,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 1,
    elevation: 2,
  };

  const rot15 = {
    ...swatch,
    backgroundColor: '#3b6ef5',
    transform: [{ rotate: '15deg' }],
  };
  const rot45 = {
    ...swatch,
    backgroundColor: '#c83ca0',
    transform: [{ rotate: '45deg' }],
  };
  const scaled = {
    ...swatch,
    backgroundColor: '#2fbf9f',
    transform: [{ scale: 1.3 }],
  };
  const plain = swatch;
  const shifted = {
    ...swatch,
    backgroundColor: '#3b6ef5',
    transform: [{ translateX: 30 }, { translateY: -8 }],
  };
  const rotThenMove = {
    ...swatch,
    backgroundColor: '#3b6ef5',
    transform: [{ rotate: '45deg' }, { translateX: 30 }],
  };
  const moveThenRot = {
    ...swatch,
    backgroundColor: '#c83ca0',
    transform: [{ translateX: 30 }, { rotate: '45deg' }],
  };

  const overlayHost = { height: 90, borderRadius: 10, overflow: 'hidden' };
  const overlayBase = { position: 'absolute', inset: 0, backgroundColor: '#2fbf9f' };
  const overlayTint = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const pressed = {
    backgroundColor: '#2748a8',
    transform: [{ scale: 0.97 }],
  };

  return withNativeStyles(sheet, () => (
    <>
      <NativeHeader title="Surfaces" />
      <ScrollView class="screen" contentContainerStyle={page.content}>
        <Text class="hint"> How a view is drawn, rather than where it is put. </Text>

        <Section title="Borders">
          <Example title="Width, colour, style" code={'borderWidth, borderColor, borderStyle'}>
            <View style={row}>
              <View style={solid}></View>
              <View style={dashed}></View>
              <View style={dotted}></View>
            </View>
          </Example>
          <Example
            title="One edge at a time"
            note="Per-side widths and colours, which is how a divider or a leading accent is drawn."
            code={'borderLeftWidth: 4, borderBottomWidth: 1'}
          >
            <View class="edge" style={accentEdge}>
              <Text class="body">A leading accent</Text>
            </View>
          </Example>
          <Example
            title="A hairline"
            note="The thinnest line the screen can draw. Beside the 1px rule below it, it should be
                visibly finer on a 2x or 3x screen."
            code={'borderBottomWidth: var(--hairline)'}
          >
            <View class="verify-hairline" style={rule}></View>
            <View style={onePx}></View>
            <Text class="hint">hairline above, 1px below</Text>
          </Example>
        </Section>

        <Section title="Corners">
          <Example title="borderRadius" code={'borderRadius: 0 | 6 | 16 | 999'}>
            <View style={row}>
              <For each={radii}>
                {(r) => (
                  <>
                    <View
                      style={{ width: 56, height: 56, backgroundColor: '#3b6ef5', borderRadius: r }}
                    ></View>{' '}
                  </>
                )}
              </For>
            </View>
          </Example>
          <Example
            title="Per-corner"
            note="The four corners take different radii, which is how a sheet or a chat bubble is
                shaped."
            code={'borderTopLeftRadius, borderBottomRightRadius'}
          >
            <View style={bubble}></View>
          </Example>
        </Section>

        <Section title="Depth">
          <Example
            title="Shadow"
            note="iOS draws the offset, radius and opacity; Android maps it onto an elevation, so
                the two are close rather than identical."
            code={'shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation'}
          >
            <View style={shadowRow}>
              <View class="tile" style={card}>
                <Text class="body">soft</Text>
              </View>
              <View class="tile" style={cardHard}>
                <Text class="body">hard</Text>
              </View>
            </View>
          </Example>
          <Example
            title="opacity"
            note="Applies to the whole subtree, including text inside it."
            code={'opacity: 1 | 0.6 | 0.25'}
          >
            <View style={row}>
              <For each={opacities}>
                {(o) => (
                  <>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        backgroundColor: '#c83ca0',
                        opacity: o,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text class="on-colour">{o}</Text>
                    </View>{' '}
                  </>
                )}
              </For>
            </View>
          </Example>
        </Section>

        <Section title="Transforms" note="Drawn transformed; the layout is unchanged.">
          <Example title="rotate" code={"transform: [{ rotate: '15deg' }]"}>
            <View style={row}>
              {' '}
              <View style={rot15}></View>
              <View style={rot45}></View>{' '}
            </View>
          </Example>
          <Example title="scale" code={'transform: [{ scale: 1.3 }]'}>
            <View style={tallRow}>
              <View style={scaled}></View>
            </View>
          </Example>
          <Example
            title="translate"
            note="The gap it leaves is the space it still occupies in the layout."
            code={'transform: [{ translateX: 30 }, { translateY: -8 }]'}
          >
            <View style={row}>
              <View class="tile" style={plain}></View>
              <View style={shifted}></View>
            </View>
          </Example>
          <Example
            title="Order matters"
            note="Rotate-then-translate and translate-then-rotate land in different places."
            code={'[{ rotate }, { translateX }] vs [{ translateX }, { rotate }]'}
          >
            <View style={tallRow}>
              <View style={rotThenMove}></View>
              <View style={moveThenRot}></View>
            </View>
          </Example>
        </Section>

        <Section title="Backgrounds">
          <Example
            title="A gradient"
            note="Compiled from CSS into the structure Fabric expects, not a library."
            code={'background-image: linear-gradient(to right, ...)'}
          >
            <View class="verify-gradient"></View>
          </Example>
          <Example
            title="A tinted overlay"
            note="A translucent view over content, which is the ordinary way to dim something."
            code={"backgroundColor: 'rgba(0, 0, 0, 0.55)'"}
          >
            <View style={overlayHost}>
              <View style={overlayBase}></View>
              <View style={overlayTint}>
                <Text class="on-colour">Dimmed</Text>
              </View>
            </View>
          </Example>
        </Section>

        <Section title="Feedback">
          <Example
            title="Pressed state"
            note="A press changes the style through a signal; there is no CSS :active on a native
                view."
            code={'(pressIn) / (pressOut)'}
          >
            <Pressable
              class="button"
              style={held() ? pressed : undefined}
              onPressIn={() => setHeld(true)}
              onPressOut={() => setHeld(false)}
            >
              <Text class="button-label">{held() ? 'Held' : 'Press and hold'}</Text>
            </Pressable>
          </Example>
        </Section>
      </ScrollView>
    </>
  ));
}
