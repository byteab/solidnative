/** @jsxImportSource @solid-native/platform/solid */
import {
  createEffect,
  createMemo,
  createSignal,
  getOwner,
  runWithOwner,
  onCleanup,
} from 'solid-js';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollViewRef,
} from '@solid-native/components/solid';
import { SCREEN_IN_FRONT, Screen, useService } from '@solid-native/device/solid';
import { For, setNativeStyleHost, withNativeStyles } from '@solid-native/platform/solid';
import { useNavigation, useRoute } from '@solid-native/router/solid';
import { GestureRoot, NativeGesture } from '@solid-native/components/solid/gestures';
import { Gesture } from 'react-native-gesture-handler';
import type { NativeSyntheticEvent } from '@solid-native/fabric';
import { PHOTOS } from './photos.solid.ts';
import sheet from './photo-viewer.native.css';

export function PhotoViewer() {
  const nav = useNavigation(),
    screen = useService(Screen),
    route = useRoute(),
    front = useService(SCREEN_IN_FRONT);
  const owner = getOwner();
  const photos = PHOTOS,
    pages = new Map<number, ScrollViewRef>(),
    zoomed = new Set<number>();
  const normalize = (value: unknown) => {
    const index = Number(value);
    return Number.isFinite(index) ? Math.max(0, Math.min(PHOTOS.length - 1, Math.trunc(index))) : 0;
  };
  const [current, setCurrent] = createSignal(normalize(route.inputs['index']));
  createEffect(() => setCurrent(normalize(route.inputs['index'])));
  const pageSize = createMemo(() => {
    const { width, height } = screen.window();
    return { width, height };
  });
  const start = () => ({ x: current() * pageSize().width, y: 0 });
  let active = true;
  onCleanup(() => {
    active = false;
    pages.clear();
    zoomed.clear();
  });
  const gestureOwner = createMemo(() => {
    front();
    let live = true;
    onCleanup(() => {
      live = false;
    });
    return () => live && active && front();
  });
  const toggleZoom = (index: number, x: number, y: number) => {
    if (!active || !front()) return;
    const page = pages.get(index);
    if (!page) return;
    const { width, height } = pageSize();
    if (zoomed.has(index)) {
      page.zoomToRect({ x: 0, y: 0, width, height });
      zoomed.delete(index);
    } else {
      page.zoomToRect({
        x: x - width / 6,
        y: y - height / 6,
        width: width / 3,
        height: height / 3,
      });
      zoomed.add(index);
    }
  };
  const doubleTap = (index: number) => {
    const owns = gestureOwner();
    return front()
      ? Gesture.Tap()
          .numberOfTaps(2)
          .runOnJS(true)
          .onEnd((event) => {
            if (owns()) toggleZoom(index, event.x, event.y);
          })
      : null;
  };
  const onZoom = (index: number, event: NativeSyntheticEvent<{ zoomScale?: number }>) => {
    if (!active || !front()) return;
    if ((event.nativeEvent?.zoomScale ?? 1) > 1.01) zoomed.add(index);
    else zoomed.delete(index);
  };
  const onPaged = (event: NativeSyntheticEvent<{ contentOffset?: { x?: number } }>) => {
    if (!active || !front()) return;
    const { width, height } = pageSize();
    if (!width) return;
    const next = normalize(Math.round((event.nativeEvent?.contentOffset?.x ?? 0) / width)),
      left = current();
    if (next === left) return;
    if (zoomed.has(left)) {
      // Changing the pager offset replaces its property effect; commands belong to the screen owner.
      runWithOwner(owner, () => pages.get(left)?.zoomToRect({ x: 0, y: 0, width, height }, false));
      zoomed.delete(left);
    }
    setCurrent(next);
  };
  const close = () => {
    void nav.back();
  };
  return withNativeStyles(sheet, () => (
    <view style={{ flex: 1 }} ref={(node) => setNativeStyleHost(node, sheet)}>
      <GestureRoot>
        <View class="viewer">
          <ScrollView
            horizontal={true}
            pagingEnabled={true}
            showsHorizontalScrollIndicator={false}
            contentOffset={start()}
            onMomentumScrollEnd={(event) => {
              onPaged(event);
            }}
          >
            <For each={photos}>
              {(photo, i) => (
                <>
                  <ScrollView
                    style={pageSize()}
                    minimumZoomScale={1}
                    maximumZoomScale={4}
                    centerContent={true}
                    bouncesZoom={true}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    nativeID={'page-' + i()}
                    onScroll={(event) => {
                      onZoom(i(), event);
                    }}
                    ref={(page) => pages.set(i(), page)}
                  >
                    <View collapsable={false} ref={NativeGesture(() => doubleTap(i()))}>
                      <Image
                        resizeMode="contain"
                        style={pageSize()}
                        source={{ uri: photo.uri }}
                        accessibilityLabel={photo.title}
                      ></Image>
                    </View>
                  </ScrollView>
                </>
              )}
            </For>
          </ScrollView>
          <View class="bar">
            <Text class="label">
              {current() + 1}
              {' of '}
              {photos.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                close();
              }}
            >
              <Text class="label">{'Done'}</Text>
            </Pressable>
          </View>
        </View>
      </GestureRoot>
    </view>
  ));
}
