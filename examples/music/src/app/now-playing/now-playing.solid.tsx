/** @jsxImportSource @solidnative/platform/solid */
import {
  Image,
  Pressable,
  SafeAreaProvider,
  SafeAreaView,
  Text,
  View,
} from '@solidnative/components/solid';
import { ColorScheme, useService } from '@solidnative/device/solid';
import { UiHost, UiSlider } from '@solidnative/expo/solid';
import { Icon } from '@solidnative/icons/solid';
import { Show } from '@solidnative/platform/solid';
import { useNavigation } from '@solidnative/router/solid';
import { album, formatDuration } from '../catalogue/catalogue.solid.ts';
import { Playback } from '../player/playback.solid.ts';

/**
 * The full player, presented as a sheet over whatever screen opened it (see mini-player-bar).
 * A presented screen has no native header and no automatic safe-area insets, so it owns both.
 */
export function NowPlaying() {
  const playback = useService(Playback);
  const scheme = useService(ColorScheme);
  const navigation = useNavigation();

  const currentAlbum = () => album(playback.current()?.albumId ?? '');
  const elapsed = () => formatDuration(playback.state().currentTime);
  const remaining = () => {
    const { currentTime, duration } = playback.state();
    return `-${formatDuration(Math.max(0, duration - currentTime))}`;
  };
  const dark = () => scheme.current() === 'dark';
  const ink = () => (dark() ? '#fafafa' : '#18181b');
  const onAccentInk = () => (dark() ? '#18181b' : '#fafafa');
  const accent = (active: boolean) => (active ? '#e11d48' : dark() ? '#71717a' : '#a1a1aa');

  return (
    <SafeAreaProvider reportInsets={false} style={{ flex: 1 }}>
      <SafeAreaView
        testID="now-playing"
        class="flex-1 bg-white dark:bg-black"
        edges={['top', 'bottom']}
      >
        <View class="flex-row items-center justify-between px-4 pt-2">
          <Pressable
            class="size-10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => void navigation.back()}
          >
            <Icon name="ChevronDown" size={24} color={ink()} />
          </Pressable>
          <Text class="text-xs font-semibold text-zinc-500 uppercase">Now playing</Text>
          <View class="size-10"></View>
        </View>

        <Show
          when={playback.current()}
          fallback={
            <View class="flex-1 items-center justify-center">
              <Text class="text-zinc-500">Nothing playing</Text>
            </View>
          }
        >
          {(track) => (
            <View class="flex-1 justify-center px-8">
              <Image
                source={currentAlbum()!.artwork}
                class="aspect-square w-full self-center rounded-3xl"
                resizeMode="cover"
              />

              <View class="mt-8">
                <Text class="text-2xl font-bold text-zinc-900 dark:text-white" numberOfLines={1}>
                  {track().title}
                </Text>
                <Text class="mt-1 text-base text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
                  {`${track().artist} · ${currentAlbum()!.title}`}
                </Text>
              </View>

              <UiHost class="mt-6" style={{ height: 40 }}>
                <UiSlider
                  value={playback.progress()}
                  accessibilityLabel="Seek"
                  onValueChanged={(event) =>
                    playback.seekTo(event.nativeEvent.value * playback.state().duration)
                  }
                />
              </UiHost>
              <View class="-mt-2 flex-row justify-between">
                <Text class="text-xs text-zinc-400">{elapsed()}</Text>
                <Text class="text-xs text-zinc-400">{remaining()}</Text>
              </View>

              <View class="mt-6 flex-row items-center justify-between">
                <Pressable
                  class="size-11 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Shuffle"
                  accessibilityState={{ selected: playback.shuffled() }}
                  onPress={() => playback.toggleShuffle()}
                >
                  <Icon name="Shuffle" size={20} color={accent(playback.shuffled())} />
                </Pressable>
                <Pressable
                  class="size-14 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Previous"
                  onPress={() => playback.previous()}
                >
                  <Icon name="SkipBack" size={28} color={ink()} />
                </Pressable>
                <Pressable
                  class="size-16 items-center justify-center rounded-full bg-zinc-900 active:opacity-80 dark:bg-white"
                  accessibilityRole="button"
                  accessibilityLabel={playback.playing() ? 'Pause' : 'Play'}
                  onPress={() => playback.toggle()}
                >
                  <Icon
                    name={playback.playing() ? 'Pause' : 'Play'}
                    size={26}
                    color={onAccentInk()}
                  />
                </Pressable>
                <Pressable
                  class="size-14 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Next"
                  onPress={() => playback.next()}
                >
                  <Icon name="SkipForward" size={28} color={ink()} />
                </Pressable>
                <Pressable
                  class="size-11 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Repeat"
                  accessibilityState={{ selected: playback.repeat() !== 'off' }}
                  onPress={() => playback.cycleRepeat()}
                >
                  <Icon
                    name={playback.repeat() === 'one' ? 'Repeat1' : 'Repeat'}
                    size={20}
                    color={accent(playback.repeat() !== 'off')}
                  />
                </Pressable>
              </View>
            </View>
          )}
        </Show>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
