/** @jsxImportSource @solidnative/platform/solid */
import { Pressable, ScrollView, Text, View } from '@solidnative/components/solid';
import { useService } from '@solidnative/device/solid';
import { For, Show, setNativeStyleHost, withNativeStyles } from '@solidnative/platform/solid';
import { NativeHeader, useNavigation } from '@solidnative/router/solid';
import { Playback, TRACKS } from './player-model.solid.ts';
import sheet from './player-page.native.css';

export function PlayerPage() {
  const playback = useService(Playback),
    nav = useNavigation();
  const tracks = TRACKS,
    content = { paddingBottom: 120 };
  const progress = () => {
    const { currentTime, duration } = playback.state();
    return duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  };
  const open = () => {
    void nav.present('/player/now', { as: 'pageSheet' });
  };
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <NativeHeader title="Listen Now" largeTitle={true}></NativeHeader>
      <View class="page">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          class="library"
          contentContainerStyle={content}
        >
          <View class="hero">
            <Text class="eyebrow">{'Tonight'}</Text>
            <Text class="hero-title">{'Late-night jazz, hand-picked'}</Text>
            <Text class="hero-hint">{'Eight records to put on after dark'}</Text>
          </View>
          <Text class="section">{'Records'}</Text>
          <View class="grid">
            <For each={tracks}>
              {(track, i) => (
                <>
                  <Pressable
                    accessibilityRole="button"
                    class="tile"
                    accessibilityLabel={track.title + ' by ' + track.artist}
                    style={{ '--cover': track.colour }}
                    onPress={() => {
                      playback.playTrack(i());
                    }}
                  >
                    <View class="cover">
                      <Text class="cover-initial">{track.title[0]}</Text>
                      <Show when={playback.index() === i() && playback.playing()}>
                        <View accessibilityLabel="Playing" class="bars">
                          <View class="bar one"></View>
                          <View class="bar two"></View>
                          <View class="bar three"></View>
                        </View>
                      </Show>
                    </View>
                    <Text class="tile-title">{track.title}</Text>
                    <Text class="tile-artist">{track.artist}</Text>
                  </Pressable>
                </>
              )}
            </For>
          </View>
        </ScrollView>
        <Show when={playback.track()}>
          {(track) => (
            <>
              <Pressable
                accessibilityRole="button"
                class="mini"
                accessibilityLabel={'Now playing, ' + track().title}
                style={{ '--cover': track().colour }}
                onPress={() => {
                  open();
                }}
              >
                <View class="mini-cover">
                  <Text class="mini-initial">{track().title[0]}</Text>
                </View>
                <View class="mini-text">
                  <Text class="mini-title">{track().title}</Text>
                  <Text class="mini-artist">{track().artist}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  class="mini-toggle"
                  accessibilityLabel={playback.playing() ? 'Pause' : 'Play'}
                  onPress={() => {
                    playback.toggle();
                  }}
                >
                  <Text class="mini-glyph">{playback.playing() ? '❚❚' : '▶'}</Text>
                </Pressable>
                <View class="mini-progress" style={{ width: `${progress()}%` }}></View>
              </Pressable>
            </>
          )}
        </Show>
      </View>
    </view>
  ));
}
