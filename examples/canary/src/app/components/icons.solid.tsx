/** @jsxImportSource @solidnative/platform/solid */
import { createSignal } from 'solid-js';
import { For } from '@solidnative/platform/solid';
import { Compass, GraduationCap, Heart, Target, Waves, Zap } from 'lucide-static';
import { Icon, IconProvider } from '@solidnative/icons/solid';
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { NativeHeader } from '@solidnative/router/solid';
import { page } from '../screen-styles.ts';

/** Heroicons' solid `fire` and `star` (MIT), markup copied verbatim: filled, not stroked. */
const fireSolid =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-slot="icon"><path fill-rule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clip-rule="evenodd"></path></svg>';
const starSolid =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-slot="icon"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clip-rule="evenodd"></path></svg>';
const icons = { GraduationCap, Zap, Heart, Compass, Target, Waves, fireSolid, starSolid };
const outline = ['graduation-cap', 'zap', 'heart'],
  solid = ['fire-solid', 'star-solid'],
  mixed = ['compass', 'target', 'waves'];
const row = { flexDirection: 'row', gap: 16, alignItems: 'center' },
  grow = { flex: 1 };
const colours = ['#ff9f0a', '#32d74b', '#0a84ff', '#8a5cf6'];
export function IconsPage() {
  const [size, setSize] = createSignal(32),
    [weight, setWeight] = createSignal(1.5),
    [color, setColor] = createSignal('#ff9f0a');
  return (
    <IconProvider icons={icons}>
      <NativeHeader title="Icons" largeTitle />
      <ScrollView
        class="screen"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={page.content}
      >
        <Text class="hint">
          The same lucide-static strings a web app uses, drawn as react-native-svg shapes. Nothing
          here is an image: every stroke is a native path.
        </Text>
        <Text class="heading">Outline, stroked</Text>
        <View style={row}>
          <For each={outline}>
            {(name) => <Icon name={name} size={size()} color={color()} strokeWidth={weight()} />}
          </For>
        </View>
        <Text class="heading">Solid, filled</Text>
        <View style={row}>
          <For each={solid}>{(name) => <Icon name={name} size={size()} color={color()} />}</For>
        </View>
        <Text class="heading">Geometry, same component</Text>
        <View style={row}>
          <For each={mixed}>
            {(name) => <Icon name={name} size={size()} color={color()} strokeWidth={weight()} />}
          </For>
        </View>
        <Text class="heading">Bound, not baked</Text>
        <Text class="body">
          {size()}pt, stroke {weight()}, {color()}
        </Text>
        <View style={page.row}>
          <Pressable
            class="card"
            style={grow}
            onPress={() => setSize((value) => (value >= 56 ? 24 : value + 8))}
          >
            <Text class="button-label">Size</Text>
          </Pressable>
          <Pressable
            class="card"
            style={grow}
            onPress={() => setWeight((value) => (value >= 3 ? 1 : value + 0.5))}
          >
            <Text class="button-label">Weight</Text>
          </Pressable>
          <Pressable
            class="card"
            style={grow}
            onPress={() => setColor((value) => colours[(colours.indexOf(value) + 1) % 4]!)}
          >
            <Text class="button-label">Colour</Text>
          </Pressable>
        </View>
        <Text class="hint">
          Colour changes without re-parsing anything: currentColor is a brush native resolves from
          the view, so the icon keeps the shapes it already committed.
        </Text>
      </ScrollView>
    </IconProvider>
  );
}
