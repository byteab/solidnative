/** @jsxImportSource @solid-native/platform/solid */
import { Pressable, ScrollView, Text, View } from '@solid-native/components/solid';
import { NativeHeader, NativeHeaderItem } from '@solid-native/router/solid';
import { page } from '../screen-styles.ts';
import { For } from '@solid-native/platform/solid';
import { createSignal } from 'solid-js';

export function Header() {
  const item = { paddingHorizontal: 6 };
  const action = { color: '#3b6ef5', fontSize: 18, fontWeight: '600' };
  const [large, setLarge] = createSignal(false);
  const [shadow, setShadow] = createSignal(true);
  const [translucent, setTranslucent] = createSignal(false);
  const [tinted, setTinted] = createSignal(false);
  const [starred, setStarred] = createSignal(false);
  const star = () => setStarred((on) => !on);
  const filler = Array.from({ length: 20 }, (_, i) => `scroll me, line ${i + 1}`);
  return (
    <>
      <NativeHeader
        title="Header"
        backTitle="Back"
        largeTitle={large()}
        hideShadow={!shadow()}
        translucent={translucent()}
        titleColor={tinted() ? '#3b6ef5' : undefined}
        color={tinted() ? '#f5a03b' : undefined}
      >
        <NativeHeaderItem type="right">
          <Pressable
            style={item}
            onPress={() => {
              star();
            }}
            accessibilityRole="button"
            accessibilityLabel="Star this page"
            accessibilityState={{ selected: starred() }}
          >
            <Text style={action}>{starred() ? '★' : '☆'}</Text>
          </Pressable>
          <Pressable
            style={item}
            onPress={() => {
              setLarge(!large());
            }}
            accessibilityRole="button"
            accessibilityLabel="Toggle the large title"
          >
            <Text style={action}>Aa</Text>
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>

      <ScrollView
        class="screen"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={page.content}
      >
        <Text class="hint">
          The title is inline by default, which is the plain UIKit navigation bar. A large title
          collapses into it as this list scrolls, so scroll up to watch it happen.
        </Text>

        <View style={page.row}>
          <Text class="body">Starred:</Text>
          <Text class="strong">{starred() ? 'yes' : 'no'}</Text>
          <Text class="hint">tap the star in the bar</Text>
        </View>

        <Pressable
          class="button"
          onPress={() => {
            setLarge(!large());
          }}
        >
          <Text class="button-label">{large() ? 'inline title' : 'large title'}</Text>
        </Pressable>

        <Pressable
          class="card"
          onPress={() => {
            setShadow(!shadow());
          }}
        >
          <Text class="button-label">{shadow() ? 'hide the hairline' : 'show the hairline'}</Text>
        </Pressable>

        <Pressable
          class="card"
          onPress={() => {
            setTranslucent(!translucent());
          }}
        >
          <Text class="button-label">{translucent() ? 'opaque bar' : 'translucent bar'}</Text>
        </Pressable>

        <Pressable
          class="card"
          onPress={() => {
            setTinted(!tinted());
          }}
        >
          <Text class="button-label">{tinted() ? 'default colours' : 'tint the bar'}</Text>
        </Pressable>

        <Text class="hint">
          Two pressables share one right-hand item: a header item lays its children out in a row, so
          several actions fit in one slot. A left item would replace the back button, and a back
          item replaces just the chevron, which needs backButtonInCustomView on the header.
        </Text>

        <For each={filler}>{(row) => <Text class="hint">{row}</Text>}</For>
      </ScrollView>
    </>
  );
}
