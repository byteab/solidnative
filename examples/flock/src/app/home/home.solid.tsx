/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal } from 'solid-js';
import { Pressable, View, VirtualList } from '@solid-native/components/solid';
import { ExpoGlass, liquidGlassAvailable } from '@solid-native/expo/solid';
import { Haptics } from '@solid-native/expo/solid/haptics';
import { useService } from '@solid-native/device/solid';
import { Show } from '@solid-native/platform/solid';
import {
  NativeHeader,
  NativeHeaderItem,
  NativeStackOutlet,
  TabSafeAreaView,
  useNavigation,
} from '@solid-native/router/solid';
import { accent, refresh, timeline } from '../flock.solid.ts';
import { openCompose, openSettings } from '../sheets.solid.ts';
import { Glyph } from '../ui/glyph.solid.tsx';
import { PostRow } from '../ui/post-row.solid.tsx';
import { Segments } from '../ui/segments.solid.tsx';

/** Floats over the feed and stays put as posts are pushed: Liquid Glass where iOS has it. */
function ComposeButton() {
  const navigation = useNavigation();
  const haptics = useService(Haptics);
  const press = () => {
    haptics.impact('light');
    openCompose(navigation);
  };
  const glyph = <Glyph name="plus" size={26} color="#ffffff" />;
  return (
    <View class="absolute right-4 bottom-0">
      <TabSafeAreaView edges={['bottom']}>
        <Show
          when={liquidGlassAvailable()}
          fallback={
            <Pressable
              class="mb-4 size-14 items-center justify-center shadow-lg ios:rounded-full android:rounded-2xl active:opacity-80"
              style={{ backgroundColor: accent() }}
              accessibilityRole="button"
              accessibilityLabel="New post"
              onPress={press}
            >
              {glyph}
            </Pressable>
          }
        >
          <Pressable accessibilityRole="button" accessibilityLabel="New post" onPress={press}>
            <ExpoGlass
              class="mb-3 size-15 items-center justify-center rounded-full"
              glassEffectStyle="regular"
              tintColor={accent()}
              isInteractive
            >
              {glyph}
            </ExpoGlass>
          </Pressable>
        </Show>
      </TabSafeAreaView>
    </View>
  );
}

export function HomeStack() {
  return (
    <>
      <NativeStackOutlet />
      <ComposeButton />
    </>
  );
}

export function Home() {
  const navigation = useNavigation();
  const haptics = useService(Haptics);
  const [feed, setFeed] = createSignal(0);
  const [refreshing, setRefreshing] = createSignal(false);
  const posts = createMemo(() => timeline(feed() === 1));
  const pull = () => {
    setRefreshing(true);
    setTimeout(() => {
      refresh();
      setRefreshing(false);
      haptics.notify('success');
    }, 1100);
  };
  return (
    <>
      <NativeHeader title="Flock">
        <NativeHeaderItem type="right">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
            onPress={() => openSettings(navigation)}
          >
            <Glyph name="gearshape" size={20} color={accent()} />
          </Pressable>
        </NativeHeaderItem>
      </NativeHeader>
      <VirtualList
        testID="timeline"
        class="flex-1 bg-white dark:bg-black"
        contentInsetAdjustmentBehavior="automatic"
        items={posts()}
        estimatedItemHeight={140}
        keyExtractor={(post) => post.id}
        listHeader={
          <Segments values={['For you', 'Following']} index={feed()} onChange={setFeed} />
        }
        listFooter={<View class="h-32" />}
        refreshControl={{
          get refreshing() {
            return refreshing();
          },
          onRefresh: pull,
          get tintColor() {
            return accent();
          },
        }}
        renderItem={(post) => <PostRow post={post()} />}
      />
    </>
  );
}
