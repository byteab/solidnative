/** @jsxImportSource @solidnative/platform/solid */
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Pressable, Text, TextInput, View } from '@solidnative/components/solid';
import { SCREEN_IN_FRONT, useService } from '@solidnative/device/solid';
import {
  For,
  useHostAdapter,
  setNativeStyleHost,
  withNativeStyles,
} from '@solidnative/platform/solid';
import { useNavigation } from '@solidnative/router/solid';
import { GestureRoot, NativeGesture } from '@solidnative/components/solid/gestures';
import { Gesture } from 'react-native-gesture-handler';
import { Viewer } from './stories-model.solid.ts';
export const SLIDE_MS = 5000;
import sheet from './story-viewer.native.css';

export function StoryViewer() {
  const viewer = useService(Viewer),
    nav = useNavigation(),
    front = useService(SCREEN_IN_FRONT);
  const [held, setHeld] = createSignal(false),
    [drag, setDrag] = createSignal(0);
  let active = true;
  onCleanup(() => {
    active = false;
  });
  const close = () => {
    if (!active || !front()) return;
    setDrag(0);
    void nav.back();
  };
  const advance = () => {
    if (active && front() && !viewer.next()) close();
  };
  const progressOwner = createMemo(() => {
    viewer.place();
    front();
    let live = true;
    onCleanup(() => {
      live = false;
    });
    return () => live && active && front();
  });
  const progressEnd = (id: string) => {
    const owns = progressOwner();
    return () => {
      if (owns() && !held() && viewer.slide().id === id) advance();
    };
  };
  const swipe = createMemo(() => {
    if (!front()) {
      setHeld(false);
      setDrag(0);
      return null;
    }
    let live = true;
    onCleanup(() => {
      live = false;
    });
    const owns = () => live && active && front();
    return Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY(14)
      .failOffsetX([-20, 20])
      .onUpdate((event) => {
        if (owns()) setDrag(Math.max(0, event.translationY));
      })
      .onEnd((event) => {
        if (!owns()) return;
        if (event.translationY > 140 || event.velocityY > 900) close();
        else setDrag(0);
      });
  });
  const swipeRef = NativeGesture(swipe);
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <GestureRoot>
        <View
          class={['viewer', drag() > 0 && 'dragging'].filter(Boolean).join(' ')}
          collapsable={false}
          ref={swipeRef}
          style={{
            transform: 'translateY(' + drag() + 'px)',
            '--from': viewer.slide().from,
            '--to': viewer.slide().to,
          }}
        >
          <View class="slide" accessibilityLabel={viewer.slide().caption} accessible={true}>
            <Text class="glyph">{viewer.slide().glyph}</Text>
            <Text class="caption">{viewer.slide().caption}</Text>
          </View>
          <View class="top">
            <View class={['bars', (held() || !front()) && 'held'].filter(Boolean).join(' ')}>
              <For each={viewer.story().slides}>
                {(one, i) => (
                  <>
                    <View class="bar">
                      <ProgressFill
                        class={
                          i() < viewer.place().slide
                            ? 'fill done'
                            : i() === viewer.place().slide
                              ? 'fill running'
                              : 'fill'
                        }
                        onAnimationEnd={progressEnd(one.id)}
                      />
                    </View>
                  </>
                )}
              </For>
            </View>
            <View class="who">
              <View class="avatar">
                <Text class="initial">{viewer.story().initial}</Text>
              </View>
              <Text class="name">{viewer.story().name}</Text>
              <Text class="when">{held() ? 'Paused' : '2h'}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                class="close"
                onPress={() => {
                  close();
                }}
              >
                <Text class="close-glyph">{'✕'}</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous"
            class="zone back"
            onPressIn={() => {
              if (active && front()) setHeld(true);
            }}
            onPressOut={() => {
              if (active && front()) setHeld(false);
            }}
            onLongPress={() => undefined}
            onPress={() => {
              if (active && front()) viewer.previous();
            }}
          ></Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next"
            class="zone forward"
            onPressIn={() => {
              if (active && front()) setHeld(true);
            }}
            onPressOut={() => {
              if (active && front()) setHeld(false);
            }}
            onLongPress={() => undefined}
            onPress={() => {
              advance();
            }}
          ></Pressable>
          <View class="reply">
            <TextInput
              placeholder="Send message"
              placeholderTextColor="rgba(255,255,255,0.7)"
              accessibilityLabel="Send message"
              class="reply-field"
            ></TextInput>
          </View>
        </View>
      </GestureRoot>
    </view>
  ));
}

/** CSS animation completion uses the host event, not a native view callback prop. */
function ProgressFill(props: { class: string; onAnimationEnd: () => void }) {
  const host = useHostAdapter();
  const node = View({
    get class() {
      return props.class;
    },
  });
  createEffect(() => {
    const complete = props.onAnimationEnd;
    let live = true;
    const remove = host.engine.setEventListener(node, 'topAnimationend', () => {
      if (live) complete();
    });
    onCleanup(() => {
      live = false;
      remove();
    });
  });
  return node;
}
