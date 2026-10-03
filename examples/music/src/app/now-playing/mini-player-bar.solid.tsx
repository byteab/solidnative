/** @jsxImportSource @solidnative/platform/solid */
import { Image, Pressable, Text, View } from '@solidnative/components/solid';
import { ColorScheme, useService } from '@solidnative/device/solid';
import { Icon } from '@solidnative/icons/solid';
import { Show } from '@solidnative/platform/solid';
import { TabSafeAreaView, useNavigation } from '@solidnative/router/solid';
import { album } from '../catalogue/catalogue.solid.ts';
import { Playback } from '../player/playback.solid.ts';

/**
 * Docked above the tab bar on every tab, once a track has ever played. Tapping the artwork or
 * title opens Now Playing; the play/pause button works without leaving the current screen.
 *
 * Each tab places one, pinned to its bottom edge, and the tab safe-area view lifts it clear of
 * the bar by however tall the bar is on this device: the floating bar on iOS 26, the classic one
 * before it, the bottom navigation bar on Android. It has to be inside a tab to know.
 */
export function MiniPlayerBar() {
  const playback = useService(Playback);
  const scheme = useService(ColorScheme);
  const navigation = useNavigation();

  /** The skip icon: the ink of the scheme, or muted when there is nothing to skip to. */
  const skipColour = () => {
    const dark = scheme.current() === 'dark';
    if (!playback.hasNext()) return dark ? '#52525b' : '#a1a1aa';
    return dark ? '#fafafa' : '#18181b';
  };
  const open = () => {
    void navigation.present('/now-playing', {
      as: 'formSheet',
      presentation: { sheetAllowedDetents: [1], sheetGrabberVisible: true },
    });
  };

  return (
    <View class="absolute bottom-0 left-0 right-0">
      <Show when={playback.current()}>
        {(track) => (
          <TabSafeAreaView edges={['bottom']}>
            <View
              testID="mini-player"
              class="mx-3 mb-2 h-14 flex-row items-center gap-3 rounded-2xl bg-white/95 pr-3 pl-2 shadow-lg dark:bg-zinc-800/95"
            >
              <Pressable
                class="flex-1 flex-row items-center gap-3"
                accessibilityRole="button"
                accessibilityLabel={'Now playing: ' + track().title}
                onPress={open}
              >
                <Image
                  source={album(track().albumId)?.artwork}
                  class="size-10 rounded-lg"
                  resizeMode="cover"
                />
                <View class="flex-1">
                  <Text
                    class="text-sm font-semibold text-zinc-900 dark:text-white"
                    numberOfLines={1}
                  >
                    {track().title}
                  </Text>
                  <Text class="text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
                    {track().artist}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                class="size-9 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={playback.playing() ? 'Pause' : 'Play'}
                onPress={() => playback.toggle()}
              >
                <Icon name={playback.playing() ? 'Pause' : 'Play'} size={22} color="#e11d48" />
              </Pressable>
              <Pressable
                class="size-9 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Next"
                accessibilityState={{ disabled: !playback.hasNext() }}
                onPress={() => playback.next()}
              >
                <Icon name="SkipForward" size={20} color={skipColour()} />
              </Pressable>
            </View>
          </TabSafeAreaView>
        )}
      </Show>
    </View>
  );
}
