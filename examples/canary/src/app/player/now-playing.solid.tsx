/** @jsxImportSource @solid-native/platform/solid */
import { createMemo, createSignal, onCleanup } from 'solid-js';
import { Pressable, Text, View } from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solid-native/device/solid';
import { Show, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { useNavigation } from '@solid-native/router/solid';
import { GestureRoot, NativeGesture } from '@solid-native/components/solid/gestures';
import { Gesture } from 'react-native-gesture-handler';
import { Playback, clock, seekTarget } from './player-model.solid.ts';
import { UiHost, UiSlider } from '@solid-native/expo/solid';
import sheet from './now-playing.native.css';

export function NowPlaying() {
  const playback = useService(Playback),
    nav = useNavigation(),
    front = useService(SCREEN_IN_FRONT);
  const [width, setWidth] = createSignal(0),
    [dragging, setDragging] = createSignal(false),
    [dragTo, setDragTo] = createSignal<number | null>(null);
  const duration = createMemo(() => playback.state().duration),
    position = createMemo(() => dragTo() ?? playback.state().currentTime);
  const percent = () => (duration() > 0 ? Math.min(100, (position() / duration()) * 100) : 0);
  const elapsed = () => clock(position()),
    remaining = () => clock(duration() - position()),
    total = () => clock(duration());
  const scrub = createMemo(() => {
    playback.index();
    if (!front()) return null;
    let live = true;
    onCleanup(() => {
      live = false;
      setDragging(false);
      setDragTo(null);
    });
    const owns = () => live && front();
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((event) => {
        if (owns()) {
          setDragging(true);
          if (!owns()) return;
          setDragTo(seekTarget(event.x, width(), duration()));
        }
      })
      .onUpdate((event) => {
        if (owns()) setDragTo(seekTarget(event.x, width(), duration()));
      })
      .onFinalize(() => {
        if (!owns()) return;
        const to = dragTo();
        setDragTo(null);
        setDragging(false);
        if (to !== null && owns()) playback.seek(to);
      });
  });
  const scrubRef = NativeGesture(scrub);
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <GestureRoot>
        <Show
          when={playback.track()}
          fallback={
            <>
              <View class="now empty">
                <Text class="artist">{'Nothing is playing.'}</Text>
                <Pressable
                  accessibilityRole="button"
                  class="button"
                  onPress={() => {
                    nav.back();
                  }}
                >
                  <Text class="button-label">{'Close'}</Text>
                </Pressable>
              </View>
            </>
          }
        >
          {(track) => (
            <>
              <View class="now" style={{ '--cover': track().colour }}>
                <View class="grabber"></View>
                <View class="art-frame">
                  <View class={playback.playing() ? 'art playing' : 'art'}>
                    <Text class="art-initial">{track().title[0]}</Text>
                  </View>
                </View>
                <View class="meta">
                  <Text class="title">{track().title}</Text>
                  <Text class="artist">{track().artist}</Text>
                </View>
                <View
                  accessibilityRole="adjustable"
                  class="scrubber"
                  accessibilityLabel={'Position, ' + elapsed() + ' of ' + total()}
                  collapsable={false}
                  ref={scrubRef}
                  onLayout={(event) => {
                    setWidth(event.nativeEvent.layout.width);
                  }}
                >
                  <View class="rail">
                    <View class="fill" style={{ width: `${percent()}%` }}></View>
                  </View>
                  <View
                    class={dragging() ? 'thumb held' : 'thumb'}
                    style={{ left: `${percent()}%` }}
                  ></View>
                </View>
                <View class="times">
                  <Text class="time">{elapsed()}</Text>
                  <Text class="time">
                    {'-'}
                    {remaining()}
                  </Text>
                </View>
                <View class="transport">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous"
                    class="skip"
                    onPress={() => {
                      playback.previous();
                    }}
                  >
                    <Text class="skip-glyph">{'⏮'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    class="play"
                    accessibilityLabel={playback.playing() ? 'Pause' : 'Play'}
                    onPress={() => {
                      playback.toggle();
                    }}
                  >
                    <Text class="play-glyph">{playback.playing() ? '❚❚' : '▶'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next"
                    class="skip"
                    onPress={() => {
                      playback.next();
                    }}
                  >
                    <Text class="skip-glyph">{'⏭'}</Text>
                  </Pressable>
                </View>
                <View class="volume">
                  <Text class="volume-glyph">{'🔈'}</Text>
                  <UiHost class="volume-host" matchContents={{ vertical: true }}>
                    <UiSlider
                      value={playback.volume()}
                      min={0}
                      max={1}
                      onValueChanged={(event) => {
                        playback.setVolume(event.nativeEvent.value);
                      }}
                    ></UiSlider>
                  </UiHost>
                  <Text class="volume-glyph">{'🔊'}</Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Repeat"
                  class={playback.repeat() ? 'repeat on' : 'repeat'}
                  accessibilityState={{ checked: playback.repeat() }}
                  onPress={() => {
                    playback.setRepeat(!playback.repeat());
                  }}
                >
                  <Text class="repeat-label">{'Repeat'}</Text>
                </Pressable>
              </View>
            </>
          )}
        </Show>
      </GestureRoot>
    </view>
  ));
}
